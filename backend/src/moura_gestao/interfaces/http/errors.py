from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from moura_gestao.domain.errors import DomainError

STATUS = {
    "not_found": 404,
    "invalid_credentials": 401,
    "not_authenticated": 401,
    "forbidden": 403,
}


def status_for(code: str) -> int:
    if code in STATUS:
        return STATUS[code]
    if code.startswith("duplicate_") or code == "last_admin":
        return 409
    return 400


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            {"detail": exc.message, "code": exc.code}, status_code=status_for(exc.code)
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()
        ]
        return JSONResponse({"detail": errors, "code": "validation_error"}, status_code=422)
