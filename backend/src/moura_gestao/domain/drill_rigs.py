from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum


class RigStatus(StrEnum):
    ACTIVE = "active"
    MAINTENANCE = "maintenance"
    INACTIVE = "inactive"


@dataclass
class DrillRig:
    id: int | None
    name: str
    max_diameter_cm: int
    max_depth_m: Decimal
    status: RigStatus
    notes: str | None = None
    created_at: datetime | None = None
