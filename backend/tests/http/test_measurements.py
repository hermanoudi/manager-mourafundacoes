import asyncio
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from moura_gestao.domain.dates import today_sp
from tests.factories import make_customer, make_rig
from tests.http.test_jobs import allocate, make_job

PRICES = {
    "mobilization_fee": "400", "max_tabled_depth_m": "15",
    "items": [{"diameter_cm": 30, "price_per_m": "10"}, {"diameter_cm": 40, "price_per_m": "10"}],
}


@dataclass
class Ctx:
    office: httpx.AsyncClient
    op_a: httpx.AsyncClient
    op_b: httpx.AsyncClient
    op_c: httpx.AsyncClient
    job_id: int
    rig_id: int


@pytest.fixture
async def ctx(login_user) -> Ctx:
    office, _ = await login_user("office@moura.test", "office")
    op_a, a_id = await login_user("a@moura.test", "operator")
    op_b, _ = await login_user("b@moura.test", "operator")
    op_c, c_id = await login_user("c@moura.test", "operator")
    cid = await make_customer(office)
    job = await make_job(office, cid, prices=PRICES)
    rig_id = await make_rig(office)
    await allocate(office, job["id"], [rig_id], [a_id, c_id])
    resp = await office.patch(f"/api/jobs/{job['id']}", json={"status": "in_progress"})
    assert resp.status_code == 200, resp.text
    return Ctx(office, op_a, op_b, op_c, job["id"], rig_id)


def today() -> str:
    return today_sp(datetime.now(UTC)).isoformat()


def body(ctx: Ctx, lines=None, **over) -> dict:
    return {
        "client_key": str(uuid.uuid4()), "job_id": ctx.job_id, "rig_id": ctx.rig_id,
        "work_date": today(),
        "lines": lines or [{"pile_code": "E-1", "diameter_cm": 30, "depth_m": "8,5"}],
        **over,
    }


def line(code: str, diameter: int = 30, depth: str = "10") -> dict:
    return {"pile_code": code, "diameter_cm": diameter, "depth_m": depth}


async def create(client, payload: dict, status: int = 201) -> dict:
    resp = await client.post("/api/measurements", json=payload)
    assert resp.status_code == status, resp.text
    return resp.json()


async def test_operator_creates_draft_with_comma_depth(ctx):
    m = await create(
        ctx.op_a, body(ctx, [{"pile_code": "e-1", "diameter_cm": 30, "depth_m": "8,5"}])
    )
    assert m["status"] == "draft"
    assert m["lines"] == [{"pile_code": "E-1", "diameter_cm": 30, "depth_m": "8.50"}]
    assert m["total_m"] == "8.50"
    assert m["totals_by_diameter"] == [{"diameter_cm": 30, "piles": 1, "meters": "8.50"}]
    assert m["uncontracted_diameters"] == []
    assert m["job"]["id"] == ctx.job_id
    assert m["rig"]["id"] == ctx.rig_id
    assert m["created_by"]["name"]
    assert m["submitted_at"] is None
    assert m["reviewed_by"] is None
    assert m["photo_id"] is None


async def test_replay_same_client_key_returns_same(ctx):
    payload = body(ctx, submit=True)
    first = await create(ctx.op_a, payload, 201)
    second = await create(ctx.op_a, payload, 200)
    assert first["id"] == second["id"]
    assert second["status"] == "submitted"
    assert second["submitted_at"] == first["submitted_at"]
    listed = (await ctx.office.get("/api/measurements", params={"job_id": ctx.job_id})).json()
    assert listed["total"] == 1
    assert "lines" not in listed["items"][0]

    resp = await ctx.op_c.post("/api/measurements", json=payload)
    assert resp.status_code == 409
    assert resp.json()["code"] == "duplicate_client_key"


