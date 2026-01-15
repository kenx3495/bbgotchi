"""
AlphaPulse Signal Processor
Implements high conviction detection, cluster buying, and volume spike logic
With integrated rug detection and token metadata enrichment
"""

import json
import asyncio
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional
from enum import Enum

from sqlalchemy.orm import Session

from alphapulse.db.models import (
    SmartWallet, Token, Trade, Alert, ClusterEvent,
    WalletRepository, TradeRepository
)
from alphapulse.config import settings
from alphapulse.utils.logger import get_logger

logger = get_logger(__name__)

# Lazy imports to avoid circular dependencies
_rug_detector = None
_token_service = None


def _get_rug_detector():
    """Lazy load rug detector"""
    global _rug_detector
    if _rug_detector is None:
        from alphapulse.services.rug_detector import RugDetector
        _rug_detector = RugDetector()
    return _rug_detector


def _get_token_service():
    """Lazy load token metadata service"""
    global _token_service
    if _token_service is None:
        from alphapulse.services.token_metadata import TokenMetadataService
        _token_service = TokenMetadataService()
    return _token_service


class SignalType(Enum):
    """Types of signals that can trigger alerts"""
    HIGH_CONVICTION = "high_conviction"
    CLUSTER_BUY = "cluster_buy"
    VOLUME_SPIKE = "volume_spike"


@dataclass
class SignalResult:
    """Result of signal detection"""
    triggered: bool
    signal_type: SignalType
    token: Optional[Token] = None
    trades: list = None
    wallets: list = None
    total_sol: float = 0.0
    max_supply_pct: float = 0.0
    details: dict = None

    # Rug check results
    rug_checked: bool = False
    rug_passed: bool = True
    rug_risk_score: int = 0
    rug_warnings: list = None

    def __post_init__(self):
        if self.trades is None:
            self.trades = []
        if self.wallets is None:
            self.wallets = []
        if self.details is None:
            self.details = {}
        if self.rug_warnings is None:
            self.rug_warnings = []


