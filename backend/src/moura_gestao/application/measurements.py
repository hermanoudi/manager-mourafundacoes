import uuid
from dataclasses import replace
from datetime import date, datetime
from typing import Any

from moura_gestao.application.jobs import get_job_for
from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.application.ports import JobRepository, MeasurementRepository, PhotoRepository
from moura_gestao.domain.dates import today_sp
from moura_gestao.domain.errors import Conflict, DomainError, NotFound
from moura_gestao.domain.jobs import JobStatus
from moura_gestao.domain.measurements import (
    EDITABLE_STATUSES,
    MIN_DIAMETER_CM,
    Measurement,
    MeasurementLine,
    MeasurementStatus,
    duplicate_piles,
    pile_key,
)
from moura_gestao.domain.users import Role, User

_NOT_FOUND = "Medição não encontrada"
_REVIEWERS = frozenset({Role.ADMIN, Role.OFFICE})
REASON_MIN, REASON_MAX = 3, 500


def _forbidden() -> DomainError:
    return DomainError("Sem permissão", code="forbidden")


async def _validate(
    measurements: MeasurementRepository, jobs: JobRepository, user: User, now: datetime,
    m: Measurement,
) -> None:
    job = await get_job_for(jobs, user, m.job_id)
    if job.status != JobStatus.IN_PROGRESS:
        raise Conflict("job_not_in_progress", "A obra não está em execução")
    rig = next((r for r in job.rigs if r.id == m.rig_id), None)
    if rig is None:
        raise Conflict("rig_not_allocated", "A perfuratriz não está alocada nesta obra")
    if m.work_date > today_sp(now):
        raise DomainError("A data da medição não pode ser futura", code="future_date")
    if dups := duplicate_piles(m.lines):
        raise DomainError(
            f"Estaca repetida na medição: {', '.join(dups)}", code="validation_error"
        )
    for line in m.lines:
        if not MIN_DIAMETER_CM <= line.diameter_cm <= rig.max_diameter_cm:
            raise DomainError(
                f"Estaca {line.pile_code}: diâmetro {line.diameter_cm} cm fora do limite da "
                f"perfuratriz ({MIN_DIAMETER_CM}–{rig.max_diameter_cm} cm)",
                code="line_exceeds_rig",
            )
        if line.depth_m > rig.max_depth_m:
            raise DomainError(
                f"Estaca {line.pile_code}: profundidade {line.depth_m} m acima do limite da "
                f"perfuratriz ({rig.max_depth_m} m)",
                code="line_exceeds_rig",
            )
    taken = await measurements.pile_keys_in_job(m.job_id, exclude_id=m.id)
    collisions = [taken[k] for k in dict.fromkeys(pile_key(ln.pile_code) for ln in m.lines)
                  if k in taken]
    if collisions:
        raise Conflict(
            "duplicate_pile", f"Estacas já lançadas nesta obra: {', '.join(collisions)}"
        )


def _mark_submitted(m: Measurement, now: datetime) -> None:
    m.status = MeasurementStatus.SUBMITTED
    m.submitted_at = now
    m.rejection_reason, m.reviewed_by, m.reviewed_at = None, None, None


async def _approve(
    measurements: MeasurementRepository, user: User, now: datetime, m: Measurement
) -> Measurement:
    if missing := m.uncontracted_diameters:
        raise Conflict(
            "diameter_not_contracted",
            "Diâmetros sem preço contratado na obra: "
            + ", ".join(f"{d} cm" for d in missing),
        )
    m.status, m.reviewed_by, m.reviewed_at = MeasurementStatus.APPROVED, user.id, now
    return await measurements.update(m)


async def _auto_approve(
    measurements: MeasurementRepository, user: User, now: datetime, m: Measurement
) -> Measurement:
    """Medição que o próprio admin lança já nasce aprovada (ele é quem aprovaria)."""
    if user.role == Role.ADMIN and m.created_by == user.id and m.status == MeasurementStatus.SUBMITTED:
        return await _approve(measurements, user, now, m)
    return m


def _check_author(user: User, m: Measurement) -> None:
    if user.role == Role.OPERATOR and m.created_by != user.id:
        raise _forbidden()


def _check_editable(m: Measurement) -> None:
    if m.status not in EDITABLE_STATUSES:
        raise Conflict("measurement_locked", "Medição enviada ou aprovada não pode ser alterada")


async def _edit(
    measurements: MeasurementRepository, jobs: JobRepository, user: User, now: datetime,
    m: Measurement, changes: dict[str, Any], submit: bool = False,
) -> Measurement:
    changed = replace(m, **changes)
    await _validate(measurements, jobs, user, now, changed)
    if changed.status == MeasurementStatus.REJECTED:
        changed.status = MeasurementStatus.DRAFT
        changed.rejection_reason, changed.reviewed_by, changed.reviewed_at = None, None, None
    if submit:
        _mark_submitted(changed, now)
    saved = await measurements.update(changed)
    return await _auto_approve(measurements, user, now, saved)


async def get_measurement_for(
    measurements: MeasurementRepository, jobs: JobRepository, user: User, measurement_id: int
) -> Measurement:
    """Medição visível; operador não alocado na obra recebe NotFound (não vaza existência)."""
    m = await measurements.get(measurement_id)
    if m is None:
        raise NotFound(_NOT_FOUND)
    if user.role == Role.OPERATOR and not await jobs.is_operator_allocated(m.job_id, user.id):
        raise NotFound(_NOT_FOUND)
    return m


