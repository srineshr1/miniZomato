from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.order import Order, OrderStatus
from app.models.delivery_partner import DeliveryPartner
from app.models.user import User, UserRole
from app.schemas.dashboard import OptimizedRoute, RouteStop, DashboardStats
from app.services.route_optimizer import optimize_route, estimate_route_time, StopInfo
from app.routers.auth import require_role

router = APIRouter(prefix="/routing", tags=["Routing"])


@router.post("/optimize", response_model=OptimizedRoute)
def optimize_delivery_route(
    order_ids: list[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.DELIVERY)),
):
    if len(order_ids) > 4:
        raise HTTPException(status_code=400, detail="Maximum 4 orders per batch")
    if len(order_ids) == 0:
        raise HTTPException(status_code=400, detail="At least one order is required")

    partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.id).first()
    if not partner or partner.current_lat is None or partner.current_lng is None:
        raise HTTPException(status_code=400, detail="Current location not available")

    orders = (
        db.query(Order)
        .filter(Order.id.in_(order_ids))
        .filter(Order.partner_id == partner.id)
        .filter(Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT]))
        .all()
    )
    if len(orders) != len(order_ids):
        raise HTTPException(status_code=404, detail="Some orders were not found or are not active for this partner")

    stops: list[StopInfo] = []
    for o in orders:
        items = o.items
        food_name = ", ".join(i.food_item.name if i.food_item else "Unknown" for i in items[:2])
        food_emoji = items[0].food_item.emoji if items and items[0].food_item else "🍽️"

        if o.status in (OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY):
            stop_type = "pickup"
            stop_lat = o.restaurant_lat
            stop_lng = o.restaurant_lng
        else:
            stop_type = "dropoff"
            stop_lat = o.customer_lat
            stop_lng = o.customer_lng

        stops.append(StopInfo(
            order_id=o.id,
            order_number=o.order_number,
            food_name=food_name,
            food_emoji=food_emoji,
            priority=o.priority,
            priority_reason=o.priority_reason,
            stop_type=stop_type,
            lat=stop_lat,
            lng=stop_lng,
        ))

    start_lat = partner.current_lat
    start_lng = partner.current_lng

    optimized = optimize_route(stops, start_lat, start_lng)

    total_distance = sum(s.distance_km for s in optimized)

    route_stops = [
        RouteStop(
            order_id=s.order_id,
            order_number=s.order_number,
            food_name=s.food_name,
            food_emoji=s.food_emoji,
            priority=s.priority,
            priority_reason=s.priority_reason,
            stop_type=s.stop_type,
            distance_km=s.distance_km,
            lat=s.lat,
            lng=s.lng,
        )
        for s in optimized
    ]

    return OptimizedRoute(
        stops=route_stops,
        total_distance_km=round(total_distance, 1),
        estimated_minutes=estimate_route_time(total_distance),
    )
