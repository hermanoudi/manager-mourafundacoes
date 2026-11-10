import pytest
from pydantic import SecretStr, ValidationError

from moura_gestao.infrastructure.config import Settings


@pytest.fixture(autouse=True)
def _isolated_env(monkeypatch):
    """Sem backend/.env nem variáveis do shell: só valem os argumentos de cada teste."""
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    for name in Settings.model_fields:
        if name not in ("database_url", "jwt_secret"):
            monkeypatch.delenv(name.upper(), raising=False)


S3 = {
    "storage_backend": "s3", "s3_endpoint_url": "https://s3.example.com", "s3_bucket": "fotos",
    "s3_access_key_id": "chave", "s3_secret_access_key": SecretStr("segredo"),
}


def test_database_url_normalized():
    s = Settings(database_url="postgresql://u:p@h:5432/d", jwt_secret=SecretStr("x" * 32))
    assert s.database_url == "postgresql+psycopg://u:p@h:5432/d"


def test_jwt_secret_too_short_rejected_in_prod():
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(
            database_url="postgresql://u:p@h/d", jwt_secret=SecretStr("curto"),
            environment="prod", **S3,
        )


def test_short_secret_allowed_outside_prod():
    s = Settings(database_url="postgresql://u:p@h/d", jwt_secret=SecretStr("curto"))
    assert s.environment == "dev"


def test_p1_settings_valid_without_new_variables():
    s = Settings(database_url="postgresql://u:p@h/d", jwt_secret=SecretStr("x" * 32))
    assert s.storage_backend == "local"
    assert s.notes_extractor == "gemini"
    assert s.gemini_api_key is None
    assert s.gemini_model == "gemini-3.5-flash-lite"
    assert s.max_upload_mb == 8


def test_prod_with_s3_is_valid():
    s = Settings(
        database_url="postgresql://u:p@h/d", jwt_secret=SecretStr("x" * 32),
        environment="prod", **S3,
    )
    assert s.storage_backend == "s3"


def test_prod_requires_s3_storage():
    with pytest.raises(ValidationError, match="S3"):
        Settings(
            database_url="postgresql://u:p@h/d", jwt_secret=SecretStr("x" * 32),
            environment="prod", storage_backend="local",
        )


def test_s3_backend_requires_bucket_outside_prod_too():
    with pytest.raises(ValidationError, match="S3_BUCKET"):
        Settings(
            database_url="postgresql://u:p@h/d", jwt_secret=SecretStr("x" * 32),
            storage_backend="s3",
        )


@pytest.mark.parametrize("missing",["s3_bucket", "s3_access_key_id", "s3_secret_access_key"])
def test_prod_s3_requires_bucket_and_credentials(missing):
    blank = SecretStr("") if missing == "s3_secret_access_key" else ""
    with pytest.raises(ValidationError, match="S3"):
        Settings(
            database_url="postgresql://u:p@h/d", jwt_secret=SecretStr("x" * 32),
            environment="prod", **{**S3, missing: blank},
        )
