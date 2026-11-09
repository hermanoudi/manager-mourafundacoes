from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher as _Argon2

from moura_gestao.domain.errors import DomainError


class Argon2Hasher:
    def __init__(self) -> None:
        self._h = PasswordHash((_Argon2(),))

    def hash(self, password: str) -> str:
        return self._h.hash(password)

    def verify(self, password: str, password_hash: str) -> bool:
        try:
            return self._h.verify(password, password_hash)
        except Exception:  # noqa: BLE001 - qualquer hash malformado = senha inválida
            return False


class JwtTokenService:
    def __init__(self, secret: str, ttl_hours: int) -> None:
        self._secret = secret
        self._ttl = ttl_hours

    def issue(self, user_id: int) -> str:
        exp = datetime.now(UTC) + timedelta(hours=self._ttl)
        return jwt.encode({"sub": str(user_id), "exp": exp}, self._secret, algorithm="HS256")

    def decode(self, token: str) -> int:
        try:
            payload = jwt.decode(token, self._secret, algorithms=["HS256"])
            return int(payload["sub"])
        except (jwt.PyJWTError, KeyError, ValueError) as exc:
            raise DomainError("Sessão inválida", code="not_authenticated") from exc
