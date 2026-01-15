"""
AlphaPulse Configuration
Environment-based settings using Pydantic
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Database
    database_url: str = Field(
        default="sqlite:///alphapulse.db",
        description="Database connection URL"
    )

    # Helius API (Solana RPC & Webhooks)
    helius_api_key: str = Field(
        default="",
        description="Helius API key for RPC and webhooks"
    )
    helius_rpc_url: str = Field(
        default="https://mainnet.helius-rpc.com",
        description="Helius RPC endpoint"
    )
    helius_webhook_url: str = Field(
        default="",
        description="Your server's webhook endpoint URL"
    )

    # Telegram Bot
    telegram_bot_token: str = Field(
        default="",
        description="Telegram bot token from @BotFather"
    )
    telegram_chat_id: str = Field(
        default="",
        description="Target chat/channel ID for alerts"
    )
    telegram_admin_ids: str = Field(
        default="",
        description="Comma-separated admin user IDs"
    )

    # Smart Wallet Thresholds
    min_win_rate: float = Field(
        default=65.0,
        description="Minimum win rate % to track wallet"
    )
    min_trades_7d: int = Field(
        default=10,
        description="Minimum trades in last 7 days"
    )

    # Signal Trigger Thresholds
    high_conviction_min_sol: float = Field(
        default=1.0,
        description="Minimum SOL for high conviction buy"
    )
    high_conviction_min_supply_pct: float = Field(
        default=0.5,
        description="Minimum % of supply for high conviction"
    )
    cluster_min_wallets: int = Field(
        default=2,
        description="Minimum wallets for cluster signal"
    )
    cluster_window_minutes: int = Field(
        default=5,
        description="Time window for cluster detection"
    )
    cluster_min_sol: float = Field(
        default=0.5,
        description="Minimum SOL per wallet in cluster"
    )
    volume_spike_threshold: float = Field(
        default=0.1,
        description="5-min volume / mcap ratio threshold (10%)"
    )
    new_token_max_age_minutes: int = Field(
        default=60,
        description="Max token age for 'new token' classification"
    )

    # Scraping Settings
    scrape_interval_minutes: int = Field(
        default=60,
        description="How often to run discovery scraper"
    )
    scrape_headless: bool = Field(
        default=True,
        description="Run browser in headless mode"
    )
    trending_token_limit: int = Field(
        default=20,
        description="Number of trending tokens to analyze"
    )
    min_token_growth_pct: float = Field(
        default=500.0,
        description="Minimum 24h growth for token consideration"
    )

    # Trading Bot Deep Links (for 1-click execution)
    trojan_bot_link: str = Field(
        default="https://t.me/solaborator_trojan_trading_bot",
        description="Trojan trading bot link"
    )
    maestro_bot_link: str = Field(
        default="https://t.me/MaestroSniperBot",
        description="Maestro bot link"
    )

    # Program IDs to monitor
    pump_fun_program_id: str = Field(
        default="6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
        description="Pump.fun program ID"
    )
    raydium_amm_program_id: str = Field(
        default="675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
        description="Raydium AMM program ID"
    )

    # Logging
    log_level: str = Field(
        default="INFO",
        description="Logging level"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()


def get_admin_ids() -> list[int]:
    """Parse admin IDs from comma-separated string"""
    if not settings.telegram_admin_ids:
        return []
    return [int(id.strip()) for id in settings.telegram_admin_ids.split(",") if id.strip()]
