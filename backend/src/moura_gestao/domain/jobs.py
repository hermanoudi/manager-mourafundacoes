from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from moura_gestao.domain.customers import Address
from moura_gestao.domain.drill_rigs import DrillRig
from moura_gestao.domain.pricing import PriceItem, PriceTable
from moura_gestao.domain.users import User


class JobStatus(StrEnum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


_ALLOWED = frozenset(
    {
        (JobStatus.PLANNED, JobStatus.IN_PROGRESS),
        (JobStatus.PLANNED, JobStatus.CANCELLED),
        (JobStatus.IN_PROGRESS, JobStatus.COMPLETED),
        (JobStatus.IN_PROGRESS, JobStatus.CANCELLED),
    }
)

LOCKED_STATUSES = frozenset({JobStatus.COMPLETED, JobStatus.CANCELLED})


def can_transition(src: JobStatus, dst: JobStatus) -> bool:
    return (src, dst) in _ALLOWED


@dataclass
class Job:
    id: int | None
    name: str
    customer_id: int
    address: Address
    mobilization_fee: Decimal
    max_tabled_depth_m: Decimal
    minimum_amount: Decimal | None = None
    status: JobStatus = JobStatus.PLANNED
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = None
    items: list[PriceItem] = field(default_factory=list)
    rigs: list[DrillRig] = field(default_factory=list)
    operators: list[User] = field(default_factory=list)
    customer_name: str = ""
    created_at: datetime | None = None

    @property
    def prices(self) -> PriceTable:
        return PriceTable(
            self.mobilization_fee, self.minimum_amount, self.max_tabled_depth_m, list(self.items)
        )

    @property
    def contracted_diameters(self) -> list[int]:
        return sorted(i.diameter_cm for i in self.items)


@dataclass
class JobSummary:
    id: int
    name: str
    customer_name: str
    city: str
    status: JobStatus
    start_date: date | None
