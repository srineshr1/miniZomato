from datetime import datetime
from pydantic import BaseModel

from app.models.food_item import FoodCategory


class FoodItemCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
    category: FoodCategory
    emoji: str = "🍽️"
    tag: str | None = None
    is_priority: bool = False
    priority_reason: str | None = None
    prep_time_minutes: int = 15
    restaurant_name: str | None = None
    restaurant_area: str | None = None
    restaurant_id: int | None = None
    image_gradient: str = "linear-gradient(135deg,#1a0f00,#2d1800)"
    rating: float | None = None
    image_url: str | None = None


class FoodItemOut(BaseModel):
    id: int
    name: str
    description: str | None
    price: float
    category: FoodCategory
    emoji: str
    tag: str | None
    is_available: bool
    is_priority: bool
    priority_reason: str | None
    prep_time_minutes: int
    restaurant_name: str | None
    restaurant_area: str | None
    restaurant_id: int | None
    image_gradient: str
    rating: float | None
    image_url: str | None

    model_config = {"from_attributes": True}


class FoodItemUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = None
    category: FoodCategory | None = None
    is_available: bool | None = None
    is_priority: bool | None = None
    tag: str | None = None