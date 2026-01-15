"""
AlphaPulse Position Tracker
Tracks current holdings of smart wallets
"""

from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from alphapulse.db.models import SmartWallet, Token
from alphapulse.config import settings
from alphapulse.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class TokenPosition:
    """A single token position held by a wallet"""
    token_address: str
    token_symbol: Optional[str]
    token_name: Optional[str]

    # Amounts
    balance: float
    balance_usd: float

    # Entry info
    avg_entry_price: float
    total_cost_usd: float

    # Current value
    current_price: float
    current_value_usd: float

    # PnL
    unrealized_pnl_usd: float
    unrealized_pnl_pct: float

    # Timing
    first_buy_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None


@dataclass
class WalletPortfolio:
    """Complete portfolio for a wallet"""
    wallet_address: str
    wallet_tag: Optional[str]

    # Summary
    total_value_usd: float
    total_value_sol: float
    position_count: int

    # Positions
    positions: list[TokenPosition] = field(default_factory=list)

    # PnL
    total_unrealized_pnl_usd: float = 0.0
    total_unrealized_pnl_pct: float = 0.0

    # SOL balance
    sol_balance: float = 0.0

    fetched_at: datetime = None

    def __post_init__(self):
        if self.fetched_at is None:
            self.fetched_at = datetime.utcnow()


