from dataclasses import replace
from datetime import date
from typing import Any

from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.application.ports import (
    CustomerRepository,
    DrillRigRepository,
    JobRepository,
    MeasurementRepository,
    PriceTableRepository,
    UserRepository,
)
from moura_gestao.domain.customers import Address
from moura_gestao.domain.drill_rigs import RigStatus
from moura_gestao.domain.errors import Conflict, DomainError, NotFound
from moura_gestao.domain.jobs import (
    LOCKED_STATUSES,
    Job,
    JobStatus,
    JobSummary,
    can_transition,
    is_home_city,
)
from moura_gestao.domain.measurements import MeasurementStatus
from moura_gestao.domain.pricing import PriceTable, validate_items
from moura_gestao.domain.users import Role, User

_NOT_FOUND = "Obra não encontrada"


def _check_dates(start: date | None, end: date | None) -> None:
    if start is not None and end is not None and end < start:
        raise DomainError(
            "A data de término não pode ser anterior à data de início", code="invalid_dates"
        )


async def create_job(
    jobs: JobRepository,
    customers: CustomerRepository,
    price_table: PriceTableRepository,
    *,
    name: str,
    customer_id: int,
    address: Address,
    start_date: date | None = None,
    end_date: date | None = None,
    notes: str | None = None,
    prices: PriceTable | None = None,
) -> Job:
    if await customers.get(customer_id) is None:
        raise NotFound("Cliente não encontrado")
    _check_dates(start_date, end_date)
    if prices is not None:
        table, mobilization_fee = prices, prices.mobilization_fee
    else:
        table = await price_table.get()
        # a taxa global é a de Uberlândia; em outra cidade a obra nasce "a negociar"
        mobilization_fee = table.mobilization_fee if is_home_city(address) else None
    return await jobs.add(
        Job(
            id=None, name=name, customer_id=customer_id, address=address,
            mobilization_fee=mobilization_fee, minimum_amount=table.minimum_amount,
            max_tabled_depth_m=table.max_tabled_depth_m, start_date=start_date,
            end_date=end_date, notes=notes, items=validate_items(list(table.items)),
        )
    )


async def get_job_for(jobs: JobRepository, user: User, job_id: int) -> Job:
    """Obra visível para o usuário; operador não alocado recebe NotFound (não vaza existência)."""
    job = await jobs.get(job_id)
    if job is None:
        raise NotFound(_NOT_FOUND)
    if user.role == Role.OPERATOR and not await jobs.is_operator_allocated(job_id, user.id):
        raise NotFound(_NOT_FOUND)
    return job


async def list_jobs_for(
    jobs: JobRepository, user: User, params: PageParams, status: JobStatus | None = None
) -> Page[JobSummary]:
    operator_id = user.id if user.role == Role.OPERATOR else None
    return await jobs.list(params, status, operator_id)


async def update_job(
    jobs: JobRepository, measurements: MeasurementRepository, job_id: int, **fields: Any
) -> Job:
    job = await jobs.get(job_id)
    if job is None:
        raise NotFound(_NOT_FOUND)
    status: JobStatus | None = fields.pop("status", None)
    changed = replace(job, **fields)
    _check_dates(changed.start_date, changed.end_date)
    if status is not None and status != job.status:
        if not can_transition(job.status, status):
            raise Conflict(
                "invalid_status_transition",
                f"Não é possível mudar a obra de {job.status.value} para {status.value}",
            )
        if status == JobStatus.IN_PROGRESS and not (job.rigs and job.operators):
            raise Conflict(
                "job_not_ready",
                "Aloque ao menos uma perfuratriz e um operador antes de iniciar a obra",
            )
        if status == JobStatus.IN_PROGRESS and job.mobilization_fee is None:
            raise Conflict(
                "mobilization_pending",
                "Feche a negociação da mobilização antes de iniciar a obra",
            )
        if status == JobStatus.COMPLETED:
            # mesmo lock das escritas de medição: um envio concorrente não escapa da contagem
            await measurements.lock_job(job_id)
            if await measurements.count_by_status(job_id, MeasurementStatus.SUBMITTED):
                raise Conflict(
                    "pending_measurements",
                    "Aprove ou rejeite as medições enviadas antes de concluir a obra",
                )
        changed.status = status
    return await jobs.update(changed)


async def replace_job_prices(jobs: JobRepository, job_id: int, table: PriceTable) -> Job:
    job = await jobs.get(job_id)
    if job is None:
        raise NotFound(_NOT_FOUND)
    if job.status in LOCKED_STATUSES:
        raise Conflict("job_locked", "A tabela de uma obra concluída ou cancelada não pode mudar")
    items = validate_items(list(table.items))
    await jobs.set_prices(
        job_id, PriceTable(table.mobilization_fee, table.minimum_amount, table.max_tabled_depth_m, items)
    )
    return await _reload(jobs, job_id)


async def set_job_allocation(
    jobs: JobRepository,
    rigs: DrillRigRepository,
    users: UserRepository,
    job_id: int,
    rig_ids: list[int],
    operator_ids: list[int],
) -> Job:
    if await jobs.get(job_id) is None:
        raise NotFound(_NOT_FOUND)
    for rig_id in rig_ids:
        rig = await rigs.get(rig_id)
        if rig is None or rig.status != RigStatus.ACTIVE:
            raise Conflict("rig_unavailable", "Perfuratriz inexistente ou fora de operação")
    for user_id in operator_ids:
        user = await users.get(user_id)
        if user is None or not user.active or user.role != Role.OPERATOR:
            raise Conflict("invalid_operator", "Usuário não é um operador ativo")
    await jobs.set_allocation(job_id, rig_ids, operator_ids)
    return await _reload(jobs, job_id)


async def _reload(jobs: JobRepository, job_id: int) -> Job:
    job = await jobs.get(job_id)
    assert job is not None
    return job


async def list_active_operators(users: UserRepository) -> list[User]:
    return await users.list_active_operators()
