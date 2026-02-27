"""Application configuration using Pydantic Settings."""

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """ForecastingMRP Forecast Engine settings.

    Values are loaded from environment variables or .env file.
    """

    # Application
    app_name: str = "ForecastingMRP Forecast Engine"
    app_version: str = "0.1.0"
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = "postgresql+asyncpg://postgres:changeme_in_production@localhost:5432/forecasting_mrp"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # API
    api_port: int = 3001

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }

    @model_validator(mode="after")
    def ensure_asyncpg_driver(self) -> "Settings":
        """Ensure database_url uses the asyncpg driver."""
        url = self.database_url
        if url.startswith("postgresql://"):
            self.database_url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self


settings = Settings()
