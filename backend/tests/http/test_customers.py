ADDRESS = {
    "zip_code": "38400-000",
    "street": "Av. Rondon Pacheco",
    "number": "100",
    "district": "Centro",
    "city": "Uberlândia",
    "state": "MG",
    "ibge_city_code": "3170206",
}


def payload(document="11.222.333/0001-81", name="Conel Construtora", **extra):
    return {"document": document, "name": name, "address": dict(ADDRESS), **extra}


async def test_office_creates_pj_customer(login_as):
    c = await login_as("office")
    resp = await c.post("/api/customers", json=payload())
    assert resp.status_code == 201
    body = resp.json()
    assert body["document"] == "11222333000181"
    assert body["kind"] == "PJ"
    assert body["address"]["city"] == "Uberlândia"


async def test_create_customer_alphanumeric_cnpj(login_as):
    c = await login_as("admin")
    resp = await c.post("/api/customers", json=payload("12.ABC.345/01DE-35"))
    assert resp.status_code == 201
    assert resp.json()["kind"] == "PJ"
    assert resp.json()["document"] == "12ABC34501DE35"


async def test_duplicate_document_ignores_mask_409(login_as):
    c = await login_as("office")
    assert (await c.post("/api/customers", json=payload("529.982.247-25"))).status_code == 201
    resp = await c.post("/api/customers", json=payload("52998224725", name="Outro"))
    assert resp.status_code == 409
    assert resp.json()["code"] == "duplicate_document"


async def test_invalid_document_422(login_as):
    c = await login_as("office")
    resp = await c.post("/api/customers", json=payload("111.111.111-11"))
    assert resp.status_code == 422
    assert resp.json()["code"] == "validation_error"


async def test_invalid_state_422(login_as):
    c = await login_as("office")
    bad = payload()
    bad["address"]["state"] = "XX"
    assert (await c.post("/api/customers", json=bad)).status_code == 422
    ok = payload()
    ok["address"]["state"] = "mg"
    resp = await c.post("/api/customers", json=ok)
    assert resp.status_code == 201
    assert resp.json()["address"]["state"] == "MG"


async def test_zip_code_normalized(login_as):
    c = await login_as("office")
    resp = await c.post("/api/customers", json=payload())
    assert resp.json()["address"]["zip_code"] == "38400000"


async def test_search_by_name_and_document(login_as):
    c = await login_as("office")
    await c.post("/api/customers", json=payload("11.222.333/0001-81", "Conel Construtora"))
    await c.post("/api/customers", json=payload("529.982.247-25", "Maria Silva"))
    await c.post("/api/customers", json=payload("12.ABC.345/01DE-35", "MRV Engenharia"))
    by_name = (await c.get("/api/customers", params={"q": "conel"})).json()
    assert by_name["total"] == 1
    by_doc = (await c.get("/api/customers", params={"q": "11.222"})).json()
    assert by_doc["total"] == 1
    assert by_doc["items"][0]["name"] == "Conel Construtora"


async def test_pagination_total(login_as, db_session):
    from moura_gestao.infrastructure.models import CustomerModel

    c = await login_as("office")
    for i in range(25):
        db_session.add(
            CustomerModel(
                kind="PJ", document=f"{i:012d}00", name=f"Cliente {i:02d}", zip_code="38400000",
                street="Rua", number="1", district="Centro", city="Uberlândia", state="MG",
            )
        )
    await db_session.commit()
    body = (await c.get("/api/customers", params={"page": 2, "page_size": 20})).json()
    assert len(body["items"]) == 5
    assert body["total"] == 25


async def test_patch_customer_name(login_as):
    c = await login_as("office")
    created = (await c.post("/api/customers", json=payload())).json()
    resp = await c.patch(f"/api/customers/{created['id']}", json={"name": "Novo Nome", "phone": "(34) 99999-0000"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Novo Nome"
    assert resp.json()["phone"] == "(34) 99999-0000"
    got = (await c.get(f"/api/customers/{created['id']}")).json()
    assert got["name"] == "Novo Nome"


async def test_get_missing_404(login_as):
    c = await login_as("office")
    resp = await c.get("/api/customers/999")
    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"


async def test_operator_forbidden_403(login_as):
    c = await login_as("operator")
    assert (await c.get("/api/customers")).status_code == 403
    assert (await c.post("/api/customers", json=payload())).status_code == 403
