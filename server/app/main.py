from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import engine, Base, SessionLocal
from app.routers import auth, users, food_items, orders, delivery, routing, qr, safety, admin, restaurants
from app.sio_server import sio, connected_partners
import socketio as _socketio


@sio.event
async def connect(sid, environ, auth=None):
    print(f"Client connected: {sid}")
    token = auth.get("token") if auth else None
    if token:
        from app.services.auth_service import decode_access_token
        from app.models.user import User, UserRole
        from app.models.delivery_partner import DeliveryPartner
        payload = decode_access_token(token)
        if payload:
            user_id = payload.get("sub")
            if user_id:
                try:
                    db = SessionLocal()
                    user = db.query(User).filter(User.id == int(user_id)).first()
                    if user and user.role == UserRole.DELIVERY:
                        partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == user.id).first()
                        if partner:
                            connected_partners[sid] = partner.id
                            await sio.enter_room(sid, "delivery_partners")
                            print(f"Partner {partner.id} joined delivery_partners room")
                    db.close()
                except Exception:
                    pass


@sio.event
async def disconnect(sid):
    partner_id = connected_partners.pop(sid, None)
    if partner_id:
        await sio.emit("partner_offline", {"partner_id": partner_id})
    print(f"Client disconnected: {sid}")


@sio.event
async def join_partner_room(sid, data):
    partner_id = data.get("partner_id")
    if partner_id:
        connected_partners[sid] = partner_id
        await sio.enter_room(sid, f"partner_{partner_id}")


@sio.event
async def location_update(sid, data):
    partner_id = data.get("partner_id")
    lat = data.get("lat")
    lng = data.get("lng")
    speed = data.get("speed_kmh", 0)
    if partner_id and lat and lng:
        await sio.emit(
            "partner_location",
            {"partner_id": partner_id, "lat": lat, "lng": lng, "speed_kmh": speed},
            room=f"order_tracking",
        )
        from app.config import settings
        if speed > settings.SPEED_LIMIT_KMH:
            await sio.emit(
                "speed_alert",
                {"partner_id": partner_id, "speed_kmh": speed, "limit": settings.SPEED_LIMIT_KMH},
                room="admin",
            )


@sio.event
async def join_tracking(sid, data):
    order_id = data.get("order_id")
    if order_id:
        await sio.enter_room(sid, f"order_{order_id}")


