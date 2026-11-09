import httpx
from pydantic import SecretStr

from moura_gestao.infrastructure.config import Settings
from moura_gestao.interfaces.http.app import create_app


async def test_health_returns_ok():
    settings = Settings(
        database_url="postgresql+psycopg://moura:moura@localhost:5433/moura",
        jwt_secret=SecretStr("x" * 32),
        environment="test",
    )
    app = create_app(settings)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
