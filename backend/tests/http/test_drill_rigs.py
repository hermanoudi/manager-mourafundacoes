def rig(name="Perfuratriz 01", **extra):
    return {
        "name": name, "max_diameter_cm": 80, "max_depth_m": "22,5", "status": "active", **extra
    }


async def test_create_rig_with_comma_depth(login_as):
    c = await login_as("office")
    resp = await c.post("/api/drill-rigs", json=rig())
    assert resp.status_code == 201
    assert resp.json()["max_depth_m"] == "22.50"


async def test_integer_depth_accepted(login_as):
    c = await login_as("office")
    resp = await c.post("/api/drill-rigs", json=rig(max_depth_m=15))
    assert resp.status_code == 201
    assert resp.json()["max_depth_m"] == "15.00"


async def test_duplicate_rig_name_case_insensitive_409(login_as):
    c = await login_as("office")
    assert (await c.post("/api/drill-rigs", json=rig())).status_code == 201
    resp = await c.post("/api/drill-rigs", json=rig("perfuratriz 01"))
    assert resp.status_code == 409
    assert resp.json()["code"] == "duplicate_rig_name"


async def test_rig_limits_422(login_as):
    c = await login_as("office")
    assert (await c.post("/api/drill-rigs", json=rig(max_diameter_cm=10))).status_code == 422
    assert (await c.post("/api/drill-rigs", json=rig(max_depth_m="0"))).status_code == 422
    assert (await c.post("/api/drill-rigs", json=rig(max_depth_m="abc"))).status_code == 422


async def test_operator_can_list_rigs_but_not_create(login_as, client):
    office = await login_as("office")
    await office.post("/api/drill-rigs", json=rig())
    op = await login_as("operator")
    assert (await op.get("/api/drill-rigs")).status_code == 200
    assert (await op.post("/api/drill-rigs", json=rig("Outra"))).status_code == 403


async def test_filter_by_status(login_as):
    c = await login_as("office")
    await c.post("/api/drill-rigs", json=rig("A"))
    await c.post("/api/drill-rigs", json=rig("B", status="maintenance"))
    body = (await c.get("/api/drill-rigs", params={"status": "active"})).json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "A"


async def test_patch_status_to_maintenance(login_as):
    c = await login_as("office")
    created = (await c.post("/api/drill-rigs", json=rig())).json()
    resp = await c.patch(f"/api/drill-rigs/{created['id']}", json={"status": "maintenance"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "maintenance"
    got = (await c.get(f"/api/drill-rigs/{created['id']}")).json()
    assert got["status"] == "maintenance"


async def test_patch_null_required_field_422(login_as):
    c = await login_as("office")
    created = (await c.post("/api/drill-rigs", json=rig())).json()
    for field in ("name", "max_diameter_cm", "max_depth_m", "status"):
        resp = await c.patch(f"/api/drill-rigs/{created['id']}", json={field: None})
        assert resp.status_code == 422, field
