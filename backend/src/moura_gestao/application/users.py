from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.application.ports import PasswordHasher, UserRepository
from moura_gestao.domain.errors import Conflict, NotFound
from moura_gestao.domain.users import Role, User


async def create_user(
    repo: UserRepository, hasher: PasswordHasher, *, name: str, email: str, password: str, role: Role
) -> User:
    email = email.strip().lower()
    if await repo.get_by_email(email) is not None:
        raise Conflict("duplicate_email", "E-mail já cadastrado")
    return await repo.add(name.strip(), email, hasher.hash(password), role)


async def update_user(
    repo: UserRepository,
    hasher: PasswordHasher,
    user_id: int,
    *,
    name: str | None = None,
    role: Role | None = None,
    active: bool | None = None,
    password: str | None = None,
) -> User:
    user = await repo.get(user_id)
    if user is None:
        raise NotFound("Usuário não encontrado")
    loses_admin = user.role == Role.ADMIN and user.active and (
        active is False or (role is not None and role != Role.ADMIN)
    )
    if loses_admin and await repo.count_active_admins() <= 1:
        raise Conflict("last_admin", "É preciso manter ao menos um administrador ativo")
    if name is not None:
        user.name = name.strip()
    if role is not None:
        user.role = role
    if active is not None:
        user.active = active
    if password is not None:
        user.password_hash = hasher.hash(password)
    return await repo.update(user)


async def list_users(repo: UserRepository, params: PageParams) -> Page[User]:
    return await repo.list(params)
