from moura_gestao.infrastructure.security import JwtTokenService

from ..conftest import PASSWORD


async def test_login_sets_httponly_cookie(client, make_user):
    await make_user("admin@moura.com", "admin")
    resp = await client.post(
        "/api/auth/login", json={"email": "admin@moura.com", "password": PASSWORD}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "admin@moura.com"
    assert body["role"] == "admin"
    assert "password_hash" not in body
    cookie = resp.headers["set-cookie"]
    assert "mg_session=" in cookie
    assert "HttpOnly" in cookie


async def test_login_email_case_and_spaces_insensitive(client, make_user):
    await make_user("admin@moura.com", "admin")
    resp = await client.post(
        "/api/auth/login", json={"email": " Admin@Moura.com ", "password": PASSWORD}
    )
    assert resp.status_code == 200


async def test_login_wrong_password_401(client, make_user):
    await make_user("admin@moura.com", "admin")
    resp = await client.post(
        "/api/auth/login", json={"email": "admin@moura.com", "password": "errada-errada"}
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "invalid_credentials"
    assert resp.json()["detail"] == "E-mail ou senha inválidos"


async def test_login_inactive_user_401(client, make_user):
    await make_user("off@moura.com", "office", active=False)
    resp = await client.post(
        "/api/auth/login", json={"email": "off@moura.com", "password": PASSWORD}
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "invalid_credentials"


async def test_me_without_cookie_401(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.json()["code"] == "not_authenticated"


async def test_me_with_expired_token_401(client, make_user, settings):
    user = await make_user("admin@moura.com", "admin")
    token = JwtTokenService(settings.jwt_secret.get_secret_value(), ttl_hours=-1).issue(user.id)
    client.cookies.set("mg_session", token)
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_logout_clears_cookie(login_as):
    c = await login_as("admin")
    assert (await c.get("/api/auth/me")).status_code == 200
    resp = await c.post("/api/auth/logout")
    assert resp.status_code == 204
    assert (await c.get("/api/auth/me")).status_code == 401
