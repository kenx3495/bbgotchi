"""
AlphaPulse Dexscreener Scraper
Discovers high-performance wallets from Dexscreener top traders
"""

import asyncio
import json
import re
from datetime import datetime
from typing import Optional
from playwright.async_api import async_playwright, Page, Browser

from alphapulse.scrapers.gmgn_scraper import ScrapedWallet
from alphapulse.utils.logger import get_logger

logger = get_logger(__name__)


class DexscreenerScraper:
    """
    Scraper for Dexscreener.com top traders

    Targets:
    - Token pages: https://dexscreener.com/solana/{ca}
    - Top traders section
    """

    BASE_URL = "https://dexscreener.com"
    API_URL = "https://api.dexscreener.com"

    # Filter thresholds
    MIN_WIN_RATE = 65.0
    MIN_TRADES_7D = 10

    def __init__(self, headless: bool = True):
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.context = None

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def start(self):
        """Initialize Playwright browser"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=self.headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox'
            ]
        )
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        logger.info("Dexscreener Scraper initialized")

    async def close(self):
        """Clean up browser resources"""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        logger.info("Dexscreener Scraper closed")

    async def get_trending_pairs(self, limit: int = 20) -> list[dict]:
        """
        Fetch trending Solana pairs from Dexscreener API
        Uses public API endpoint for reliability
        """
        import aiohttp

        pairs = []

        try:
            async with aiohttp.ClientSession() as session:
                # Dexscreener API endpoint for Solana gainers
                url = f"{self.API_URL}/latest/dex/tokens/solana"

                async with session.get(url, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()

                        # Extract pairs from response
                        for pair in data.get('pairs', [])[:limit]:
                            pairs.append({
                                'contract_address': pair.get('baseToken', {}).get('address'),
                                'name': pair.get('baseToken', {}).get('name', 'Unknown'),
                                'symbol': pair.get('baseToken', {}).get('symbol', '???'),
                                'price_change_24h': float(pair.get('priceChange', {}).get('h24', 0) or 0),
                                'market_cap': float(pair.get('fdv', 0) or 0),
                                'liquidity': float(pair.get('liquidity', {}).get('usd', 0) or 0),
                                'volume_24h': float(pair.get('volume', {}).get('h24', 0) or 0),
                                'pair_address': pair.get('pairAddress')
                            })

            logger.info(f"Fetched {len(pairs)} trending pairs from Dexscreener API")

        except Exception as e:
            logger.error(f"Error fetching trending pairs: {e}")

        return pairs

    async def get_top_traders_for_token(self, contract_address: str) -> list[ScrapedWallet]:
        """
        Scrape top traders for a specific token from Dexscreener
        Note: Dexscreener may require browser-based scraping for trader data
        """
        page = await self.context.new_page()
        wallets = []

        try:
            url = f"{self.BASE_URL}/solana/{contract_address}"
            await page.goto(url, wait_until='networkidle', timeout=30000)
            await asyncio.sleep(2)

            # Look for "Top Traders" or similar section
            # Dexscreener structure varies - try multiple selectors
            traders_section = await page.query_selector(
                '[class*="traders"], '
                '[data-testid*="traders"], '
                'section:has-text("Top Traders")'
            )

            if traders_section:
                # Click to expand if needed
                expand_btn = await traders_section.query_selector('button:has-text("Show")')
                if expand_btn:
                    await expand_btn.click()
                    await asyncio.sleep(1)

                # Extract trader rows
                trader_rows = await page.query_selector_all(
                    '[class*="trader-row"], '
                    '[class*="wallet-item"], '
                    'tr[class*="trader"]'
                )

                for row in trader_rows:
                    wallet = await self._extract_wallet_data(row, contract_address)
                    if wallet and self._meets_threshold(wallet):
                        wallets.append(wallet)

            logger.info(f"Found {len(wallets)} traders for {contract_address[:8]}...")

        except Exception as e:
            logger.error(f"Error scraping traders: {e}")
        finally:
            await page.close()

        return wallets

    async def _extract_wallet_data(self, row, source_token: str) -> Optional[ScrapedWallet]:
        """Extract wallet data from a trader row element"""
        try:
            # Find wallet address
            addr_el = await row.query_selector('a[href*="solscan"], [class*="address"]')
            if not addr_el:
                return None

            href = await addr_el.get_attribute('href') or ""
            addr_match = re.search(r'account/([A-Za-z0-9]{32,44})', href)

            if addr_match:
                address = addr_match.group(1)
            else:
                address = await addr_el.inner_text()
                address = address.strip()

            if len(address) < 32:
                return None

            # Extract metrics (Dexscreener shows PnL, trades, etc.)
            cells = await row.query_selector_all('td, [class*="cell"]')

            pnl = 0.0
            trades = 0
            win_rate = 0.0

            for cell in cells:
                text = await cell.inner_text()
                text_lower = text.lower()

                if 'sol' in text_lower or '$' in text:
                    pnl = self._parse_value(text)
                elif text.isdigit() or re.match(r'^\d+$', text.strip()):
                    trades = int(text.strip())
                elif '%' in text:
                    win_rate = self._parse_percentage(text)

            return ScrapedWallet(
                address=address,
                win_rate=win_rate,
                total_trades=trades,
                trades_7d=trades,
                pnl_total_sol=pnl,
                pnl_7d_sol=pnl,
                realized_profit=pnl,
                source_token=source_token
            )

        except Exception as e:
            logger.debug(f"Extraction error: {e}")
            return None

    def _meets_threshold(self, wallet: ScrapedWallet) -> bool:
        """Check if wallet meets performance criteria"""
        return (
            wallet.win_rate >= self.MIN_WIN_RATE and
            wallet.trades_7d >= self.MIN_TRADES_7D
        )

    @staticmethod
    def _parse_value(text: str) -> float:
        """Parse numeric value"""
        if not text:
            return 0.0
        text = text.strip().replace(',', '').replace('$', '')

        multipliers = {'K': 1_000, 'M': 1_000_000, 'B': 1_000_000_000}
        for suffix, mult in multipliers.items():
            if suffix in text.upper():
                try:
                    return float(text.upper().replace(suffix, '').strip()) * mult
                except ValueError:
                    return 0.0
        try:
            return float(re.sub(r'[^\d.-]', '', text))
        except ValueError:
            return 0.0

    @staticmethod
    def _parse_percentage(text: str) -> float:
        """Parse percentage value"""
        try:
            return float(re.sub(r'[^\d.-]', '', text.replace('%', '')))
        except ValueError:
            return 0.0


async def discover_from_dexscreener(
    token_limit: int = 20,
    min_growth: float = 500.0,
    headless: bool = True
) -> list[ScrapedWallet]:
    """
    Discover smart wallets from Dexscreener trending tokens
    """
    all_wallets = []
    seen_addresses = set()

    async with DexscreenerScraper(headless=headless) as scraper:
        # Get trending pairs via API
        pairs = await scraper.get_trending_pairs(limit=token_limit)

        # Filter for high-growth
        high_growth = [p for p in pairs if p.get('price_change_24h', 0) >= min_growth]

        logger.info(f"Analyzing {len(high_growth)} high-growth tokens from Dexscreener")

        for pair in high_growth:
            ca = pair.get('contract_address')
            if not ca:
                continue

            wallets = await scraper.get_top_traders_for_token(ca)

            for wallet in wallets:
                if wallet.address not in seen_addresses:
                    seen_addresses.add(wallet.address)
                    all_wallets.append(wallet)

            await asyncio.sleep(2)  # Rate limiting

    return all_wallets
