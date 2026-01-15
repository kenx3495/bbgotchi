"""
AlphaPulse Telegram Bot
Real-time alerting and command interface

Commands:
- /start - Welcome message
- /help - Show all commands
- /stats - Show tracking statistics
- /wallets - List tracked wallets
- /alerts - Recent alerts
- /report - Performance report (7d)
- /portfolio <address> - View wallet holdings
- /check <token_ca> - Rug check a token
- /add <address> - Add wallet to track (admin)
- /remove <address> - Remove wallet (admin)
"""

import json
from datetime import datetime
from typing import Optional

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, ContextTypes,
    CallbackQueryHandler, MessageHandler, filters
)
from telegram.constants import ParseMode

from alphapulse.config import settings, get_admin_ids
from alphapulse.db.models import (
    init_db, get_session, SmartWallet, Token, Alert,
    WalletRepository
)
from alphapulse.utils.logger import get_logger, AlertFormatter

logger = get_logger(__name__)

# Rate limiting
_last_command_time = {}
RATE_LIMIT_SECONDS = 2


class AlphaPulseBot:
    """
    Telegram bot for AlphaPulse alerts and management

    Commands:
    - /start - Welcome message
    - /stats - Show tracking statistics
    - /wallets - List tracked wallets
    - /add <address> - Add wallet to track (admin)
    - /remove <address> - Remove wallet (admin)
    - /alerts - Recent alerts
    """

    def __init__(self):
        self.engine = init_db(settings.database_url)
        self.admin_ids = get_admin_ids()
        self.app: Optional[Application] = None

    async def start(self):
        """Initialize and start the bot"""
        self.app = (
            Application.builder()
            .token(settings.telegram_bot_token)
            .build()
        )

        # Register handlers
        self.app.add_handler(CommandHandler("start", self.cmd_start))
        self.app.add_handler(CommandHandler("help", self.cmd_help))
        self.app.add_handler(CommandHandler("stats", self.cmd_stats))
        self.app.add_handler(CommandHandler("wallets", self.cmd_wallets))
        self.app.add_handler(CommandHandler("alerts", self.cmd_alerts))
        self.app.add_handler(CommandHandler("report", self.cmd_report))
        self.app.add_handler(CommandHandler("portfolio", self.cmd_portfolio))
        self.app.add_handler(CommandHandler("check", self.cmd_check_token))
        self.app.add_handler(CommandHandler("holdings", self.cmd_common_holdings))
        self.app.add_handler(CommandHandler("backtest", self.cmd_backtest))
        # Admin commands
        self.app.add_handler(CommandHandler("add", self.cmd_add_wallet))
        self.app.add_handler(CommandHandler("remove", self.cmd_remove_wallet))
        self.app.add_handler(CallbackQueryHandler(self.handle_callback))

        logger.info("Telegram bot initialized")

        # Start polling
        await self.app.initialize()
        await self.app.start()
        await self.app.updater.start_polling()

    async def stop(self):
        """Stop the bot"""
        if self.app:
            await self.app.updater.stop()
            await self.app.stop()
            await self.app.shutdown()

    def _is_admin(self, user_id: int) -> bool:
        """Check if user is an admin"""
        return user_id in self.admin_ids

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command"""
        welcome = """
*AlphaPulse* - Smart Wallet Tracker

Track high-conviction Solana traders and get instant alerts when they buy.

*Commands:*
/stats - View tracking statistics
/wallets - List tracked wallets
/alerts - Recent signals

