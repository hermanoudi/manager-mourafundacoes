from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: SecretStr
    session_ttl_hours: int = 12
    cookie_secure: bool = True
    environment: Literal["dev", "test", "prod"] = "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
