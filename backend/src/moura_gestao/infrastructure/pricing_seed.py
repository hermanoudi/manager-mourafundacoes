from decimal import Decimal

import sqlalchemy as sa

SEED = {
    "mobilization_fee": Decimal("400.00"),
    "minimum_amount": None,
    "max_tabled_depth_m": Decimal("15.00"),
    "items": [
        (30, Decimal("10.00")),
        (35, Decimal("10.00")),
        (40, Decimal("10.00")),
        (50, Decimal("14.00")),
        (60, Decimal("18.00")),
        (70, Decimal("30.00")),
    ],
}

# Tabelas leves (não os modelos ORM): a migration 0005 não pode depender de colunas futuras.
_PRICE_TABLE = sa.table(
    "price_table",
    sa.column("id", sa.Integer),
    sa.column("mobilization_fee", sa.Numeric),
    sa.column("minimum_amount", sa.Numeric),
    sa.column("max_tabled_depth_m", sa.Numeric),
)
_ITEMS = sa.table(
    "price_table_items",
    sa.column("diameter_cm", sa.Integer),
    sa.column("price_per_m", sa.Numeric),
)


def seed_price_table(conn: sa.Connection) -> None:
    conn.execute(
        sa.insert(_PRICE_TABLE).values(
            id=1,
            mobilization_fee=SEED["mobilization_fee"],
            minimum_amount=SEED["minimum_amount"],
            max_tabled_depth_m=SEED["max_tabled_depth_m"],
        )
    )
    conn.execute(
        sa.insert(_ITEMS),
        [{"diameter_cm": d, "price_per_m": p} for d, p in SEED["items"]],
    )
