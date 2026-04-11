from datetime import datetime

from sqlalchemy import String, Float, Text, Integer, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    area: Mapped[str] = mapped_column(String(255), nullable=True)
    cuisine: Mapped[str] = mapped_column(String(100), nullable=True)
    rating: Mapped[str] = mapped_column(String(20), nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=True)
    menu_scraped: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    food_items = relationship("FoodItem", back_populates="restaurant")
