from collections.abc import AsyncIterator, Callable

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from moura_gestao.application.ports import PasswordHasher, TokenService
from moura_gestao.domain.errors import DomainError
from moura_gestao.domain.users import Role, User
from moura_gestao.infrastructure.repositories import SqlUserRepository
from moura_gestao.infrastructure.security import Argon2Hasher, JwtTokenService

COOKIE_NAME = "mg_session"


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    factory = request.app.state.session_factory
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_hasher() -> PasswordHasher:
    return Argon2Hasher()


def get_tokens(request: Request) -> TokenService:
    s = request.app.state.settings
    return JwtTokenService(s.jwt_secret.get_secret_value(), s.session_ttl_hours)


def get_user_repo(session: AsyncSession = Depends(get_session)) -> SqlUserRepository:
    return SqlUserRepository(session)


async def current_user(
    request: Request,
    repo: SqlUserRepository = Depends(get_user_repo),
    tokens: TokenService = Depends(get_tokens),
) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise DomainError("Não autenticado", code="not_authenticated")
    user = await repo.get(tokens.decode(token))
    if user is None or not user.active:
        raise DomainError("Não autenticado", code="not_authenticated")
    return user


def require_roles(*roles: Role) -> Callable[..., User]:
    async def _dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise DomainError("Sem permissão", code="forbidden")
        return user

    return _dep
