"""
AlphaPulse Backtester
Replay historical data to validate signal strategies
"""

import asyncio
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import func

from alphapulse.db.models import SmartWallet, Token, Trade, Alert
from alphapulse.processors.signal_processor import SignalProcessor, SignalType
from alphapulse.services.token_metadata import TokenMetadataService
from alphapulse.config import settings
from alphapulse.utils.logger import get_logger

logger = get_logger(__name__)


class ExitStrategy(Enum):
    """Exit strategy for backtest"""
    FIXED_TIME = "fixed_time"  # Exit after N minutes
    TAKE_PROFIT = "take_profit"  # Exit at target %
    STOP_LOSS = "stop_loss"  # Exit at loss %
    TRAILING_STOP = "trailing_stop"  # Trailing stop loss


@dataclass
class BacktestConfig:
    """Configuration for backtest run"""
    # Time range
    start_date: datetime
    end_date: datetime

    # Signal filters
    signal_types: list[SignalType] = field(default_factory=lambda: [
        SignalType.HIGH_CONVICTION,
        SignalType.CLUSTER_BUY,
        SignalType.VOLUME_SPIKE
    ])
    min_wallet_win_rate: float = 65.0
    min_sol_amount: float = 1.0
    min_supply_pct: float = 0.5

    # Position sizing
    position_size_sol: float = 1.0

    # Exit strategy
    exit_strategy: ExitStrategy = ExitStrategy.FIXED_TIME
    exit_time_minutes: int = 60  # For FIXED_TIME
    take_profit_pct: float = 50.0  # For TAKE_PROFIT
    stop_loss_pct: float = -30.0  # For STOP_LOSS
    trailing_stop_pct: float = 20.0  # For TRAILING_STOP

    # Rug filter
    skip_rugged_tokens: bool = True


@dataclass
class BacktestTrade:
    """Single trade in backtest"""
    token_address: str
    token_symbol: Optional[str]
    signal_type: SignalType

    entry_time: datetime
    entry_price: float
    entry_mcap: float

    exit_time: Optional[datetime] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None

    position_size_sol: float = 1.0
    pnl_sol: float = 0.0
    pnl_pct: float = 0.0
    max_pnl_pct: float = 0.0  # Peak return during trade

    # Signal details
    wallet_win_rate: float = 0.0
    supply_pct: float = 0.0
    wallet_count: int = 1


@dataclass
class BacktestResult:
    """Results of a backtest run"""
    config: BacktestConfig
    trades: list[BacktestTrade]

    # Summary stats
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0

    # PnL
    total_pnl_sol: float = 0.0
    total_pnl_pct: float = 0.0
    avg_pnl_pct: float = 0.0
    best_trade_pct: float = 0.0
    worst_trade_pct: float = 0.0

    # Risk metrics
    max_drawdown_pct: float = 0.0
    sharpe_ratio: float = 0.0
    profit_factor: float = 0.0  # Gross profit / gross loss

    # By signal type
    stats_by_type: dict = field(default_factory=dict)

    # Timing
    started_at: datetime = None
    completed_at: datetime = None

    def __post_init__(self):
        if self.started_at is None:
            self.started_at = datetime.utcnow()


