"""
AlphaPulse Helius Webhook Handler
Processes incoming Solana transactions from Helius webhooks
"""

import json
import base64
from datetime import datetime
from typing import Optional
from dataclasses import dataclass

from sqlalchemy.orm import Session

from alphapulse.config import settings
from alphapulse.processors.signal_processor import SignalProcessor
from alphapulse.db.models import WalletRepository
from alphapulse.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class ParsedSwap:
    """Parsed swap/buy event from transaction"""
    wallet_address: str
    token_address: str
    sol_amount: float
    token_amount: float
    tx_signature: str
    block_time: datetime
    platform: str  # pump_fun or raydium
    is_buy: bool


class HeliusWebhookHandler:
    """
    Handles incoming webhooks from Helius Enhanced Transactions API

    Parses Pump.fun and Raydium swap transactions and routes
    them to the signal processor.
    """

    # Program IDs
    PUMP_FUN_PROGRAM = settings.pump_fun_program_id
    RAYDIUM_AMM_PROGRAM = settings.raydium_amm_program_id

    # Native SOL mint
    SOL_MINT = "So11111111111111111111111111111111111111112"

    def __init__(self, session: Session):
        self.session = session
        self.wallet_repo = WalletRepository(session)
        self.signal_processor = SignalProcessor(session)

        # Cache tracked wallet addresses for fast lookup
        self._tracked_wallets: set[str] = set()
        self._refresh_wallet_cache()

    def _refresh_wallet_cache(self):
        """Refresh the set of tracked wallet addresses"""
        self._tracked_wallets = set(self.wallet_repo.get_wallet_addresses())
        logger.info(f"Wallet cache refreshed: {len(self._tracked_wallets)} wallets tracked")

    def handle_webhook(self, payload: dict) -> list[dict]:
        """
        Main webhook entry point

        Args:
            payload: Raw webhook payload from Helius

        Returns:
            List of generated alerts (if any)
        """
        alerts = []

        # Helius sends array of transactions
        transactions = payload if isinstance(payload, list) else [payload]

        for tx in transactions:
            try:
                parsed = self._parse_transaction(tx)
                if parsed and parsed.is_buy:
                    # Check if wallet is tracked
                    if parsed.wallet_address in self._tracked_wallets:
                        signals = self.signal_processor.process_buy_event(
                            wallet_address=parsed.wallet_address,
                            token_ca=parsed.token_address,
                            sol_amount=parsed.sol_amount,
                            token_amount=parsed.token_amount,
                            tx_signature=parsed.tx_signature,
                            block_time=parsed.block_time
                        )

                        # Create alerts for triggered signals
                        for signal in signals:
                            if signal.triggered:
                                alert = self.signal_processor.create_alert(signal)
                                alerts.append({
                                    'alert_id': alert.id,
                                    'type': signal.signal_type.value,
                                    'token': parsed.token_address
                                })

            except Exception as e:
                logger.error(f"Error processing transaction: {e}")
                continue

        return alerts

    def _parse_transaction(self, tx: dict) -> Optional[ParsedSwap]:
        """
        Parse a Helius enhanced transaction

        Helius Enhanced Transaction format includes:
        - type: SWAP, TRANSFER, etc.
        - tokenTransfers: array of token movements
        - nativeTransfers: array of SOL movements
        - accountData: parsed account data
        """
        tx_type = tx.get('type', '').upper()

        # Only process swap transactions
        if tx_type != 'SWAP':
            return None

        signature = tx.get('signature', '')
        timestamp = tx.get('timestamp', 0)
        block_time = datetime.utcfromtimestamp(timestamp) if timestamp else datetime.utcnow()

        # Get fee payer (the wallet initiating the tx)
        fee_payer = tx.get('feePayer', '')

        # Analyze token transfers to determine swap direction
        token_transfers = tx.get('tokenTransfers', [])
        native_transfers = tx.get('nativeTransfers', [])

        # Find SOL outflow and token inflow for a BUY
        sol_out = 0.0
        token_in = 0.0
        token_address = None

        # Check native (SOL) transfers
        for nt in native_transfers:
            if nt.get('fromUserAccount') == fee_payer:
                sol_out += nt.get('amount', 0) / 1e9  # lamports to SOL

        # Check token transfers
        for tt in token_transfers:
            mint = tt.get('mint', '')

            # Skip wrapped SOL
            if mint == self.SOL_MINT:
                continue

            # Token coming TO the fee payer = buy
            if tt.get('toUserAccount') == fee_payer:
                token_in += tt.get('tokenAmount', 0)
                token_address = mint

        # Determine if this is a buy (SOL out, token in)
        is_buy = sol_out > 0 and token_in > 0 and token_address

        if not is_buy:
            return None

        # Determine platform from program IDs
        instructions = tx.get('instructions', [])
        platform = 'unknown'

        for inst in instructions:
            program_id = inst.get('programId', '')
            if program_id == self.PUMP_FUN_PROGRAM:
                platform = 'pump_fun'
                break
            elif program_id == self.RAYDIUM_AMM_PROGRAM:
                platform = 'raydium'
                break

        return ParsedSwap(
            wallet_address=fee_payer,
            token_address=token_address,
            sol_amount=sol_out,
            token_amount=token_in,
            tx_signature=signature,
            block_time=block_time,
            platform=platform,
            is_buy=True
        )

    def add_wallet_to_cache(self, address: str):
        """Add a new wallet to the tracking cache"""
        self._tracked_wallets.add(address)

    def remove_wallet_from_cache(self, address: str):
        """Remove a wallet from the tracking cache"""
        self._tracked_wallets.discard(address)


class HeliusWebhookManager:
    """
    Manages Helius webhook subscriptions

    Used to register/update webhooks for tracked wallets.
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.helius.xyz/v0"

    async def create_webhook(
        self,
        webhook_url: str,
        wallet_addresses: list[str],
        webhook_type: str = "enhanced"
    ) -> dict:
        """
        Create a new Helius webhook

        Args:
            webhook_url: Your server's webhook endpoint
            wallet_addresses: List of wallet addresses to monitor
            webhook_type: 'enhanced' for parsed transactions

        Returns:
            Webhook configuration from Helius
        """
        import httpx

        url = f"{self.base_url}/webhooks?api-key={self.api_key}"

        payload = {
            "webhookURL": webhook_url,
            "transactionTypes": ["SWAP"],
            "accountAddresses": wallet_addresses,
            "webhookType": webhook_type,
            "txnStatus": "success"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return response.json()

    async def update_webhook(
        self,
        webhook_id: str,
        wallet_addresses: list[str]
    ) -> dict:
        """
        Update an existing webhook with new wallet addresses

        Args:
            webhook_id: Existing webhook ID
            wallet_addresses: Updated list of addresses

        Returns:
            Updated webhook configuration
        """
        import httpx

        url = f"{self.base_url}/webhooks/{webhook_id}?api-key={self.api_key}"

        payload = {
            "accountAddresses": wallet_addresses
        }

        async with httpx.AsyncClient() as client:
            response = await client.put(url, json=payload)
            response.raise_for_status()
            return response.json()

    async def delete_webhook(self, webhook_id: str) -> bool:
        """Delete a webhook"""
        import httpx

        url = f"{self.base_url}/webhooks/{webhook_id}?api-key={self.api_key}"

        async with httpx.AsyncClient() as client:
            response = await client.delete(url)
            return response.status_code == 200

    async def list_webhooks(self) -> list[dict]:
        """List all webhooks for this API key"""
        import httpx

        url = f"{self.base_url}/webhooks?api-key={self.api_key}"

        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()
