from fastapi import FastAPI

from moura_gestao.infrastructure.config import Settings, get_settings
from moura_gestao.infrastructure.db import make_engine, make_session_factory
from moura_gestao.interfaces.http.routes import health


def create_app(settings: Settings | None = None) -> FastAPI:
    app = FastAPI(title="Moura Gestão")
    app.state.settings = settings or get_settings()
    engine = make_engine(app.state.settings.database_url)
    app.state.engine = engine
    app.state.session_factory = make_session_factory(engine)
    app.include_router(health.router)
    return app
