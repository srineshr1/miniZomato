import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.restaurant import Restaurant
from app.models.food_item import FoodItem
from app.schemas.restaurant import RestaurantOut, RestaurantWithMenu

router = APIRouter(prefix="/restaurants", tags=["Restaurants"])

EARTH_RADIUS_M = 6371000


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2)
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


@router.get("/zone", response_model=list[RestaurantWithMenu])
def zone_restaurants(
    radius_km: float = 5,
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    AREA_CENTER_LAT = 17.4369
    AREA_CENTER_LNG = 78.4001

    all_q = db.query(Restaurant)
    restaurants = all_q.all()
    in_zone = []
    for r in restaurants:
        dist_m = haversine_m(AREA_CENTER_LAT, AREA_CENTER_LNG, r.lat, r.lng)
        if dist_m <= radius_km * 1000:
            in_zone.append(r)

    in_zone.sort(key=lambda x: -float(x.rating or 0))
    return in_zone[skip:skip + limit]


@router.get("/", response_model=list[RestaurantOut])
def list_restaurants(
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 5,
    cuisine: str | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(Restaurant)
    if cuisine:
        q = q.filter(Restaurant.cuisine.ilike(f"%{cuisine}%"))
    if search:
        q = q.filter(Restaurant.name.ilike(f"%{search}%"))
    restaurants = q.offset(skip).limit(limit).all()

    if lat is not None and lng is not None:
        results = []
        for r in restaurants:
            dist_m = haversine_m(lat, lng, r.lat, r.lng)
            if dist_m <= radius_km * 1000:
                results.append(r)
        return results
    return restaurants


@router.get("/nearby", response_model=list[RestaurantWithMenu])
def nearby_restaurants(
    lat: float,
    lng: float,
    radius_km: float = 3,
    cuisine: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    all_q = db.query(Restaurant)
    if cuisine:
        all_q = all_q.filter(Restaurant.cuisine.ilike(f"%{cuisine}%"))

    restaurants = all_q.all()
    nearby = []
    for r in restaurants:
        dist_m = haversine_m(lat, lng, r.lat, r.lng)
        if dist_m <= radius_km * 1000:
            r._dist_m = dist_m
            nearby.append(r)

    nearby.sort(key=lambda x: x._dist_m)
    return nearby[skip:skip + limit]


@router.get("/{restaurant_id}", response_model=RestaurantWithMenu)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant


@router.get("/{restaurant_id}/menu", response_model=list[RestaurantOut])
def get_restaurant_menu(
    restaurant_id: int,
    db: Session = Depends(get_db),
):
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    items = db.query(FoodItem).filter(FoodItem.restaurant_id == restaurant_id).all()
    return items
