"""
AlphaPulse Webhook Security
Signature verification for Helius webhooks
"""

import hmac
import hashlib
import time
from typing import Optional
from dataclasses import dataclass

from alphapulse.config import settings
from alphapulse.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class WebhookValidationResult:
    """Result of webhook validation"""
    valid: bool
    error: Optional[str] = None
    timestamp: Optional[int] = None
    webhook_id: Optional[str] = None


class WebhookSecurityManager:
    """
    Manages webhook signature verification for Helius

    Helius webhooks include:
    - X-Helius-Signature: HMAC signature of payload
    - X-Helius-Timestamp: Request timestamp
    - X-Helius-Webhook-Id: Webhook identifier

    Verification process:
    1. Check timestamp is within tolerance (prevent replay attacks)
    2. Reconstruct signature using shared secret
    3. Compare signatures using constant-time comparison
    """

    # Maximum age of webhook in seconds (5 minutes)
    MAX_TIMESTAMP_AGE = 300

    def __init__(self, webhook_secret: str = None):
        """
        Initialize with webhook secret

        Args:
            webhook_secret: Shared secret from Helius webhook config
                           If not provided, uses HELIUS_WEBHOOK_SECRET env var
        """
        self.webhook_secret = webhook_secret or settings.helius_api_key
        if not self.webhook_secret:
            logger.warning("No webhook secret configured - signature verification disabled")

    def verify_signature(
        self,
        payload: bytes,
        signature: str,
        timestamp: str,
        webhook_id: str = None
    ) -> WebhookValidationResult:
        """
        Verify webhook signature

        Args:
            payload: Raw request body as bytes
            signature: X-Helius-Signature header value
            timestamp: X-Helius-Timestamp header value
            webhook_id: X-Helius-Webhook-Id header value (optional)

        Returns:
            WebhookValidationResult with validation status
        """
        # Skip if no secret configured
        if not self.webhook_secret:
            logger.debug("Webhook verification skipped - no secret configured")
            return WebhookValidationResult(valid=True, error="verification_disabled")

        # Validate timestamp
        try:
            ts = int(timestamp)
        except (ValueError, TypeError):
            return WebhookValidationResult(
                valid=False,
                error="invalid_timestamp_format"
            )

        # Check timestamp age (prevent replay attacks)
        current_time = int(time.time())
        age = abs(current_time - ts)

        if age > self.MAX_TIMESTAMP_AGE:
            logger.warning(f"Webhook timestamp too old: {age}s")
            return WebhookValidationResult(
                valid=False,
                error=f"timestamp_expired ({age}s old)",
                timestamp=ts
            )

        # Compute expected signature
        # Helius signature format: timestamp.payload
        signed_payload = f"{timestamp}.".encode() + payload
        expected_signature = hmac.new(
            self.webhook_secret.encode(),
            signed_payload,
            hashlib.sha256
        ).hexdigest()

        # Constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(signature, expected_signature):
            logger.warning("Webhook signature mismatch")
            return WebhookValidationResult(
                valid=False,
                error="signature_mismatch",
                timestamp=ts,
                webhook_id=webhook_id
            )

        logger.debug(f"Webhook signature verified successfully (age: {age}s)")
        return WebhookValidationResult(
            valid=True,
            timestamp=ts,
            webhook_id=webhook_id
        )

    def verify_request(self, headers: dict, body: bytes) -> WebhookValidationResult:
        """
        Verify webhook request using headers and body

        Args:
            headers: Request headers dict
            body: Raw request body

        Returns:
            WebhookValidationResult
        """
        signature = headers.get('x-helius-signature', headers.get('X-Helius-Signature'))
        timestamp = headers.get('x-helius-timestamp', headers.get('X-Helius-Timestamp'))
        webhook_id = headers.get('x-helius-webhook-id', headers.get('X-Helius-Webhook-Id'))

        if not signature:
            return WebhookValidationResult(
                valid=False,
                error="missing_signature_header"
            )

        if not timestamp:
            return WebhookValidationResult(
                valid=False,
                error="missing_timestamp_header"
            )

        return self.verify_signature(body, signature, timestamp, webhook_id)


class RateLimiter:
    """
    Simple in-memory rate limiter for webhook endpoints

    Prevents abuse by limiting requests per IP/webhook
    """

    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        """
        Initialize rate limiter

        Args:
            max_requests: Maximum requests per window
            window_seconds: Time window in seconds
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = {}

    def is_allowed(self, identifier: str) -> bool:
        """
        Check if request is allowed for identifier

        Args:
            identifier: Unique identifier (IP, webhook_id, etc.)

        Returns:
            True if allowed, False if rate limited
        """
        now = time.time()
        window_start = now - self.window_seconds

        # Get or create request list for identifier
        if identifier not in self._requests:
            self._requests[identifier] = []

        # Clean old requests
        self._requests[identifier] = [
            ts for ts in self._requests[identifier]
            if ts > window_start
        ]

        # Check limit
        if len(self._requests[identifier]) >= self.max_requests:
            logger.warning(f"Rate limit exceeded for {identifier}")
            return False

        # Record this request
        self._requests[identifier].append(now)
        return True

    def cleanup(self):
        """Remove stale entries to prevent memory growth"""
        now = time.time()
        window_start = now - self.window_seconds

        for identifier in list(self._requests.keys()):
            self._requests[identifier] = [
                ts for ts in self._requests[identifier]
                if ts > window_start
            ]
            # Remove empty entries
            if not self._requests[identifier]:
                del self._requests[identifier]


# Global instances
_security_manager: Optional[WebhookSecurityManager] = None
_rate_limiter: Optional[RateLimiter] = None


def get_security_manager() -> WebhookSecurityManager:
    """Get global security manager instance"""
    global _security_manager
    if _security_manager is None:
        _security_manager = WebhookSecurityManager()
    return _security_manager


def get_rate_limiter() -> RateLimiter:
    """Get global rate limiter instance"""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter(max_requests=100, window_seconds=60)
    return _rate_limiter
