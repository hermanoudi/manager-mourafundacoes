from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: SecretStr
    session_ttl_hours: int = 12
    cookie_secure: bool = True
    environment: Literal["dev", "test", "prod"] = "dev"
    # extração das anotações por IA
    notes_extractor: Literal["gemini", "fake"] = "gemini"
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    extraction_timeout_s: int = 30
    # fotos
    storage_backend: Literal["local", "s3"] = "local"
    storage_local_dir: str = "var/uploads"
    s3_endpoint_url: str | None = None
    s3_bucket: str | None = None
    s3_region: str = "auto"
    s3_access_key_id: str | None = None
    s3_secret_access_key: SecretStr | None = None
    max_upload_mb: int = 8

    @field_validator("database_url")
    @classmethod
    def _driver(cls, v: str) -> str:
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+psycopg://", 1)
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    @model_validator(mode="after")
    def _prod_secret(self) -> "Settings":
        if self.environment == "prod" and len(self.jwt_secret.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET precisa ter ao menos 32 caracteres em produção")
        return self

    @model_validator(mode="after")
    def _storage(self) -> "Settings":
        # o disco do Railway é efêmero: em produção as fotos precisam ir para o S3
        if self.environment == "prod" and self.storage_backend != "s3":
            raise ValueError("Em produção as fotos precisam de S3: use STORAGE_BACKEND=s3")
        secret = self.s3_secret_access_key.get_secret_value() if self.s3_secret_access_key else ""
        if self.storage_backend == "s3" and not (
            self.s3_bucket and self.s3_access_key_id and secret
        ):
            raise ValueError(
                "STORAGE_BACKEND=s3 exige S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY"
            )
        return self

    @property
    def gemini_key(self) -> str | None:
        """Chave do Gemini; variável vazia conta como ausente."""
        key = self.gemini_api_key.get_secret_value() if self.gemini_api_key else ""
        return key or None


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