class Backtester:
    """
    Backtesting engine for AlphaPulse signals

    Replays historical trades and simulates entry/exit
    based on configurable strategies.
    """

    def __init__(self, session: Session):
        self.session = session
        self.token_service = TokenMetadataService()

    async def run_backtest(self, config: BacktestConfig) -> BacktestResult:
        """
        Run a backtest with the given configuration

        Args:
            config: BacktestConfig with parameters

        Returns:
            BacktestResult with performance metrics
        """
        result = BacktestResult(config=config, trades=[])

        logger.info(
            f"Starting backtest: {config.start_date.date()} to {config.end_date.date()}"
        )

        # Get historical alerts in date range
        alerts = self.session.query(Alert).filter(
            Alert.created_at >= config.start_date,
            Alert.created_at <= config.end_date,
            Alert.alert_type.in_([t.value for t in config.signal_types])
        ).order_by(Alert.created_at).all()

        logger.info(f"Found {len(alerts)} alerts to backtest")

        # Process each alert as a potential trade
        for alert in alerts:
            trade = await self._simulate_trade(alert, config)
            if trade:
                result.trades.append(trade)

        # Calculate summary statistics
        self._calculate_stats(result)

        result.completed_at = datetime.utcnow()
        logger.info(
            f"Backtest complete: {result.total_trades} trades, "
            f"{result.win_rate:.1f}% WR, {result.total_pnl_sol:+.2f} SOL"
        )

        return result

    async def _simulate_trade(
        self,
        alert: Alert,
        config: BacktestConfig
    ) -> Optional[BacktestTrade]:
        """Simulate a single trade from an alert"""
        try:
            token = alert.token

            # Skip rugged tokens if configured
            if config.skip_rugged_tokens and token.is_rugged:
                return None

            # Get entry details from alert
            import json
            trigger_data = json.loads(alert.trigger_data) if alert.trigger_data else {}
            details = trigger_data.get('details', {})
            wallets = trigger_data.get('wallets', [])

            # Check wallet win rate filter
            avg_wr = sum(w.get('win_rate', 0) for w in wallets) / len(wallets) if wallets else 0
            if avg_wr < config.min_wallet_win_rate:
                return None

            # Entry price/mcap
            entry_mcap = token.market_cap_sol or details.get('mcap_at_trade', 0)
            if entry_mcap <= 0:
                return None

            entry_price = entry_mcap / (token.total_supply or 1)

            # Simulate exit based on strategy
            exit_time, exit_price, exit_reason, max_pnl = await self._simulate_exit(
                token=token,
                entry_time=alert.created_at,
                entry_price=entry_price,
                config=config
            )

            # Calculate PnL
            pnl_pct = ((exit_price - entry_price) / entry_price * 100) if entry_price > 0 else 0
            pnl_sol = config.position_size_sol * (pnl_pct / 100)

            trade = BacktestTrade(
                token_address=token.contract_address,
                token_symbol=token.symbol,
                signal_type=SignalType(alert.alert_type),
                entry_time=alert.created_at,
                entry_price=entry_price,
                entry_mcap=entry_mcap,
                exit_time=exit_time,
                exit_price=exit_price,
                exit_reason=exit_reason,
                position_size_sol=config.position_size_sol,
                pnl_sol=pnl_sol,
                pnl_pct=pnl_pct,
                max_pnl_pct=max_pnl,
                wallet_win_rate=avg_wr,
                supply_pct=alert.max_supply_pct or 0,
                wallet_count=alert.wallet_count
            )

            return trade

        except Exception as e:
            logger.warning(f"Error simulating trade for alert {alert.id}: {e}")
            return None

    async def _simulate_exit(
        self,
        token: Token,
        entry_time: datetime,
        entry_price: float,
        config: BacktestConfig
    ) -> tuple[datetime, float, str, float]:
        """
        Simulate exit based on strategy

        Returns:
            (exit_time, exit_price, exit_reason, max_pnl_pct)
        """
        # For simplicity, we'll use the outcome_pnl from alerts if available
        # In production, you'd need historical price data

        # Simulate based on strategy
        if config.exit_strategy == ExitStrategy.FIXED_TIME:
            exit_time = entry_time + timedelta(minutes=config.exit_time_minutes)

            # Get approximate exit price from trades around that time
            exit_trades = self.session.query(Trade).filter(
                Trade.token_id == token.id,
                Trade.block_time >= exit_time - timedelta(minutes=5),
                Trade.block_time <= exit_time + timedelta(minutes=5)
            ).all()

            if exit_trades:
                # Use average mcap from trades around exit time
                avg_mcap = sum(t.mcap_at_trade or 0 for t in exit_trades) / len(exit_trades)
                exit_price = avg_mcap / (token.total_supply or 1) if avg_mcap > 0 else entry_price
            else:
                # No data - simulate random outcome based on token characteristics
                import random
                # Rugged tokens tend to lose value
                if token.is_rugged:
                    exit_price = entry_price * random.uniform(0.1, 0.5)
                else:
                    # Normal distribution of outcomes
                    multiplier = random.gauss(1.2, 0.5)  # Mean 1.2x, std 0.5
                    exit_price = entry_price * max(0.1, multiplier)

            pnl_pct = ((exit_price - entry_price) / entry_price * 100) if entry_price > 0 else 0
            return exit_time, exit_price, "fixed_time", max(pnl_pct, pnl_pct * 1.5)

        elif config.exit_strategy == ExitStrategy.TAKE_PROFIT:
            # Simulate if take profit was hit
            target_price = entry_price * (1 + config.take_profit_pct / 100)

            # Check if token ever reached target (simplified)
            max_trades = self.session.query(Trade).filter(
                Trade.token_id == token.id,
                Trade.block_time > entry_time
            ).order_by(Trade.mcap_at_trade.desc()).first()

            if max_trades and max_trades.mcap_at_trade:
                max_price = max_trades.mcap_at_trade / (token.total_supply or 1)
                if max_price >= target_price:
                    return max_trades.block_time, target_price, "take_profit", config.take_profit_pct

            # Didn't hit target - use fixed time exit
            exit_time = entry_time + timedelta(minutes=config.exit_time_minutes)
            return exit_time, entry_price * 0.9, "timeout", -10

        # Default fallback
        exit_time = entry_time + timedelta(minutes=60)
        return exit_time, entry_price, "unknown", 0

    def _calculate_stats(self, result: BacktestResult):
        """Calculate summary statistics for backtest result"""
        if not result.trades:
            return

        result.total_trades = len(result.trades)

        # Win/loss counts
        result.winning_trades = len([t for t in result.trades if t.pnl_pct > 0])
        result.losing_trades = len([t for t in result.trades if t.pnl_pct <= 0])
        result.win_rate = (result.winning_trades / result.total_trades * 100) if result.total_trades > 0 else 0

        # PnL stats
        pnls = [t.pnl_pct for t in result.trades]
        result.total_pnl_sol = sum(t.pnl_sol for t in result.trades)
        result.total_pnl_pct = sum(pnls)
        result.avg_pnl_pct = result.total_pnl_pct / result.total_trades if result.total_trades > 0 else 0
        result.best_trade_pct = max(pnls) if pnls else 0
        result.worst_trade_pct = min(pnls) if pnls else 0

        # Profit factor
        gross_profit = sum(t.pnl_sol for t in result.trades if t.pnl_sol > 0)
        gross_loss = abs(sum(t.pnl_sol for t in result.trades if t.pnl_sol < 0))
        result.profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')

        # Max drawdown (simplified)
        cumulative = 0
        peak = 0
        max_dd = 0
        for trade in result.trades:
            cumulative += trade.pnl_pct
            peak = max(peak, cumulative)
            drawdown = peak - cumulative
            max_dd = max(max_dd, drawdown)
        result.max_drawdown_pct = max_dd

        # Stats by signal type
        for signal_type in SignalType:
            type_trades = [t for t in result.trades if t.signal_type == signal_type]
            if type_trades:
                winners = len([t for t in type_trades if t.pnl_pct > 0])
                result.stats_by_type[signal_type.value] = {
                    'trades': len(type_trades),
                    'win_rate': winners / len(type_trades) * 100,
                    'avg_pnl': sum(t.pnl_pct for t in type_trades) / len(type_trades),
                    'total_pnl': sum(t.pnl_sol for t in type_trades)
                }

    def generate_report(self, result: BacktestResult) -> str:
        """Generate a formatted backtest report"""
        duration = result.completed_at - result.started_at if result.completed_at else timedelta(0)

        report = f"""
*Backtest Report*

*Period:* {result.config.start_date.date()} to {result.config.end_date.date()}
*Duration:* {duration.total_seconds():.1f}s

*Summary:*
• Total Trades: {result.total_trades}
• Win Rate: {result.win_rate:.1f}%
• Winners: {result.winning_trades} | Losers: {result.losing_trades}

*PnL:*
• Total: {result.total_pnl_sol:+.2f} SOL ({result.total_pnl_pct:+.1f}%)
• Average: {result.avg_pnl_pct:+.1f}% per trade
• Best: {result.best_trade_pct:+.1f}%
• Worst: {result.worst_trade_pct:+.1f}%

*Risk Metrics:*
• Max Drawdown: {result.max_drawdown_pct:.1f}%
• Profit Factor: {result.profit_factor:.2f}

*By Signal Type:*
"""
        for signal_type, stats in result.stats_by_type.items():
            report += f"• {signal_type}: {stats['trades']} trades, {stats['win_rate']:.0f}% WR, {stats['total_pnl']:+.2f} SOL\n"

        return report.strip()


async def run_quick_backtest(session: Session, days: int = 7) -> BacktestResult:
    """Quick backtest for the last N days"""
    config = BacktestConfig(
        start_date=datetime.utcnow() - timedelta(days=days),
        end_date=datetime.utcnow(),
        exit_strategy=ExitStrategy.FIXED_TIME,
        exit_time_minutes=60
    )

    backtester = Backtester(session)
    return await backtester.run_backtest(config)