async def test_concurrent_same_client_key_creates_one(ctx):
    payload = body(ctx, submit=True)
    r1, r2 = await asyncio.gather(
        ctx.op_a.post("/api/measurements", json=payload),
        ctx.op_a.post("/api/measurements", json=payload),
    )
    assert sorted([r1.status_code, r2.status_code]) == [200, 201], (r1.text, r2.text)
    assert r1.json()["id"] == r2.json()["id"]
    listed = (await ctx.office.get("/api/measurements", params={"job_id": ctx.job_id})).json()
    assert listed["total"] == 1


async def test_concurrent_replays_do_not_double_lines_or_unsubmit(ctx):
    payload = body(ctx, [line("E-1")])
    m = await create(ctx.op_a, payload, 201)
    submit_a = {**payload, "lines": [line("E-1"), line("E-2")], "submit": True}
    draft_b = {**payload, "lines": [line("E-1"), line("E-3")], "submit": False}
    r1, r2 = await asyncio.gather(
        ctx.op_a.post("/api/measurements", json=submit_a),
        ctx.op_a.post("/api/measurements", json=draft_b),
    )
    assert r1.status_code == r2.status_code == 200, (r1.text, r2.text)
    final = (await ctx.op_a.get(f"/api/measurements/{m['id']}")).json()
    # qualquer ordem termina enviada com as linhas do envio (o rascunho atrasado não desfaz)
    assert final["status"] == "submitted"
    assert [ln["pile_code"] for ln in final["lines"]] == ["E-1", "E-2"]
    assert final["total_m"] == "20.00"
    listed = (await ctx.office.get("/api/measurements", params={"job_id": ctx.job_id})).json()
    assert listed["total"] == 1


async def test_concurrent_duplicate_pile_only_one_wins(ctx):
    r1, r2 = await asyncio.gather(
        ctx.op_a.post("/api/measurements", json=body(ctx, [line("E-50")])),
        ctx.op_c.post("/api/measurements", json=body(ctx, [line("e50")])),
    )
    assert sorted([r1.status_code, r2.status_code]) == [201, 409], (r1.text, r2.text)
    loser = r1 if r1.status_code == 409 else r2
    assert loser.json()["code"] == "duplicate_pile"


async def test_upsert_draft_then_submit_same_key(ctx):
    payload = body(ctx, [line("E-1")])
    first = await create(ctx.op_a, payload, 201)
    payload["lines"] = [line("E-1"), line("E-2", 40, "12,25")]
    payload["submit"] = True
    second = await create(ctx.op_a, payload, 200)
    assert second["id"] == first["id"]
    assert second["status"] == "submitted"
    assert len(second["lines"]) == 2
    assert second["total_m"] == "22.25"

    # já enviada: replay devolve sem alterar
    payload["lines"] = [line("E-9")]
    third = await create(ctx.op_a, payload, 200)
    assert [ln["pile_code"] for ln in third["lines"]] == ["E-1", "E-2"]


async def test_other_allocated_operator_cannot_edit_403(ctx):
    m = await create(ctx.op_a, body(ctx))
    url = f"/api/measurements/{m['id']}"
    assert (await ctx.op_c.get(url)).status_code == 200
    resp = await ctx.op_c.patch(url, json={"notes": "x"})
    assert resp.status_code == 403
    assert resp.json()["code"] == "forbidden"
    resp = await ctx.op_c.delete(url)
    assert resp.status_code == 403
    assert resp.json()["code"] == "forbidden"
    assert (await ctx.op_c.post(f"{url}/submit")).status_code == 403
    # autor e escritório podem
    assert (await ctx.op_a.patch(url, json={"notes": "ok"})).json()["notes"] == "ok"
    assert (await ctx.office.patch(url, json={"notes": "of"})).json()["notes"] == "of"


async def test_author_deletes_draft(ctx):
    m = await create(ctx.op_a, body(ctx))
    url = f"/api/measurements/{m['id']}"
    assert (await ctx.op_a.delete(url)).status_code == 204
    assert (await ctx.op_a.get(url)).status_code == 404


