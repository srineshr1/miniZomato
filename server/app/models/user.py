import enum
from datetime import datetime

from sqlalchemy import String, Enum, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    DELIVERY = "delivery"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.CUSTOMER, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avatar_initial: Mapped[str] = mapped_column(String(2), default="U")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    orders_as_customer = relationship("Order", back_populates="customer", foreign_keys="Order.customer_id")
    delivery_partner = relationship("DeliveryPartner", back_populates="user", uselist=False)