from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from moura_gestao.application import jobs as uc
from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.domain.customers import Address
from moura_gestao.domain.jobs import Job, JobStatus
from moura_gestao.domain.pricing import PriceItem, PriceTable
from moura_gestao.domain.users import Role, User
from moura_gestao.infrastructure.repositories import (
    SqlCustomerRepository,
    SqlDrillRigRepository,
    SqlJobRepository,
    SqlMeasurementRepository,
    SqlPriceTableRepository,
    SqlUserRepository,
)
from moura_gestao.interfaces.http.deps import current_user, get_session, require_roles
from moura_gestao.interfaces.http.schemas import (
    AddressOut,
    AllocationIn,
    IdName,
    JobIn,
    JobOut,
    JobPatch,
    JobRigOut,
    JobSummaryOut,
    PriceItemIO,
    PriceTableIO,
)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
writers = [Depends(require_roles(Role.ADMIN, Role.OFFICE))]


def get_repo(session: AsyncSession = Depends(get_session)) -> SqlJobRepository:
    return SqlJobRepository(session)


def _prices_out(t: PriceTable) -> PriceTableIO:
    return PriceTableIO(
        mobilization_fee=t.mobilization_fee,
        minimum_amount=t.minimum_amount,
        max_tabled_depth_m=t.max_tabled_depth_m,
        items=[PriceItemIO(diameter_cm=i.diameter_cm, price_per_m=i.price_per_m) for i in t.items],
    )


def _table(body: PriceTableIO) -> PriceTable:
    return PriceTable(
        mobilization_fee=body.mobilization_fee,
        minimum_amount=body.minimum_amount,
        max_tabled_depth_m=body.max_tabled_depth_m,
        items=[PriceItem(i.diameter_cm, i.price_per_m) for i in body.items],
    )


def _out(job: Job, user: User) -> JobOut:
    assert job.id is not None and job.created_at is not None
    return JobOut(
        id=job.id, name=job.name, customer=IdName(id=job.customer_id, name=job.customer_name),
        address=AddressOut(**vars(job.address)), status=job.status,
        start_date=job.start_date, end_date=job.end_date, notes=job.notes,
        prices=None if user.role == Role.OPERATOR else _prices_out(job.prices),
        contracted_diameters=job.contracted_diameters,
        rigs=[
            JobRigOut(id=r.id, name=r.name, max_diameter_cm=r.max_diameter_cm,
                      max_depth_m=r.max_depth_m)
            for r in job.rigs if r.id is not None
        ],
        operators=[IdName(id=o.id, name=o.name) for o in job.operators],
        created_at=job.created_at,
    )


@router.get("", response_model=Page[JobSummaryOut])
async def list_jobs(
    params: PageParams = Depends(), status: JobStatus | None = None,
    user: User = Depends(current_user), repo=Depends(get_repo),
):
    page = await uc.list_jobs_for(repo, user, params, status)
    return Page[JobSummaryOut](
        items=[JobSummaryOut(**vars(j)) for j in page.items], total=page.total, page=page.page,
        page_size=page.page_size,
    )


@router.post("", response_model=JobOut, status_code=201, dependencies=writers)
async def create_job(
    body: JobIn, user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    job = await uc.create_job(
        SqlJobRepository(session), SqlCustomerRepository(session), SqlPriceTableRepository(session),
        name=body.name, customer_id=body.customer_id,
        address=Address(**body.address.model_dump()), start_date=body.start_date,
        end_date=body.end_date, notes=body.notes,
        prices=_table(body.prices) if body.prices is not None else None,
    )
    return _out(job, user)


@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: int, user: User = Depends(current_user), repo=Depends(get_repo)):
    return _out(await uc.get_job_for(repo, user, job_id), user)


@router.patch("/{job_id}", response_model=JobOut, dependencies=writers)
async def patch_job(
    job_id: int, body: JobPatch, user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    data = body.model_dump(exclude_unset=True, exclude={"address"})
    if body.address is not None:
        data["address"] = Address(**body.address.model_dump())
    job = await uc.update_job(
        SqlJobRepository(session), SqlMeasurementRepository(session), job_id, **data
    )
    return _out(job, user)


@router.put("/{job_id}/prices", response_model=JobOut, dependencies=writers)
async def put_prices(
    job_id: int, body: PriceTableIO, user: User = Depends(current_user), repo=Depends(get_repo)
):
    return _out(await uc.replace_job_prices(repo, job_id, _table(body)), user)


@router.put("/{job_id}/allocation", response_model=JobOut, dependencies=writers)
async def put_allocation(
    job_id: int, body: AllocationIn, user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    job = await uc.set_job_allocation(
        SqlJobRepository(session), SqlDrillRigRepository(session), SqlUserRepository(session),
        job_id, body.rig_ids, body.operator_ids,
    )
    return _out(job, user)
