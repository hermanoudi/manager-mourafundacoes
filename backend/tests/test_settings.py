import pytest
from pydantic import SecretStr, ValidationError

from moura_gestao.infrastructure.config import Settings


def test_database_url_normalized():
    s = Settings(database_url="postgresql://u:p@h:5432/d", jwt_secret=SecretStr("x" * 32))
    assert s.database_url == "postgresql+psycopg://u:p@h:5432/d"


def test_jwt_secret_too_short_rejected_in_prod():
    with pytest.raises(ValidationError):
        Settings(
            database_url="postgresql://u:p@h/d", jwt_secret=SecretStr("curto"), environment="prod"
        )


def test_short_secret_allowed_outside_prod():
    s = Settings(database_url="postgresql://u:p@h/d", jwt_secret=SecretStr("curto"))
    assert s.environment == "dev"
