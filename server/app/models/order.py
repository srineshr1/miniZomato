import enum
from datetime import datetime

from sqlalchemy import String, Enum, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_number: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    partner_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("delivery_partners.id"), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.PENDING, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=3)
    priority_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, default=0)
    delivery_fee: Mapped[float] = mapped_column(Float, default=0)
    distance_km: Mapped[float] = mapped_column(Float, default=0)
    eta_minutes: Mapped[int] = mapped_column(Integer, default=0)
    customer_address: Mapped[str] = mapped_column(Text, nullable=True)
    customer_landmark: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    customer_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    restaurant_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    restaurant_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    picked_up_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customer = relationship("User", back_populates="orders_as_customer", foreign_keys=[customer_id])
    partner = relationship("DeliveryPartner", back_populates="orders", foreign_keys=[partner_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    qr_session = relationship("QRSession", back_populates="order", uselist=False)


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=False)
    food_item_id: Mapped[int] = mapped_column(Integer, ForeignKey("food_items.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)

    order = relationship("Order", back_populates="items")
    food_item = relationship("FoodItem", back_populates="order_items")