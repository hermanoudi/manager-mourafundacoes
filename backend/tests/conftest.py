import os

import httpx
import pytest
from alembic import command
from alembic.config import Config
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from moura_gestao.infrastructure.config import Settings
from moura_gestao.infrastructure.models import Base, UserModel
from moura_gestao.infrastructure.pricing_seed import seed_price_table
from moura_gestao.infrastructure.security import Argon2Hasher
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


async def _reset(engine) -> None:
    """Banco limpo + tabela de preços semeada (como depois da migration)."""
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    if tables:
        async with engine.begin() as conn:
            await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
            await conn.run_sync(seed_price_table)


@pytest.fixture
async def db_session(settings: Settings):
    engine = create_async_engine(settings.database_url)
    # Também no início: sobras de outra execução (e2e no mesmo banco) não vazam para o teste.
    await _reset(engine)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await _reset(engine)
    await engine.dispose()


@pytest.fixture
async def app(settings: Settings, db_session: AsyncSession):
    application = create_app(settings)
    yield application
    await application.state.engine.dispose()


@pytest.fixture
async def client(app):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


PASSWORD = "senha-forte-123"


@pytest.fixture
def make_user(db_session: AsyncSession):
    async def _make(
        email: str, role: str = "operator", *, name: str = "Usuário", active: bool = True,
        password: str = PASSWORD,
    ) -> UserModel:
        user = UserModel(
            name=name, email=email.strip().lower(), role=role, active=active,
            password_hash=Argon2Hasher().hash(password),
        )
        db_session.add(user)
        await db_session.commit()
        return user

    return _make


@pytest.fixture
def login_user(app, make_user):
    clients: list[httpx.AsyncClient] = []

    async def _login(email: str, role: str) -> tuple[httpx.AsyncClient, int]:
        user = await make_user(email, role)
        c = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        clients.append(c)
        resp = await c.post("/api/auth/login", json={"email": email, "password": PASSWORD})
        assert resp.status_code == 200, resp.text
        return c, user.id

    yield _login
    # clients closed by GC; explicit close below
    import asyncio

    for c in clients:
        asyncio.get_event_loop().create_task(c.aclose())


@pytest.fixture
def login_as(login_user):
    async def _login(role: str) -> httpx.AsyncClient:
        client, _ = await login_user(f"{role}@moura.test", role)
        return client

    return _login
