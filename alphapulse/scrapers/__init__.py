"""AlphaPulse Scrapers Package"""

from alphapulse.scrapers.gmgn_scraper import (
    GMGNScraper,
    ScrapedWallet,
    discover_smart_wallets
)
from alphapulse.scrapers.dexscreener_scraper import (
    DexscreenerScraper,
    discover_from_dexscreener
)

__all__ = [
    'GMGNScraper',
    'DexscreenerScraper',
    'ScrapedWallet',
    'discover_smart_wallets',
    'discover_from_dexscreener'
]
