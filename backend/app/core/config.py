import logging
from typing import List, Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application configuration settings with environment variable management."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # General / Application
    PROJECT_NAME: str = "Venture X API"
    API_V1_STR: str = "/api"
    APP_ENV: str = "development"
    ENVIRONMENT: Optional[str] = None  # Backward-compatibility alias for APP_ENV
    DEBUG: bool = True

    # MongoDB Atlas Configuration
    MONGODB_URI: str = ""
    MONGODB_DATABASE: str = "VentureX"

    # JWT Authentication
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ACCESS_TOKEN_EXPIRE_MINUTES: Optional[int] = None  # Backward-compatibility alias

    # CORS Configuration
    CORS_ORIGINS: str = "http://localhost:3000"
    ALLOWED_ORIGINS: Optional[str] = None  # Backward-compatibility alias

    # AI Configuration
    AI_PROVIDER: str = "none"

    # Database URL (legacy fallback if referenced)
    DATABASE_URL: Optional[str] = None

    @property
    def environment_name(self) -> str:
        """Normalized environment name."""
        return (self.APP_ENV or self.ENVIRONMENT or "development").strip().lower()

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment_name in ("production", "prod")

    @property
    def is_mongodb_configured(self) -> bool:
        """Check whether a non-empty MongoDB URI has been configured."""
        return bool(self.MONGODB_URI and self.MONGODB_URI.strip())

    @property
    def cors_origins(self) -> List[str]:
        """Parsed list of allowed origins for CORS middleware."""
        origins_str = self.CORS_ORIGINS or self.ALLOWED_ORIGINS or "http://localhost:3000"
        return [origin.strip() for origin in origins_str.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_configuration(self) -> "Settings":
        """Validate critical configuration settings based on environment."""
        # Synchronize legacy token expiration alias
        if self.ACCESS_TOKEN_EXPIRE_MINUTES is None:
            self.ACCESS_TOKEN_EXPIRE_MINUTES = self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES

        # Production security & database integrity checks
        if self.is_production:
            if not self.JWT_SECRET_KEY or len(self.JWT_SECRET_KEY.strip()) < 32:
                raise ValueError(
                    "Production Configuration Error: JWT_SECRET_KEY must be set to a secure, "
                    "random secret of at least 32 characters in production."
                )
            if not self.is_mongodb_configured:
                raise ValueError(
                    "Production Configuration Error: MONGODB_URI must be configured with your "
                    "MongoDB Atlas connection string in production."
                )
        return self


settings = Settings()
