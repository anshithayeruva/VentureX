import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration settings."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # General
    PROJECT_NAME: str = "Venture X API"
    ENVIRONMENT: str = "development"
    API_V1_STR: str = "/api"

    # Database
    DATABASE_URL: str = "postgresql://venturex:venturex_password@localhost:5432/venturex_db"

    # Security
    JWT_SECRET_KEY: str = "venture_x_super_secret_development_jwt_key_12345"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()