_Powered by Helius_
        """
        await update.message.reply_text(
            welcome.strip(),
            parse_mode=ParseMode.MARKDOWN
        )

    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command"""
        help_text = """
*AlphaPulse Commands*

*Public:*
/stats - Show tracking statistics
/wallets - List top tracked wallets
/alerts - View recent alerts
/report - Performance report (7d win rate)
/backtest [days] - Run strategy backtest
/portfolio <addr> - View wallet holdings
/check <token\\_ca> - Rug check a token
/holdings - Tokens held by multiple wallets

*Admin Only:*
/add <address> - Add wallet to track
/remove <address> - Remove wallet

*Signal Types:*
- HIGH CONVICTION: Large % of supply bought
- CLUSTER BUY: Multiple wallets buying same token
- VOLUME SPIKE: New token with high activity
        """
        await update.message.reply_text(
            help_text.strip(),
            parse_mode=ParseMode.MARKDOWN
        )

    async def cmd_stats(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /stats command"""
        session = get_session(self.engine)
        try:
            wallet_count = session.query(SmartWallet).filter(
                SmartWallet.is_active == True
            ).count()

            high_wr_count = session.query(SmartWallet).filter(
                SmartWallet.is_active == True,
                SmartWallet.win_rate >= settings.min_win_rate
            ).count()

            token_count = session.query(Token).count()

            alert_count_24h = session.query(Alert).filter(
                Alert.created_at >= datetime.utcnow().replace(hour=0, minute=0)
            ).count()

            stats = f"""
*AlphaPulse Stats*

*Wallets Tracked:* {wallet_count}
*High Win Rate (>{settings.min_win_rate}%):* {high_wr_count}
*Tokens Seen:* {token_count}
*Alerts Today:* {alert_count_24h}

*Thresholds:*
- Min Win Rate: {settings.min_win_rate}%
- High Conviction: >{settings.high_conviction_min_sol} SOL & >{settings.high_conviction_min_supply_pct}% supply
- Cluster: {settings.cluster_min_wallets}+ wallets in {settings.cluster_window_minutes}min
            """
            await update.message.reply_text(
                stats.strip(),
                parse_mode=ParseMode.MARKDOWN
            )
        finally:
            session.close()

    async def cmd_wallets(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /wallets command - show top tracked wallets"""
        session = get_session(self.engine)
        try:
            wallets = session.query(SmartWallet).filter(
                SmartWallet.is_active == True
            ).order_by(
                SmartWallet.conviction_score.desc()
            ).limit(10).all()

            if not wallets:
                await update.message.reply_text("No wallets being tracked yet.")
                return

            lines = ["*Top Tracked Wallets*\n"]
            for i, w in enumerate(wallets, 1):
                addr_short = f"{w.address[:6]}...{w.address[-4:]}"
                tag = f" ({w.tag})" if w.tag else ""
                lines.append(
                    f"{i}. `{addr_short}`{tag}\n"
                    f"   WR: {w.win_rate:.0f}% | Trades: {w.trades_7d} | Score: {w.conviction_score:.0f}"
                )

            await update.message.reply_text(
                "\n".join(lines),
                parse_mode=ParseMode.MARKDOWN
            )
        finally:
            session.close()

    async def cmd_add_wallet(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /add <address> command (admin only)"""
        if not self._is_admin(update.effective_user.id):
            await update.message.reply_text("Admin only command.")
            return

        if not context.args:
            await update.message.reply_text("Usage: /add <wallet_address>")
            return

        address = context.args[0]

        if len(address) < 32 or len(address) > 44:
            await update.message.reply_text("Invalid Solana address.")
            return

        session = get_session(self.engine)
        try:
            repo = WalletRepository(session)
            wallet = repo.upsert_wallet(address, {
                'source': 'manual',
                'is_active': True,
                'win_rate': 0,
                'trades_7d': 0
            })

            await update.message.reply_text(
                f"Wallet added: `{address[:8]}...{address[-4:]}`",
                parse_mode=ParseMode.MARKDOWN
            )
        finally:
            session.close()

    async def cmd_remove_wallet(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /remove <address> command (admin only)"""
        if not self._is_admin(update.effective_user.id):
            await update.message.reply_text("Admin only command.")
            return

        if not context.args:
            await update.message.reply_text("Usage: /remove <wallet_address>")
            return

        address = context.args[0]
        session = get_session(self.engine)

        try:
            wallet = session.query(SmartWallet).filter(
                SmartWallet.address == address
            ).first()

            if wallet:
                wallet.is_active = False
                session.commit()
                await update.message.reply_text(f"Wallet deactivated.")
            else:
                await update.message.reply_text("Wallet not found.")
        finally:
            session.close()

    async def cmd_alerts(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /alerts command - show recent alerts"""
        session = get_session(self.engine)
        try:
            alerts = session.query(Alert).order_by(
                Alert.created_at.desc()
            ).limit(5).all()

            if not alerts:
                await update.message.reply_text("No recent alerts.")
                return

            lines = ["*Recent Alerts*\n"]
            for alert in alerts:
                token = alert.token
                time_ago = (datetime.utcnow() - alert.created_at).total_seconds() / 60

                lines.append(
                    f"*{alert.alert_type.upper()}*\n"
                    f"Token: `{token.contract_address[:8]}...`\n"
                    f"SOL: {alert.total_sol_volume:.2f} | "
                    f"Wallets: {alert.wallet_count} | "
                    f"{time_ago:.0f}m ago\n"
                )

            await update.message.reply_text(
                "\n".join(lines),
                parse_mode=ParseMode.MARKDOWN
            )
        finally:
            session.close()

    async def cmd_report(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /report command - show performance report"""
        await update.message.reply_text("Generating report...")

        session = get_session(self.engine)
        try:
            from alphapulse.services.outcome_tracker import OutcomeTracker

            tracker = OutcomeTracker(session)
            report = tracker.generate_report(days=7)

            await update.message.reply_text(
                report,
                parse_mode=ParseMode.MARKDOWN
            )
        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            await update.message.reply_text(f"Error generating report: {e}")
        finally:
            session.close()

    async def cmd_portfolio(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /portfolio <address> command - show wallet holdings"""
        if not context.args:
            await update.message.reply_text("Usage: /portfolio <wallet_address>")
            return

        address = context.args[0]
        if len(address) < 32 or len(address) > 44:
            await update.message.reply_text("Invalid Solana address.")
            return

        await update.message.reply_text("Fetching portfolio...")

        session = get_session(self.engine)
        try:
            from alphapulse.services.position_tracker import PositionTracker

            tracker = PositionTracker(session)
            portfolio = await tracker.get_wallet_portfolio(address)

            if portfolio.position_count == 0:
                await update.message.reply_text("No token positions found.")
                return

            lines = [
                f"*Portfolio: `{address[:6]}...{address[-4:]}`*\n",
                f"*Total Value:* ${portfolio.total_value_usd:,.0f} ({portfolio.total_value_sol:.2f} SOL)",
                f"*SOL Balance:* {portfolio.sol_balance:.2f} SOL",
                f"*Positions:* {portfolio.position_count}",
                f"*Unrealized PnL:* ${portfolio.total_unrealized_pnl_usd:+,.0f} ({portfolio.total_unrealized_pnl_pct:+.1f}%)\n",
                "*Top Holdings:*"
            ]

            for pos in portfolio.positions[:5]:
                pnl_emoji = "+" if pos.unrealized_pnl_pct >= 0 else ""
                lines.append(
                    f"• *{pos.token_symbol or '???'}*: ${pos.current_value_usd:,.0f} "
                    f"({pnl_emoji}{pos.unrealized_pnl_pct:.1f}%)"
                )

            await update.message.reply_text(
                "\n".join(lines),
                parse_mode=ParseMode.MARKDOWN
            )
        except Exception as e:
            logger.error(f"Portfolio fetch failed: {e}")
            await update.message.reply_text(f"Error fetching portfolio: {e}")
        finally:
            session.close()

    async def cmd_check_token(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /check <token_ca> command - rug check a token"""
        if not context.args:
            await update.message.reply_text("Usage: /check <token_contract_address>")
            return

        token_ca = context.args[0]
        if len(token_ca) < 32 or len(token_ca) > 44:
            await update.message.reply_text("Invalid token address.")
            return

        await update.message.reply_text("Running rug check...")

        try:
            from alphapulse.services.rug_detector import RugDetector

            detector = RugDetector()
            result = await detector.check_token(token_ca)

            # Risk level emoji
            risk_emoji = {
                'low': '',
                'medium': '',
                'high': '',
                'critical': ''
            }.get(result.risk_level.value, '')

            status_emoji = "" if result.passed else ""

            lines = [
                f"*Rug Check: `{token_ca[:8]}...`*\n",
                f"*Status:* {status_emoji} {'PASSED' if result.passed else 'FAILED'}",
                f"*Risk Level:* {risk_emoji} {result.risk_level.value.upper()}",
                f"*Risk Score:* {result.risk_score}/100\n",
                "*Checks:*",
                f"• Mintable: {'Yes' if result.mintable else 'No'}",
                f"• Freezable: {'Yes' if result.freezable else 'No'}",
                f"• LP Unlocked: {'Yes' if result.lp_unlocked else 'No'}",
                f"• Low Liquidity: {'Yes' if result.low_liquidity else 'No'}",
                f"• High Concentration: {'Yes' if result.high_concentration else 'No'}",
                f"• Honeypot Risk: {'Yes' if result.honeypot_risk else 'No'}",
            ]

            if result.warnings:
                lines.append("\n*Warnings:*")
                for w in result.warnings[:5]:
                    lines.append(f"  {w}")

            await update.message.reply_text(
                "\n".join(lines),
                parse_mode=ParseMode.MARKDOWN
            )
        except Exception as e:
            logger.error(f"Rug check failed: {e}")
            await update.message.reply_text(f"Error running rug check: {e}")

    async def cmd_common_holdings(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /holdings command - show tokens held by multiple wallets"""
        await update.message.reply_text("Analyzing common holdings (this may take a minute)...")

        session = get_session(self.engine)
        try:
            from alphapulse.services.position_tracker import PositionTracker

            tracker = PositionTracker(session)
            common = await tracker.get_common_holdings(min_wallets=2)

            if not common:
                await update.message.reply_text("No common holdings found across tracked wallets.")
                return

            lines = ["*Tokens Held by Multiple Smart Wallets*\n"]

            for token in common[:10]:
                lines.append(
                    f"• *{token['symbol'] or '???'}* - {token['holder_count']} wallets\n"
                    f"  `{token['token_address'][:8]}...`\n"
                    f"  Total: ${token['total_value']:,.0f}"
                )

            await update.message.reply_text(
                "\n".join(lines),
                parse_mode=ParseMode.MARKDOWN
            )
        except Exception as e:
            logger.error(f"Holdings analysis failed: {e}")
            await update.message.reply_text(f"Error: {e}")
        finally:
            session.close()

    async def cmd_backtest(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /backtest command - run strategy backtest"""
        days = 7
        if context.args:
            try:
                days = int(context.args[0])
                days = min(max(days, 1), 30)  # Clamp between 1-30
            except ValueError:
                pass

        await update.message.reply_text(f"Running backtest for last {days} days...")

        session = get_session(self.engine)
        try:
            from alphapulse.services.backtester import run_quick_backtest, Backtester

            result = await run_quick_backtest(session, days=days)
            backtester = Backtester(session)
            report = backtester.generate_report(result)

            await update.message.reply_text(
                report,
                parse_mode=ParseMode.MARKDOWN
            )
        except Exception as e:
            logger.error(f"Backtest failed: {e}")
            await update.message.reply_text(f"Error running backtest: {e}")
        finally:
            session.close()

    def _rate_limited(self, user_id: int) -> bool:
        """Check if user is rate limited"""
        now = datetime.utcnow()
        last = _last_command_time.get(user_id)
        if last and (now - last).total_seconds() < RATE_LIMIT_SECONDS:
            return True
        _last_command_time[user_id] = now
        return False

    async def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle inline button callbacks"""
        query = update.callback_query
        await query.answer()

        data = query.data

        # Parse callback data
        if ":" not in data:
            return

        action, value = data.split(":", 1)

        if action == "check_token":
            # Perform rug check on token
            from alphapulse.services.rug_detector import RugDetector
            detector = RugDetector()
            result = await detector.check_token(value)

            status = "" if result.passed else ""
            await query.message.reply_text(
                f"{status} *Rug Check:* {result.risk_level.value.upper()} "
                f"(Score: {result.risk_score})",
                parse_mode=ParseMode.MARKDOWN
            )

        elif action == "view_wallet":
            # Show wallet info
            session = get_session(self.engine)
            try:
                wallet = session.query(SmartWallet).filter(
                    SmartWallet.address == value
                ).first()
                if wallet:
                    await query.message.reply_text(
                        f"*Wallet:* `{value[:8]}...`\n"
                        f"WR: {wallet.win_rate:.0f}% | Score: {wallet.conviction_score:.0f}",
                        parse_mode=ParseMode.MARKDOWN
                    )
            finally:
                session.close()

    async def send_alert(self, alert: Alert, token: Token, wallets: list[dict]):
        """
        Send an alert message to the configured chat

        Args:
            alert: Alert database record
            token: Token database record
            wallets: List of wallet info dicts
        """
        if not self.app:
            logger.warning("Bot not initialized, cannot send alert")
            return

        # Format the alert message
        message = AlertFormatter.format_alert(
            alert_type=alert.alert_type,
            token_name=token.name or "Unknown",
            token_symbol=token.symbol or "???",
            contract_address=token.contract_address,
            market_cap=token.market_cap_sol or 0,
            liquidity=token.liquidity_sol or 0,
            wallets=wallets,
            total_sol=alert.total_sol_volume,
            max_supply_pct=alert.max_supply_pct or 0
        )

        # Add quick-buy buttons
        quick_buy = AlertFormatter.format_quick_buy_buttons(
            token.contract_address,
            settings.trojan_bot_link,
            settings.maestro_bot_link
        )

        full_message = f"{message}\n{quick_buy}"

        # Create inline keyboard for quick actions
        keyboard = [
            [
                InlineKeyboardButton(
                    "Buy on Trojan",
                    url=f"{settings.trojan_bot_link}?start={token.contract_address}"
                ),
                InlineKeyboardButton(
                    "Buy on Maestro",
                    url=f"{settings.maestro_bot_link}?start={token.contract_address}"
                )
            ],
            [
                InlineKeyboardButton(
                    "DexScreener",
                    url=f"https://dexscreener.com/solana/{token.contract_address}"
                ),
                InlineKeyboardButton(
                    "Birdeye",
                    url=f"https://birdeye.so/token/{token.contract_address}"
                )
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        try:
            await self.app.bot.send_message(
                chat_id=settings.telegram_chat_id,
                text=full_message,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=reply_markup,
                disable_web_page_preview=True
            )
            logger.info(f"Alert sent: {alert.alert_type} for {token.contract_address[:8]}...")
        except Exception as e:
            logger.error(f"Failed to send alert: {e}")


async def run_bot():
    """Run the Telegram bot"""
    bot = AlphaPulseBot()
    try:
        await bot.start()
        # Keep running
        import asyncio
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        await bot.stop()
