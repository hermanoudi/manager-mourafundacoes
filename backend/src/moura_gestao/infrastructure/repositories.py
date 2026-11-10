from sqlalchemy import delete, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.domain.customers import Address, Customer, CustomerKind
from moura_gestao.domain.documents import normalize_document
from moura_gestao.domain.drill_rigs import DrillRig, RigStatus
from moura_gestao.domain.jobs import Job, JobStatus, JobSummary
from moura_gestao.domain.pricing import PriceItem, PriceTable
from moura_gestao.domain.users import Role, User
from moura_gestao.infrastructure.models import (
    CustomerModel,
    DrillRigModel,
    JobModel,
    JobOperatorModel,
    JobPriceModel,
    JobRigModel,
    PriceTableItemModel,
    PriceTableModel,
    UserModel,
)


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

    async def list_active_operators(self) -> list[User]:
        stmt = (
            select(UserModel)
            .where(UserModel.role == "operator", UserModel.active.is_(True))
            .order_by(UserModel.name, UserModel.id)
        )
        return [_user(m) for m in (await self._s.execute(stmt)).scalars()]

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


_RIG = ("name", "max_diameter_cm", "max_depth_m", "notes")


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


class SqlPriceTableRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def _head(self) -> PriceTableModel:
        return (
            await self._s.execute(select(PriceTableModel).where(PriceTableModel.id == 1))
        ).scalar_one()

    async def get(self) -> PriceTable:
        head = await self._head()
        rows = (
            await self._s.execute(
                select(PriceTableItemModel).order_by(PriceTableItemModel.diameter_cm)
            )
        ).scalars()
        return PriceTable(
            mobilization_fee=head.mobilization_fee,
            minimum_amount=head.minimum_amount,
            max_tabled_depth_m=head.max_tabled_depth_m,
            items=[PriceItem(r.diameter_cm, r.price_per_m) for r in rows],
        )

    async def replace(self, table: PriceTable) -> PriceTable:
        head = await self._head()
        head.mobilization_fee = table.mobilization_fee
        head.minimum_amount = table.minimum_amount
        head.max_tabled_depth_m = table.max_tabled_depth_m
        head.updated_at = func.now()
        await self._s.execute(delete(PriceTableItemModel))
        await self._s.flush()
        self._s.add_all(
            PriceTableItemModel(diameter_cm=i.diameter_cm, price_per_m=i.price_per_m)
            for i in table.items
        )
        await self._s.flush()
        self._s.expire_all()
        return await self.get()


def _job(
    m: JobModel, customer_name: str, items: list[PriceItem], rigs: list[DrillRig],
    operators: list[User],
) -> Job:
    return Job(
        id=m.id, name=m.name, customer_id=m.customer_id,
        address=Address(**{k: getattr(m, k) for k in _ADDR}),
        status=JobStatus(m.status), start_date=m.start_date, end_date=m.end_date,
        mobilization_fee=m.mobilization_fee, minimum_amount=m.minimum_amount,
        max_tabled_depth_m=m.max_tabled_depth_m, notes=m.notes, items=items, rigs=rigs,
        operators=operators, customer_name=customer_name, created_at=m.created_at,
    )


class SqlJobRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    @staticmethod
    def _apply(m: JobModel, job: Job) -> None:
        m.name, m.customer_id, m.status = job.name, job.customer_id, job.status.value
        m.start_date, m.end_date, m.notes = job.start_date, job.end_date, job.notes
        m.mobilization_fee, m.minimum_amount = job.mobilization_fee, job.minimum_amount
        m.max_tabled_depth_m = job.max_tabled_depth_m
        for k in _ADDR:
            setattr(m, k, getattr(job.address, k))

    async def _hydrate(self, m: JobModel) -> Job:
        customer_name = (
            await self._s.execute(select(CustomerModel.name).where(CustomerModel.id == m.customer_id))
        ).scalar_one()
        items = (
            await self._s.execute(
                select(JobPriceModel)
                .where(JobPriceModel.job_id == m.id)
                .order_by(JobPriceModel.diameter_cm)
            )
        ).scalars()
        rigs = (
            await self._s.execute(
                select(DrillRigModel)
                .join(JobRigModel, JobRigModel.rig_id == DrillRigModel.id)
                .where(JobRigModel.job_id == m.id)
                .order_by(DrillRigModel.name)
            )
        ).scalars()
        operators = (
            await self._s.execute(
                select(UserModel)
                .join(JobOperatorModel, JobOperatorModel.user_id == UserModel.id)
                .where(JobOperatorModel.job_id == m.id)
                .order_by(UserModel.name, UserModel.id)
            )
        ).scalars()
        return _job(
            m, customer_name, [PriceItem(i.diameter_cm, i.price_per_m) for i in items],
            [_rig(r) for r in rigs], [_user(u) for u in operators],
        )

    async def add(self, job: Job) -> Job:
        m = JobModel()
        self._apply(m, job)
        self._s.add(m)
        await self._s.flush()
        self._s.add_all(
            JobPriceModel(job_id=m.id, diameter_cm=i.diameter_cm, price_per_m=i.price_per_m)
            for i in job.items
        )
        await self._s.flush()
        await self._s.refresh(m)
        return await self._hydrate(m)

    async def get(self, job_id: int) -> Job | None:
        m = await self._s.get(JobModel, job_id)
        return await self._hydrate(m) if m else None

    async def update(self, job: Job) -> Job:
        m = await self._s.get(JobModel, job.id)
        assert m is not None
        self._apply(m, job)
        await self._s.flush()
        await self._s.refresh(m)
        return await self._hydrate(m)

    async def set_allocation(
        self, job_id: int, rig_ids: list[int], operator_ids: list[int]
    ) -> None:
        await self._s.execute(delete(JobRigModel).where(JobRigModel.job_id == job_id))
        await self._s.execute(delete(JobOperatorModel).where(JobOperatorModel.job_id == job_id))
        await self._s.flush()
        self._s.add_all(JobRigModel(job_id=job_id, rig_id=r) for r in dict.fromkeys(rig_ids))
        self._s.add_all(
            JobOperatorModel(job_id=job_id, user_id=u) for u in dict.fromkeys(operator_ids)
        )
        await self._s.flush()

    async def list(
        self, params: PageParams, status: JobStatus | None = None, operator_id: int | None = None
    ) -> Page[JobSummary]:
        stmt = select(JobModel, CustomerModel.name).join(
            CustomerModel, CustomerModel.id == JobModel.customer_id
        )
        if params.q:
            like = f"%{params.q.strip()}%"
            stmt = stmt.where(
                or_(
                    JobModel.name.ilike(like),
                    CustomerModel.name.ilike(like),
                    CustomerModel.trade_name.ilike(like),
                )
            )
        if status is not None:
            stmt = stmt.where(JobModel.status == status.value)
        if operator_id is not None:
            stmt = stmt.where(
                exists().where(
                    JobOperatorModel.job_id == JobModel.id, JobOperatorModel.user_id == operator_id
                )
            )
        total = (await self._s.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows = (
            await self._s.execute(
                stmt.order_by(JobModel.created_at.desc(), JobModel.id.desc())
                .offset(params.offset)
                .limit(params.page_size)
            )
        ).all()
        return Page(
            items=[
                JobSummary(
                    id=m.id, name=m.name, customer_name=cname, city=m.city,
                    status=JobStatus(m.status), start_date=m.start_date,
                )
                for m, cname in rows
            ],
            total=total, page=params.page, page_size=params.page_size,
        )

    async def set_prices(self, job_id: int, table: PriceTable) -> None:
        m = await self._s.get(JobModel, job_id)
        assert m is not None
        m.mobilization_fee = table.mobilization_fee
        m.minimum_amount = table.minimum_amount
        m.max_tabled_depth_m = table.max_tabled_depth_m
        await self._s.execute(delete(JobPriceModel).where(JobPriceModel.job_id == job_id))
        await self._s.flush()
        self._s.add_all(
            JobPriceModel(job_id=job_id, diameter_cm=i.diameter_cm, price_per_m=i.price_per_m)
            for i in table.items
        )
        await self._s.flush()

    async def is_operator_allocated(self, job_id: int, user_id: int) -> bool:
        stmt = select(
            exists().where(JobOperatorModel.job_id == job_id, JobOperatorModel.user_id == user_id)
        )
        return bool((await self._s.execute(stmt)).scalar())
