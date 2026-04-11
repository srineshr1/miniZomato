from datetime import datetime
from pydantic import BaseModel


class RestaurantOut(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    address: str | None
    area: str | None
    cuisine: str | None
    rating: str | None
    source: str | None
    menu_scraped: bool

    model_config = {"from_attributes": True}


class RestaurantWithMenu(RestaurantOut):
    food_items: list["FoodItemOut"] = []


from app.schemas.food_item import FoodItemOut
RestaurantWithMenu.model_rebuild()