async def _get_locked(
    measurements: MeasurementRepository, jobs: JobRepository, user: User, measurement_id: int
) -> Measurement:
    """Medição visível relida depois do lock da obra (escritas concorrentes serializadas)."""
    m = await get_measurement_for(measurements, jobs, user, measurement_id)
    await measurements.lock_job(m.job_id)
    locked = await measurements.get(measurement_id)
    if locked is None:  # excluída enquanto esperava o lock
        raise NotFound(_NOT_FOUND)
    return locked


async def list_measurements_for(
    measurements: MeasurementRepository, user: User, params: PageParams,
    job_id: int | None = None, status: MeasurementStatus | None = None,
) -> Page[Measurement]:
    operator_id = user.id if user.role == Role.OPERATOR else None
    return await measurements.list(params, job_id, status, operator_id)


async def save_measurement(
    measurements: MeasurementRepository, jobs: JobRepository, photos: PhotoRepository,
    user: User, now: datetime, *,
    client_key: uuid.UUID, job_id: int, rig_id: int, work_date: date,
    lines: list[MeasurementLine], notes: str | None = None, photo_id: uuid.UUID | None = None,
    submit: bool = False,
) -> tuple[Measurement, bool]:
    """Cria a medição ou, se o client_key já existe, aplica o replay/upsert.

    Devolve (medição, criada?).
    """
    if photo_id is not None:
        await get_job_for(jobs, user, job_id)  # operador não alocado: 404 antes de olhar a foto
        photo = await photos.get(photo_id)
        if photo is None or photo.job_id != job_id:
            raise DomainError("A foto não pertence a esta obra", code="validation_error")
    payload = {
        "rig_id": rig_id, "work_date": work_date, "lines": list(lines), "notes": notes,
        "photo_id": photo_id,
    }
    await measurements.lock_job(job_id)
    existing = await measurements.get_by_client_key(client_key)
    if existing is None:
        new = Measurement(
            id=None, client_key=client_key, job_id=job_id, created_by=user.id, **payload
        )
        await _validate(measurements, jobs, user, now, new)
        if submit:
            _mark_submitted(new, now)
        try:
            saved = await measurements.add(new)
        except Conflict as exc:  # outra requisição gravou o mesmo client_key antes
            if exc.code != "duplicate_client_key":
                raise
            existing = await measurements.get_by_client_key(client_key)
            if existing is None:
                raise
        else:
            return await _auto_approve(measurements, user, now, saved), True
    return await _replay(measurements, jobs, user, now, existing, job_id, payload, submit), False


async def _replay(
    measurements: MeasurementRepository, jobs: JobRepository, user: User, now: datetime,
    existing: Measurement, job_id: int, payload: dict[str, Any], submit: bool,
) -> Measurement:
    # O admin pode corrigir a medição de qualquer autor; os demais, só as próprias.
    owner = existing.created_by == user.id or user.role == Role.ADMIN
    if not owner or existing.job_id != job_id:
        raise Conflict("duplicate_client_key", "Este identificador já pertence a outra medição")
    if existing.status not in EDITABLE_STATUSES:
        return existing
    return await _edit(measurements, jobs, user, now, existing, payload, submit)


async def update_measurement(
    measurements: MeasurementRepository, jobs: JobRepository, user: User, now: datetime,
    measurement_id: int, **changes: Any,
) -> Measurement:
    m = await _get_locked(measurements, jobs, user, measurement_id)
    _check_author(user, m)
    _check_editable(m)
    return await _edit(measurements, jobs, user, now, m, changes)


async def delete_measurement(
    measurements: MeasurementRepository, jobs: JobRepository, user: User, measurement_id: int
) -> None:
    m = await _get_locked(measurements, jobs, user, measurement_id)
    _check_author(user, m)
    _check_editable(m)
    await measurements.delete(measurement_id)


async def submit_measurement(
    measurements: MeasurementRepository, jobs: JobRepository, user: User, now: datetime,
    measurement_id: int,
) -> Measurement:
    m = await _get_locked(measurements, jobs, user, measurement_id)
    _check_author(user, m)
    if m.status == MeasurementStatus.SUBMITTED:
        return m
    _check_editable(m)
    await _validate(measurements, jobs, user, now, m)
    _mark_submitted(m, now)
    saved = await measurements.update(m)
    return await _auto_approve(measurements, user, now, saved)


def _check_reviewer(user: User) -> None:
    if user.role not in _REVIEWERS:
        raise _forbidden()


async def approve_measurement(
    measurements: MeasurementRepository, jobs: JobRepository, user: User, now: datetime,
    measurement_id: int,
) -> Measurement:
    _check_reviewer(user)
    m = await _get_locked(measurements, jobs, user, measurement_id)
    if m.status == MeasurementStatus.APPROVED:
        return m
    if m.status != MeasurementStatus.SUBMITTED:
        raise Conflict("invalid_status_transition", "Só medições enviadas podem ser aprovadas")
    return await _approve(measurements, user, now, m)


async def reject_measurement(
    measurements: MeasurementRepository, jobs: JobRepository, user: User, now: datetime,
    measurement_id: int, reason: str,
) -> Measurement:
    _check_reviewer(user)
    reason = reason.strip()
    if not REASON_MIN <= len(reason) <= REASON_MAX:
        raise DomainError(
            f"O motivo deve ter de {REASON_MIN} a {REASON_MAX} caracteres", code="validation_error"
        )
    m = await _get_locked(measurements, jobs, user, measurement_id)
    if m.status != MeasurementStatus.SUBMITTED:
        raise Conflict("invalid_status_transition", "Só medições enviadas podem ser rejeitadas")
    m.status, m.reviewed_by, m.reviewed_at = MeasurementStatus.REJECTED, user.id, now
    m.rejection_reason = reason
    return await measurements.update(m)
