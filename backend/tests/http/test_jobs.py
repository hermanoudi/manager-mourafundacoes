from tests.factories import make_customer, make_rig

ADDRESS = {
    "zip_code": "01001000", "street": "Rua B", "number": "10",
    "district": "Centro", "city": "Campinas", "state": "SP",
}


async def make_job(client, customer_id: int, **over) -> dict:
    body = {"name": "Obra Alfa", "customer_id": customer_id, "address": ADDRESS, **over}
    resp = await client.post("/api/jobs", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def allocate(client, job_id: int, rig_ids, operator_ids):
    resp = await client.put(
        f"/api/jobs/{job_id}/allocation", json={"rig_ids": rig_ids, "operator_ids": operator_ids}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_create_job_snapshots_global_table(login_as):
    c = await login_as("office")
    cid = await make_customer(c)
    global_table = (await c.get("/api/price-table")).json()
    job = await make_job(c, cid)
    assert job["prices"] == global_table
    assert job["status"] == "planned"
    assert job["customer"]["id"] == cid
    assert job["contracted_diameters"] == [30, 35, 40, 50, 60, 70]

    changed = {
        **global_table,
        "items": [
            {**i, "price_per_m": "99.00"} if i["diameter_cm"] == 30 else i
            for i in global_table["items"]
        ],
    }
    assert (await c.put("/api/price-table", json=changed)).status_code == 200
    again = (await c.get(f"/api/jobs/{job['id']}")).json()
    by_d = {i["diameter_cm"]: i["price_per_m"] for i in again["prices"]["items"]}
    assert by_d[30] == "10.00"


async def test_create_job_with_custom_prices(login_as):
    c = await login_as("office")
    cid = await make_customer(c)
    job = await make_job(
        c, cid,
        prices={
            "mobilization_fee": "500", "max_tabled_depth_m": "15",
            "items": [{"diameter_cm": 45, "price_per_m": "12,5"}],
        },
    )
    assert job["contracted_diameters"] == [45]
    assert job["prices"]["items"] == [{"diameter_cm": 45, "price_per_m": "12.50"}]
    assert job["prices"]["mobilization_fee"] == "500.00"


async def test_create_job_unknown_customer_404(login_as):
    c = await login_as("office")
    resp = await c.post(
        "/api/jobs", json={"name": "X", "customer_id": 999, "address": ADDRESS}
    )
    assert resp.status_code == 404


async def test_end_date_before_start_date_422(login_as):
    c = await login_as("office")
    cid = await make_customer(c)
    resp = await c.post(
        "/api/jobs",
        json={
            "name": "X", "customer_id": cid, "address": ADDRESS,
            "start_date": "2026-11-10", "end_date": "2026-11-01",
        },
    )
    assert resp.status_code == 422
    job = await make_job(c, cid, start_date="2026-11-10")
    resp = await c.patch(f"/api/jobs/{job['id']}", json={"end_date": "2026-11-01"})
    assert resp.status_code == 422


async def test_patch_job_fields(login_as):
    c = await login_as("office")
    cid = await make_customer(c)
    job = await make_job(c, cid)
    resp = await c.patch(
        f"/api/jobs/{job['id']}", json={"name": "Obra Beta", "notes": "n", "end_date": "2026-12-01"}
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Obra Beta"
    assert resp.json()["end_date"] == "2026-12-01"


async def test_status_flow(login_user):
    c, _ = await login_user("office@moura.test", "office")
    _, op_id = await login_user("op@moura.test", "operator")
    cid = await make_customer(c)
    job = await make_job(c, cid)
    url = f"/api/jobs/{job['id']}"

    resp = await c.patch(url, json={"status": "in_progress"})
    assert resp.status_code == 409
    assert resp.json()["code"] == "job_not_ready"

    rig_id = await make_rig(c)
    await allocate(c, job["id"], [rig_id], [op_id])
    resp = await c.patch(url, json={"status": "in_progress"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"

    resp = await c.patch(url, json={"status": "planned"})
    assert resp.status_code == 409
    assert resp.json()["code"] == "invalid_status_transition"


async def test_allocation_rules(login_user):
    c, _ = await login_user("office@moura.test", "office")
    _, op_id = await login_user("op@moura.test", "operator")
    cid = await make_customer(c)
    job = await make_job(c, cid)
    url = f"/api/jobs/{job['id']}/allocation"

    rig_id = await make_rig(c, status="maintenance")
    resp = await c.put(url, json={"rig_ids": [rig_id], "operator_ids": [op_id]})
    assert resp.status_code == 409
    assert resp.json()["code"] == "rig_unavailable"

    _, office_id = await login_user("other@moura.test", "office")
    ok_rig = await make_rig(c, name="Perfuratriz 02")
    resp = await c.put(url, json={"rig_ids": [ok_rig], "operator_ids": [office_id]})
    assert resp.status_code == 409
    assert resp.json()["code"] == "invalid_operator"

    resp = await c.put(url, json={"rig_ids": [ok_rig], "operator_ids": [9999]})
    assert resp.json()["code"] == "invalid_operator"


async def test_allocation_replaces_previous(login_user):
    c, _ = await login_user("office@moura.test", "office")
    _, op_id = await login_user("op@moura.test", "operator")
    cid = await make_customer(c)
    job = await make_job(c, cid)
    rig_id = await make_rig(c)
    out = await allocate(c, job["id"], [rig_id], [op_id])
    assert [r["id"] for r in out["rigs"]] == [rig_id]
    assert [o["id"] for o in out["operators"]] == [op_id]
    out = await allocate(c, job["id"], [rig_id], [])
    assert out["operators"] == []


async def test_prices_locked_after_completion(login_user):
    c, _ = await login_user("office@moura.test", "office")
    _, op_id = await login_user("op@moura.test", "operator")
    cid = await make_customer(c)
    job = await make_job(c, cid)
    await allocate(c, job["id"], [await make_rig(c)], [op_id])
    url = f"/api/jobs/{job['id']}"
    assert (await c.patch(url, json={"status": "in_progress"})).status_code == 200
    assert (await c.patch(url, json={"status": "completed"})).status_code == 200

    table = (await c.get("/api/price-table")).json()
    resp = await c.put(f"{url}/prices", json=table)
    assert resp.status_code == 409
    assert resp.json()["code"] == "job_locked"


async def test_put_prices_updates_snapshot(login_as):
    c = await login_as("office")
    cid = await make_customer(c)
    job = await make_job(c, cid)
    table = {
        "mobilization_fee": "1,00", "max_tabled_depth_m": "10",
        "items": [{"diameter_cm": 50, "price_per_m": "20"}],
    }
    resp = await c.put(f"/api/jobs/{job['id']}/prices", json=table)
    assert resp.status_code == 200
    assert resp.json()["contracted_diameters"] == [50]
    assert resp.json()["prices"]["mobilization_fee"] == "1.00"


async def test_operator_sees_only_allocated_jobs_without_prices(login_user):
    office, _ = await login_user("office@moura.test", "office")
    op_a, a_id = await login_user("a@moura.test", "operator")
    op_b, _ = await login_user("b@moura.test", "operator")
    cid = await make_customer(office)
    job = await make_job(office, cid)
    await allocate(office, job["id"], [await make_rig(office)], [a_id])

    listed = (await op_a.get("/api/jobs")).json()
    assert listed["total"] == 1
    got = (await op_a.get(f"/api/jobs/{job['id']}")).json()
    assert got["prices"] is None
    assert got["contracted_diameters"] == [30, 35, 40, 50, 60, 70]

    assert (await op_b.get("/api/jobs")).json()["total"] == 0
    resp = await op_b.get(f"/api/jobs/{job['id']}")
    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"

    # office ve os precos
    assert (await office.get(f"/api/jobs/{job['id']}")).json()["prices"] is not None


async def test_operator_cannot_create_job_403(login_as):
    op = await login_as("operator")
    resp = await op.post(
        "/api/jobs", json={"name": "X", "customer_id": 1, "address": ADDRESS}
    )
    assert resp.status_code == 403
    assert (await op.put("/api/jobs/1/allocation", json={"rig_ids": [], "operator_ids": []})
            ).status_code == 403


async def test_search_by_name_and_customer(login_as):
    c = await login_as("office")
    cid = await make_customer(c)
    await make_job(c, cid, name="Edifício Aurora")
    await make_job(c, cid, name="Galpão Sul")
    by_name = (await c.get("/api/jobs", params={"q": "aurora"})).json()
    assert [j["name"] for j in by_name["items"]] == ["Edifício Aurora"]
    by_customer = (await c.get("/api/jobs", params={"q": "cliente teste"})).json()
    assert by_customer["total"] == 2
    item = by_customer["items"][0]
    assert item["customer_name"] == "Cliente Teste"
    assert item["city"] == "Campinas"
    assert (await c.get("/api/jobs", params={"q": "zzz"})).json()["total"] == 0


async def test_filter_by_status(login_user):
    c, _ = await login_user("office@moura.test", "office")
    cid = await make_customer(c)
    await make_job(c, cid, name="A")
    b = await make_job(c, cid, name="B")
    assert (await c.patch(f"/api/jobs/{b['id']}", json={"status": "cancelled"})).status_code == 200
    planned = (await c.get("/api/jobs", params={"status": "planned"})).json()
    assert [j["name"] for j in planned["items"]] == ["A"]
    assert (await c.get("/api/jobs", params={"status": "cancelled"})).json()["total"] == 1


async def test_operators_endpoint_lists_active_operators_only(login_user, make_user):
    c, _ = await login_user("office@moura.test", "office")
    await make_user("z@moura.test", "operator", name="Zeca")
    await make_user("a@moura.test", "operator", name="Ana")
    await make_user("off@moura.test", "operator", name="Inativo", active=False)
    resp = await c.get("/api/operators")
    assert resp.status_code == 200
    assert resp.json() == [
        {"id": resp.json()[0]["id"], "name": "Ana"},
        {"id": resp.json()[1]["id"], "name": "Zeca"},
    ]
    op, _ = await login_user("op@moura.test", "operator")
    assert (await op.get("/api/operators")).status_code == 403
