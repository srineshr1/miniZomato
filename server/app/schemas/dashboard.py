from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_orders: int = 0
    active_orders: int = 0
    active_partners: int = 0
    avg_delivery_minutes: float = 0
    violations_today: int = 0
    revenue_today: float = 0
    delivered_today: int = 0


class RouteStop(BaseModel):
    order_id: int
    order_number: str
    food_name: str
    food_emoji: str
    priority: int
    priority_reason: str | None
    stop_type: str = "dropoff"
    distance_km: float
    lat: float | None
    lng: float | None


class OptimizedRoute(BaseModel):
    stops: list[RouteStop]
    total_distance_km: float
    estimated_minutes: int
    algorithm: str = "NN + Priority"
