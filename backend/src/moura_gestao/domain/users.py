from dataclasses import dataclass
from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    OFFICE = "office"
    OPERATOR = "operator"


@dataclass
class User:
    id: int
    name: str
    email: str
    role: Role
    active: bool
    password_hash: str
