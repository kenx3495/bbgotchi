"""
AlphaPulse Rug Pull Detection
Identifies potential scam tokens before alerting
"""

from dataclasses import dataclass
from typing import Optional
from datetime import datetime, timedelta
from enum import Enum

import httpx

from alphapulse.services.token_metadata import TokenMetadataService, TokenMetadata
from alphapulse.config import settings
from alphapulse.utils.logger import get_logger

logger = get_logger(__name__)


class RiskLevel(Enum):
    """Token risk classification"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RugCheckResult:
    """Result of rug pull risk analysis"""
    contract_address: str
    risk_level: RiskLevel
    risk_score: int  # 0-100 (higher = more risky)
    passed: bool  # Safe to alert on

    # Individual risk factors
    mintable: bool = False
    freezable: bool = False
    lp_unlocked: bool = False
    low_liquidity: bool = False
    high_concentration: bool = False
    honeypot_risk: bool = False
    copycat_name: bool = False

    # Details
    warnings: list = None
    details: dict = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []
        if self.details is None:
            self.details = {}


class RugDetector:
    """
    Detects potential rug pulls and scam tokens

    Risk Factors Checked:
    1. Mint Authority: Can more tokens be minted? (dilution risk)
    2. Freeze Authority: Can transfers be frozen? (honeypot)
    3. LP Lock Status: Is liquidity locked or can it be pulled?
    4. Holder Concentration: Top 10 wallets holding >50%?
    5. Liquidity Depth: Is there enough liquidity to exit?
    6. Honeypot Test: Can the token actually be sold?
    7. Copycat Detection: Is this impersonating a known token?
    """

    # Thresholds
    MIN_LIQUIDITY_USD = 5000  # Minimum liquidity to consider safe
    MAX_TOP10_CONCENTRATION = 50  # Max % top 10 can hold
    MIN_LP_LOCK_DAYS = 30  # Minimum days LP should be locked

    # Known scam patterns (token names to avoid)
    COPYCAT_PATTERNS = [
        "BONK", "WIF", "PEPE", "DOGE", "SHIB",  # Popular memes
        "SOL", "ETH", "BTC",  # Major coins
        "USDC", "USDT",  # Stablecoins
    ]

    def __init__(self, token_service: TokenMetadataService = None):
        self.token_service = token_service or TokenMetadataService()

    async def check_token(self, contract_address: str) -> RugCheckResult:
        """
        Perform comprehensive rug pull risk analysis

        Args:
            contract_address: Token mint address

        Returns:
            RugCheckResult with risk assessment
        """
        warnings = []
        details = {}
        risk_score = 0

        # Fetch token metadata
        metadata = await self.token_service.get_token_metadata(contract_address)
        holder_dist = await self.token_service.get_holder_distribution(contract_address)

        # Check 1: Mint Authority
        mintable = metadata.is_mintable
        if mintable:
            risk_score += 25
            warnings.append("Token is MINTABLE - supply can be inflated")

        # Check 2: Freeze Authority
        freezable = metadata.is_freezable
        if freezable:
            risk_score += 30
            warnings.append("Token has FREEZE authority - honeypot risk")

        # Check 3: LP Lock (would need GoPlus or similar API)
        lp_unlocked = await self._check_lp_unlocked(contract_address)
        if lp_unlocked:
            risk_score += 20
            warnings.append("Liquidity is NOT locked - rug pull risk")

        # Check 4: Low Liquidity
        low_liquidity = metadata.liquidity_usd < self.MIN_LIQUIDITY_USD
        if low_liquidity:
            risk_score += 10
            warnings.append(f"Low liquidity: ${metadata.liquidity_usd:.0f}")
        details['liquidity_usd'] = metadata.liquidity_usd

        # Check 5: Holder Concentration
        top10_pct = holder_dist.get('top_n_concentration', 0)
        high_concentration = top10_pct > self.MAX_TOP10_CONCENTRATION
        if high_concentration:
            risk_score += 15
            warnings.append(f"High concentration: Top 10 hold {top10_pct:.1f}%")
        details['top10_concentration'] = top10_pct

        # Check 6: Honeypot Test
        honeypot_risk = await self._check_honeypot(contract_address)
        if honeypot_risk:
            risk_score += 40
            warnings.append("HONEYPOT detected - token cannot be sold")

        # Check 7: Copycat Detection
        copycat = self._check_copycat(metadata.symbol, metadata.name)
        if copycat:
            risk_score += 10
            warnings.append(f"Possible copycat of known token: {copycat}")
        details['copycat_of'] = copycat

        # Determine risk level
        if risk_score >= 70:
            risk_level = RiskLevel.CRITICAL
        elif risk_score >= 50:
            risk_level = RiskLevel.HIGH
        elif risk_score >= 25:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW

        # Passed = safe to alert (not critical risk)
        passed = risk_level not in [RiskLevel.CRITICAL, RiskLevel.HIGH]

        result = RugCheckResult(
            contract_address=contract_address,
            risk_level=risk_level,
            risk_score=risk_score,
            passed=passed,
            mintable=mintable,
            freezable=freezable,
            lp_unlocked=lp_unlocked,
            low_liquidity=low_liquidity,
            high_concentration=high_concentration,
            honeypot_risk=honeypot_risk,
            copycat_name=copycat is not None,
            warnings=warnings,
            details=details
        )

        logger.info(
            f"Rug check for {contract_address[:8]}...: "
            f"risk={risk_level.value} score={risk_score} passed={passed}"
        )

        return result

    async def _check_lp_unlocked(self, mint: str) -> bool:
        """
        Check if liquidity pool is unlocked

        Note: This would ideally use GoPlus or RugCheck API
        For now, returns False (assume locked)
        """
        # TODO: Integrate with GoPlus API or similar
        # https://docs.gopluslabs.io/reference/token-security-api
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.gopluslabs.io/api/v1/token_security/solana",
                    params={"contract_addresses": mint},
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    result = data.get('result', {}).get(mint.lower(), {})
                    # Check if LP is locked
                    lp_holders = result.get('lp_holders', [])
                    for holder in lp_holders:
                        if holder.get('is_locked') == 0:
                            return True  # Found unlocked LP
                    return False
        except Exception as e:
            logger.debug(f"LP lock check failed: {e}")
        return False  # Assume locked if check fails

    async def _check_honeypot(self, mint: str) -> bool:
        """
        Check if token is a honeypot (can't be sold)

        Note: Would use simulation or GoPlus API
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.gopluslabs.io/api/v1/token_security/solana",
                    params={"contract_addresses": mint},
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    result = data.get('result', {}).get(mint.lower(), {})
                    # Check honeypot indicators
                    if result.get('is_honeypot') == 1:
                        return True
                    if result.get('cannot_sell_all') == 1:
                        return True
                    if result.get('transfer_pausable') == 1:
                        return True
        except Exception as e:
            logger.debug(f"Honeypot check failed: {e}")
        return False

    def _check_copycat(self, symbol: str, name: str) -> Optional[str]:
        """
        Check if token name/symbol is copying a known token

        Returns:
            Name of token being copied, or None
        """
        if not symbol and not name:
            return None

        symbol_upper = (symbol or "").upper()
        name_upper = (name or "").upper()

        for known in self.COPYCAT_PATTERNS:
            # Exact match
            if symbol_upper == known:
                return known

            # Contains known name with modifications
            if known in name_upper and name_upper != known:
                return known

            # Common copycat patterns
            copycat_variants = [
                f"{known}2", f"{known}2.0", f"BABY{known}",
                f"MINI{known}", f"{known}INU", f"{known}MOON"
            ]
            if symbol_upper in copycat_variants:
                return known

        return None

    async def should_alert(self, contract_address: str) -> tuple[bool, RugCheckResult]:
        """
        Quick check if we should send alert for this token

        Returns:
            (should_alert, rug_check_result)
        """
        result = await self.check_token(contract_address)
        return result.passed, result
