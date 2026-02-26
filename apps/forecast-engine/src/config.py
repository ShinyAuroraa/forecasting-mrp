"""Application configuration using Pydantic Settings."""

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


settings = Settings()
