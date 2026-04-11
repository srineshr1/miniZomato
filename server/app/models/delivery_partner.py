import enum
from datetime import datetime

from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PartnerStatus(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"


class DeliveryPartner(Base):
    __tablename__ = "delivery_partners"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    vehicle_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    current_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[PartnerStatus] = mapped_column(Enum(PartnerStatus), default=PartnerStatus.OFFLINE)
    safety_score: Mapped[float] = mapped_column(Float, default=100.0)
    rating: Mapped[float] = mapped_column(Float, default=4.5)
    total_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    helmet_detected: Mapped[bool] = mapped_column(Boolean, default=True)
    camera_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="delivery_partner")
    orders = relationship("Order", back_populates="partner", foreign_keys="Order.partner_id")
    location_updates = relationship("LocationUpdate", back_populates="partner", cascade="all, delete-orphan")
    violations = relationship("Violation", back_populates="partner")


class LocationUpdate(Base):
    __tablename__ = "location_updates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("delivery_partners.id"), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    speed_kmh: Mapped[float] = mapped_column(Float, default=0)
    bearing: Mapped[float | None] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    partner = relationship("DeliveryPartner", back_populates="location_updates")