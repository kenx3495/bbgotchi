"""
AlphaPulse Outcome Tracker
Tracks performance of alerts - did they result in profit?
"""

from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import func

from alphapulse.db.models import Alert, Token, Trade
from alphapulse.services.token_metadata import TokenMetadataService
from alphapulse.utils.logger import get_logger

logger = get_logger(__name__)


class OutcomeStatus(Enum):
    """Alert outcome classification"""
    PENDING = "pending"  # Not enough time elapsed
    WINNER = "winner"  # Profitable
    LOSER = "loser"  # Loss
    RUGGED = "rugged"  # Token rugged
    UNKNOWN = "unknown"  # Couldn't determine


@dataclass
class AlertOutcome:
    """Detailed outcome for a single alert"""
    alert_id: int
    token_ca: str
    status: OutcomeStatus

    # Price data
    price_at_alert: float
    price_current: float
    price_ath: float  # All-time high after alert

    # Returns
    return_pct: float  # Current return %
    ath_return_pct: float  # Max return % reached

    # Timing
    time_to_ath_mins: float  # How long to reach ATH
    alert_age_mins: float

    # Meta
    checked_at: datetime = None

    def __post_init__(self):
        if self.checked_at is None:
            self.checked_at = datetime.utcnow()


@dataclass
class PerformanceStats:
    """Aggregate performance statistics"""
    total_alerts: int
    winners: int
    losers: int
    rugged: int
    pending: int

    win_rate: float  # % of resolved alerts that were winners
    avg_return_pct: float  # Average return on winners
    avg_loss_pct: float  # Average loss on losers
    best_return_pct: float
    worst_loss_pct: float

    # By signal type
    high_conviction_win_rate: float
    cluster_buy_win_rate: float
    volume_spike_win_rate: float