@sio.event
async def order_status_update(sid, data):
    order_id = data.get("order_id")
    status = data.get("status")
    if order_id and status:
        await sio.emit("order_update", data, room=f"order_{order_id}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        db.execute(text("PRAGMA foreign_keys=off"))
        try:
            db.execute(text("ALTER TABLE food_items ADD COLUMN restaurant_id INTEGER REFERENCES restaurants(id)"))
        except Exception:
            pass
        try:
            db.execute(text("ALTER TABLE restaurants ADD COLUMN menu_scraped BOOLEAN DEFAULT 0"))
        except Exception:
            pass
        try:
            db.execute(text("ALTER TABLE food_items ADD COLUMN rating FLOAT"))
        except Exception:
            pass
        try:
            db.execute(text("ALTER TABLE food_items ADD COLUMN image_url TEXT"))
        except Exception:
            pass
        db.commit()
    finally:
        db.close()

    db = SessionLocal()
    from app.models.user import User, UserRole
    from app.services.auth_service import hash_password

    if not db.query(User).filter(User.email == "admin@smartroute.in").first():
        admin = User(email="admin@smartroute.in", name="Admin", hashed_password=hash_password("admin1234"), role=UserRole.ADMIN, avatar_initial="A")
        db.add(admin)
    if not db.query(User).filter(User.email == "demo@smartroute.in").first():
        customer = User(email="demo@smartroute.in", name="Ricky", hashed_password=hash_password("demo1234"), role=UserRole.CUSTOMER, avatar_initial="R")
        db.add(customer)
    if not db.query(User).filter(User.email == "arjun@smartroute.in").first():
        delivery = User(email="arjun@smartroute.in", name="Arjun Kumar", hashed_password=hash_password("demo1234"), role=UserRole.DELIVERY, avatar_initial="A")
        db.add(delivery)
        db.flush()
        from app.models.delivery_partner import DeliveryPartner, PartnerStatus
        partner = DeliveryPartner(user_id=delivery.id, status=PartnerStatus.ONLINE, safety_score=98.0, rating=4.8, total_deliveries=1240)
        db.add(partner)

    from app.models.food_item import FoodItem, FoodCategory
    if db.query(FoodItem).count() == 0:
        foods = [
            FoodItem(name="Chicken Biryani", description="Fragrant basmati rice with tender chicken, slow-cooked with spices", price=280, category=FoodCategory.BIRYANI, emoji="🍗", tag="BESTSELLER", restaurant_name="Paradise", restaurant_area="Hyderabad Zone", image_gradient="linear-gradient(135deg,#1a0f00,#2d1800)", rating=4.5, image_url="https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&h=420&fit=crop"),
            FoodItem(name="Belgian Waffle Sundae", description="3 scoops of Belgian chocolate ice cream, waffle, caramel drizzle", price=195, category=FoodCategory.ICE_CREAM, emoji="🍦", tag="⚡ PRIORITY", is_priority=True, priority_reason="Melts in 20min — deliver first", restaurant_name="Cream Stone", restaurant_area="Hyderabad Zone", image_gradient="linear-gradient(135deg,#001a1a,#002828)", rating=4.6, image_url="https://images.unsplash.com/photo-1570197571499-166b36435e9f?w=600&h=420&fit=crop"),
            FoodItem(name="Double Pepperoni", description="Stone-baked, double layer mozzarella, spicy pepperoni, basil", price=420, category=FoodCategory.PIZZA, emoji="🍕", tag="NEW", restaurant_name="Pizza Hut", restaurant_area="Hyderabad Zone", image_gradient="linear-gradient(135deg,#1a0000,#2d0000)", rating=4.2, image_url="https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=420&fit=crop"),
            FoodItem(name="Quinoa Power Bowl", description="Grilled veggies, quinoa, tahini dressing, pomegranate seeds", price=310, category=FoodCategory.HEALTHY, emoji="🥗", tag="HEALTHY", restaurant_name="Nectar Kitchen & Bar", restaurant_area="Hyderabad Zone", image_gradient="linear-gradient(135deg,#0d1a00,#1a2d00)", rating=4.3, image_url="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=420&fit=crop"),
            FoodItem(name="Smash Burger", description="Double smashed patty, ghost pepper sauce, pickled jalapenos", price=340, category=FoodCategory.BURGERS, emoji="🍔", tag="SPICY 🌶️", restaurant_name="Burger King", restaurant_area="Hyderabad Zone", image_gradient="linear-gradient(135deg,#1a0a00,#2d1500)", rating=4.4, image_url="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=420&fit=crop"),
            FoodItem(name="Pad Thai Noodles", description="Rice noodles, tofu, bean sprouts, peanuts, tamarind sauce", price=220, category=FoodCategory.NOODLES, emoji="🍜", tag="VEG", restaurant_name="Mamagoto", restaurant_area="Hyderabad Zone", image_gradient="linear-gradient(135deg,#001500,#002400)", rating=4.1, image_url="https://images.unsplash.com/photo-1559314809-0d1550143294?w=600&h=420&fit=crop"),
        ]
        db.add_all(foods)

    from app.models.restaurant import Restaurant
    import math
    AREA_CENTER_LAT = 17.4369
    AREA_CENTER_LNG = 78.4001
    AREA_RADIUS_KM = 10
    EARTH_RADIUS_M = 6371000

    def in_zone(lat: float, lng: float) -> bool:
        d_lat = math.radians(lat - AREA_CENTER_LAT)
        d_lng = math.radians(lng - AREA_CENTER_LNG)
        a = math.sin(d_lat/2)**2 + math.cos(math.radians(AREA_CENTER_LAT)) * math.cos(math.radians(lat)) * math.sin(d_lng/2)**2
        return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a)) <= AREA_RADIUS_KM * 1000

    csv_path = "../restaurants_cleaned.csv"
    if db.query(Restaurant).count() == 0:
        try:
            import csv as csv_lib
            with open(csv_path, newline='', encoding='utf-8') as f:
                reader = csv_lib.DictReader(f)
                for row in reader:
                    try:
                        lat = float(row['lat'])
                        lng = float(row['lng'])
                        if not in_zone(lat, lng):
                            continue
                        existing = db.query(Restaurant).filter(Restaurant.name == row['name'], Restaurant.lat == lat, Restaurant.lng == lng).first()
                        if not existing:
                            r = Restaurant(
                                name=row['name'],
                                lat=lat,
                                lng=lng,
                                address=row.get('address', ''),
                                area=row.get('area', ''),
                                cuisine=row.get('cuisine', ''),
                                rating=row.get('rating', ''),
                                source=row.get('source', ''),
                                menu_scraped=False,
                            )
                            db.add(r)
                    except (ValueError, KeyError):
                        continue
            print(f"[Startup] Loaded restaurants from CSV (zone filtered)")
        except Exception as e:
            print(f"[Startup] Could not load restaurants from CSV: {e}")

    db.commit()
    db.close()
    yield


app = FastAPI(
    title="Smart Route API",
    description="Intelligent Delivery Platform with Smart Routing, Safety Monitoring, and QR Privacy",
    version="2.4.1",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(food_items.router)
app.include_router(orders.router)
app.include_router(delivery.router)
app.include_router(routing.router)
app.include_router(qr.router)
app.include_router(safety.router)
app.include_router(admin.router)
app.include_router(restaurants.router)


@app.get("/")
def root():
    return {
        "app": "Smart Route API",
        "version": "2.4.1",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


socket_app = _socketio.ASGIApp(sio, app)