async def test_duplicate_pile_across_measurements(ctx):
    m1 = await create(ctx.op_a, body(ctx, [line("E-12"), line("E-13")], submit=True))
    resp = await ctx.op_a.post(
        "/api/measurements", json=body(ctx, [line("e12"), line("E 13"), line("E-14")])
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "duplicate_pile"
    assert "E-12" in resp.json()["detail"] and "E-13" in resp.json()["detail"]

    resp = await ctx.office.post(
        f"/api/measurements/{m1['id']}/reject", json={"reason": "Estacas trocadas"}
    )
    assert resp.status_code == 200
    await create(ctx.op_a, body(ctx, [line("e12")]))


async def test_duplicate_pile_inside_same_measurement_422(ctx):
    resp = await ctx.op_a.post("/api/measurements", json=body(ctx, [line("E-1"), line("e1")]))
    assert resp.status_code == 422
    assert resp.json()["code"] == "validation_error"


async def test_invalid_lines_422(ctx):
    bad_lines = ([], [line("")], [line("E-1", depth="0")], [line("E-1", 10)], [line("E" * 21)])
    for bad in bad_lines:
        resp = await ctx.op_a.post("/api/measurements", json={**body(ctx), "lines": bad})
        assert resp.status_code == 422, bad
        assert resp.json()["code"] == "validation_error"


async def test_line_exceeds_rig_limits_422(ctx):
    for bad in (line("E-7", 90), line("E-7", 30, "22,5"), line("E-7", 20)):
        resp = await ctx.op_a.post("/api/measurements", json=body(ctx, [bad]))
        assert resp.status_code == 422, bad
        assert resp.json()["code"] == "line_exceeds_rig"
        assert "E-7" in resp.json()["detail"]
    await create(ctx.op_a, body(ctx, [line("E-7", 80, "22")]))


async def test_rig_not_allocated_409(ctx):
    other = await make_rig(ctx.office, name="Perfuratriz 02")
    resp = await ctx.op_a.post("/api/measurements", json=body(ctx, rig_id=other))
    assert resp.status_code == 409
    assert resp.json()["code"] == "rig_not_allocated"


async def test_job_not_in_progress_409(login_user):
    office, _ = await login_user("office@moura.test", "office")
    op, op_id = await login_user("a@moura.test", "operator")
    job = await make_job(office, await make_customer(office))
    rig_id = await make_rig(office)
    await allocate(office, job["id"], [rig_id], [op_id])
    resp = await op.post(
        "/api/measurements",
        json={
            "client_key": str(uuid.uuid4()), "job_id": job["id"], "rig_id": rig_id,
            "work_date": today(), "lines": [line("E-1")],
        },
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "job_not_in_progress"


async def test_future_date_422(ctx):
    tomorrow = (today_sp(datetime.now(UTC)) + timedelta(days=1)).isoformat()
    resp = await ctx.op_a.post("/api/measurements", json=body(ctx, work_date=tomorrow))
    assert resp.status_code == 422
    assert resp.json()["code"] == "future_date"
    m = await create(ctx.op_a, body(ctx, work_date=today()))
    resp = await ctx.op_a.patch(f"/api/measurements/{m['id']}", json={"work_date": tomorrow})
    assert resp.status_code == 422
    assert resp.json()["code"] == "future_date"


async def test_unallocated_operator_gets_404(ctx):
    m = await create(ctx.op_a, body(ctx))
    resp = await ctx.op_b.get(f"/api/measurements/{m['id']}")
    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"
    assert (await ctx.op_b.patch(f"/api/measurements/{m['id']}", json={"notes": "x"})
            ).status_code == 404
    resp = await ctx.op_b.post("/api/measurements", json=body(ctx))
    assert resp.status_code == 404
    listed = (await ctx.op_b.get("/api/measurements", params={"job_id": ctx.job_id})).json()
    assert listed["total"] == 0
    assert (await ctx.op_b.get("/api/measurements")).json()["items"] == []
    assert (await ctx.op_a.get("/api/measurements")).json()["total"] == 1


async def test_submit_idempotent_and_locks(ctx):
    m = await create(ctx.op_a, body(ctx))
    url = f"/api/measurements/{m['id']}"
    r1 = await ctx.op_a.post(f"{url}/submit")
    r2 = await ctx.op_a.post(f"{url}/submit")
    assert r1.status_code == r2.status_code == 200
    assert r1.json()["status"] == "submitted"
    assert r1.json()["submitted_at"] is not None
    assert r1.json()["submitted_at"] == r2.json()["submitted_at"]
    resp = await ctx.op_a.patch(url, json={"notes": "x"})
    assert resp.status_code == 409
    assert resp.json()["code"] == "measurement_locked"
    resp = await ctx.op_a.delete(url)
    assert resp.status_code == 409


async def test_approve_requires_contracted_diameter(ctx):
    m = await create(ctx.op_a, body(ctx, [line("E-1", 30), line("E-2", 50)], submit=True))
    assert m["uncontracted_diameters"] == [50]
    url = f"/api/measurements/{m['id']}"
    resp = await ctx.office.post(f"{url}/approve")
    assert resp.status_code == 409
    assert resp.json()["code"] == "diameter_not_contracted"

    prices = {**PRICES, "items": [*PRICES["items"], {"diameter_cm": 50, "price_per_m": "14"}]}
    assert (await ctx.office.put(f"/api/jobs/{ctx.job_id}/prices", json=prices)).status_code == 200
    r1 = await ctx.office.post(f"{url}/approve")
    assert r1.status_code == 200, r1.text
    assert r1.json()["status"] == "approved"
    assert r1.json()["uncontracted_diameters"] == []
    assert r1.json()["reviewed_by"]["name"]
    assert r1.json()["reviewed_at"] is not None
    r2 = await ctx.office.post(f"{url}/approve")
    assert r2.status_code == 200
    assert r2.json()["reviewed_at"] == r1.json()["reviewed_at"]

    for resp in (await ctx.office.patch(url, json={"notes": "x"}), await ctx.office.delete(url)):
        assert resp.status_code == 409
        assert resp.json()["code"] == "measurement_locked"
    resp = await ctx.op_a.post(f"{url}/submit")
    assert resp.json()["code"] == "measurement_locked"
    resp = await ctx.office.post(f"{url}/reject", json={"reason": "tarde demais"})
    assert resp.status_code == 409


async def test_approve_draft_is_invalid_transition(ctx):
    m = await create(ctx.op_a, body(ctx))
    resp = await ctx.office.post(f"/api/measurements/{m['id']}/approve")
    assert resp.status_code == 409
    assert resp.json()["code"] == "invalid_status_transition"


async def test_reject_then_edit_returns_to_draft(ctx):
    m = await create(ctx.op_a, body(ctx, [line("E-3")], submit=True))
    url = f"/api/measurements/{m['id']}"
    resp = await ctx.office.post(f"{url}/reject", json={"reason": ""})
    assert resp.status_code == 422
    resp = await ctx.office.post(f"{url}/reject", json={"reason": "Profundidade da E-3 ilegível"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"
    assert resp.json()["rejection_reason"] == "Profundidade da E-3 ilegível"

    resp = await ctx.op_a.patch(url, json={"lines": [line("E-3", 30, "9,75")]})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "draft"
    assert resp.json()["rejection_reason"] is None
    assert resp.json()["total_m"] == "9.75"
    resp = await ctx.op_a.post(f"{url}/submit")
    assert resp.json()["status"] == "submitted"


async def test_operator_cannot_approve_403(ctx):
    m = await create(ctx.op_a, body(ctx, submit=True))
    url = f"/api/measurements/{m['id']}"
    resp = await ctx.op_a.post(f"{url}/approve")
    assert resp.status_code == 403
    assert resp.json()["code"] == "forbidden"
    assert (await ctx.op_a.post(f"{url}/reject", json={"reason": "abc"})).status_code == 403


async def test_list_filters_by_status(ctx):
    await create(ctx.op_a, body(ctx, [line("E-1")]))
    await create(ctx.op_a, body(ctx, [line("E-2")], submit=True))
    resp = await ctx.office.get("/api/measurements", params={"status": "submitted"})
    items = resp.json()["items"]
    assert [i["status"] for i in items] == ["submitted"]
    assert items[0]["total_m"] == "10.00"


async def test_complete_job_with_pending_measurement_409(ctx):
    m = await create(ctx.op_a, body(ctx, submit=True))
    job_url = f"/api/jobs/{ctx.job_id}"
    resp = await ctx.office.patch(job_url, json={"status": "completed"})
    assert resp.status_code == 409
    assert resp.json()["code"] == "pending_measurements"
    await ctx.office.post(f"/api/measurements/{m['id']}/approve")
    assert (await ctx.office.patch(job_url, json={"status": "completed"})).status_code == 200


# --- medição lançada por admin já nasce aprovada ---------------------------------------------


async def test_admin_submit_on_create_is_approved(ctx, login_user):
    admin, admin_id = await login_user("admin@moura.test", "admin")
    payload = body(ctx, [line("E-1", 30), line("E-2", 40)], submit=True)
    m = await create(admin, payload, 201)
    assert m["status"] == "approved"
    assert m["created_by"]["id"] == admin_id
    assert m["reviewed_by"]["id"] == admin_id
    assert m["reviewed_at"] is not None
    assert m["submitted_at"] is not None
    # reenvio com o mesmo client_key devolve a mesma medição, inalterada
    again = await create(admin, payload, 200)
    assert again["id"] == m["id"]
    assert again["status"] == "approved"
    assert again["reviewed_at"] == m["reviewed_at"]
    listed = (await ctx.office.get("/api/measurements", params={"job_id": ctx.job_id})).json()
    assert listed["total"] == 1


async def test_admin_draft_stays_draft_until_sent(ctx, login_user):
    admin, _ = await login_user("admin@moura.test", "admin")
    payload = body(ctx, [line("E-1")])
    draft = await create(admin, payload, 201)
    assert draft["status"] == "draft"
    assert draft["reviewed_by"] is None
    sent = await create(admin, {**payload, "submit": True}, 200)
    assert sent["id"] == draft["id"]
    assert sent["status"] == "approved"


async def test_admin_submit_endpoint_on_own_draft_is_approved(ctx, login_user):
    admin, _ = await login_user("admin@moura.test", "admin")
    draft = await create(admin, body(ctx, [line("E-1")]))
    resp = await admin.post(f"/api/measurements/{draft['id']}/submit")
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "approved"
    assert resp.json()["reviewed_by"] is not None


async def test_admin_uncontracted_diameter_is_blocked_and_not_saved(ctx, login_user):
    admin, _ = await login_user("admin@moura.test", "admin")
    resp = await admin.post(
        "/api/measurements", json=body(ctx, [line("E-1", 30), line("E-2", 50)], submit=True)
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "diameter_not_contracted"
    listed = (await ctx.office.get("/api/measurements", params={"job_id": ctx.job_id})).json()
    assert listed["total"] == 0


async def test_office_submit_still_waits_for_review(ctx):
    m = await create(ctx.office, body(ctx, [line("E-1")], submit=True), 201)
    assert m["status"] == "submitted"
    assert m["reviewed_by"] is None


async def test_admin_submitting_operators_draft_does_not_approve_it(ctx, login_user):
    admin, _ = await login_user("admin@moura.test", "admin")
    draft = await create(ctx.op_a, body(ctx, [line("E-1")]))
    resp = await admin.post(f"/api/measurements/{draft['id']}/submit")
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "submitted"
    assert resp.json()["reviewed_by"] is None


async def test_job_with_admin_measurement_can_be_completed(ctx, login_user):
    admin, _ = await login_user("admin@moura.test", "admin")
    await create(admin, body(ctx, [line("E-1")], submit=True), 201)
    resp = await ctx.office.patch(f"/api/jobs/{ctx.job_id}", json={"status": "completed"})
    assert resp.status_code == 200, resp.text
