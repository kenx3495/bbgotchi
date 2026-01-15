"""
AlphaPulse Database Models
SQLAlchemy ORM models for smart wallet tracking
"""

from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Text, Index, UniqueConstraint
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()


class SmartWallet(Base):
    """
    Tracked smart wallets with performance metrics
    """
    __tablename__ = 'smart_wallets'

    id = Column(Integer, primary_key=True, autoincrement=True)
    address = Column(String(44), unique=True, nullable=False, index=True)

    # Identification
    tag = Column(String(100), nullable=True)  # Custom label (e.g., "Whale_001")
    source = Column(String(50), nullable=False)  # gmgn, dexscreener, manual

    # Performance Metrics
    win_rate = Column(Float, default=0.0)  # 0-100 percentage
    total_trades = Column(Integer, default=0)
    trades_7d = Column(Integer, default=0)
    pnl_total_sol = Column(Float, default=0.0)
    pnl_7d_sol = Column(Float, default=0.0)
    avg_hold_time_mins = Column(Float, nullable=True)

    # Conviction Reliability Score (calculated)
    conviction_score = Column(Float, default=0.0)  # 0-100

    # Status
    is_active = Column(Boolean, default=True)
    last_activity = Column(DateTime, nullable=True)

    # Timestamps
    discovered_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    trades = relationship("Trade", back_populates="wallet", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_wallet_performance', 'win_rate', 'trades_7d'),
        Index('idx_wallet_conviction', 'conviction_score'),
    )

    def __repr__(self):
        return f"<SmartWallet {self.address[:8]}... WR:{self.win_rate}%>"

    def meets_threshold(self, min_win_rate: float = 65.0, min_trades_7d: int = 10) -> bool:
        """Check if wallet meets minimum performance threshold"""
        return self.win_rate >= min_win_rate and self.trades_7d >= min_trades_7d


class Token(Base):
    """
    Tracked tokens (Pump.fun / Raydium launches)
    """
    __tablename__ = 'tokens'

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_address = Column(String(44), unique=True, nullable=False, index=True)

    # Token Info
    name = Column(String(100), nullable=True)
    symbol = Column(String(20), nullable=True)
    decimals = Column(Integer, default=9)

    # Market Data (snapshot at discovery)
    market_cap_sol = Column(Float, nullable=True)
    liquidity_sol = Column(Float, nullable=True)
    total_supply = Column(Float, nullable=True)

    # Platform
    platform = Column(String(20), nullable=False)  # pump_fun, raydium
    pool_address = Column(String(44), nullable=True)

    # Status
    launched_at = Column(DateTime, nullable=True)
    discovered_at = Column(DateTime, default=datetime.utcnow)
    is_rugged = Column(Boolean, default=False)

    # Relationships
    trades = relationship("Trade", back_populates="token", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="token", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_token_platform', 'platform', 'launched_at'),
    )

    def __repr__(self):
        return f"<Token {self.symbol} ({self.contract_address[:8]}...)>"

    def age_minutes(self) -> float:
        """Get token age in minutes since launch"""
        if not self.launched_at:
            return 0
        delta = datetime.utcnow() - self.launched_at
        return delta.total_seconds() / 60


