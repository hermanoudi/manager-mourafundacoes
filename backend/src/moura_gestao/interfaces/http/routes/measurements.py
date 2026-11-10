from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from moura_gestao.application import measurements as uc
from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.domain.measurements import Measurement, MeasurementLine, MeasurementStatus
from moura_gestao.domain.users import User
from moura_gestao.infrastructure.repositories import (
    SqlJobRepository,
    SqlMeasurementRepository,
    SqlPhotoRepository,
)
from moura_gestao.interfaces.http.deps import current_user, get_session
from moura_gestao.interfaces.http.schemas import (
    DiameterTotalOut,
    IdName,
    MeasurementIn,
    MeasurementLineIO,
    MeasurementOut,
    MeasurementPatch,
    MeasurementSummaryOut,
    RejectIn,
)

router = APIRouter(prefix="/api/measurements", tags=["measurements"])


@dataclass
class Repos:
    measurements: SqlMeasurementRepository
    jobs: SqlJobRepository
    photos: SqlPhotoRepository


def get_repos(session: AsyncSession = Depends(get_session)) -> Repos:
    return Repos(
        SqlMeasurementRepository(session), SqlJobRepository(session), SqlPhotoRepository(session)
    )


def _now() -> datetime:
    return datetime.now(UTC)


def _lines(items: list[MeasurementLineIO]) -> list[MeasurementLine]:
    return [MeasurementLine(i.pile_code, i.diameter_cm, i.depth_m) for i in items]


def _summary_fields(m: Measurement) -> dict[str, Any]:
    assert m.id is not None
    return {
        "id": m.id, "client_key": m.client_key,
        "job": IdName(id=m.job_id, name=m.job_name),
        "rig": IdName(id=m.rig_id, name=m.rig_name),
        "work_date": m.work_date, "status": m.status, "total_m": m.total_m,
        "totals_by_diameter": [
            DiameterTotalOut(diameter_cm=d, piles=p, meters=meters)
            for d, p, meters in m.totals_by_diameter
        ],
        "uncontracted_diameters": m.uncontracted_diameters,
        "created_by": IdName(id=m.created_by, name=m.created_by_name),
        "submitted_at": m.submitted_at,
        "reviewed_by": (
            IdName(id=m.reviewed_by, name=m.reviewed_by_name or "")
            if m.reviewed_by is not None else None
        ),
        "reviewed_at": m.reviewed_at, "rejection_reason": m.rejection_reason,
        "photo_id": m.photo_id,
        "notes": m.notes,
    }


def _out(m: Measurement) -> MeasurementOut:
    return MeasurementOut(
        **_summary_fields(m),
        lines=[
            MeasurementLineIO(pile_code=ln.pile_code, diameter_cm=ln.diameter_cm, depth_m=ln.depth_m)
            for ln in m.lines
        ],
    )


@router.get("", response_model=Page[MeasurementSummaryOut])
async def list_measurements(
    params: PageParams = Depends(), job_id: int | None = None,
    status: MeasurementStatus | None = None,
    user: User = Depends(current_user), r: Repos = Depends(get_repos),
):
    page = await uc.list_measurements_for(r.measurements, user, params, job_id, status)
    return Page[MeasurementSummaryOut](
        items=[MeasurementSummaryOut(**_summary_fields(m)) for m in page.items],
        total=page.total, page=page.page, page_size=page.page_size,
    )


@router.post("", response_model=MeasurementOut, status_code=201)
async def create_measurement(
    body: MeasurementIn, response: Response, user: User = Depends(current_user),
    r: Repos = Depends(get_repos),
):
    m, created = await uc.save_measurement(
        r.measurements, r.jobs, r.photos, user, _now(),
        client_key=body.client_key, job_id=body.job_id, rig_id=body.rig_id,
        work_date=body.work_date, lines=_lines(body.lines), notes=body.notes,
        photo_id=body.photo_id, submit=body.submit,
    )
    if not created:
        response.status_code = 200
    return _out(m)


@router.get("/{measurement_id}", response_model=MeasurementOut)
async def get_measurement(
    measurement_id: int, user: User = Depends(current_user), r: Repos = Depends(get_repos)
):
    return _out(await uc.get_measurement_for(r.measurements, r.jobs, user, measurement_id))


@router.patch("/{measurement_id}", response_model=MeasurementOut)
async def patch_measurement(
    measurement_id: int, body: MeasurementPatch, user: User = Depends(current_user),
    r: Repos = Depends(get_repos),
):
    data = body.model_dump(exclude_unset=True, exclude={"lines"})
    if body.lines is not None:
        data["lines"] = _lines(body.lines)
    m = await uc.update_measurement(r.measurements, r.jobs, user, _now(), measurement_id, **data)
    return _out(m)


@router.delete("/{measurement_id}", status_code=204)
async def delete_measurement(
    measurement_id: int, user: User = Depends(current_user), r: Repos = Depends(get_repos)
):
    await uc.delete_measurement(r.measurements, r.jobs, user, measurement_id)


@router.post("/{measurement_id}/submit", response_model=MeasurementOut)
async def submit_measurement(
    measurement_id: int, user: User = Depends(current_user), r: Repos = Depends(get_repos)
):
    return _out(await uc.submit_measurement(r.measurements, r.jobs, user, _now(), measurement_id))


@router.post("/{measurement_id}/approve", response_model=MeasurementOut)
async def approve_measurement(
    measurement_id: int, user: User = Depends(current_user), r: Repos = Depends(get_repos)
):
    return _out(await uc.approve_measurement(r.measurements, r.jobs, user, _now(), measurement_id))


@router.post("/{measurement_id}/reject", response_model=MeasurementOut)
async def reject_measurement(
    measurement_id: int, body: RejectIn, user: User = Depends(current_user),
    r: Repos = Depends(get_repos),
):
    m = await uc.reject_measurement(
        r.measurements, r.jobs, user, _now(), measurement_id, body.reason
    )
    return _out(m)
