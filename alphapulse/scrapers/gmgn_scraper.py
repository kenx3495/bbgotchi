"""
AlphaPulse GMGN.ai Scraper
Discovers high-performance wallets from GMGN.ai top traders
"""

import asyncio
import json
import re
from datetime import datetime
from dataclasses import dataclass
from typing import Optional
from playwright.async_api import async_playwright, Page, Browser

from alphapulse.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class ScrapedWallet:
    """Data structure for scraped wallet information"""
    address: str
    win_rate: float
    total_trades: int
    trades_7d: int
    pnl_total_sol: float
    pnl_7d_sol: float
    realized_profit: float
    source_token: Optional[str] = None  # Token where this wallet was discovered


class GMGNScraper:
    """
    Scraper for GMGN.ai to discover high-performance wallets

    Targets:
    - Trending tokens page: https://gmgn.ai/sol/token/{ca}
    - Top traders tab for each token
    """

    BASE_URL = "https://gmgn.ai"

    # Filter thresholds (from spec)
    MIN_WIN_RATE = 65.0
    MIN_TRADES_7D = 10
    MIN_PNL_SOL = 0.0  # Can be adjusted

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
                '--no-sandbox',
                '--disable-dev-shm-usage'
            ]
        )
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        logger.info("GMGN Scraper initialized")

    async def close(self):
        """Clean up browser resources"""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        logger.info("GMGN Scraper closed")

    async def get_trending_tokens(self, limit: int = 20) -> list[dict]:
        """
        Scrape trending tokens from GMGN homepage
        Returns list of token CAs with basic metrics
        """
        page = await self.context.new_page()
        tokens = []

        try:
            # Navigate to trending/new pairs page
            await page.goto(f"{self.BASE_URL}/sol/trending", wait_until='networkidle', timeout=30000)
            await asyncio.sleep(2)  # Allow dynamic content to load

            # Wait for token table to load
            await page.wait_for_selector('[class*="token-row"], [class*="pair-row"], table tbody tr', timeout=15000)

            # Extract token data from the table
            # Note: Selectors may need adjustment based on actual GMGN DOM structure
            rows = await page.query_selector_all('table tbody tr, [class*="token-row"]')

            for row in rows[:limit]:
                try:
                    token_data = await self._extract_token_from_row(row)
                    if token_data:
                        tokens.append(token_data)
                except Exception as e:
                    logger.warning(f"Failed to extract token from row: {e}")
                    continue

            logger.info(f"Found {len(tokens)} trending tokens")

        except Exception as e:
            logger.error(f"Error scraping trending tokens: {e}")
        finally:
            await page.close()

        return tokens

    async def _extract_token_from_row(self, row) -> Optional[dict]:
        """Extract token data from a table row element"""
        try:
            # Try to find contract address link
            link = await row.query_selector('a[href*="/sol/token/"]')
            if not link:
                return None

            href = await link.get_attribute('href')
            # Extract CA from URL pattern /sol/token/{CA}
            ca_match = re.search(r'/sol/token/([A-Za-z0-9]{32,44})', href)
            if not ca_match:
                return None

            ca = ca_match.group(1)

            # Extract token name/symbol
            name_el = await row.query_selector('[class*="name"], [class*="symbol"]')
            name = await name_el.inner_text() if name_el else "Unknown"

            # Extract market cap if available
            mcap_el = await row.query_selector('[class*="mcap"], [class*="market-cap"]')
            mcap_text = await mcap_el.inner_text() if mcap_el else "0"
            mcap = self._parse_value(mcap_text)

            # Extract price change if available
            change_el = await row.query_selector('[class*="change"], [class*="percent"]')
            change_text = await change_el.inner_text() if change_el else "0%"
            change = self._parse_percentage(change_text)

            return {
                'contract_address': ca,
                'name': name.strip(),
                'market_cap': mcap,
                'price_change_24h': change
            }

        except Exception as e:
            logger.debug(f"Token extraction error: {e}")
            return None

    async def get_top_traders_for_token(self, contract_address: str) -> list[ScrapedWallet]:
        """
        Scrape top traders for a specific token
        Returns list of wallet addresses with performance metrics
        """
        page = await self.context.new_page()
        wallets = []

        try:
            # Navigate to token page
            url = f"{self.BASE_URL}/sol/token/{contract_address}"
            await page.goto(url, wait_until='networkidle', timeout=30000)
            await asyncio.sleep(2)

            # Click on "Top Traders" tab if it exists
            top_traders_tab = await page.query_selector(
                'button:has-text("Top Traders"), '
                '[role="tab"]:has-text("Top Traders"), '
                'a:has-text("Top Traders")'
            )
            if top_traders_tab:
                await top_traders_tab.click()
                await asyncio.sleep(1.5)

            # Wait for trader table to load
            await page.wait_for_selector(
                '[class*="trader"], table tbody tr, [class*="wallet-row"]',
                timeout=10000
            )

            # Extract wallet data
            trader_rows = await page.query_selector_all(
                'table tbody tr, [class*="trader-row"], [class*="wallet-item"]'
            )

            for row in trader_rows:
                try:
                    wallet = await self._extract_wallet_from_row(row, contract_address)
                    if wallet and self._meets_threshold(wallet):
                        wallets.append(wallet)
                except Exception as e:
                    logger.debug(f"Failed to extract wallet: {e}")
                    continue

            logger.info(f"Found {len(wallets)} qualifying wallets for {contract_address[:8]}...")

        except Exception as e:
            logger.error(f"Error scraping top traders for {contract_address}: {e}")
        finally:
            await page.close()

        return wallets

    async def _extract_wallet_from_row(self, row, source_token: str) -> Optional[ScrapedWallet]:
        """Extract wallet performance data from a trader row"""
        try:
            # Extract wallet address
            addr_el = await row.query_selector(
                'a[href*="/sol/address/"], '
                '[class*="address"], '
                '[class*="wallet"]'
            )
            if not addr_el:
                return None

            # Try to get address from href or text
            href = await addr_el.get_attribute('href')
            if href:
                addr_match = re.search(r'/sol/address/([A-Za-z0-9]{32,44})', href)
                address = addr_match.group(1) if addr_match else None
            else:
                address = await addr_el.inner_text()

            if not address or len(address) < 32:
                return None

            # Extract performance metrics
            # Win Rate
            wr_el = await row.query_selector('[class*="win"], [class*="rate"]')
            win_rate = self._parse_percentage(await wr_el.inner_text() if wr_el else "0%")

            # Total Trades
            trades_el = await row.query_selector('[class*="trades"], [class*="txn"]')
            trades_text = await trades_el.inner_text() if trades_el else "0"
            total_trades = int(self._parse_value(trades_text))

            # PnL
            pnl_el = await row.query_selector('[class*="pnl"], [class*="profit"]')
            pnl_text = await pnl_el.inner_text() if pnl_el else "0"
            pnl = self._parse_sol_value(pnl_text)

            # Realized profit (may be separate column)
            realized_el = await row.query_selector('[class*="realized"]')
            realized = self._parse_sol_value(await realized_el.inner_text() if realized_el else "0")

            return ScrapedWallet(
                address=address.strip(),
                win_rate=win_rate,
                total_trades=total_trades,
                trades_7d=total_trades,  # GMGN typically shows 7d data
                pnl_total_sol=pnl,
                pnl_7d_sol=pnl,
                realized_profit=realized,
                source_token=source_token
            )

        except Exception as e:
            logger.debug(f"Wallet extraction error: {e}")
            return None

    def _meets_threshold(self, wallet: ScrapedWallet) -> bool:
        """Check if wallet meets minimum performance thresholds"""
        return (
            wallet.win_rate >= self.MIN_WIN_RATE and
            wallet.trades_7d >= self.MIN_TRADES_7D and
            wallet.pnl_total_sol >= self.MIN_PNL_SOL
        )

    @staticmethod
    def _parse_value(text: str) -> float:
        """Parse numeric value from text (handles K, M suffixes)"""
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
        """Parse percentage value from text"""
        if not text:
            return 0.0
        try:
            return float(re.sub(r'[^\d.-]', '', text.replace('%', '')))
        except ValueError:
            return 0.0

    @staticmethod
    def _parse_sol_value(text: str) -> float:
        """Parse SOL value from text"""
        if not text:
            return 0.0
        # Remove 'SOL' suffix and parse
        text = text.upper().replace('SOL', '').strip()
        return GMGNScraper._parse_value(text)


