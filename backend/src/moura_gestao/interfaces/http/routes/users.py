from fastapi import APIRouter, Depends

from moura_gestao.application import users as uc
from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.application.ports import PasswordHasher
from moura_gestao.domain.users import Role
from moura_gestao.interfaces.http.deps import get_hasher, get_user_repo, require_roles
from moura_gestao.interfaces.http.routes.auth import _out
from moura_gestao.interfaces.http.schemas import UserCreate, UserOut, UserUpdate

router = APIRouter(
    prefix="/api/users", tags=["users"], dependencies=[Depends(require_roles(Role.ADMIN))]
)


@router.get("", response_model=Page[UserOut])
async def list_users(params: PageParams = Depends(), repo=Depends(get_user_repo)):
    page = await uc.list_users(repo, params)
    return Page[UserOut](
        items=[_out(u) for u in page.items], total=page.total, page=page.page,
        page_size=page.page_size,
    )


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate, repo=Depends(get_user_repo), hasher: PasswordHasher = Depends(get_hasher)
):
    user = await uc.create_user(
        repo, hasher, name=body.name, email=body.email, password=body.password, role=body.role
    )
    return _out(user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    body: UserUpdate,
    repo=Depends(get_user_repo),
    hasher: PasswordHasher = Depends(get_hasher),
):
    user = await uc.update_user(repo, hasher, user_id, **body.model_dump(exclude_unset=True))
    return _out(user)
