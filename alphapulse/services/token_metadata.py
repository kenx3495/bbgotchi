"""
AlphaPulse Token Metadata Service
Fetches on-chain token data: supply, market cap, liquidity, holder distribution
"""

import asyncio
from typing import Optional
from dataclasses import dataclass
from datetime import datetime

import httpx
from solana.rpc.async_api import AsyncClient
from solders.pubkey import Pubkey

from alphapulse.config import settings
from alphapulse.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class TokenMetadata:
    """Complete token metadata from chain"""
    contract_address: str
    name: Optional[str] = None
    symbol: Optional[str] = None
    decimals: int = 9
    total_supply: float = 0.0
    circulating_supply: float = 0.0

    # Market data
    price_usd: float = 0.0
    price_sol: float = 0.0
    market_cap_usd: float = 0.0
    market_cap_sol: float = 0.0
    fdv_usd: float = 0.0  # Fully diluted valuation

    # Liquidity
    liquidity_usd: float = 0.0
    liquidity_sol: float = 0.0
    pool_address: Optional[str] = None

    # Holder distribution (for conviction analysis)
    holder_count: int = 0
    top_10_holder_pct: float = 0.0  # % held by top 10 wallets

    # Risk indicators
    is_mintable: bool = False
    is_freezable: bool = False
    lp_burned_pct: float = 0.0

    # Timing
    created_at: Optional[datetime] = None
    fetched_at: datetime = None

    def __post_init__(self):
        if self.fetched_at is None:
            self.fetched_at = datetime.utcnow()


