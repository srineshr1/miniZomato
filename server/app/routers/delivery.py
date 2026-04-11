from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.delivery_partner import DeliveryPartner, LocationUpdate, PartnerStatus
from app.models.user import User, UserRole
from app.models.order import Order, OrderStatus
from app.schemas.delivery_partner import (
    DeliveryPartnerOut,
    DeliveryPartnerUpdate,
    LocationUpdateCreate,
    LocationUpdateOut,
)
from app.routers.auth import get_current_user, require_role

router = APIRouter(prefix="/delivery", tags=["Delivery"])


@router.get("/me", response_model=DeliveryPartnerOut)
def get_my_partner(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.DELIVERY)),
):
    partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner profile not found")
    return partner


@router.get("/partners", response_model=list[DeliveryPartnerOut])
def list_partners(
    status: PartnerStatus | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    q = db.query(DeliveryPartner)
    if status:
        q = q.filter(DeliveryPartner.status == status)
    return q.offset(skip).limit(limit).all()


@router.get("/partners/{partner_id}", response_model=DeliveryPartnerOut)
def get_partner(partner_id: int, db: Session = Depends(get_db)):
    partner = db.query(DeliveryPartner).filter(DeliveryPartner.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner


@router.patch("/partners/{partner_id}", response_model=DeliveryPartnerOut)
def update_partner(
    partner_id: int,
    data: DeliveryPartnerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN, UserRole.DELIVERY)),
):
    partner = db.query(DeliveryPartner).filter(DeliveryPartner.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(partner, key, val)
    db.commit()
    db.refresh(partner)
    return partner


@router.post("/location", response_model=LocationUpdateOut)
def update_location(
    data: LocationUpdateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.DELIVERY)),
):
    partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner profile not found")

    loc = LocationUpdate(
        partner_id=partner.id,
        lat=data.lat,
        lng=data.lng,
        speed_kmh=data.speed_kmh,
        bearing=data.bearing,
    )
    db.add(loc)

    partner.current_lat = data.lat
    partner.current_lng = data.lng

    if not partner.camera_active:
        pass

    db.commit()
    db.refresh(loc)
    return loc


@router.get("/location/{partner_id}", response_model=list[LocationUpdateOut])
def get_location_history(
    partner_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(LocationUpdate)
        .filter(LocationUpdate.partner_id == partner_id)
        .order_by(LocationUpdate.timestamp.desc())
        .limit(limit)
        .all()
    )
