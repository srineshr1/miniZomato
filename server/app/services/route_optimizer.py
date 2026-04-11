import math
from dataclasses import dataclass


@dataclass
class StopInfo:
    order_id: int
    order_number: str
    food_name: str
    food_emoji: str
    priority: int
    priority_reason: str | None
    stop_type: str
    lat: float | None
    lng: float | None
    distance_km: float = 0


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return R * c


def optimize_route(
    orders: list[StopInfo],
    start_lat: float,
    start_lng: float,
) -> list[StopInfo]:
    if not orders:
        return []

    unvisited = list(orders)
    route: list[StopInfo] = []
    current_lat, current_lng = start_lat, start_lng

    while unvisited:
        nearest = min(
            unvisited,
            key=lambda o: (
                o.priority,
                haversine(current_lat, current_lng, o.lat, o.lng) if o.lat is not None and o.lng is not None else float("inf"),
                o.order_id,
            ),
        )

        if nearest.lat is not None and nearest.lng is not None:
            dist = haversine(current_lat, current_lng, nearest.lat, nearest.lng)
            nearest.distance_km = round(dist, 1)
            current_lat, current_lng = nearest.lat, nearest.lng
        else:
            nearest.distance_km = 0

        route.append(nearest)
        unvisited.remove(nearest)

    return route


def estimate_route_time(total_distance_km: float, avg_speed_kmh: float = 30) -> int:
    return max(15, int((total_distance_km / avg_speed_kmh) * 60 + 10))
