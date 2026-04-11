import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.models.qr_session import QRStatus


def generate_qr_token(order_id: int) -> str:
    raw = f"{order_id}:{settings.QR_SECRET}:{secrets.token_hex(8)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def is_qr_valid(scanned_at: datetime | None, expires_at: datetime) -> bool:
    now = datetime.now(timezone.utc)
    return scanned_at is None and now < expires_at.replace(tzinfo=timezone.utc)