class OutcomeTracker:
    """
    Tracks and analyzes alert outcomes

    Checks alerts after configurable time windows:
    - 5 minutes: Quick flip potential
    - 30 minutes: Short-term outcome
    - 4 hours: Medium-term outcome
    - 24 hours: Final outcome
    """

    # Time windows to check (in minutes)
    CHECK_WINDOWS = [5, 30, 240, 1440]

    # Thresholds
    WIN_THRESHOLD_PCT = 20  # >20% gain = winner
    LOSS_THRESHOLD_PCT = -30  # <-30% loss = loser
    RUG_THRESHOLD_PCT = -80  # <-80% = probably rugged

    def __init__(self, session: Session, token_service: TokenMetadataService = None):
        self.session = session
        self.token_service = token_service or TokenMetadataService()

    async def check_alert_outcome(self, alert: Alert) -> AlertOutcome:
        """
        Check the outcome of a single alert

        Args:
            alert: Alert record to check

        Returns:
            AlertOutcome with current status
        """
        token = alert.token
        alert_age_mins = (datetime.utcnow() - alert.created_at).total_seconds() / 60

        # Get current price
        metadata = await self.token_service.get_token_metadata(token.contract_address)
        current_price = metadata.price_usd

        # Get price at alert time (from mcap_at_trade of triggering trade)
        trigger_trades = self.session.query(Trade).filter(
            Trade.token_id == token.id,
            Trade.block_time >= alert.created_at - timedelta(minutes=1),
            Trade.block_time <= alert.created_at + timedelta(minutes=1)
        ).all()

        if trigger_trades and trigger_trades[0].mcap_at_trade:
            # Estimate price from mcap
            price_at_alert = trigger_trades[0].mcap_at_trade / (metadata.total_supply or 1)
        else:
            price_at_alert = current_price  # Fallback

        # Calculate returns
        if price_at_alert > 0:
            return_pct = ((current_price - price_at_alert) / price_at_alert) * 100
        else:
            return_pct = 0

        # Determine ATH (would need price history - simplified here)
        price_ath = max(current_price, price_at_alert * 1.5)  # Placeholder
        ath_return_pct = ((price_ath - price_at_alert) / price_at_alert) * 100 if price_at_alert > 0 else 0

        # Determine status
        if alert_age_mins < 30:
            status = OutcomeStatus.PENDING
        elif return_pct <= self.RUG_THRESHOLD_PCT:
            status = OutcomeStatus.RUGGED
            token.is_rugged = True
            self.session.commit()
        elif return_pct >= self.WIN_THRESHOLD_PCT:
            status = OutcomeStatus.WINNER
        elif return_pct <= self.LOSS_THRESHOLD_PCT:
            status = OutcomeStatus.LOSER
        else:
            status = OutcomeStatus.PENDING

        outcome = AlertOutcome(
            alert_id=alert.id,
            token_ca=token.contract_address,
            status=status,
            price_at_alert=price_at_alert,
            price_current=current_price,
            price_ath=price_ath,
            return_pct=return_pct,
            ath_return_pct=ath_return_pct,
            time_to_ath_mins=15,  # Placeholder
            alert_age_mins=alert_age_mins
        )

        # Update alert record
        alert.outcome_pnl = return_pct
        alert.outcome_checked_at = datetime.utcnow()
        self.session.commit()

        logger.info(
            f"Alert {alert.id} outcome: {status.value} "
            f"({return_pct:+.1f}% after {alert_age_mins:.0f}m)"
        )

        return outcome

    async def check_pending_alerts(self) -> list[AlertOutcome]:
        """Check all alerts that need outcome evaluation"""
        # Get alerts older than 30 mins that haven't been checked recently
        cutoff = datetime.utcnow() - timedelta(minutes=30)
        recheck_cutoff = datetime.utcnow() - timedelta(hours=4)

        alerts = self.session.query(Alert).filter(
            Alert.created_at <= cutoff,
            (Alert.outcome_checked_at == None) | (Alert.outcome_checked_at <= recheck_cutoff)
        ).limit(50).all()

        outcomes = []
        for alert in alerts:
            try:
                outcome = await self.check_alert_outcome(alert)
                outcomes.append(outcome)
            except Exception as e:
                logger.warning(f"Failed to check alert {alert.id}: {e}")

        return outcomes

    def get_performance_stats(self, days: int = 7) -> PerformanceStats:
        """
        Calculate aggregate performance statistics

        Args:
            days: Number of days to analyze

        Returns:
            PerformanceStats with win rates and returns
        """
        cutoff = datetime.utcnow() - timedelta(days=days)

        alerts = self.session.query(Alert).filter(
            Alert.created_at >= cutoff,
            Alert.outcome_pnl != None
        ).all()

        if not alerts:
            return PerformanceStats(
                total_alerts=0, winners=0, losers=0, rugged=0, pending=0,
                win_rate=0, avg_return_pct=0, avg_loss_pct=0,
                best_return_pct=0, worst_loss_pct=0,
                high_conviction_win_rate=0, cluster_buy_win_rate=0, volume_spike_win_rate=0
            )

        # Categorize
        winners = [a for a in alerts if a.outcome_pnl >= self.WIN_THRESHOLD_PCT]
        losers = [a for a in alerts if a.outcome_pnl <= self.LOSS_THRESHOLD_PCT]
        rugged = [a for a in alerts if a.outcome_pnl <= self.RUG_THRESHOLD_PCT]

        # Calculate stats
        resolved = len(winners) + len(losers)
        win_rate = (len(winners) / resolved * 100) if resolved > 0 else 0

        winner_returns = [a.outcome_pnl for a in winners]
        loser_returns = [a.outcome_pnl for a in losers]

        avg_return = sum(winner_returns) / len(winner_returns) if winner_returns else 0
        avg_loss = sum(loser_returns) / len(loser_returns) if loser_returns else 0

        all_returns = [a.outcome_pnl for a in alerts]
        best = max(all_returns) if all_returns else 0
        worst = min(all_returns) if all_returns else 0

        # By signal type
        def win_rate_for_type(alert_type: str) -> float:
            type_alerts = [a for a in alerts if a.alert_type == alert_type]
            type_winners = [a for a in type_alerts if a.outcome_pnl >= self.WIN_THRESHOLD_PCT]
            type_resolved = len([a for a in type_alerts if a.outcome_pnl <= self.LOSS_THRESHOLD_PCT]) + len(type_winners)
            return (len(type_winners) / type_resolved * 100) if type_resolved > 0 else 0

        pending_count = self.session.query(Alert).filter(
            Alert.created_at >= cutoff,
            Alert.outcome_pnl == None
        ).count()

        return PerformanceStats(
            total_alerts=len(alerts) + pending_count,
            winners=len(winners),
            losers=len(losers),
            rugged=len(rugged),
            pending=pending_count,
            win_rate=win_rate,
            avg_return_pct=avg_return,
            avg_loss_pct=avg_loss,
            best_return_pct=best,
            worst_loss_pct=worst,
            high_conviction_win_rate=win_rate_for_type('high_conviction'),
            cluster_buy_win_rate=win_rate_for_type('cluster_buy'),
            volume_spike_win_rate=win_rate_for_type('volume_spike')
        )

    def generate_report(self, days: int = 7) -> str:
        """Generate a formatted performance report"""
        stats = self.get_performance_stats(days)

        report = f"""
📊 *AlphaPulse Performance Report ({days}d)*

*Overview:*
• Total Alerts: {stats.total_alerts}
• Winners: {stats.winners} ({stats.win_rate:.1f}%)
• Losers: {stats.losers}
• Rugged: {stats.rugged}
• Pending: {stats.pending}

*Returns:*
• Avg Winner: +{stats.avg_return_pct:.1f}%
• Avg Loser: {stats.avg_loss_pct:.1f}%
• Best Trade: +{stats.best_return_pct:.1f}%
• Worst Trade: {stats.worst_loss_pct:.1f}%

*By Signal Type:*
• High Conviction: {stats.high_conviction_win_rate:.1f}% WR
• Cluster Buy: {stats.cluster_buy_win_rate:.1f}% WR
• Volume Spike: {stats.volume_spike_win_rate:.1f}% WR
"""
        return report.strip()
