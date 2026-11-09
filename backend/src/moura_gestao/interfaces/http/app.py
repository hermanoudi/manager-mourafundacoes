from fastapi import FastAPI

from moura_gestao.infrastructure.config import Settings, get_settings
from moura_gestao.interfaces.http.routes import health


def create_app(settings: Settings | None = None) -> FastAPI:
    app = FastAPI(title="Moura Gestão")
    app.state.settings = settings or get_settings()
    app.include_router(health.router)
    return app
