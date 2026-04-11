import enum
from datetime import datetime

from sqlalchemy import String, Enum, Float, Text, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FoodCategory(str, enum.Enum):
    BIRYANI = "biryani"
    PIZZA = "pizza"
    ICE_CREAM = "ice_cream"
    BURGERS = "burgers"
    NOODLES = "noodles"
    HEALTHY = "healthy"
    DRINKS = "drinks"


class FoodItem(Base):
    __tablename__ = "food_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[FoodCategory] = mapped_column(Enum(FoodCategory), nullable=False)
    emoji: Mapped[str] = mapped_column(String(10), nullable=True)
    tag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    is_priority: Mapped[bool] = mapped_column(Boolean, default=False)
    priority_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prep_time_minutes: Mapped[int] = mapped_column(Integer, default=15)
    restaurant_name: Mapped[str] = mapped_column(String(255), nullable=True)
    restaurant_area: Mapped[str] = mapped_column(String(255), nullable=True)
    restaurant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("restaurants.id"), nullable=True)
    image_gradient: Mapped[str] = mapped_column(String(100), default="linear-gradient(135deg,#1a0f00,#2d1800)")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    restaurant = relationship("Restaurant", back_populates="food_items")
    order_items = relationship("OrderItem", back_populates="food_item")