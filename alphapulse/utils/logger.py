"""
AlphaPulse Logging Configuration
Structured logging with color support
"""

import logging
import sys
from typing import Optional

import structlog
from colorama import Fore, Style, init as colorama_init

from alphapulse.config import settings

# Initialize colorama for Windows support
colorama_init(autoreset=True)


def get_logger(name: Optional[str] = None) -> structlog.stdlib.BoundLogger:
    """
    Get a configured structured logger

    Args:
        name: Logger name (typically __name__)

    Returns:
        Configured structlog logger
    """
    return structlog.get_logger(name or "alphapulse")


def setup_logging():
    """Configure logging for the application"""

    # Determine log level from settings
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S", utc=False),
            structlog.dev.ConsoleRenderer(
                colors=True,
                exception_formatter=structlog.dev.plain_traceback
            )
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Also configure standard logging for third-party libraries
    logging.basicConfig(
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        level=log_level,
        stream=sys.stdout
    )

    # Reduce noise from libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("playwright").setLevel(logging.WARNING)
    logging.getLogger("telegram").setLevel(logging.WARNING)


class AlertFormatter:
    """Format alert messages for Telegram with nice styling"""

    SIGNAL_EMOJIS = {
        'high_conviction': '🎯',
        'cluster_buy': '👥',
        'volume_spike': '📈',
    }

    @staticmethod
    def format_alert(
        alert_type: str,
        token_name: str,
        token_symbol: str,
        contract_address: str,
        market_cap: float,
        liquidity: float,
        wallets: list[dict],
        total_sol: float,
        max_supply_pct: float = 0.0
    ) -> str:
        """
        Format an alert message for Telegram

        Returns:
            Formatted message string with markdown
        """
        emoji = AlertFormatter.SIGNAL_EMOJIS.get(alert_type, '🔔')

        # Format market cap and liquidity
        mcap_str = AlertFormatter._format_value(market_cap)
        liq_str = AlertFormatter._format_value(liquidity)

        # Build wallet info section
        wallet_lines = []
        for w in wallets[:3]:  # Max 3 wallets shown
            addr_short = f"{w['address'][:6]}...{w['address'][-4:]}"
            wallet_lines.append(
                f"  • `{addr_short}` | WR: {w['win_rate']:.0f}% | {w.get('supply_pct', 0):.2f}% supply"
            )
        wallet_section = "\n".join(wallet_lines)

        # Build message
        message = f"""
{emoji} *{alert_type.replace('_', ' ').upper()}*

*Token:* {token_name} (${token_symbol})
`{contract_address}`

*Market Cap:* {mcap_str}
*Liquidity:* {liq_str}
*Total SOL:* {total_sol:.2f} SOL
*Max Supply %:* {max_supply_pct:.2f}%

*Buyers:*
{wallet_section}

🔗 [DexScreener](https://dexscreener.com/solana/{contract_address}) | [Birdeye](https://birdeye.so/token/{contract_address})
"""
        return message.strip()

    @staticmethod
    def format_quick_buy_buttons(contract_address: str, trojan_link: str, maestro_link: str) -> str:
        """Generate quick-buy button markdown"""
        return f"""
*Quick Buy:*
• [Trojan]({trojan_link}?start={contract_address})
• [Maestro]({maestro_link}?start={contract_address})
"""

    @staticmethod
    def _format_value(value: float) -> str:
        """Format large numbers with K/M/B suffix"""
        if value >= 1_000_000_000:
            return f"${value / 1_000_000_000:.2f}B"
        elif value >= 1_000_000:
            return f"${value / 1_000_000:.2f}M"
        elif value >= 1_000:
            return f"${value / 1_000:.2f}K"
        else:
            return f"${value:.2f}"
