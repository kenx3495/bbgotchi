"""
AlphaPulse - Main Entry Point
Orchestrates all components: scraper, webhook handler, and Telegram bot
"""

import asyncio
import signal
import json
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
import uvicorn

from alphapulse.config import settings
from alphapulse.db.models import init_db, get_session, WalletRepository, Alert
from alphapulse.scrapers import discover_smart_wallets, discover_from_dexscreener
from alphapulse.processors.signal_processor import SignalProcessor
from alphapulse.processors.helius_handler import HeliusWebhookHandler, HeliusWebhookManager
from alphapulse.processors.webhook_security import (
    WebhookSecurityManager, RateLimiter,
    get_security_manager, get_rate_limiter
)
from alphapulse.bot.telegram_bot import AlphaPulseBot
from alphapulse.services.conviction_calculator import ConvictionCalculator
from alphapulse.utils.logger import get_logger, setup_logging

setup_logging()
logger = get_logger(__name__)

# FastAPI app for webhook receiver
app = FastAPI(
    title="AlphaPulse Webhook Receiver",
    description="Solana Smart Wallet Tracker API",
    version="0.1.0"
)

# Global instances
engine = None
webhook_handler: Optional[HeliusWebhookHandler] = None
telegram_bot: Optional[AlphaPulseBot] = None
security_manager: Optional[WebhookSecurityManager] = None
rate_limiter: Optional[RateLimiter] = None


@app.on_event("startup")
async def startup():
    """Initialize components on startup"""
    global engine, webhook_handler, telegram_bot, security_manager, rate_limiter

    logger.info("Starting AlphaPulse...")

    # Initialize database
    engine = init_db(settings.database_url)
    logger.info("Database initialized")

    # Initialize webhook handler
    session = get_session(engine)
    webhook_handler = HeliusWebhookHandler(session)
    logger.info("Webhook handler initialized")

    # Initialize security components
    security_manager = get_security_manager()
    rate_limiter = get_rate_limiter()
    logger.info("Security components initialized")

    # Initialize Telegram bot
    if settings.telegram_bot_token:
        telegram_bot = AlphaPulseBot()
        asyncio.create_task(telegram_bot.start())
        logger.info("Telegram bot started")

    # Schedule periodic tasks
    asyncio.create_task(discovery_loop())
    asyncio.create_task(conviction_update_loop())
    asyncio.create_task(outcome_check_loop())


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    global telegram_bot
    if telegram_bot:
        await telegram_bot.stop()
    logger.info("AlphaPulse shutdown complete")


@app.post("/webhook/helius")
async def helius_webhook(request: Request):
    """
    Helius webhook endpoint
    Receives enhanced transaction data for tracked wallets
    """
    global webhook_handler, telegram_bot, security_manager, rate_limiter

    if not webhook_handler:
        raise HTTPException(status_code=503, detail="Handler not initialized")

    # Get client IP for rate limiting
    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting check
    if rate_limiter and not rate_limiter.is_allowed(client_ip):
        logger.warning(f"Rate limited request from {client_ip}")
        raise HTTPException(status_code=429, detail="Too many requests")

    # Get raw body for signature verification
    body = await request.body()

    # Verify webhook signature
    if security_manager:
        headers = dict(request.headers)
        validation = security_manager.verify_request(headers, body)

        if not validation.valid and validation.error != "verification_disabled":
            logger.warning(f"Invalid webhook signature from {client_ip}: {validation.error}")
            raise HTTPException(status_code=401, detail=f"Invalid signature: {validation.error}")

    try:
        payload = json.loads(body)
        logger.debug(f"Received webhook payload with {len(payload) if isinstance(payload, list) else 1} transactions")

        # Process the webhook
        alerts = webhook_handler.handle_webhook(payload)

        # Send Telegram alerts
        if alerts and telegram_bot:
            session = get_session(engine)
            try:
                signal_processor = SignalProcessor(session)
                for alert_info in alerts:
                    alert = session.query(Alert).get(alert_info['alert_id'])
                    if alert and not alert.is_sent:
                        # Enrich signal with rug check before sending
                        # (Already done during alert creation now)

                        # Get wallet details for the alert
                        trigger_data = json.loads(alert.trigger_data) if alert.trigger_data else {}
                        wallets = trigger_data.get('wallets', [])

                        await telegram_bot.send_alert(alert, alert.token, wallets)
                        signal_processor.mark_alert_sent(alert)
            finally:
                session.close()

        return JSONResponse({"status": "ok", "alerts": len(alerts)})

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in webhook: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "tracked_wallets": len(webhook_handler._tracked_wallets) if webhook_handler else 0
    }


