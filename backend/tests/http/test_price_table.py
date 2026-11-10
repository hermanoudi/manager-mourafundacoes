PUT_BODY = {
    "mobilization_fee": "450,00",
    "minimum_amount": "1.500,00",
    "max_tabled_depth_m": "15",
    "items": [
        {"diameter_cm": 80, "price_per_m": "45,5"},
        {"diameter_cm": 25, "price_per_m": "9"},
    ],
}


async def test_seeded_table_matches_pricing_md(login_as):
    c = await login_as("office")
    resp = await c.get("/api/price-table")
    assert resp.status_code == 200
    body = resp.json()
    assert body["mobilization_fee"] == "400.00"
    assert body["minimum_amount"] is None
    assert body["max_tabled_depth_m"] == "15.00"
    assert [(i["diameter_cm"], i["price_per_m"]) for i in body["items"]] == [
        (30, "10.00"), (35, "10.00"), (40, "10.00"), (50, "14.00"), (60, "18.00"), (70, "30.00"),
    ]


async def test_put_replaces_with_comma_values(login_as):
    c = await login_as("office")
    resp = await c.put("/api/price-table", json=PUT_BODY)
    assert resp.status_code == 200
    body = resp.json()
    assert [(i["diameter_cm"], i["price_per_m"]) for i in body["items"]] == [
        (25, "9.00"), (80, "45.50"),
    ]
    assert body["minimum_amount"] == "1500.00"
    assert body["mobilization_fee"] == "450.00"
    again = (await c.get("/api/price-table")).json()
    assert again == body


async def test_duplicate_or_out_of_range_diameter_422(login_as):
    c = await login_as("office")

    def body(*items):
        return {**PUT_BODY, "items": [{"diameter_cm": d, "price_per_m": p} for d, p in items]}

    for items in ([(30, "10"), (30, "11")], [(90, "10")], [(30, "0")]):
        resp = await c.put("/api/price-table", json=body(*items))
        assert resp.status_code == 422, items


async def test_operator_forbidden_403(login_as):
    c = await login_as("operator")
    resp = await c.put("/api/price-table", json=PUT_BODY)
    assert resp.status_code == 403
