import asyncio
import random
import string
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.order import Order, OrderItem, OrderStatus
from app.models.food_item import FoodItem
from app.models.user import User, UserRole
from app.models.delivery_partner import DeliveryPartner, PartnerStatus
from app.schemas.order import OrderCreate, OrderOut, OrderStatusUpdate, OrderItemOut
from app.routers.auth import get_current_user, require_role

router = APIRouter(prefix="/orders", tags=["Orders"])

_order_auto_tasks: dict[int, asyncio.Task] = {}


async def _emit_new_order(order: Order):
    from app.sio_server import sio
    try:
        await sio.emit('new_order', {
            'order_id': order.id,
            'order_number': order.order_number,
            'total_amount': order.total_amount,
            'delivery_fee': order.delivery_fee,
            'distance_km': order.distance_km,
            'restaurant_lat': order.restaurant_lat,
            'restaurant_lng': order.restaurant_lng,
            'customer_address': order.customer_address,
            'priority': order.priority,
            'priority_reason': order.priority_reason,
            'eta_minutes': order.eta_minutes,
            'status': order.status.value,
            'items': [{'name': i.food_item.name, 'quantity': i.quantity} for i in order.items],
        }, room='delivery_partners')
    except Exception as e:
        print(f"[Socket] Failed to emit new_order: {e}")


async def _emit_order_update(order_id: int, status: str, partner_id: int | None = None):
    from app.sio_server import sio
    try:
        await sio.emit('order_update', {
            'order_id': order_id,
            'status': status,
            'partner_id': partner_id,
        }, room=f'order_{order_id}')
    except Exception as e:
        print(f"[Socket] Failed to emit order_update: {e}")


async def _emit_partner_location(order_id: int, partner_id: int, lat: float, lng: float):
    from app.sio_server import sio
    try:
        await sio.emit('partner_location', {
            'order_id': order_id,
            'partner_id': partner_id,
            'lat': lat,
            'lng': lng,
        }, room=f'order_{order_id}')
    except Exception as e:
        print(f"[Socket] Failed to emit partner_location: {e}")


async def _simulate_partner_movement(
    order_id: int,
    partner_id: int,
    customer_lat: float,
    customer_lng: float,
    restaurant_lat: float,
    restaurant_lng: float,
):
    await _emit_partner_location(order_id, partner_id, restaurant_lat, restaurant_lng)
    steps = 4
    interval = 3
    for i in range(steps):
        progress = (i + 1) / steps
        lat = restaurant_lat + (customer_lat - restaurant_lat) * progress
        lng = restaurant_lng + (customer_lng - restaurant_lng) * progress
        await _emit_partner_location(order_id, partner_id, lat, lng)
        await asyncio.sleep(interval)
    await _emit_partner_location(order_id, partner_id, customer_lat, customer_lng)


@asynccontextmanager
async def _progress_order(order_id: int, db: Session):
    if order_id in _order_auto_tasks:
        _order_auto_tasks[order_id].cancel()
        try:
            await _order_auto_tasks[order_id]
        except asyncio.CancelledError:
            pass

    async def run():
        try:
            await _auto_progress_order(order_id, db)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[AutoOrder] Error progressing order {order_id}: {e}")
        finally:
            _order_auto_tasks.pop(order_id, None)

    t = asyncio.create_task(run())
    _order_auto_tasks[order_id] = t
    try:
        yield
    finally:
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass


async def _auto_progress_order(order_id: int, db: Session):
    order = db.query(Order).options(joinedload(Order.items).joinedload(OrderItem.food_item)).filter(Order.id == order_id).first()
    if not order:
        return

    order.status = OrderStatus.CONFIRMED
    order.confirmed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    await _emit_order_update(order.id, order.status.value, order.partner_id)
    await asyncio.sleep(12)

    if order.status != OrderStatus.CONFIRMED:
        return
    order.status = OrderStatus.PREPARING
    db.commit()
    db.refresh(order)
    await _emit_order_update(order.id, order.status.value, order.partner_id)
    await asyncio.sleep(12)

    if order.status != OrderStatus.PREPARING:
        return
    order.status = OrderStatus.READY
    db.commit()
    db.refresh(order)

    partner = db.query(DeliveryPartner).filter(DeliveryPartner.status == PartnerStatus.AVAILABLE).first()
    if partner:
        order.partner_id = partner.id
        partner.status = PartnerStatus.BUSY
        db.commit()
        db.refresh(order)

    await _emit_order_update(order.id, order.status.value, order.partner_id)
    await asyncio.sleep(12)

    if order.status != OrderStatus.READY:
        return
    order.status = OrderStatus.PICKED_UP
    order.picked_up_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    await _emit_order_update(order.id, order.status.value, order.partner_id)

    movement_task = None
    if order.partner_id:
        movement_task = asyncio.create_task(
            _simulate_partner_movement(
                order.id,
                order.partner_id,
                order.customer_lat or 17.4369,
                order.customer_lng or 78.4001,
                order.restaurant_lat or 17.4369,
                order.restaurant_lng or 78.4001,
            )
        )

    await asyncio.sleep(12)

    if movement_task:
        try:
            await movement_task
        except asyncio.CancelledError:
            pass

    if order.status != OrderStatus.PICKED_UP:
        return
    order.status = OrderStatus.IN_TRANSIT
    db.commit()
    db.refresh(order)
    await _emit_order_update(order.id, order.status.value, order.partner_id)
    await asyncio.sleep(15)

    if order.status != OrderStatus.IN_TRANSIT:
        return
    order.status = OrderStatus.DELIVERED
    order.delivered_at = datetime.now(timezone.utc)
    if order.partner:
        order.partner.status = PartnerStatus.AVAILABLE
    db.commit()
    db.refresh(order)
    await _emit_order_update(order.id, order.status.value, order.partner_id)


