import os

from alembic import command
from alembic.config import Config

TEST_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://moura:moura@localhost:5433/moura"
)


def _cfg() -> Config:
    os.environ["DATABASE_URL"] = TEST_URL
    return Config("alembic.ini")


def test_upgrade_downgrade_roundtrip():
    cfg = _cfg()
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")


def test_models_match_migrations():
    cfg = _cfg()
    command.upgrade(cfg, "head")
    command.check(cfg)

def test_downgrade_0011_expands_groups_without_code_collisions():
    """Desfazer a 0011 vira cada grupo em estacas com código único na obra (sem bater com 'L-<id>')."""
    import re

    from sqlalchemy import create_engine, text

    cfg = _cfg()
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "0011")
    engine = create_engine(TEST_URL)
    try:
        with engine.begin() as c:
            c.execute(text(
                "INSERT INTO users (id, name, email, password_hash, role) "
                "VALUES (1, 'Op', 'op@x.com', 'h', 'operator')"
            ))
            c.execute(text(
                "INSERT INTO customers (id, kind, document, name, zip_code, street, number, "
                "district, city, state) VALUES (1, 'PJ', '11222333000181', 'C', '01001000', "
                "'R', '1', 'B', 'SP', 'SP')"
            ))
            c.execute(text(
                "INSERT INTO jobs (id, name, customer_id, zip_code, street, number, district, "
                "city, state, status, max_tabled_depth_m) VALUES (1, 'Obra', 1, '01001000', "
                "'R', '1', 'B', 'SP', 'SP', 'in_progress', 12)"
            ))
            c.execute(text(
                "INSERT INTO drill_rigs (id, name, max_diameter_cm, max_depth_m, status) "
                "VALUES (1, 'P1', 60, 22, 'active')"
            ))
            for mid in (1, 2):
                c.execute(text(
                    "INSERT INTO measurements (id, client_key, job_id, rig_id, work_date, "
                    "status, created_by, entered_by) VALUES (:id, gen_random_uuid(), 1, 1, "
                    "'2026-11-10', 'draft', 1, 1)"
                ), {"id": mid})
            group_id = c.execute(text(
                "INSERT INTO measurement_lines (measurement_id, position, pile_code, "
                "diameter_cm, depth_m, quantity) VALUES (1, 1, NULL, 30, 8, 3) RETURNING id"
            )).scalar_one()
            c.execute(text(
                "INSERT INTO measurement_lines (measurement_id, position, pile_code, "
                "diameter_cm, depth_m, quantity) VALUES (2, 1, :code, 30, 8, 1)"
            ), {"code": f"L-{group_id}"})

        command.downgrade(cfg, "0010")

        with engine.connect() as c:
            codes = [r[0] for r in c.execute(text(
                "SELECT pile_code FROM measurement_lines ml JOIN measurements m "
                "ON m.id = ml.measurement_id WHERE m.job_id = 1"
            ))]
        assert len(codes) == 4
        assert f"L-{group_id}" in codes
        keys = [re.sub(r"[^A-Z0-9]", "", code.upper()) for code in codes]
        assert len(set(keys)) == 4, codes
        assert all(len(code) <= 20 for code in codes)
    finally:
        engine.dispose()
        command.downgrade(cfg, "base")
        command.upgrade(cfg, "head")
