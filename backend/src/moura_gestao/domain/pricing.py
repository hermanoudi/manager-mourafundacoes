from dataclasses import dataclass
from decimal import Decimal

MIN_DIAMETER_CM = 25
MAX_DIAMETER_CM = 80


@dataclass(frozen=True)
class PriceItem:
    diameter_cm: int
    price_per_m: Decimal


@dataclass(frozen=True)
class PriceTable:
    # Na tabela global é a mobilização de Uberlândia-MG; na obra, None = "a negociar".
    mobilization_fee: Decimal | None
    minimum_amount: Decimal | None
    max_tabled_depth_m: Decimal
    items: list[PriceItem]


def validate_items(items: list[PriceItem]) -> list[PriceItem]:
    seen: set[int] = set()
    for item in items:
        if not MIN_DIAMETER_CM <= item.diameter_cm <= MAX_DIAMETER_CM:
            raise ValueError(
                f"diâmetro deve estar entre {MIN_DIAMETER_CM} e {MAX_DIAMETER_CM} cm"
            )
        if item.diameter_cm in seen:
            raise ValueError("diâmetro repetido")
        if item.price_per_m <= 0:
            raise ValueError("preço por metro deve ser maior que zero")
        seen.add(item.diameter_cm)
    return sorted(items, key=lambda i: i.diameter_cm)
