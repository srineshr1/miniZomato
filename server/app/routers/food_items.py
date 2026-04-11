from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.food_item import FoodItem, FoodCategory
from app.schemas.food_item import FoodItemCreate, FoodItemOut, FoodItemUpdate
from app.models.user import User, UserRole
from app.routers.auth import require_role

router = APIRouter(prefix="/food-items", tags=["Food Items"])


@router.get("/", response_model=list[FoodItemOut])
def list_food_items(
    category: FoodCategory | None = None,
    search: str | None = None,
    available_only: bool = True,
    restaurant_id: int | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(FoodItem)
    if category:
        q = q.filter(FoodItem.category == category)
    if available_only:
        q = q.filter(FoodItem.is_available == True)
    if search:
        q = q.filter(FoodItem.name.ilike(f"%{search}%"))
    if restaurant_id is not None:
        q = q.filter(FoodItem.restaurant_id == restaurant_id)
    return q.offset(skip).limit(limit).all()


@router.get("/{item_id}", response_model=FoodItemOut)
def get_food_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(FoodItem).filter(FoodItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Food item not found")
    return item


@router.post("/", response_model=FoodItemOut)
def create_food_item(
    data: FoodItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    item = FoodItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=FoodItemOut)
def update_food_item(
    item_id: int,
    data: FoodItemUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    item = db.query(FoodItem).filter(FoodItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Food item not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(item, key, val)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_food_item(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    item = db.query(FoodItem).filter(FoodItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Food item not found")
    db.delete(item)
    db.commit()
    return {"detail": "Food item deleted"}