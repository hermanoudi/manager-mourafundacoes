import re
import uuid
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from moura_gestao.domain.numbers import quantize_measure

PILE_CODE_MAX = 20
MIN_DIAMETER_CM = 25


class MeasurementStatus(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


EDITABLE_STATUSES = frozenset({MeasurementStatus.DRAFT, MeasurementStatus.REJECTED})


@dataclass(frozen=True)
class MeasurementLine:
    pile_code: str
    diameter_cm: int
    depth_m: Decimal


def normalize_pile_code(raw: str) -> str:
    code = " ".join(raw.split()).upper()
    if not code:
        raise ValueError("identificação da estaca vazia")
    if len(code) > PILE_CODE_MAX:
        raise ValueError(f"identificação da estaca com mais de {PILE_CODE_MAX} caracteres")
    return code


def pile_key(code: str) -> str:
    """Chave de comparação da estaca: só letras e dígitos, maiúsculos ("E-12" == "e 12")."""
    return re.sub(r"[^A-Z0-9]", "", code.upper())


def duplicate_piles(lines: Iterable[MeasurementLine]) -> list[str]:
    seen: set[str] = set()
    dups: list[str] = []
    for line in lines:
        key = pile_key(line.pile_code)
        if key in seen:
            dups.append(line.pile_code)
        seen.add(key)
    return dups


def totals_by_diameter(lines: Iterable[MeasurementLine]) -> list[tuple[int, int, Decimal]]:
    acc: dict[int, tuple[int, Decimal]] = {}
    for line in lines:
        piles, meters = acc.get(line.diameter_cm, (0, Decimal(0)))
        acc[line.diameter_cm] = (piles + 1, meters + line.depth_m)
    return [(d, p, quantize_measure(m)) for d, (p, m) in sorted(acc.items())]


def total_meters(lines: Iterable[MeasurementLine]) -> Decimal:
    return quantize_measure(sum((line.depth_m for line in lines), Decimal(0)))


@dataclass
class Measurement:
    id: int | None
    client_key: uuid.UUID
    job_id: int
    rig_id: int
    work_date: date
    created_by: int
    lines: list[MeasurementLine]
    status: MeasurementStatus = MeasurementStatus.DRAFT
    notes: str | None = None
    photo_id: uuid.UUID | None = None
    submitted_at: datetime | None = None
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    rejection_reason: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    # Quem digitou: o admin pode lançar no nome do operador (created_by). Padrão: o próprio autor.
    entered_by: int | None = None
    # leitura (preenchidos pelo repositório)
    job_name: str = ""
    rig_name: str = ""
    created_by_name: str = ""
    entered_by_name: str = ""
    reviewed_by_name: str | None = None
    contracted_diameters: list[int] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.entered_by is None:
            self.entered_by = self.created_by

    @property
    def total_m(self) -> Decimal:
        return total_meters(self.lines)

    @property
    def totals_by_diameter(self) -> list[tuple[int, int, Decimal]]:
        return totals_by_diameter(self.lines)

    @property
    def uncontracted_diameters(self) -> list[int]:
        contracted = set(self.contracted_diameters)
        return sorted({ln.diameter_cm for ln in self.lines} - contracted)
