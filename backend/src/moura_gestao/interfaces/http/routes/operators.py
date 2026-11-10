from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from moura_gestao.application import jobs as uc
from moura_gestao.domain.users import Role
from moura_gestao.infrastructure.repositories import SqlUserRepository
from moura_gestao.interfaces.http.deps import get_session, require_roles
from moura_gestao.interfaces.http.schemas import IdName

router = APIRouter(
    prefix="/api/operators",
    tags=["operators"],
    dependencies=[Depends(require_roles(Role.ADMIN, Role.OFFICE))],
)


@router.get("", response_model=list[IdName])
async def list_operators(session: AsyncSession = Depends(get_session)):
    users = await uc.list_active_operators(SqlUserRepository(session))
    return [IdName(id=u.id, name=u.name) for u in users]