class PositionTracker:
    """
    Tracks current positions of smart wallets

    Uses Helius DAS API to fetch token balances
    """

    def __init__(self, session: Session, helius_api_key: str = None):
        self.session = session
        self.helius_api_key = helius_api_key or settings.helius_api_key
        self.helius_url = f"https://mainnet.helius-rpc.com/?api-key={self.helius_api_key}"

    async def get_wallet_portfolio(self, wallet_address: str) -> WalletPortfolio:
        """
        Get complete portfolio for a wallet

        Args:
            wallet_address: Solana wallet address

        Returns:
            WalletPortfolio with all positions
        """
        # Fetch token accounts
        token_accounts = await self._fetch_token_accounts(wallet_address)

        # Fetch SOL balance
        sol_balance = await self._fetch_sol_balance(wallet_address)

        # Build positions
        positions = []
        total_value = 0.0

        for account in token_accounts:
            mint = account.get('mint')
            amount = float(account.get('amount', 0))
            decimals = account.get('decimals', 9)

            if amount == 0:
                continue

            # Get token info
            token_info = await self._get_token_info(mint)
            balance = amount / (10 ** decimals)
            current_price = token_info.get('price_usd', 0)
            current_value = balance * current_price

            # Get entry info from our trade history
            entry_info = self._get_entry_info(wallet_address, mint)

            position = TokenPosition(
                token_address=mint,
                token_symbol=token_info.get('symbol'),
                token_name=token_info.get('name'),
                balance=balance,
                balance_usd=current_value,
                avg_entry_price=entry_info.get('avg_price', current_price),
                total_cost_usd=entry_info.get('total_cost', current_value),
                current_price=current_price,
                current_value_usd=current_value,
                unrealized_pnl_usd=current_value - entry_info.get('total_cost', current_value),
                unrealized_pnl_pct=self._calc_pnl_pct(
                    entry_info.get('total_cost', current_value),
                    current_value
                ),
                first_buy_at=entry_info.get('first_buy'),
                last_activity_at=entry_info.get('last_activity')
            )
            positions.append(position)
            total_value += current_value

        # Sort by value descending
        positions.sort(key=lambda p: p.current_value_usd, reverse=True)

        # Get wallet tag from DB
        wallet = self.session.query(SmartWallet).filter(
            SmartWallet.address == wallet_address
        ).first()

        # Calculate totals
        total_unrealized = sum(p.unrealized_pnl_usd for p in positions)
        total_cost = sum(p.total_cost_usd for p in positions)

        sol_price = await self._get_sol_price()

        return WalletPortfolio(
            wallet_address=wallet_address,
            wallet_tag=wallet.tag if wallet else None,
            total_value_usd=total_value + (sol_balance * sol_price),
            total_value_sol=(total_value / sol_price) + sol_balance if sol_price > 0 else 0,
            position_count=len(positions),
            positions=positions,
            total_unrealized_pnl_usd=total_unrealized,
            total_unrealized_pnl_pct=self._calc_pnl_pct(total_cost, total_value),
            sol_balance=sol_balance
        )

    async def _fetch_token_accounts(self, wallet: str) -> list[dict]:
        """Fetch all token accounts for a wallet using Helius DAS"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.helius_url,
                    json={
                        "jsonrpc": "2.0",
                        "id": "alphapulse",
                        "method": "getAssetsByOwner",
                        "params": {
                            "ownerAddress": wallet,
                            "page": 1,
                            "limit": 100,
                            "displayOptions": {
                                "showFungible": True,
                                "showNativeBalance": True
                            }
                        }
                    },
                    timeout=15
                )
                data = response.json()
                items = data.get('result', {}).get('items', [])

                # Filter for fungible tokens only
                token_accounts = []
                for item in items:
                    if item.get('interface') == 'FungibleToken':
                        token_info = item.get('token_info', {})
                        token_accounts.append({
                            'mint': item.get('id'),
                            'amount': token_info.get('balance', 0),
                            'decimals': token_info.get('decimals', 9),
                            'symbol': token_info.get('symbol'),
                            'price_info': token_info.get('price_info', {})
                        })

                return token_accounts
        except Exception as e:
            logger.warning(f"Failed to fetch token accounts: {e}")
            return []

    async def _fetch_sol_balance(self, wallet: str) -> float:
        """Fetch native SOL balance"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.helius_url,
                    json={
                        "jsonrpc": "2.0",
                        "id": "alphapulse",
                        "method": "getBalance",
                        "params": [wallet]
                    },
                    timeout=10
                )
                data = response.json()
                lamports = data.get('result', {}).get('value', 0)
                return lamports / 1e9
        except Exception as e:
            logger.warning(f"Failed to fetch SOL balance: {e}")
            return 0.0

    async def _get_token_info(self, mint: str) -> dict:
        """Get basic token info with price"""
        try:
            async with httpx.AsyncClient() as client:
                # Jupiter price API
                response = await client.get(
                    "https://price.jup.ag/v6/price",
                    params={"ids": mint},
                    timeout=5
                )
                data = response.json()
                price_data = data.get('data', {}).get(mint, {})

                return {
                    'symbol': price_data.get('symbol', '???'),
                    'name': price_data.get('symbol', 'Unknown'),
                    'price_usd': price_data.get('price', 0)
                }
        except Exception:
            return {'symbol': '???', 'name': 'Unknown', 'price_usd': 0}

    def _get_entry_info(self, wallet_address: str, token_mint: str) -> dict:
        """Get entry info from our trade history"""
        from alphapulse.db.models import Trade

        wallet = self.session.query(SmartWallet).filter(
            SmartWallet.address == wallet_address
        ).first()

        if not wallet:
            return {}

        token = self.session.query(Token).filter(
            Token.contract_address == token_mint
        ).first()

        if not token:
            return {}

        trades = self.session.query(Trade).filter(
            Trade.wallet_id == wallet.id,
            Trade.token_id == token.id
        ).order_by(Trade.block_time).all()

        if not trades:
            return {}

        # Calculate average entry
        total_bought = 0.0
        total_cost = 0.0

        for trade in trades:
            if trade.trade_type == 'BUY':
                total_bought += trade.token_amount
                total_cost += trade.sol_amount  # In SOL
            else:  # SELL
                # Reduce position
                if total_bought > 0:
                    avg_cost_per_token = total_cost / total_bought
                    sold_cost = trade.token_amount * avg_cost_per_token
                    total_bought -= trade.token_amount
                    total_cost -= sold_cost

        avg_price = total_cost / total_bought if total_bought > 0 else 0

        return {
            'avg_price': avg_price,
            'total_cost': total_cost,
            'first_buy': trades[0].block_time if trades else None,
            'last_activity': trades[-1].block_time if trades else None
        }

    async def _get_sol_price(self) -> float:
        """Get current SOL price in USD"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://price.jup.ag/v6/price",
                    params={"ids": "So11111111111111111111111111111111111111112"},
                    timeout=5
                )
                data = response.json()
                return data.get('data', {}).get(
                    'So11111111111111111111111111111111111111112', {}
                ).get('price', 150)
        except Exception:
            return 150

    @staticmethod
    def _calc_pnl_pct(cost: float, value: float) -> float:
        """Calculate PnL percentage"""
        if cost <= 0:
            return 0.0
        return ((value - cost) / cost) * 100

    async def get_common_holdings(self, min_wallets: int = 3) -> list[dict]:
        """
        Find tokens held by multiple tracked wallets

        Returns:
            List of tokens with holder count
        """
        # Get all active wallets
        wallets = self.session.query(SmartWallet).filter(
            SmartWallet.is_active == True
        ).all()

        # Track token holdings across wallets
        token_holders = {}

        for wallet in wallets[:50]:  # Limit for API rate limits
            try:
                portfolio = await self.get_wallet_portfolio(wallet.address)
                for pos in portfolio.positions:
                    if pos.token_address not in token_holders:
                        token_holders[pos.token_address] = {
                            'symbol': pos.token_symbol,
                            'name': pos.token_name,
                            'holders': [],
                            'total_value': 0
                        }
                    token_holders[pos.token_address]['holders'].append({
                        'wallet': wallet.address,
                        'value': pos.current_value_usd
                    })
                    token_holders[pos.token_address]['total_value'] += pos.current_value_usd
            except Exception as e:
                logger.debug(f"Failed to get portfolio for {wallet.address[:8]}...: {e}")

        # Filter for tokens held by multiple wallets
        common = []
        for mint, data in token_holders.items():
            if len(data['holders']) >= min_wallets:
                common.append({
                    'token_address': mint,
                    'symbol': data['symbol'],
                    'holder_count': len(data['holders']),
                    'total_value': data['total_value'],
                    'holders': data['holders']
                })

        # Sort by holder count
        common.sort(key=lambda x: x['holder_count'], reverse=True)
        return common
