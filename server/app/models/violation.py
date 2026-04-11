import enum
from datetime import datetime

from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ViolationType(str, enum.Enum):
    SPEED = "speed"
    HELMET = "helmet"
    CAMERA = "camera"


class ViolationSeverity(str, enum.Enum):
    WARNING = "warning"
    PENALTY = "penalty"
    REVIEW = "review"


class Violation(Base):
    __tablename__ = "violations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("delivery_partners.id"), nullable=False)
    type: Mapped[ViolationType] = mapped_column(Enum(ViolationType), nullable=False)
    severity: Mapped[ViolationSeverity] = mapped_column(Enum(ViolationSeverity), default=ViolationSeverity.WARNING)
    detail: Mapped[str] = mapped_column(Text, nullable=True)
    speed_recorded: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed_limit: Mapped[float | None] = mapped_column(Float, nullable=True)
    offense_count: Mapped[int] = mapped_column(Integer, default=1)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    resolved: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    partner = relationship("DeliveryPartner", back_populates="violations")