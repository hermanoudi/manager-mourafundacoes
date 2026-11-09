import os

import httpx
import pytest
from alembic import command
from alembic.config import Config
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from moura_gestao.infrastructure.config import Settings
from moura_gestao.infrastructure.models import Base
from moura_gestao.interfaces.http.app import create_app

TEST_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://moura:moura@localhost:5433/moura"
)


@pytest.fixture(scope="session", autouse=True)
def _migrated() -> None:
    os.environ["DATABASE_URL"] = TEST_URL
    command.upgrade(Config("alembic.ini"), "head")


@pytest.fixture
def settings() -> Settings:
    return Settings(
        database_url=TEST_URL,
        jwt_secret=SecretStr("test-secret-" + "x" * 32),
        cookie_secure=False,
        environment="test",
    )


@pytest.fixture
async def db_session(settings: Settings):
    engine = create_async_engine(settings.database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    if tables:
        async with engine.begin() as conn:
            await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    await engine.dispose()


@pytest.fixture
async def client(settings: Settings, db_session: AsyncSession):
    app = create_app(settings)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
    await app.state.engine.dispose()
