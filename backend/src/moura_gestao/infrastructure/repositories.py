from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.domain.customers import Address, Customer, CustomerKind
from moura_gestao.domain.documents import normalize_document
from moura_gestao.domain.drill_rigs import DrillRig, RigStatus
from moura_gestao.domain.users import Role, User
from moura_gestao.infrastructure.models import CustomerModel, DrillRigModel, UserModel


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


_ADDR = ("zip_code", "street", "number", "complement", "district", "city", "state", "ibge_city_code")
_PLAIN = (
    "name", "trade_name", "state_registration", "municipal_registration", "email", "phone",
    "contact_name", "notes", "active",
)


def _customer(m: CustomerModel) -> Customer:
    return Customer(
        id=m.id, kind=CustomerKind(m.kind), document=m.document, name=m.name,
        trade_name=m.trade_name, state_registration=m.state_registration,
        municipal_registration=m.municipal_registration, email=m.email, phone=m.phone,
        contact_name=m.contact_name, notes=m.notes, active=m.active, created_at=m.created_at,
        address=Address(**{k: getattr(m, k) for k in _ADDR}),
    )


def _apply(m: CustomerModel, c: Customer) -> None:
    m.kind, m.document = c.kind.value, c.document
    for k in _PLAIN:
        setattr(m, k, getattr(c, k))
    for k in _ADDR:
        setattr(m, k, getattr(c.address, k))


class SqlCustomerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def add(self, customer: Customer) -> Customer:
        m = CustomerModel()
        _apply(m, customer)
        self._s.add(m)
        await self._s.flush()
        await self._s.refresh(m)
        return _customer(m)

    async def get(self, customer_id: int) -> Customer | None:
        m = await self._s.get(CustomerModel, customer_id)
        return _customer(m) if m else None

    async def get_by_document(self, document: str) -> Customer | None:
        stmt = select(CustomerModel).where(CustomerModel.document == document)
        m = (await self._s.execute(stmt)).scalar()
        return _customer(m) if m else None

    async def update(self, customer: Customer) -> Customer:
        m = await self._s.get(CustomerModel, customer.id)
        assert m is not None
        _apply(m, customer)
        await self._s.flush()
        await self._s.refresh(m)
        return _customer(m)

    async def list(self, params: PageParams) -> Page[Customer]:
        stmt = select(CustomerModel)
        if params.q:
            like = f"%{params.q.strip()}%"
            conds = [CustomerModel.name.ilike(like), CustomerModel.trade_name.ilike(like)]
            doc = normalize_document(params.q)
            if doc:
                conds.append(CustomerModel.document.like(f"{doc}%"))
            stmt = stmt.where(or_(*conds))
        total = (await self._s.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows = (
            await self._s.execute(
                stmt.order_by(CustomerModel.name).offset(params.offset).limit(params.page_size)
            )
        ).scalars()
        return Page(
            items=[_customer(m) for m in rows], total=total, page=params.page,
            page_size=params.page_size,
        )


_RIG = (
    "name", "manufacturer", "model", "serial_number", "max_diameter_cm", "max_depth_m", "notes",
)


def _rig(m: DrillRigModel) -> DrillRig:
    return DrillRig(
        id=m.id, status=RigStatus(m.status), created_at=m.created_at,
        **{k: getattr(m, k) for k in _RIG},
    )


class SqlDrillRigRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    @staticmethod
    def _apply(m: DrillRigModel, rig: DrillRig) -> None:
        for k in _RIG:
            setattr(m, k, getattr(rig, k))
        m.status = rig.status.value

    async def add(self, rig: DrillRig) -> DrillRig:
        m = DrillRigModel()
        self._apply(m, rig)
        self._s.add(m)
        await self._s.flush()
        await self._s.refresh(m)
        return _rig(m)

    async def get(self, rig_id: int) -> DrillRig | None:
        m = await self._s.get(DrillRigModel, rig_id)
        return _rig(m) if m else None

    async def get_by_name(self, name: str) -> DrillRig | None:
        stmt = select(DrillRigModel).where(func.lower(DrillRigModel.name) == name.lower())
        m = (await self._s.execute(stmt)).scalar()
        return _rig(m) if m else None

    async def update(self, rig: DrillRig) -> DrillRig:
        m = await self._s.get(DrillRigModel, rig.id)
        assert m is not None
        self._apply(m, rig)
        await self._s.flush()
        await self._s.refresh(m)
        return _rig(m)

    async def list(self, params: PageParams, status: RigStatus | None = None) -> Page[DrillRig]:
        stmt = select(DrillRigModel)
        if params.q:
            stmt = stmt.where(DrillRigModel.name.ilike(f"%{params.q.strip()}%"))
        if status is not None:
            stmt = stmt.where(DrillRigModel.status == status.value)
        total = (await self._s.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows = (
            await self._s.execute(
                stmt.order_by(DrillRigModel.name).offset(params.offset).limit(params.page_size)
            )
        ).scalars()
        return Page(
            items=[_rig(m) for m in rows], total=total, page=params.page,
            page_size=params.page_size,
        )
