import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field

from moura_gestao.domain.users import Role

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(v: str) -> str:
    v = v.strip().lower()
    if not _EMAIL.match(v) or len(v) > 254:
        raise ValueError("e-mail inválido")
    return v


Email = Annotated[str, AfterValidator(_email)]


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
