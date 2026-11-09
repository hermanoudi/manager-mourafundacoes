from dataclasses import asdict

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from moura_gestao.application import drill_rigs as uc
from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.domain.drill_rigs import DrillRig, RigStatus
from moura_gestao.domain.users import Role
from moura_gestao.infrastructure.repositories import SqlDrillRigRepository
from moura_gestao.interfaces.http.deps import current_user, get_session, require_roles
from moura_gestao.interfaces.http.schemas import DrillRigIn, DrillRigOut, DrillRigPatch

router = APIRouter(prefix="/api/drill-rigs", tags=["drill-rigs"])
writers = [Depends(require_roles(Role.ADMIN, Role.OFFICE))]


def get_repo(session: AsyncSession = Depends(get_session)) -> SqlDrillRigRepository:
    return SqlDrillRigRepository(session)


def _out(r: DrillRig) -> DrillRigOut:
    data = asdict(r)
    data["status"] = r.status.value
    return DrillRigOut(**data)


@router.get("", response_model=Page[DrillRigOut], dependencies=[Depends(current_user)])
async def list_rigs(
    params: PageParams = Depends(), status: RigStatus | None = None, repo=Depends(get_repo)
):
    page = await uc.list_rigs(repo, params, status)
    return Page[DrillRigOut](
        items=[_out(r) for r in page.items], total=page.total, page=page.page,
        page_size=page.page_size,
    )


@router.get("/{rig_id}", response_model=DrillRigOut, dependencies=[Depends(current_user)])
async def get_rig(rig_id: int, repo=Depends(get_repo)):
    return _out(await uc.get_rig(repo, rig_id))


@router.post("", response_model=DrillRigOut, status_code=201, dependencies=writers)
async def create_rig(body: DrillRigIn, repo=Depends(get_repo)):
    return _out(await uc.create_rig(repo, **body.model_dump()))


@router.patch("/{rig_id}", response_model=DrillRigOut, dependencies=writers)
async def patch_rig(rig_id: int, body: DrillRigPatch, repo=Depends(get_repo)):
    return _out(await uc.update_rig(repo, rig_id, **body.model_dump(exclude_unset=True)))
