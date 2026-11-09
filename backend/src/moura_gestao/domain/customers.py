from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

UFS = frozenset(
    ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]
)


class CustomerKind(StrEnum):
    PF = "PF"
    PJ = "PJ"


@dataclass
class Address:
    zip_code: str
    street: str
    number: str
    district: str
    city: str
    state: str
    complement: str | None = None
    ibge_city_code: str | None = None


@dataclass
class Customer:
    id: int | None
    kind: CustomerKind
    document: str
    name: str
    address: Address
    trade_name: str | None = None
    state_registration: str | None = None
    municipal_registration: str | None = None
    email: str | None = None
    phone: str | None = None
    contact_name: str | None = None
    notes: str | None = None
    active: bool = True
    created_at: datetime | None = None
