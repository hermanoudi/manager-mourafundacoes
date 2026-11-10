from dataclasses import dataclass

import httpx
import pytest

from moura_gestao.application.photos import normalize_extracted
from moura_gestao.domain.errors import DomainError
from moura_gestao.domain.photos import RawLine
from moura_gestao.infrastructure.extractors import FakeNotesExtractor, GeminiNotesExtractor
from moura_gestao.infrastructure.storage import LocalFileStorage
from moura_gestao.interfaces.http.deps import get_extractor, get_storage
from moura_gestao.interfaces.http.routes.photos import _limited
from tests.factories import make_customer, make_rig
from tests.http.test_jobs import allocate, make_job
from tests.http.test_measurements import body

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 1024 + b"\xff\xd9"


class FailingExtractor:
    async def extract(self, image: bytes, content_type: str) -> list[RawLine]:
        raise DomainError("Não foi possível ler a foto", code="extraction_failed")


@dataclass
class Ctx:
    app: object
    office: httpx.AsyncClient
    op_a: httpx.AsyncClient
    op_b: httpx.AsyncClient
    job_id: int
    rig_id: int
    other_job_id: int


async def _start_job(office, cid: int, rig_id: int, op_id: int, name: str) -> int:
    job = await make_job(office, cid, name=name)
    await allocate(office, job["id"], [rig_id], [op_id])
    resp = await office.patch(f"/api/jobs/{job['id']}", json={"status": "in_progress"})
    assert resp.status_code == 200, resp.text
    return job["id"]


@pytest.fixture
async def ctx(app, login_user, tmp_path) -> Ctx:
    app.dependency_overrides[get_storage] = lambda: LocalFileStorage(tmp_path)
    app.dependency_overrides[get_extractor] = FakeNotesExtractor
    office, _ = await login_user("office@moura.test", "office")
    op_a, a_id = await login_user("a@moura.test", "operator")
    op_b, _ = await login_user("b@moura.test", "operator")
    cid = await make_customer(office)
    rig_id = await make_rig(office)
    job_id = await _start_job(office, cid, rig_id, a_id, "Obra Alfa")
    other = await _start_job(office, cid, rig_id, a_id, "Obra Beta")
    return Ctx(app, office, op_a, op_b, job_id, rig_id, other)


async def upload(client, job_id: int, data: bytes = JPEG, content_type: str = "image/jpeg"):
    return await client.post(
        f"/api/jobs/{job_id}/photos", files={"file": ("nota.jpg", data, content_type)}
    )


async def test_upload_and_extract_with_fake(ctx):
    resp = await upload(ctx.op_a, ctx.job_id)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["photo_id"]
    assert data["extraction_error"] is None
    lines = data["extraction"]["lines"]
    assert len(lines) == 3
    assert lines[0] == {
        "pile_code": "E-1", "diameter_cm": 30, "depth_m": "8.50", "valid": True, "error": None
    }
    assert lines[2]["pile_code"] == "E-3"
    assert lines[2]["valid"] is False
    assert lines[2]["error"]
    assert (await ctx.office.get("/api/measurements")).json()["total"] == 0


async def test_extraction_failure_keeps_photo(ctx):
    ctx.app.dependency_overrides[get_extractor] = FailingExtractor
    resp = await upload(ctx.op_a, ctx.job_id)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["extraction"] is None
    assert data["extraction_error"] == "extraction_failed"
    assert (await ctx.op_a.get(f"/api/photos/{data['photo_id']}")).status_code == 200

    ctx.app.dependency_overrides[get_extractor] = FakeNotesExtractor
    resp = await ctx.op_a.post(f"/api/photos/{data['photo_id']}/extract")
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["lines"]) == 3


async def test_missing_api_key_503(ctx):
    ctx.app.dependency_overrides[get_extractor] = lambda: GeminiNotesExtractor(
        api_key=None, model="gemini-3.5-flash-lite", timeout_s=30
    )
    resp = await upload(ctx.op_a, ctx.job_id)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["extraction"] is None
    assert data["extraction_error"] == "extraction_unavailable"
    resp = await ctx.op_a.post(f"/api/photos/{data['photo_id']}/extract")
    assert resp.status_code == 503
    assert resp.json()["code"] == "extraction_unavailable"


async def test_rejects_pdf_415(ctx):
    resp = await upload(ctx.op_a, ctx.job_id, b"%PDF-1.4", "application/pdf")
    assert resp.status_code == 415
    assert resp.json()["code"] == "unsupported_media_type"


async def test_rejects_oversized_413(ctx):
    ctx.app.state.settings = ctx.app.state.settings.model_copy(update={"max_upload_mb": 1})
    resp = await upload(ctx.op_a, ctx.job_id, b"0" * (2 * 1024 * 1024))
    assert resp.status_code == 413
    assert resp.json()["code"] == "file_too_large"