class TokenMetadataService:
    """
    Fetches comprehensive token metadata from multiple sources:
    1. Helius DAS API (Digital Asset Standard) - token info
    2. Jupiter Price API - current price
    3. Birdeye API (optional) - detailed analytics
    4. On-chain RPC - supply and authority checks
    """

    JUPITER_PRICE_API = "https://price.jup.ag/v6/price"
    HELIUS_DAS_URL = "https://mainnet.helius-rpc.com/?api-key="
    BIRDEYE_API = "https://public-api.birdeye.so"

    def __init__(self, helius_api_key: str = None, birdeye_api_key: str = None):
        self.helius_api_key = helius_api_key or settings.helius_api_key
        self.birdeye_api_key = birdeye_api_key
        self.rpc_url = f"{settings.helius_rpc_url}/?api-key={self.helius_api_key}"

    async def get_token_metadata(self, contract_address: str) -> TokenMetadata:
        """
        Fetch complete token metadata from all available sources

        Args:
            contract_address: Solana token mint address

        Returns:
            TokenMetadata with all available fields populated
        """
        metadata = TokenMetadata(contract_address=contract_address)

        # Fetch from multiple sources in parallel
        tasks = [
            self._fetch_helius_asset(contract_address),
            self._fetch_jupiter_price(contract_address),
            self._fetch_supply_info(contract_address),
        ]

        if self.birdeye_api_key:
            tasks.append(self._fetch_birdeye_data(contract_address))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Merge results
        helius_data, jupiter_data, supply_data = results[:3]
        birdeye_data = results[3] if len(results) > 3 else None

        # Apply Helius DAS data
        if isinstance(helius_data, dict):
            metadata.name = helius_data.get('name')
            metadata.symbol = helius_data.get('symbol')
            metadata.decimals = helius_data.get('decimals', 9)
            metadata.is_mintable = helius_data.get('is_mintable', False)
            metadata.is_freezable = helius_data.get('is_freezable', False)

        # Apply Jupiter price data
        if isinstance(jupiter_data, dict):
            metadata.price_usd = jupiter_data.get('price_usd', 0)
            metadata.price_sol = jupiter_data.get('price_sol', 0)

        # Apply supply data
        if isinstance(supply_data, dict):
            metadata.total_supply = supply_data.get('total_supply', 0)
            metadata.circulating_supply = supply_data.get('circulating_supply', 0)

        # Apply Birdeye data (most comprehensive)
        if isinstance(birdeye_data, dict):
            metadata.market_cap_usd = birdeye_data.get('mc', 0)
            metadata.liquidity_usd = birdeye_data.get('liquidity', 0)
            metadata.holder_count = birdeye_data.get('holder', 0)
            metadata.fdv_usd = birdeye_data.get('fdv', 0)

        # Calculate derived fields
        if metadata.price_usd > 0 and metadata.total_supply > 0:
            metadata.market_cap_usd = metadata.price_usd * metadata.circulating_supply
            metadata.fdv_usd = metadata.price_usd * metadata.total_supply

        # Convert USD to SOL (approximate using SOL price)
        sol_price = await self._get_sol_price()
        if sol_price > 0:
            metadata.market_cap_sol = metadata.market_cap_usd / sol_price
            metadata.liquidity_sol = metadata.liquidity_usd / sol_price

        logger.debug(f"Fetched metadata for {contract_address[:8]}...: mcap=${metadata.market_cap_usd:.0f}")
        return metadata

    async def _fetch_helius_asset(self, mint: str) -> dict:
        """Fetch token info from Helius DAS API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.HELIUS_DAS_URL}{self.helius_api_key}",
                    json={
                        "jsonrpc": "2.0",
                        "id": "alphapulse",
                        "method": "getAsset",
                        "params": {"id": mint}
                    },
                    timeout=10
                )
                data = response.json()
                result = data.get('result', {})

                # Extract from DAS format
                content = result.get('content', {})
                metadata = content.get('metadata', {})
                token_info = result.get('token_info', {})

                return {
                    'name': metadata.get('name'),
                    'symbol': metadata.get('symbol'),
                    'decimals': token_info.get('decimals', 9),
                    'is_mintable': result.get('mutable', False),
                    'is_freezable': token_info.get('freeze_authority') is not None
                }
        except Exception as e:
            logger.warning(f"Helius DAS fetch failed: {e}")
            return {}

    async def _fetch_jupiter_price(self, mint: str) -> dict:
        """Fetch current price from Jupiter"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.JUPITER_PRICE_API,
                    params={"ids": mint},
                    timeout=10
                )
                data = response.json()
                price_data = data.get('data', {}).get(mint, {})

                return {
                    'price_usd': price_data.get('price', 0),
                    'price_sol': price_data.get('price', 0) / await self._get_sol_price()
                }
        except Exception as e:
            logger.warning(f"Jupiter price fetch failed: {e}")
            return {}

    async def _fetch_supply_info(self, mint: str) -> dict:
        """Fetch supply info directly from RPC"""
        try:
            async with AsyncClient(self.rpc_url) as client:
                # Get token supply
                supply_resp = await client.get_token_supply(Pubkey.from_string(mint))

                if supply_resp.value:
                    amount = float(supply_resp.value.amount)
                    decimals = supply_resp.value.decimals
                    total_supply = amount / (10 ** decimals)

                    return {
                        'total_supply': total_supply,
                        'circulating_supply': total_supply  # Approximate
                    }
        except Exception as e:
            logger.warning(f"Supply fetch failed: {e}")
        return {}

    async def _fetch_birdeye_data(self, mint: str) -> dict:
        """Fetch detailed analytics from Birdeye (requires API key)"""
        if not self.birdeye_api_key:
            return {}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BIRDEYE_API}/defi/token_overview",
                    params={"address": mint},
                    headers={"X-API-KEY": self.birdeye_api_key},
                    timeout=10
                )
                data = response.json()
                return data.get('data', {})
        except Exception as e:
            logger.warning(f"Birdeye fetch failed: {e}")
            return {}

    async def _get_sol_price(self) -> float:
        """Get current SOL price in USD"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.JUPITER_PRICE_API,
                    params={"ids": "So11111111111111111111111111111111111111112"},
                    timeout=5
                )
                data = response.json()
                return data.get('data', {}).get('So11111111111111111111111111111111111111112', {}).get('price', 150)
        except Exception:
            return 150  # Fallback SOL price

    async def get_holder_distribution(self, mint: str, top_n: int = 10) -> dict:
        """
        Get top holder distribution for conviction analysis

        Returns:
            Dict with top holders and concentration metrics
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.HELIUS_DAS_URL}{self.helius_api_key}",
                    json={
                        "jsonrpc": "2.0",
                        "id": "alphapulse",
                        "method": "getTokenLargestAccounts",
                        "params": [mint]
                    },
                    timeout=15
                )
                data = response.json()
                accounts = data.get('result', {}).get('value', [])

                total_held = sum(float(a.get('amount', 0)) for a in accounts)
                top_n_held = sum(float(a.get('amount', 0)) for a in accounts[:top_n])

                top_n_pct = (top_n_held / total_held * 100) if total_held > 0 else 0

                return {
                    'top_holders': accounts[:top_n],
                    'top_n_concentration': top_n_pct,
                    'total_accounts': len(accounts)
                }
        except Exception as e:
            logger.warning(f"Holder distribution fetch failed: {e}")
            return {}

    async def calculate_supply_percentage(self, mint: str, token_amount: float) -> float:
        """
        Calculate what percentage of total supply a given amount represents

        Args:
            mint: Token mint address
            token_amount: Raw token amount (with decimals applied)

        Returns:
            Percentage of total supply (0-100)
        """
        metadata = await self.get_token_metadata(mint)
        if metadata.total_supply > 0:
            return (token_amount / metadata.total_supply) * 100
        return 0.0