def generate_order_number() -> str:
    num = "".join(random.choices(string.digits, k=4))
    return f"SR-{num}"


@router.post("/", response_model=OrderOut, status_code=201)
async def create_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CUSTOMER)),
):
    total = 0.0
    order_items = []
    has_priority = False
    for item_data in data.items:
        food = db.query(FoodItem).filter(FoodItem.id == item_data.food_item_id).first()
        if not food:
            raise HTTPException(status_code=404, detail=f"Food item {item_data.food_item_id} not found")
        if not food.is_available:
            raise HTTPException(status_code=400, detail=f"{food.name} is not available")
        price = food.price * item_data.quantity
        total += price
        oi = OrderItem(
            food_item_id=food.id,
            quantity=item_data.quantity,
            unit_price=food.price,
        )
        order_items.append(oi)
        if food.is_priority:
            has_priority = True

    priority = 1 if has_priority else 3
    priority_reason = "Ice cream / perishable — deliver first" if has_priority else None
    delivery_fee = round(40 + total * 0.1, 2)
    distance = round(random.uniform(1.5, 5.0), 1)
    eta = max(15, int(distance * 6 + 10))

    order = Order(
        order_number=generate_order_number(),
        customer_id=current_user.id,
        status=OrderStatus.PENDING,
        priority=priority,
        priority_reason=priority_reason,
        total_amount=round(total, 2),
        delivery_fee=delivery_fee,
        distance_km=distance,
        eta_minutes=eta,
        customer_address=data.customer_address,
        customer_landmark=data.customer_landmark,
        customer_lat=data.customer_lat,
        customer_lng=data.customer_lng,
        restaurant_lat=round(random.uniform(17.35, 17.50), 6),
        restaurant_lng=round(random.uniform(78.40, 78.55), 6),
    )
    db.add(order)
    db.flush()

    for oi in order_items:
        oi.order_id = order.id
        db.add(oi)

    db.commit()
    db.refresh(order)

    asyncio.create_task(_emit_new_order(order))

    async with _progress_order(order.id, db):
        pass

    return order


@router.get("/available/list", response_model=list[OrderOut])
def available_orders(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.DELIVERY)),
):
    return (
        db.query(Order)
        .filter(Order.status.in_([OrderStatus.PENDING, OrderStatus.CONFIRMED]))
        .filter(Order.partner_id == None)
        .order_by(Order.priority, Order.created_at)
        .all()
    )


@router.get("/", response_model=list[OrderOut])
def list_orders(
    status: OrderStatus | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Order).options(joinedload(Order.items).joinedload(OrderItem.food_item))
    if current_user.role == UserRole.CUSTOMER:
        q = q.filter(Order.customer_id == current_user.id)
    elif current_user.role == UserRole.DELIVERY:
        partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.id).first()
        q = q.filter(Order.partner_id == partner.id) if partner else q.filter(Order.id == 0)
    if status:
        q = q.filter(Order.status == status)
    return q.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.role == UserRole.CUSTOMER and order.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    return order


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    valid_transitions = {
        OrderStatus.PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
        OrderStatus.CONFIRMED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
        OrderStatus.PREPARING: [OrderStatus.READY],
        OrderStatus.READY: [OrderStatus.PICKED_UP],
        OrderStatus.PICKED_UP: [OrderStatus.IN_TRANSIT],
        OrderStatus.IN_TRANSIT: [OrderStatus.DELIVERED],
    }
    allowed = valid_transitions.get(order.status, [])
    if data.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Cannot transition from {order.status} to {data.status}")

    now = datetime.now(timezone.utc)
    if data.status == OrderStatus.CONFIRMED:
        order.confirmed_at = now
    elif data.status == OrderStatus.PICKED_UP:
        order.picked_up_at = now
    elif data.status == OrderStatus.DELIVERED:
        order.delivered_at = now

    order.status = data.status

    if current_user.role == UserRole.DELIVERY:
        partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.id).first()
        if partner and not order.partner_id:
            order.partner_id = partner.id
            partner.total_deliveries += 1

    if order.id in _order_auto_tasks:
        _order_auto_tasks[order.id].cancel()
        del _order_auto_tasks[order.id]

    db.commit()
    db.refresh(order)
    asyncio.create_task(_emit_order_update(order.id, order.status.value, order.partner_id))
    return order


@router.post("/{order_id}/accept", response_model=OrderOut)
def accept_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.DELIVERY)),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in (OrderStatus.PENDING, OrderStatus.CONFIRMED):
        raise HTTPException(status_code=400, detail=f"Cannot accept order in {order.status.value} status")
    if order.partner_id is not None:
        raise HTTPException(status_code=409, detail="Order already accepted by another partner")

    partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner profile not found")

    order.partner_id = partner.id
    order.status = OrderStatus.CONFIRMED
    order.confirmed_at = datetime.now(timezone.utc)
    partner.status = PartnerStatus.BUSY

    if order.id in _order_auto_tasks:
        _order_auto_tasks[order.id].cancel()
        del _order_auto_tasks[order.id]

    db.commit()
    db.refresh(order)
    asyncio.create_task(_emit_order_update(order.id, order.status.value, order.partner_id))
    return order