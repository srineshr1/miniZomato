from datetime import datetime
from pydantic import BaseModel

from app.models.delivery_partner import PartnerStatus


class LocationUpdateCreate(BaseModel):
    lat: float
    lng: float
    speed_kmh: float = 0
    bearing: float | None = None


class LocationUpdateOut(BaseModel):
    id: int
    partner_id: int
    lat: float
    lng: float
    speed_kmh: float
    bearing: float | None
    timestamp: datetime

    model_config = {"from_attributes": True}


class DeliveryPartnerOut(BaseModel):
    id: int
    user_id: int
    vehicle_number: str | None
    current_lat: float | None
    current_lng: float | None
    status: PartnerStatus
    safety_score: float
    rating: float
    total_deliveries: int
    helmet_detected: bool
    camera_active: bool

    model_config = {"from_attributes": True}


class DeliveryPartnerUpdate(BaseModel):
    vehicle_number: str | None = None
    status: PartnerStatus | None = None