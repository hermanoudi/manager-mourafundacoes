import re
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    Field,
    PlainSerializer,
    field_validator,
    model_validator,
)

from moura_gestao.domain.customers import UFS
from moura_gestao.domain.documents import document_kind
from moura_gestao.domain.drill_rigs import RigStatus
from moura_gestao.domain.numbers import parse_decimal_br, quantize_measure
from moura_gestao.domain.users import Role

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(v: str) -> str:
    v = v.strip().lower()
    if not _EMAIL.match(v) or len(v) > 254:
        raise ValueError("e-mail inválido")
    return v


Email = Annotated[str, AfterValidator(_email)]


def _reject_null(model: BaseModel, required: tuple[str, ...]) -> None:
    for name in required:
        if name in model.model_fields_set and getattr(model, name) is None:
            raise ValueError(f"{name} não pode ser nulo")


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: Role
    active: bool


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: Email
    password: str = Field(min_length=10, max_length=128)
    role: Role


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    active: bool | None = None
    password: str | None = Field(default=None, min_length=10, max_length=128)

    @model_validator(mode="after")
    def _no_nulls(self) -> "UserUpdate":
        _reject_null(self, ("name", "role", "active", "password"))
        return self


def _digits(v: str) -> str:
    return re.sub(r"\D", "", v)


class AddressIn(BaseModel):
    zip_code: str
    street: str = Field(min_length=1, max_length=160)
    number: str = Field(min_length=1, max_length=20)
    complement: str | None = Field(default=None, max_length=80)
    district: str = Field(min_length=1, max_length=80)
    city: str = Field(min_length=1, max_length=80)
    state: str
    ibge_city_code: str | None = None

    @field_validator("zip_code")
    @classmethod
    def _zip(cls, v: str) -> str:
        d = _digits(v)
        if len(d) != 8:
            raise ValueError("CEP inválido")
        return d

    @field_validator("state")
    @classmethod
    def _state(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in UFS:
            raise ValueError("UF inválida")
        return v

    @field_validator("ibge_city_code")
    @classmethod
    def _ibge(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        d = _digits(v)
        if len(d) != 7:
            raise ValueError("código IBGE inválido")
        return d


def _valid_document(v: str) -> str:
    document_kind(v)  # levanta ValueError se inválido
    return v


class CustomerBase(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    trade_name: str | None = Field(default=None, max_length=160)
    state_registration: str | None = Field(default=None, max_length=30)
    municipal_registration: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=30)
    contact_name: str | None = Field(default=None, max_length=120)
    notes: str | None = None
    active: bool = True


class CustomerIn(CustomerBase):
    document: Annotated[str, AfterValidator(_valid_document)]
    address: AddressIn


class CustomerPatch(BaseModel):
    document: Annotated[str, AfterValidator(_valid_document)] | None = None
    name: str | None = Field(default=None, min_length=1, max_length=160)
    trade_name: str | None = Field(default=None, max_length=160)
    state_registration: str | None = Field(default=None, max_length=30)
    municipal_registration: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=30)
    contact_name: str | None = Field(default=None, max_length=120)
    notes: str | None = None
    active: bool | None = None
    address: AddressIn | None = None

    @model_validator(mode="after")
    def _no_nulls(self) -> "CustomerPatch":
        _reject_null(self, ("document", "name", "active", "address"))
        return self


class AddressOut(BaseModel):
    zip_code: str
    street: str
    number: str
    complement: str | None
    district: str
    city: str
    state: str
    ibge_city_code: str | None


class CustomerOut(CustomerBase):
    id: int
    kind: str
    document: str
    address: AddressOut
    created_at: datetime


def _depth(v: str | int | Decimal) -> Decimal:
    value = quantize_measure(parse_decimal_br(v))
    if not (Decimal(0) < value <= Decimal(40)):
        raise ValueError("profundidade deve ser maior que 0 e no máximo 40 m")
    return value


Depth = Annotated[Decimal, BeforeValidator(_depth)]


class DrillRigBase(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    max_diameter_cm: int = Field(ge=20, le=120)
    max_depth_m: Depth
    status: RigStatus
    notes: str | None = None


class DrillRigIn(DrillRigBase):
    pass


class DrillRigPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    max_diameter_cm: int | None = Field(default=None, ge=20, le=120)
    max_depth_m: Depth | None = None
    status: RigStatus | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _no_nulls(self) -> "DrillRigPatch":
        _reject_null(self, ("name", "max_diameter_cm", "max_depth_m", "status"))
        return self


class DrillRigOut(DrillRigBase):
    id: int
    max_depth_m: Annotated[Decimal, PlainSerializer(lambda d: f"{d:.2f}", return_type=str)]
