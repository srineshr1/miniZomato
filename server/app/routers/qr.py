from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.qr_session import QRSession, QRStatus
from app.models.order import Order, OrderStatus
from app.models.delivery_partner import DeliveryPartner
from app.models.user import User, UserRole
from app.schemas.qr_session import QRScanRequest, QRSessionOut, QRScanResult
from app.services.qr_service import generate_qr_token, is_qr_valid
from app.routers.auth import require_role

router = APIRouter(prefix="/qr", tags=["QR & Privacy"])


@router.post("/generate/{order_id}", response_model=QRSessionOut)
def generate_qr(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.CUSTOMER)),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    existing = db.query(QRSession).filter(QRSession.order_id == order_id).first()
    if existing:
        return existing

    token = generate_qr_token(order_id)
    now = datetime.now(timezone.utc)
    session = QRSession(
        order_id=order_id,
        token=token,
        status=QRStatus.PENDING,
        expires_at=now + timedelta(hours=2),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/scan", response_model=QRScanResult)
def scan_qr(
    data: QRScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.DELIVERY)),
):
    partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner profile not found")

    session = db.query(QRSession).filter(QRSession.token == data.token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Invalid QR token")

    order = db.query(Order).filter(Order.id == session.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not is_qr_valid(session.scanned_at, session.expires_at):
        session.status = QRStatus.EXPIRED
        db.commit()
        raise HTTPException(status_code=400, detail="QR code expired or already used")

    now = datetime.now(timezone.utc)
    session.status = QRStatus.SCANNED
    session.scanned_by = partner.id
    session.address_revealed = True
    session.scanned_at = now

    if order.status == OrderStatus.READY:
        order.status = OrderStatus.PICKED_UP
        order.picked_up_at = now
        order.partner_id = partner.id

    db.commit()

    return QRScanResult(
        success=True,
        order_number=order.order_number,
        customer_address=order.customer_address or "Address not available",
        customer_landmark=order.customer_landmark,
        scanned_at=now,
    )