class SignalProcessor:
    """
    Core signal processing engine

    Implements the three signal triggers from the spec:
    1. High Conviction Buy: wallet buys >1 SOL AND >0.5% supply
    2. Cluster Buying: 2+ tracked wallets buy same token within 5 mins
    3. Volume Spike: New token (<60 min) with 5-min volume >10% of mcap
    """

    def __init__(self, session: Session):
        self.session = session
        self.wallet_repo = WalletRepository(session)
        self.trade_repo = TradeRepository(session)

        # Load thresholds from config
        self.high_conviction_min_sol = settings.high_conviction_min_sol
        self.high_conviction_min_supply = settings.high_conviction_min_supply_pct
        self.cluster_min_wallets = settings.cluster_min_wallets
        self.cluster_window_mins = settings.cluster_window_minutes
        self.cluster_min_sol = settings.cluster_min_sol
        self.volume_spike_threshold = settings.volume_spike_threshold
        self.new_token_max_age = settings.new_token_max_age_minutes

    def process_buy_event(
        self,
        wallet_address: str,
        token_ca: str,
        sol_amount: float,
        token_amount: float,
        tx_signature: str,
        block_time: datetime,
        market_cap: Optional[float] = None,
        total_supply: Optional[float] = None,
    ) -> list[SignalResult]:
        """
        Process an incoming buy event and check all signal conditions

        Args:
            wallet_address: Buyer's Solana address
            token_ca: Token contract address
            sol_amount: Amount of SOL spent
            token_amount: Amount of tokens received
            tx_signature: Transaction signature
            block_time: Transaction timestamp
            market_cap: Current market cap in SOL (optional)
            total_supply: Token total supply (optional)

        Returns:
            List of triggered signals
        """
        signals = []

        # Get or create wallet record
        wallet = self.wallet_repo.get_by_address(wallet_address)
        if not wallet:
            logger.debug(f"Unknown wallet {wallet_address[:8]}..., skipping")
            return signals

        # Get or create token record
        token = self._get_or_create_token(token_ca, market_cap, total_supply)

        # Calculate supply percentage
        supply_pct = 0.0
        if total_supply and total_supply > 0:
            supply_pct = (token_amount / total_supply) * 100

        # Record the trade
        trade = self._record_trade(
            wallet=wallet,
            token=token,
            sol_amount=sol_amount,
            token_amount=token_amount,
            supply_pct=supply_pct,
            tx_signature=tx_signature,
            block_time=block_time,
            market_cap=market_cap
        )

        # Check Signal 1: High Conviction Buy
        hc_signal = self._check_high_conviction(wallet, trade, token, supply_pct, sol_amount)
        if hc_signal.triggered:
            signals.append(hc_signal)
            logger.info(f"HIGH CONVICTION: {wallet.address[:8]}... bought {supply_pct:.2f}% of {token.symbol}")

        # Check Signal 2: Cluster Buying
        cluster_signal = self._check_cluster_buying(token)
        if cluster_signal.triggered:
            signals.append(cluster_signal)
            logger.info(f"CLUSTER BUY: {cluster_signal.details.get('wallet_count')} wallets on {token.symbol}")

        # Check Signal 3: Volume Spike (only for new tokens)
        if token.age_minutes() <= self.new_token_max_age:
            volume_signal = self._check_volume_spike(token)
            if volume_signal.triggered:
                signals.append(volume_signal)
                logger.info(f"VOLUME SPIKE: {token.symbol} volume ratio {volume_signal.details.get('volume_ratio'):.2f}")

        return signals

    def _check_high_conviction(
        self,
        wallet: SmartWallet,
        trade: Trade,
        token: Token,
        supply_pct: float,
        sol_amount: float
    ) -> SignalResult:
        """
        Check High Conviction Buy condition:
        - Wallet purchases >1.0 SOL
        - Purchase represents >0.5% of total supply
        """
        triggered = (
            sol_amount >= self.high_conviction_min_sol and
            supply_pct >= self.high_conviction_min_supply
        )

        return SignalResult(
            triggered=triggered,
            signal_type=SignalType.HIGH_CONVICTION,
            token=token,
            trades=[trade],
            wallets=[wallet],
            total_sol=sol_amount,
            max_supply_pct=supply_pct,
            details={
                'wallet_address': wallet.address,
                'wallet_win_rate': wallet.win_rate,
                'sol_amount': sol_amount,
                'supply_pct': supply_pct,
                'conviction_score': wallet.conviction_score
            }
        )

    def _check_cluster_buying(self, token: Token) -> SignalResult:
        """
        Check Cluster Buying condition:
        - 2+ tracked wallets purchase same token
        - Within 5-minute window
        - Minimum 0.5 SOL each
        """
        is_cluster, trades = self.trade_repo.check_cluster_condition(
            token_id=token.id,
            min_wallets=self.cluster_min_wallets,
            window_mins=self.cluster_window_mins,
            min_sol=self.cluster_min_sol
        )

        if not is_cluster:
            return SignalResult(triggered=False, signal_type=SignalType.CLUSTER_BUY)

        # Gather wallet details
        wallets = []
        wallet_addresses = []
        total_sol = 0.0
        max_supply = 0.0

        for trade in trades:
            if trade.wallet.address not in wallet_addresses:
                wallet_addresses.append(trade.wallet.address)
                wallets.append(trade.wallet)
            total_sol += trade.sol_amount
            max_supply = max(max_supply, trade.supply_percentage or 0)

        # Record cluster event
        self._record_cluster_event(token, trades)

        return SignalResult(
            triggered=True,
            signal_type=SignalType.CLUSTER_BUY,
            token=token,
            trades=trades,
            wallets=wallets,
            total_sol=total_sol,
            max_supply_pct=max_supply,
            details={
                'wallet_count': len(wallets),
                'wallet_addresses': wallet_addresses,
                'avg_win_rate': sum(w.win_rate for w in wallets) / len(wallets),
                'window_minutes': self.cluster_window_mins
            }
        )

    def _check_volume_spike(self, token: Token) -> SignalResult:
        """
        Check Volume Spike condition:
        - Token age < 60 minutes
        - 5-min volume > 10% of Market Cap
        """
        if token.age_minutes() > self.new_token_max_age:
            return SignalResult(triggered=False, signal_type=SignalType.VOLUME_SPIKE)

        # Calculate 5-minute volume from recent trades
        five_min_ago = datetime.utcnow() - timedelta(minutes=5)
        recent_trades = self.session.query(Trade).filter(
            Trade.token_id == token.id,
            Trade.trade_type == 'BUY',
            Trade.block_time >= five_min_ago
        ).all()

        volume_5m = sum(t.sol_amount for t in recent_trades)
        market_cap = token.market_cap_sol or 0

        if market_cap <= 0:
            return SignalResult(triggered=False, signal_type=SignalType.VOLUME_SPIKE)

        volume_ratio = volume_5m / market_cap

        triggered = volume_ratio >= self.volume_spike_threshold

        return SignalResult(
            triggered=triggered,
            signal_type=SignalType.VOLUME_SPIKE,
            token=token,
            trades=recent_trades,
            total_sol=volume_5m,
            details={
                'volume_5m_sol': volume_5m,
                'market_cap_sol': market_cap,
                'volume_ratio': volume_ratio,
                'threshold': self.volume_spike_threshold,
                'token_age_mins': token.age_minutes()
            }
        )

    def _get_or_create_token(
        self,
        contract_address: str,
        market_cap: Optional[float],
        total_supply: Optional[float]
    ) -> Token:
        """Get existing token or create new one"""
        token = self.session.query(Token).filter(
            Token.contract_address == contract_address
        ).first()

        if not token:
            token = Token(
                contract_address=contract_address,
                market_cap_sol=market_cap,
                total_supply=total_supply,
                platform='unknown',  # Will be determined from tx
                launched_at=datetime.utcnow()  # Approximate
            )
            self.session.add(token)
            self.session.commit()
        else:
            # Update market data
            if market_cap:
                token.market_cap_sol = market_cap
            if total_supply:
                token.total_supply = total_supply
            self.session.commit()

        return token

    def _record_trade(
        self,
        wallet: SmartWallet,
        token: Token,
        sol_amount: float,
        token_amount: float,
        supply_pct: float,
        tx_signature: str,
        block_time: datetime,
        market_cap: Optional[float]
    ) -> Trade:
        """Record a trade in the database"""
        # Check if trade already exists
        existing = self.session.query(Trade).filter(
            Trade.tx_signature == tx_signature
        ).first()

        if existing:
            return existing

        trade = Trade(
            wallet_id=wallet.id,
            token_id=token.id,
            tx_signature=tx_signature,
            trade_type='BUY',
            sol_amount=sol_amount,
            token_amount=token_amount,
            supply_percentage=supply_pct,
            mcap_at_trade=market_cap,
            block_time=block_time
        )
        self.session.add(trade)
        self.session.commit()

        # Update wallet activity
        wallet.last_activity = block_time
        self.session.commit()

        return trade

    def _record_cluster_event(self, token: Token, trades: list[Trade]) -> ClusterEvent:
        """Record a cluster buying event"""
        addresses = list(set(t.wallet.address for t in trades))
        block_times = [t.block_time for t in trades]

        cluster = ClusterEvent(
            token_id=token.id,
            wallet_addresses=json.dumps(addresses),
            wallet_count=len(addresses),
            total_sol=sum(t.sol_amount for t in trades),
            first_buy_at=min(block_times),
            last_buy_at=max(block_times),
            window_seconds=int((max(block_times) - min(block_times)).total_seconds())
        )
        self.session.add(cluster)
        self.session.commit()
        return cluster

    async def enrich_and_validate_signal(self, signal: SignalResult) -> SignalResult:
        """
        Enrich signal with token metadata and perform rug check

        Args:
            signal: Raw signal result

        Returns:
            Enriched signal with rug check results
        """
        if not signal.triggered or not signal.token:
            return signal

        try:
            # Fetch fresh token metadata
            token_service = _get_token_service()
            metadata = await token_service.get_token_metadata(signal.token.contract_address)

            # Update token record with fresh data
            if metadata.name:
                signal.token.name = metadata.name
            if metadata.symbol:
                signal.token.symbol = metadata.symbol
            if metadata.market_cap_sol > 0:
                signal.token.market_cap_sol = metadata.market_cap_sol
            if metadata.liquidity_sol > 0:
                signal.token.liquidity_sol = metadata.liquidity_sol
            if metadata.total_supply > 0:
                signal.token.total_supply = metadata.total_supply

            self.session.commit()

            # Perform rug check
            rug_detector = _get_rug_detector()
            rug_result = await rug_detector.check_token(signal.token.contract_address)

            signal.rug_checked = True
            signal.rug_passed = rug_result.passed
            signal.rug_risk_score = rug_result.risk_score
            signal.rug_warnings = rug_result.warnings

            # Add rug info to details
            signal.details['rug_check'] = {
                'passed': rug_result.passed,
                'risk_score': rug_result.risk_score,
                'risk_level': rug_result.risk_level.value,
                'warnings': rug_result.warnings[:3]  # Top 3 warnings
            }

            if not rug_result.passed:
                logger.warning(
                    f"Rug check FAILED for {signal.token.contract_address[:8]}...: "
                    f"score={rug_result.risk_score}, warnings={rug_result.warnings}"
                )

        except Exception as e:
            logger.error(f"Error enriching signal: {e}")
            # Continue without enrichment rather than failing

        return signal

    def create_alert(self, signal: SignalResult, skip_rug_failed: bool = True) -> Optional[Alert]:
        """
        Create an alert record from a signal

        Args:
            signal: SignalResult to create alert from
            skip_rug_failed: If True, don't create alerts for failed rug checks

        Returns:
            Alert record or None if skipped
        """
        # Skip if rug check failed
        if skip_rug_failed and signal.rug_checked and not signal.rug_passed:
            logger.info(
                f"Skipping alert for {signal.token.contract_address[:8]}... - "
                f"rug check failed (score: {signal.rug_risk_score})"
            )
            return None

        wallet_data = []
        for w in signal.wallets:
            wallet_data.append({
                'address': w.address,
                'win_rate': w.win_rate,
                'conviction_score': w.conviction_score
            })

        alert = Alert(
            token_id=signal.token.id,
            alert_type=signal.signal_type.value,
            trigger_data=json.dumps({
                'wallets': wallet_data,
                'details': signal.details,
                'rug_check': {
                    'passed': signal.rug_passed,
                    'risk_score': signal.rug_risk_score,
                    'warnings': signal.rug_warnings
                } if signal.rug_checked else None
            }),
            total_sol_volume=signal.total_sol,
            wallet_count=len(signal.wallets),
            avg_win_rate=signal.details.get('avg_win_rate') or (
                signal.wallets[0].win_rate if signal.wallets else 0
            ),
            max_supply_pct=signal.max_supply_pct
        )
        self.session.add(alert)
        self.session.commit()

        logger.info(f"Alert created: {alert.alert_type} for {signal.token.contract_address[:8]}...")
        return alert

    def get_pending_alerts(self, limit: int = 10) -> list[Alert]:
        """Get unsent alerts for Telegram dispatch"""
        return self.session.query(Alert).filter(
            Alert.is_sent == False
        ).order_by(Alert.created_at.asc()).limit(limit).all()

    def mark_alert_sent(self, alert: Alert):
        """Mark an alert as sent"""
        alert.is_sent = True
        alert.sent_at = datetime.utcnow()
        self.session.commit()
