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
