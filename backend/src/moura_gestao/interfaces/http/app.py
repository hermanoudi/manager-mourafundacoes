from fastapi import FastAPI

from moura_gestao.infrastructure.config import Settings, get_settings
from moura_gestao.infrastructure.db import make_engine, make_session_factory
from moura_gestao.interfaces.http.errors import install_error_handlers
from moura_gestao.interfaces.http.routes import (
    auth,
    customers,
    drill_rigs,
    health,
    jobs,
    operators,
    price_table,
    users,
)


def create_app(settings: Settings | None = None) -> FastAPI:
    app = FastAPI(title="Moura Gestão")
    app.state.settings = settings or get_settings()
    engine = make_engine(app.state.settings.database_url)
    app.state.engine = engine
    app.state.session_factory = make_session_factory(engine)
    install_error_handlers(app)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(customers.router)
    app.include_router(drill_rigs.router)
    app.include_router(price_table.router)
    app.include_router(jobs.router)
    app.include_router(operators.router)
    return app
