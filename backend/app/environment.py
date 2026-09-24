from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env, independent of the working directory the server is started from
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Environment(BaseSettings):
    """Environment variables take precedence; missing ones are read from backend/.env."""

    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    openrouter_api_key: SecretStr

@lru_cache
def get_environment() -> Environment:
    return Environment()