class Trade(Base):
    """
    Individual buy/sell transactions from tracked wallets
    """
    __tablename__ = 'trades'

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign Keys
    wallet_id = Column(Integer, ForeignKey('smart_wallets.id'), nullable=False, index=True)
    token_id = Column(Integer, ForeignKey('tokens.id'), nullable=False, index=True)

    # Transaction Details
    tx_signature = Column(String(88), unique=True, nullable=False, index=True)
    trade_type = Column(String(4), nullable=False)  # BUY or SELL

    # Amounts
    sol_amount = Column(Float, nullable=False)
    token_amount = Column(Float, nullable=False)
    price_per_token = Column(Float, nullable=True)

    # Conviction Metrics
    supply_percentage = Column(Float, nullable=True)  # % of total supply bought
    mcap_at_trade = Column(Float, nullable=True)  # Market cap at time of trade

    # Timing
    block_time = Column(DateTime, nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    wallet = relationship("SmartWallet", back_populates="trades")
    token = relationship("Token", back_populates="trades")

    __table_args__ = (
        Index('idx_trade_time', 'block_time'),
        Index('idx_trade_conviction', 'sol_amount', 'supply_percentage'),
    )

    def __repr__(self):
        return f"<Trade {self.trade_type} {self.sol_amount} SOL>"

    def is_high_conviction(self, min_sol: float = 1.0, min_supply_pct: float = 0.5) -> bool:
        """Check if trade meets high conviction criteria"""
        return self.sol_amount >= min_sol and (self.supply_percentage or 0) >= min_supply_pct


class Alert(Base):
    """
    Generated alerts for Telegram notifications
    """
    __tablename__ = 'alerts'

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign Key
    token_id = Column(Integer, ForeignKey('tokens.id'), nullable=False, index=True)

    # Alert Type
    alert_type = Column(String(30), nullable=False)  # high_conviction, cluster_buy, volume_spike

    # Alert Data (JSON-serialized)
    trigger_data = Column(Text, nullable=True)  # JSON: wallets involved, amounts, etc.

    # Conviction Summary
    total_sol_volume = Column(Float, default=0.0)
    wallet_count = Column(Integer, default=1)
    avg_win_rate = Column(Float, nullable=True)
    max_supply_pct = Column(Float, nullable=True)

    # Status
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Outcome Tracking
    outcome_pnl = Column(Float, nullable=True)  # Track if alert was profitable
    outcome_checked_at = Column(DateTime, nullable=True)

    # Relationships
    token = relationship("Token", back_populates="alerts")

    __table_args__ = (
        Index('idx_alert_type_time', 'alert_type', 'created_at'),
        Index('idx_alert_unsent', 'is_sent', 'created_at'),
    )

    def __repr__(self):
        return f"<Alert {self.alert_type} for token_id={self.token_id}>"


class ClusterEvent(Base):
    """
    Tracks when multiple wallets buy the same token within a time window
    """
    __tablename__ = 'cluster_events'

    id = Column(Integer, primary_key=True, autoincrement=True)
    token_id = Column(Integer, ForeignKey('tokens.id'), nullable=False, index=True)

    # Cluster Details
    wallet_addresses = Column(Text, nullable=False)  # JSON array of addresses
    wallet_count = Column(Integer, nullable=False)
    total_sol = Column(Float, nullable=False)

    # Time Window
    first_buy_at = Column(DateTime, nullable=False)
    last_buy_at = Column(DateTime, nullable=False)
    window_seconds = Column(Integer, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_cluster_token_time', 'token_id', 'created_at'),
    )


# Database initialization
def init_db(database_url: str = "sqlite:///alphapulse.db"):
    """Initialize database and create all tables"""
    engine = create_engine(database_url, echo=False)
    Base.metadata.create_all(engine)
    return engine


def get_session(engine):
    """Get a new database session"""
    Session = sessionmaker(bind=engine)
    return Session()


# Convenience functions for common queries
class WalletRepository:
    """Repository pattern for wallet operations"""

    def __init__(self, session):
        self.session = session

    def get_active_wallets(self, min_win_rate: float = 65.0, min_trades: int = 10):
        """Get all active wallets meeting threshold"""
        return self.session.query(SmartWallet).filter(
            SmartWallet.is_active == True,
            SmartWallet.win_rate >= min_win_rate,
            SmartWallet.trades_7d >= min_trades
        ).order_by(SmartWallet.conviction_score.desc()).all()

    def get_by_address(self, address: str):
        """Get wallet by Solana address"""
        return self.session.query(SmartWallet).filter(
            SmartWallet.address == address
        ).first()

    def upsert_wallet(self, address: str, data: dict):
        """Insert or update wallet data"""
        wallet = self.get_by_address(address)
        if wallet:
            for key, value in data.items():
                if hasattr(wallet, key):
                    setattr(wallet, key, value)
        else:
            wallet = SmartWallet(address=address, **data)
            self.session.add(wallet)
        self.session.commit()
        return wallet

    def get_wallet_addresses(self) -> list[str]:
        """Get list of all tracked wallet addresses for webhook filtering"""
        results = self.session.query(SmartWallet.address).filter(
            SmartWallet.is_active == True
        ).all()
        return [r[0] for r in results]


class TradeRepository:
    """Repository pattern for trade operations"""

    def __init__(self, session):
        self.session = session

    def get_recent_buys_for_token(self, token_id: int, minutes: int = 5):
        """Get recent buy trades for a token within time window"""
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        return self.session.query(Trade).filter(
            Trade.token_id == token_id,
            Trade.trade_type == 'BUY',
            Trade.block_time >= cutoff
        ).all()

    def check_cluster_condition(self, token_id: int, min_wallets: int = 2,
                                 window_mins: int = 5, min_sol: float = 0.5):
        """Check if cluster buying condition is met"""
        trades = self.get_recent_buys_for_token(token_id, window_mins)
        qualifying_trades = [t for t in trades if t.sol_amount >= min_sol]
        unique_wallets = set(t.wallet_id for t in qualifying_trades)
        return len(unique_wallets) >= min_wallets, qualifying_trades
