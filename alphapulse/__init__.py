"""
AlphaPulse - Solana Smart Wallet Tracker
========================================

A proprietary monitoring tool that identifies and tracks "Smart Wallets"
(highly profitable/low-cap traders) to provide early signals on newly
launched or high-momentum tokens.

Key Features:
- Dynamic smart wallet discovery from GMGN.ai and Dexscreener
- High conviction signal detection (supply % based, not just volume)
- Wallet cluster detection (multiple smart wallets buying same token)
- Real-time Telegram alerts with 1-click trading bot integration

Usage:
    from alphapulse import discover_smart_wallets
    from alphapulse.db import init_db, SmartWallet

    # Initialize database
    engine = init_db()

    # Discover wallets
    wallets = await discover_smart_wallets()
"""

__version__ = "0.1.0"
__author__ = "AlphaPulse"

from alphapulse.config import settings

__all__ = ['settings', '__version__']