@app.get("/stats")
async def get_stats():
    """Get current tracking statistics"""
    session = get_session(engine)
    try:
        from alphapulse.db.models import SmartWallet, Token, Alert

        wallet_count = session.query(SmartWallet).filter(SmartWallet.is_active == True).count()
        token_count = session.query(Token).count()
        alert_count = session.query(Alert).count()

        return {
            "tracked_wallets": wallet_count,
            "tokens_seen": token_count,
            "total_alerts": alert_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    finally:
        session.close()


async def discovery_loop():
    """
    Periodic wallet discovery loop
    Runs every SCRAPE_INTERVAL_MINUTES to find new smart wallets
    """
    while True:
        try:
            logger.info("Starting wallet discovery cycle...")

            # Discover from both sources
            gmgn_wallets = await discover_smart_wallets(
                token_limit=settings.trending_token_limit,
                min_growth=settings.min_token_growth_pct,
                headless=settings.scrape_headless
            )

            dex_wallets = await discover_from_dexscreener(
                token_limit=settings.trending_token_limit,
                min_growth=settings.min_token_growth_pct,
                headless=settings.scrape_headless
            )

            # Merge and deduplicate
            all_wallets = gmgn_wallets + dex_wallets
            seen = set()
            unique_wallets = []
            for w in all_wallets:
                if w.address not in seen:
                    seen.add(w.address)
                    unique_wallets.append(w)

            # Save to database
            session = get_session(engine)
            try:
                repo = WalletRepository(session)
                new_count = 0

                for w in unique_wallets:
                    existing = repo.get_by_address(w.address)
                    if not existing:
                        repo.upsert_wallet(w.address, {
                            'source': 'gmgn' if w in gmgn_wallets else 'dexscreener',
                            'win_rate': w.win_rate,
                            'total_trades': w.total_trades,
                            'trades_7d': w.trades_7d,
                            'pnl_total_sol': w.pnl_total_sol,
                            'pnl_7d_sol': w.pnl_7d_sol,
                            'is_active': True
                        })
                        new_count += 1

                        # Add to webhook handler cache
                        if webhook_handler:
                            webhook_handler.add_wallet_to_cache(w.address)

                logger.info(f"Discovery complete: {new_count} new wallets added")

                # Update Helius webhook with new addresses
                if new_count > 0 and settings.helius_api_key:
                    await update_helius_webhook()

            finally:
                session.close()

        except Exception as e:
            logger.error(f"Discovery loop error: {e}")

        # Wait for next cycle
        await asyncio.sleep(settings.scrape_interval_minutes * 60)


async def update_helius_webhook():
    """Update Helius webhook with current tracked wallets"""
    if not settings.helius_api_key or not settings.helius_webhook_url:
        logger.warning("Helius API key or webhook URL not configured")
        return

    session = get_session(engine)
    try:
        repo = WalletRepository(session)
        addresses = repo.get_wallet_addresses()

        manager = HeliusWebhookManager(settings.helius_api_key)

        # Get existing webhooks
        webhooks = await manager.list_webhooks()

        if webhooks:
            # Update first webhook
            webhook_id = webhooks[0].get('webhookID')
            await manager.update_webhook(webhook_id, addresses)
            logger.info(f"Updated Helius webhook with {len(addresses)} addresses")
        else:
            # Create new webhook
            await manager.create_webhook(
                settings.helius_webhook_url,
                addresses
            )
            logger.info(f"Created Helius webhook with {len(addresses)} addresses")

    except Exception as e:
        logger.error(f"Failed to update Helius webhook: {e}")
    finally:
        session.close()


async def conviction_update_loop():
    """
    Periodic conviction score update loop
    Runs every 6 hours to recalculate wallet scores
    """
    await asyncio.sleep(60)  # Initial delay

    while True:
        try:
            logger.info("Updating conviction scores...")
            session = get_session(engine)
            try:
                calculator = ConvictionCalculator(session)
                updated = calculator.update_all_scores()
                logger.info(f"Updated conviction scores for {updated} wallets")
            finally:
                session.close()
        except Exception as e:
            logger.error(f"Conviction update error: {e}")

        # Run every 6 hours
        await asyncio.sleep(6 * 60 * 60)


async def outcome_check_loop():
    """
    Periodic outcome checking loop
    Runs every 30 minutes to check alert outcomes
    """
    await asyncio.sleep(120)  # Initial delay

    while True:
        try:
            logger.info("Checking alert outcomes...")
            session = get_session(engine)
            try:
                from alphapulse.services.outcome_tracker import OutcomeTracker
                tracker = OutcomeTracker(session)
                outcomes = await tracker.check_pending_alerts()
                logger.info(f"Checked {len(outcomes)} alert outcomes")
            finally:
                session.close()
        except Exception as e:
            logger.error(f"Outcome check error: {e}")

        # Run every 30 minutes
        await asyncio.sleep(30 * 60)


@app.get("/backtest")
async def run_backtest(days: int = 7):
    """
    Run a quick backtest on historical data

    Args:
        days: Number of days to backtest
    """
    session = get_session(engine)
    try:
        from alphapulse.services.backtester import run_quick_backtest, Backtester

        result = await run_quick_backtest(session, days=days)
        backtester = Backtester(session)
        report = backtester.generate_report(result)

        return {
            "status": "ok",
            "total_trades": result.total_trades,
            "win_rate": result.win_rate,
            "total_pnl_sol": result.total_pnl_sol,
            "profit_factor": result.profit_factor,
            "report": report
        }
    except Exception as e:
        logger.error(f"Backtest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@app.get("/check/{token_ca}")
async def check_token(token_ca: str):
    """
    Run rug check on a token

    Args:
        token_ca: Token contract address
    """
    try:
        from alphapulse.services.rug_detector import RugDetector

        detector = RugDetector()
        result = await detector.check_token(token_ca)

        return {
            "contract_address": token_ca,
            "passed": result.passed,
            "risk_level": result.risk_level.value,
            "risk_score": result.risk_score,
            "warnings": result.warnings,
            "details": {
                "mintable": result.mintable,
                "freezable": result.freezable,
                "lp_unlocked": result.lp_unlocked,
                "low_liquidity": result.low_liquidity,
                "high_concentration": result.high_concentration,
                "honeypot_risk": result.honeypot_risk
            }
        }
    except Exception as e:
        logger.error(f"Token check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def main():
    """Main entry point"""
    logger.info("="*50)
    logger.info("AlphaPulse - Solana Smart Wallet Tracker")
    logger.info("="*50)

    # Run the FastAPI server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )


if __name__ == "__main__":
    main()
