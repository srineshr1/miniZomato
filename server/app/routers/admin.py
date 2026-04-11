from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.order import Order, OrderStatus
from app.models.delivery_partner import DeliveryPartner, PartnerStatus
from app.models.violation import Violation
from app.models.user import User, UserRole
from app.schemas.dashboard import DashboardStats
from app.routers.auth import require_role

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_orders = db.query(Order).count()
    active_orders = db.query(Order).filter(Order.status.in_([OrderStatus.IN_TRANSIT, OrderStatus.PICKED_UP, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY])).count()
    active_partners = db.query(DeliveryPartner).filter(DeliveryPartner.status == PartnerStatus.ONLINE).count()

    avg_eta = db.query(func.avg(Order.eta_minutes)).filter(Order.status == OrderStatus.DELIVERED).scalar() or 0
    delivered_today = db.query(Order).filter(Order.status == OrderStatus.DELIVERED, Order.delivered_at >= today_start).count()
    revenue_today = db.query(func.sum(Order.total_amount)).filter(Order.status == OrderStatus.DELIVERED, Order.delivered_at >= today_start).scalar() or 0
    violations_today = db.query(Violation).filter(Violation.created_at >= today_start).count()

    return DashboardStats(
        total_orders=total_orders,
        active_orders=active_orders,
        active_partners=active_partners,
        avg_delivery_minutes=round(avg_eta, 1),
        violations_today=violations_today,
        revenue_today=round(revenue_today, 2),
        delivered_today=delivered_today,
    )


@router.get("/orders/recent", response_model=list)
def recent_orders(
    limit: int = 10,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    from app.schemas.order import OrderOut
    orders = db.query(Order).order_by(Order.created_at.desc()).limit(limit).all()
    return [OrderOut.model_validate(o) for o in orders]


@router.get("/partners/safety-scores")
def partner_safety_scores(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    partners = db.query(DeliveryPartner).filter(DeliveryPartner.is_active == True).all()
    return [
        {
            "partner_id": p.id,
            "name": p.user.name if p.user else "Unknown",
            "safety_score": p.safety_score,
            "rating": p.rating,
            "total_deliveries": p.total_deliveries,
            "status": p.status.value,
            "helmet_detected": p.helmet_detected,
        }
        for p in partners
    ]