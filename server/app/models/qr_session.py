import enum
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class QRStatus(str, enum.Enum):
    PENDING = "pending"
    SCANNED = "scanned"
    EXPIRED = "expired"


class QRSession(Base):
    __tablename__ = "qr_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    status: Mapped[QRStatus] = mapped_column(Enum(QRStatus), default=QRStatus.PENDING)
    scanned_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("delivery_partners.id"), nullable=True)
    address_revealed: Mapped[bool] = mapped_column(Boolean, default=False)
    scanned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="qr_session")