async def discover_smart_wallets(
    token_limit: int = 20,
    min_growth: float = 500.0,
    headless: bool = True
) -> list[ScrapedWallet]:
    """
    Main discovery function - finds smart wallets from trending tokens

    Args:
        token_limit: Maximum number of trending tokens to analyze
        min_growth: Minimum 24h growth percentage to consider token
        headless: Run browser in headless mode

    Returns:
        List of discovered smart wallets meeting threshold criteria
    """
    all_wallets = []
    seen_addresses = set()

    async with GMGNScraper(headless=headless) as scraper:
        # Get trending tokens
        tokens = await scraper.get_trending_tokens(limit=token_limit)

        # Filter for high-growth tokens (>500% as per spec)
        high_growth_tokens = [
            t for t in tokens
            if t.get('price_change_24h', 0) >= min_growth
        ]

        logger.info(f"Analyzing {len(high_growth_tokens)} high-growth tokens")

        # Get top traders for each qualifying token
        for token in high_growth_tokens:
            ca = token['contract_address']
            wallets = await scraper.get_top_traders_for_token(ca)

            for wallet in wallets:
                if wallet.address not in seen_addresses:
                    seen_addresses.add(wallet.address)
                    all_wallets.append(wallet)

            # Rate limiting - be respectful to the site
            await asyncio.sleep(2)

    logger.info(f"Discovery complete: {len(all_wallets)} unique smart wallets found")
    return all_wallets


# CLI entry point
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Discover smart wallets from GMGN.ai")
    parser.add_argument("--tokens", type=int, default=20, help="Number of trending tokens to analyze")
    parser.add_argument("--min-growth", type=float, default=500.0, help="Minimum 24h growth %")
    parser.add_argument("--visible", action="store_true", help="Run browser in visible mode")
    args = parser.parse_args()

    wallets = asyncio.run(discover_smart_wallets(
        token_limit=args.tokens,
        min_growth=args.min_growth,
        headless=not args.visible
    ))

    print(f"\n{'='*60}")
    print(f"Discovered {len(wallets)} Smart Wallets")
    print(f"{'='*60}")
    for w in wallets[:10]:  # Show top 10
        print(f"  {w.address[:12]}... | WR: {w.win_rate:.1f}% | Trades: {w.trades_7d} | PnL: {w.pnl_7d_sol:.2f} SOL")
