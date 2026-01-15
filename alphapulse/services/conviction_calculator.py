"""
AlphaPulse Conviction Score Calculator
Ranks wallet reliability based on historical performance
"""

from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass

from sqlalchemy.orm import Session
from sqlalchemy import func

from alphapulse.db.models import SmartWallet, Trade, Alert
from alphapulse.config import settings
from alphapulse.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class WalletMetrics:
    """Detailed metrics for conviction calculation"""
    address: str
    win_rate: float
    total_trades: int
    trades_7d: int
    trades_30d: int
    pnl_total_sol: float
    pnl_7d_sol: float
    avg_hold_time_mins: float
    avg_entry_mcap: float  # Average market cap at entry
    best_trade_multiple: float  # Best single trade ROI
    consistency_score: float  # How consistent are returns
    early_entry_rate: float  # % of trades in first 30 mins of token life
    rug_avoidance_rate: float  # % of tokens that didn't rug


class ConvictionCalculator:
    """
    Calculates conviction scores for smart wallets

    Score Components (0-100 total):
    1. Win Rate (0-30 pts): Higher win rate = more reliable
    2. Consistency (0-20 pts): Consistent returns vs lucky one-offs
    3. Trade Frequency (0-15 pts): Active traders with sample size
    4. PnL Magnitude (0-15 pts): Absolute profit generated
    5. Early Entry (0-10 pts): Ability to find tokens early
    6. Rug Avoidance (0-10 pts): Avoiding scam tokens
    """

    # Weight configuration
    WEIGHT_WIN_RATE = 30
    WEIGHT_CONSISTENCY = 20
    WEIGHT_FREQUENCY = 15
    WEIGHT_PNL = 15
    WEIGHT_EARLY_ENTRY = 10
    WEIGHT_RUG_AVOIDANCE = 10

    def __init__(self, session: Session):
        self.session = session

    def calculate_score(self, wallet: SmartWallet) -> float:
        """
        Calculate conviction score for a wallet

        Args:
            wallet: SmartWallet record

        Returns:
            Conviction score 0-100
        """
        metrics = self._gather_metrics(wallet)

        # Component scores
        win_rate_score = self._score_win_rate(metrics.win_rate)
        consistency_score = self._score_consistency(metrics)
        frequency_score = self._score_frequency(metrics.trades_7d, metrics.trades_30d)
        pnl_score = self._score_pnl(metrics.pnl_total_sol, metrics.pnl_7d_sol)
        early_entry_score = self._score_early_entry(metrics.early_entry_rate)
        rug_avoidance_score = self._score_rug_avoidance(metrics.rug_avoidance_rate)

        # Weighted total
        total_score = (
            win_rate_score +
            consistency_score +
            frequency_score +
            pnl_score +
            early_entry_score +
            rug_avoidance_score
        )

        logger.debug(
            f"Conviction score for {wallet.address[:8]}...: {total_score:.1f} "
            f"(WR:{win_rate_score:.1f} CON:{consistency_score:.1f} FREQ:{frequency_score:.1f} "
            f"PNL:{pnl_score:.1f} EARLY:{early_entry_score:.1f} RUG:{rug_avoidance_score:.1f})"
        )

        return min(100, max(0, total_score))

    def _gather_metrics(self, wallet: SmartWallet) -> WalletMetrics:
        """Gather all metrics needed for score calculation"""
        now = datetime.utcnow()
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        # Get trades
        all_trades = self.session.query(Trade).filter(
            Trade.wallet_id == wallet.id
        ).all()

        trades_7d = [t for t in all_trades if t.block_time >= seven_days_ago]
        trades_30d = [t for t in all_trades if t.block_time >= thirty_days_ago]

        # Calculate metrics
        buy_trades = [t for t in all_trades if t.trade_type == 'BUY']
        sell_trades = [t for t in all_trades if t.trade_type == 'SELL']

        # Early entry rate (trades on tokens < 30 mins old)
        early_entries = 0
        for trade in buy_trades:
            if trade.token and trade.token.launched_at:
                entry_age = (trade.block_time - trade.token.launched_at).total_seconds() / 60
                if entry_age <= 30:
                    early_entries += 1
        early_entry_rate = (early_entries / len(buy_trades) * 100) if buy_trades else 0

        # Rug avoidance (tokens that didn't rug)
        tokens_traded = set(t.token_id for t in buy_trades)
        rugged_tokens = self.session.query(func.count()).filter(
            Trade.token_id.in_(tokens_traded),
            Trade.token.has(is_rugged=True)
        ).scalar() or 0
        rug_avoidance = ((len(tokens_traded) - rugged_tokens) / len(tokens_traded) * 100) if tokens_traded else 100

        # Average entry market cap
        entry_mcaps = [t.mcap_at_trade for t in buy_trades if t.mcap_at_trade]
        avg_entry_mcap = sum(entry_mcaps) / len(entry_mcaps) if entry_mcaps else 0

        # Best trade multiple (simplified - would need full PnL tracking)
        best_multiple = 1.0  # Placeholder

        # Consistency score (standard deviation of returns)
        consistency = self._calculate_consistency(wallet)

        return WalletMetrics(
            address=wallet.address,
            win_rate=wallet.win_rate,
            total_trades=wallet.total_trades,
            trades_7d=len(trades_7d),
            trades_30d=len(trades_30d),
            pnl_total_sol=wallet.pnl_total_sol,
            pnl_7d_sol=wallet.pnl_7d_sol,
            avg_hold_time_mins=wallet.avg_hold_time_mins or 0,
            avg_entry_mcap=avg_entry_mcap,
            best_trade_multiple=best_multiple,
            consistency_score=consistency,
            early_entry_rate=early_entry_rate,
            rug_avoidance_rate=rug_avoidance
        )

    def _calculate_consistency(self, wallet: SmartWallet) -> float:
        """
        Calculate consistency of returns
        Lower variance = more consistent = higher score

        Returns:
            0-100 consistency score
        """
        # Get PnL per token traded
        trades_by_token = {}
        trades = self.session.query(Trade).filter(
            Trade.wallet_id == wallet.id
        ).all()

        for trade in trades:
            if trade.token_id not in trades_by_token:
                trades_by_token[trade.token_id] = {'buys': 0, 'sells': 0}
            if trade.trade_type == 'BUY':
                trades_by_token[trade.token_id]['buys'] += trade.sol_amount
            else:
                trades_by_token[trade.token_id]['sells'] += trade.sol_amount

        # Calculate PnL per token
        pnls = []
        for token_id, amounts in trades_by_token.items():
            pnl = amounts['sells'] - amounts['buys']
            pnls.append(pnl)

        if len(pnls) < 3:
            return 50  # Not enough data

        # Calculate coefficient of variation
        avg_pnl = sum(pnls) / len(pnls)
        if avg_pnl == 0:
            return 50

        variance = sum((p - avg_pnl) ** 2 for p in pnls) / len(pnls)
        std_dev = variance ** 0.5
        cv = abs(std_dev / avg_pnl) if avg_pnl != 0 else 1

        # Convert CV to score (lower CV = higher consistency)
        # CV of 0 = 100 score, CV of 2+ = 0 score
        consistency_score = max(0, 100 - (cv * 50))
        return consistency_score

    def _score_win_rate(self, win_rate: float) -> float:
        """Score win rate component (0-30 pts)"""
        # 50% WR = 0 pts, 100% WR = 30 pts (linear)
        if win_rate <= 50:
            return 0
        return ((win_rate - 50) / 50) * self.WEIGHT_WIN_RATE

    def _score_consistency(self, metrics: WalletMetrics) -> float:
        """Score consistency component (0-20 pts)"""
        return (metrics.consistency_score / 100) * self.WEIGHT_CONSISTENCY

    def _score_frequency(self, trades_7d: int, trades_30d: int) -> float:
        """Score trade frequency component (0-15 pts)"""
        # Need at least 10 trades in 7d for full score
        # 5 trades = 50%, 10+ trades = 100%
        ratio = min(1.0, trades_7d / 10)
        return ratio * self.WEIGHT_FREQUENCY

    def _score_pnl(self, pnl_total: float, pnl_7d: float) -> float:
        """Score PnL magnitude component (0-15 pts)"""
        # Scale: 0 SOL = 0 pts, 100 SOL = full pts
        if pnl_total <= 0:
            return 0
        ratio = min(1.0, pnl_total / 100)
        return ratio * self.WEIGHT_PNL

    def _score_early_entry(self, early_rate: float) -> float:
        """Score early entry ability (0-10 pts)"""
        # 0% early = 0 pts, 50%+ early = full pts
        ratio = min(1.0, early_rate / 50)
        return ratio * self.WEIGHT_EARLY_ENTRY

    def _score_rug_avoidance(self, avoidance_rate: float) -> float:
        """Score rug avoidance (0-10 pts)"""
        # 50% avoidance = 0 pts, 100% avoidance = full pts
        if avoidance_rate <= 50:
            return 0
        ratio = (avoidance_rate - 50) / 50
        return ratio * self.WEIGHT_RUG_AVOIDANCE

    def update_all_scores(self) -> int:
        """
        Recalculate conviction scores for all active wallets

        Returns:
            Number of wallets updated
        """
        wallets = self.session.query(SmartWallet).filter(
            SmartWallet.is_active == True
        ).all()

        updated = 0
        for wallet in wallets:
            try:
                new_score = self.calculate_score(wallet)
                wallet.conviction_score = new_score
                updated += 1
            except Exception as e:
                logger.warning(f"Failed to update score for {wallet.address[:8]}...: {e}")

        self.session.commit()
        logger.info(f"Updated conviction scores for {updated} wallets")
        return updated

    def get_top_wallets(self, limit: int = 20, min_score: float = 50) -> list[SmartWallet]:
        """Get top wallets by conviction score"""
        return self.session.query(SmartWallet).filter(
            SmartWallet.is_active == True,
            SmartWallet.conviction_score >= min_score
        ).order_by(
            SmartWallet.conviction_score.desc()
        ).limit(limit).all()