async def test_rejects_oversized_without_content_length(ctx):
    ctx.app.state.settings = ctx.app.state.settings.model_copy(update={"max_upload_mb": 1})
    boundary = "limite"
    payload = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\n'
        "Content-Type: image/jpeg\r\n\r\n"
    ).encode() + b"0" * (2 * 1024 * 1024) + f"\r\n--{boundary}--\r\n".encode()

    async def chunks():
        for i in range(0, len(payload), 64 * 1024):
            yield payload[i:i + 64 * 1024]

    resp = await ctx.op_a.post(
        f"/api/jobs/{ctx.job_id}/photos", content=chunks(),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    assert resp.status_code == 413
    assert resp.json()["code"] == "file_too_large"


async def test_limited_receive_stops_reading_past_limit():
    calls = 0

    async def receive():
        nonlocal calls
        calls += 1
        return {"type": "http.request", "body": b"x" * 100, "more_body": True}

    limited = _limited(receive, limit=250, max_bytes=250)
    await limited()
    await limited()
    with pytest.raises(DomainError) as exc:
        await limited()
    assert exc.value.code == "file_too_large"
    assert calls == 3


async def test_upload_requires_file_field(ctx):
    resp = await ctx.op_a.post(f"/api/jobs/{ctx.job_id}/photos", files={"x": ("a.jpg", JPEG)})
    assert resp.status_code == 422
    assert resp.json()["code"] == "validation_error"


async def test_unallocated_operator_404(ctx):
    resp = await upload(ctx.op_b, ctx.job_id)
    assert resp.status_code == 404
    photo_id = (await upload(ctx.op_a, ctx.job_id)).json()["photo_id"]
    assert (await ctx.op_b.post(f"/api/photos/{photo_id}/extract")).status_code == 404
    assert (await ctx.op_b.get(f"/api/photos/{photo_id}")).status_code == 404


async def test_upload_requires_job_in_progress(ctx):
    photo_id = (await upload(ctx.op_a, ctx.job_id)).json()["photo_id"]
    resp = await ctx.office.patch(f"/api/jobs/{ctx.job_id}", json={"status": "completed"})
    assert resp.status_code == 200, resp.text
    resp = await upload(ctx.op_a, ctx.job_id)
    assert resp.status_code == 409
    assert resp.json()["code"] == "job_not_in_progress"
    resp = await ctx.op_a.post(f"/api/photos/{photo_id}/extract")
    assert resp.status_code == 409
    assert (await ctx.op_a.get(f"/api/photos/{photo_id}")).status_code == 200


async def test_get_photo_returns_bytes_and_type(ctx):
    photo_id = (await upload(ctx.op_a, ctx.job_id, b"png-bytes", "image/png")).json()["photo_id"]
    resp = await ctx.office.get(f"/api/photos/{photo_id}")
    assert resp.status_code == 200
    assert resp.content == b"png-bytes"
    assert resp.headers["content-type"] == "image/png"


async def test_get_unknown_photo_404(ctx):
    resp = await ctx.office.get("/api/photos/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


async def test_measurement_persists_photo_id(ctx):
    photo_id = (await upload(ctx.op_a, ctx.job_id)).json()["photo_id"]
    payload = body(ctx, photo_id=photo_id)
    resp = await ctx.op_a.post("/api/measurements", json=payload)
    assert resp.status_code == 201, resp.text
    m = resp.json()
    assert m["photo_id"] == photo_id
    assert (await ctx.op_a.get(f"/api/measurements/{m['id']}")).json()["photo_id"] == photo_id


async def test_measurement_with_photo_from_other_job_422(ctx):
    photo_id = (await upload(ctx.op_a, ctx.other_job_id)).json()["photo_id"]
    resp = await ctx.op_a.post("/api/measurements", json=body(ctx, photo_id=photo_id))
    assert resp.status_code == 422
    assert resp.json()["code"] == "validation_error"
    unknown = "00000000-0000-0000-0000-000000000000"
    resp = await ctx.op_a.post("/api/measurements", json=body(ctx, photo_id=unknown))
    assert resp.status_code == 422


async def test_normalize_extracted_variants():
    ex = normalize_extracted([
        RawLine(pile_code="e-1", diameter="Ø40", depth="12,5"),
        RawLine(pile_code="E-2", diameter="40cm", depth="8"),
        RawLine(pile_code="E-3", diameter="40 cm", depth="abc"),
        RawLine(pile_code="E-4", diameter="abc", depth="10"),
        RawLine(pile_code="", diameter="30", depth="10"),
    ])
    a, b, c, d, e = ex.lines
    assert (a.pile_code, a.diameter_cm, str(a.depth_m), a.valid) == ("E-1", 40, "12.50", True)
    assert (b.diameter_cm, str(b.depth_m), b.valid) == (40, "8.00", True)
    assert (c.diameter_cm, c.depth_m, c.valid) == (40, None, False)
    assert c.error
    assert (d.diameter_cm, d.valid) == (None, False)
    assert d.error
    assert e.valid is False
    assert ex.warnings == []


async def test_normalize_extracted_truncates_over_200():
    ex = normalize_extracted(
        [RawLine(pile_code=f"E-{i}", diameter="30", depth="10") for i in range(205)]
    )
    assert len(ex.lines) == 200
    assert len(ex.warnings) == 1
