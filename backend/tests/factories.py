from httpx import AsyncClient


async def make_customer(client: AsyncClient) -> int:
    resp = await client.post(
        "/api/customers",
        json={
            "document": "11222333000181", "name": "Cliente Teste",
            "address": {
                "zip_code": "01001000", "street": "Rua A", "number": "1",
                "district": "Centro", "city": "São Paulo", "state": "SP",
            },
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def make_rig(client: AsyncClient, **over) -> int:
    body = {
        "name": "Perfuratriz 01", "max_diameter_cm": 80, "max_depth_m": "22",
        "status": "active", **over,
    }
    resp = await client.post("/api/drill-rigs", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]
