from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.domain.users import Role, User
from moura_gestao.infrastructure.models import UserModel


def _user(m: UserModel) -> User:
    return User(
        id=m.id, name=m.name, email=m.email, role=Role(m.role), active=m.active,
        password_hash=m.password_hash,
    )


class SqlUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def add(self, name: str, email: str, password_hash: str, role: Role) -> User:
        m = UserModel(name=name, email=email, password_hash=password_hash, role=role.value)
        self._s.add(m)
        await self._s.flush()
        return _user(m)

    async def get(self, user_id: int) -> User | None:
        m = await self._s.get(UserModel, user_id)
        return _user(m) if m else None

    async def get_by_email(self, email: str) -> User | None:
        m = (await self._s.execute(select(UserModel).where(UserModel.email == email))).scalar()
        return _user(m) if m else None

    async def update(self, user: User) -> User:
        m = await self._s.get(UserModel, user.id)
        assert m is not None
        m.name, m.role, m.active = user.name, user.role.value, user.active
        m.password_hash = user.password_hash
        await self._s.flush()
        return _user(m)

    async def list(self, params: PageParams) -> Page[User]:
        stmt = select(UserModel)
        if params.q:
            like = f"%{params.q}%"
            stmt = stmt.where(or_(UserModel.name.ilike(like), UserModel.email.ilike(like)))
        total = (await self._s.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows = (
            await self._s.execute(
                stmt.order_by(UserModel.name).offset(params.offset).limit(params.page_size)
            )
        ).scalars()
        return Page(
            items=[_user(m) for m in rows], total=total, page=params.page,
            page_size=params.page_size,
        )

    async def count_active_admins(self) -> int:
        stmt = select(func.count()).select_from(UserModel).where(
            UserModel.role == "admin", UserModel.active.is_(True)
        )
        return (await self._s.execute(stmt)).scalar_one()
