from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.config import settings
from app.models.delivery_partner import DeliveryPartner, LocationUpdate, PartnerStatus
from app.models.violation import Violation, ViolationType, ViolationSeverity
from app.models.user import User, UserRole
from app.schemas.violation import ViolationCreate, ViolationOut, ViolationResolve
from app.routers.auth import require_role

router = APIRouter(prefix="/safety", tags=["Safety"])


@router.get("/speed/{partner_id}")
def get_current_speed(
    partner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.DELIVERY)),
):
    latest = (
        db.query(LocationUpdate)
        .filter(LocationUpdate.partner_id == partner_id)
        .order_by(LocationUpdate.timestamp.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No location data")
    is_over = latest.speed_kmh > settings.SPEED_LIMIT_KMH
    return {
        "speed_kmh": latest.speed_kmh,
        "speed_limit": settings.SPEED_LIMIT_KMH,
        "is_over_limit": is_over,
        "lat": latest.lat,
        "lng": latest.lng,
        "timestamp": latest.timestamp,
    }


@router.get("/helmet/{partner_id}")
def check_helmet(
    partner_id: int,
    db: Session = Depends(get_db),
):
    partner = db.query(DeliveryPartner).filter(DeliveryPartner.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {
        "partner_id": partner_id,
        "helmet_detected": partner.helmet_detected,
        "camera_active": partner.camera_active,
    }


@router.post("/violations", response_model=ViolationOut, status_code=201)
def create_violation(
    data: ViolationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    existing = (
        db.query(Violation)
        .filter(
            Violation.partner_id == data.partner_id,
            Violation.type == data.type,
            Violation.resolved == False,
        )
        .first()
    )
    offense_count = 1
    if existing:
        offense_count = existing.offense_count + 1
        if data.severity == ViolationSeverity.WARNING and offense_count >= 2:
            data.severity = ViolationSeverity.PENALTY

    violation = Violation(
        partner_id=data.partner_id,
        type=data.type,
        severity=data.severity,
        detail=data.detail,
        speed_recorded=data.speed_recorded,
        speed_limit=data.speed_limit,
        lat=data.lat,
        lng=data.lng,
        offense_count=offense_count,
    )
    db.add(violation)

    partner = db.query(DeliveryPartner).filter(DeliveryPartner.id == data.partner_id).first()
    if partner:
        deduction = 5 if data.severity == ViolationSeverity.WARNING else 15
        partner.safety_score = max(0, partner.safety_score - deduction)

    db.commit()
    db.refresh(violation)
    return violation


@router.get("/violations", response_model=list[ViolationOut])
def list_violations(
    partner_id: int | None = None,
    type: ViolationType | None = None,
    resolved: bool | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    q = db.query(Violation)
    if partner_id:
        q = q.filter(Violation.partner_id == partner_id)
    if type:
        q = q.filter(Violation.type == type)
    if resolved is not None:
        q = q.filter(Violation.resolved == resolved)
    results = q.order_by(Violation.created_at.desc()).offset(skip).limit(limit).all()
    out = []
    for v in results:
        vd = ViolationOut.model_validate(v)
        if v.partner and v.partner.user:
            vd.partner_name = v.partner.user.name
        out.append(vd)
    return out


@router.patch("/violations/{violation_id}", response_model=ViolationOut)
def resolve_violation(
    violation_id: int,
    data: ViolationResolve,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    violation = db.query(Violation).filter(Violation.id == violation_id).first()
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")
    violation.resolved = data.resolved
    db.commit()
    db.refresh(violation)
    return violation