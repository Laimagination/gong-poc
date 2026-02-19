from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./data/gong_poc.db"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
