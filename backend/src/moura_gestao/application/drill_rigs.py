from dataclasses import replace
from typing import Any

from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.application.ports import DrillRigRepository
from moura_gestao.domain.drill_rigs import DrillRig, RigStatus
from moura_gestao.domain.errors import Conflict, NotFound


async def create_rig(repo: DrillRigRepository, **fields: Any) -> DrillRig:
    if await repo.get_by_name(fields["name"]) is not None:
        raise Conflict("duplicate_rig_name", "Já existe uma perfuratriz com este nome")
    return await repo.add(DrillRig(id=None, **fields))


async def update_rig(repo: DrillRigRepository, rig_id: int, **fields: Any) -> DrillRig:
    rig = await repo.get(rig_id)
    if rig is None:
        raise NotFound("Perfuratriz não encontrada")
    if "name" in fields:
        other = await repo.get_by_name(fields["name"])
        if other is not None and other.id != rig_id:
            raise Conflict("duplicate_rig_name", "Já existe uma perfuratriz com este nome")
    return await repo.update(replace(rig, **fields))


async def get_rig(repo: DrillRigRepository, rig_id: int) -> DrillRig:
    rig = await repo.get(rig_id)
    if rig is None:
        raise NotFound("Perfuratriz não encontrada")
    return rig


async def list_rigs(
    repo: DrillRigRepository, params: PageParams, status: RigStatus | None = None
) -> Page[DrillRig]:
    return await repo.list(params, status)
