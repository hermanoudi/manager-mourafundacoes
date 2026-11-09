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


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
