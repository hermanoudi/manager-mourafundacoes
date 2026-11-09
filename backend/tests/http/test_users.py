NEW = {
    "name": "João",
    "email": "joao@moura.com",
    "password": "senha-forte-123",
    "role": "operator",
}


async def test_admin_creates_user(login_as):
    c = await login_as("admin")
    resp = await c.post("/api/users", json=NEW)
    assert resp.status_code == 201
    body = resp.json()
    assert body["role"] == "operator"
    assert "password" not in body
    assert "password_hash" not in body


async def test_duplicate_email_409(login_as):
    c = await login_as("admin")
    assert (await c.post("/api/users", json=NEW)).status_code == 201
    resp = await c.post("/api/users", json={**NEW, "email": "JOAO@moura.com"})
    assert resp.status_code == 409
    assert resp.json()["code"] == "duplicate_email"


async def test_office_cannot_list_users_403(login_as):
    c = await login_as("office")
    resp = await c.get("/api/users")
    assert resp.status_code == 403
    assert resp.json()["code"] == "forbidden"


async def test_operator_cannot_create_user_403(login_as):
    c = await login_as("operator")
    assert (await c.post("/api/users", json=NEW)).status_code == 403


async def test_admin_deactivates_user_then_login_fails(login_as, client):
    c = await login_as("admin")
    created = (await c.post("/api/users", json=NEW)).json()
    resp = await c.patch(f"/api/users/{created['id']}", json={"active": False})
    assert resp.status_code == 200
    assert resp.json()["active"] is False
    login = await client.post(
        "/api/auth/login", json={"email": NEW["email"], "password": NEW["password"]}
    )
    assert login.status_code == 401


async def test_short_password_422(login_as):
    c = await login_as("admin")
    resp = await c.post("/api/users", json={**NEW, "password": "curta"})
    assert resp.status_code == 422
    assert resp.json()["code"] == "validation_error"


async def test_cannot_deactivate_or_demote_last_active_admin(login_as):
    c = await login_as("admin")
    me = (await c.get("/api/auth/me")).json()
    r1 = await c.patch(f"/api/users/{me['id']}", json={"active": False})
    assert r1.status_code == 409
    assert r1.json()["code"] == "last_admin"
    r2 = await c.patch(f"/api/users/{me['id']}", json={"role": "office"})
    assert r2.status_code == 409
    assert r2.json()["code"] == "last_admin"
    second = await c.post("/api/users", json={**NEW, "email": "outro@moura.com", "role": "admin"})
    assert second.status_code == 201
    r3 = await c.patch(f"/api/users/{me['id']}", json={"role": "office"})
    assert r3.status_code == 200
