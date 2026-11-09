from moura_gestao.application.ports import PasswordHasher, UserRepository
from moura_gestao.domain.errors import DomainError
from moura_gestao.domain.users import User

INVALID = "E-mail ou senha inválidos"


async def authenticate(
    repo: UserRepository, hasher: PasswordHasher, email: str, password: str
) -> User:
    user = await repo.get_by_email(email.strip().lower())
    if user is None or not user.active or not hasher.verify(password, user.password_hash):
        raise DomainError(INVALID, code="invalid_credentials")
    return user
