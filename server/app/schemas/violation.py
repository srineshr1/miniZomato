from datetime import datetime
from pydantic import BaseModel

from app.models.violation import ViolationType, ViolationSeverity


class ViolationCreate(BaseModel):
    partner_id: int
    type: ViolationType
    severity: ViolationSeverity = ViolationSeverity.WARNING
    detail: str | None = None
    speed_recorded: float | None = None
    speed_limit: float | None = None
    lat: float | None = None
    lng: float | None = None


class ViolationOut(BaseModel):
    id: int
    partner_id: int
    partner_name: str | None = None
    type: ViolationType
    severity: ViolationSeverity
    detail: str | None
    speed_recorded: float | None
    speed_limit: float | None
    offense_count: int
    resolved: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ViolationResolve(BaseModel):
    resolved: bool = True