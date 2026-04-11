from datetime import datetime
from pydantic import BaseModel

from app.models.qr_session import QRStatus


class QRScanRequest(BaseModel):
    token: str


class QRSessionOut(BaseModel):
    id: int
    order_id: int
    token: str
    status: QRStatus
    address_revealed: bool
    scanned_at: datetime | None
    expires_at: datetime

    model_config = {"from_attributes": True}


class QRScanResult(BaseModel):
    success: bool
    order_number: str
    customer_address: str
    customer_landmark: str | None = None
    scanned_at: datetime