from fastapi import APIRouter, Depends, Request, Response

from moura_gestao.application.auth import authenticate
from moura_gestao.application.ports import PasswordHasher, TokenService
from moura_gestao.domain.users import User
from moura_gestao.interfaces.http.deps import (
    COOKIE_NAME,
    current_user,
    get_hasher,
    get_tokens,
    get_user_repo,
)
from moura_gestao.interfaces.http.schemas import LoginIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _out(u: User) -> UserOut:
    return UserOut(id=u.id, name=u.name, email=u.email, role=u.role, active=u.active)


@router.post("/login", response_model=UserOut)
async def login(
    body: LoginIn,
    request: Request,
    response: Response,
    repo=Depends(get_user_repo),
    hasher: PasswordHasher = Depends(get_hasher),
    tokens: TokenService = Depends(get_tokens),
) -> UserOut:
    user = await authenticate(repo, hasher, body.email, body.password)
    s = request.app.state.settings
    response.set_cookie(
        COOKIE_NAME,
        tokens.issue(user.id),
        httponly=True,
        samesite="lax",
        secure=s.cookie_secure,
        path="/",
        max_age=s.session_ttl_hours * 3600,
    )
    return _out(user)


@router.post("/logout", status_code=204)
async def logout(response: Response, _: User = Depends(current_user)) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)) -> UserOut:
    return _out(user)
