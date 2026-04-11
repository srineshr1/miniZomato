from datetime import datetime
from pydantic import BaseModel

from app.models.order import OrderStatus


class OrderItemCreate(BaseModel):
    food_item_id: int
    quantity: int = 1


class OrderItemOut(BaseModel):
    id: int
    food_item_id: int
    quantity: int
    unit_price: float
    food_item_name: str | None = None
    food_item_emoji: str | None = None

    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    items: list[OrderItemCreate]
    customer_address: str
    customer_landmark: str | None = None
    customer_lat: float | None = None
    customer_lng: float | None = None


class OrderOut(BaseModel):
    id: int
    order_number: str
    customer_id: int
    partner_id: int | None
    status: OrderStatus
    priority: int
    priority_reason: str | None
    total_amount: float
    delivery_fee: float
    distance_km: float
    eta_minutes: int
    customer_address: str | None
    customer_landmark: str | None
    customer_lat: float | None
    customer_lng: float | None
    restaurant_lat: float | None = None
    restaurant_lng: float | None = None
    confirmed_at: datetime | None
    picked_up_at: datetime | None
    delivered_at: datetime | None
    created_at: datetime
    items: list[OrderItemOut] = []

    model_config = {"from_attributes": True}


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
