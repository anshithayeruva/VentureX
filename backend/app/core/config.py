import logging
from pathlib import Path
from typing import List, Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_REPO_ROOT = _BACKEND_DIR.parent
# Later files win. `neon deploy` / `neon env pull` write the repo-root .env.local;
# backend/.env holds app-only settings and can override anything.
_ENV_FILES = (_REPO_ROOT / ".env.local", _BACKEND_DIR / ".env")


class Settings(BaseSettings):
    """Application configuration settings with environment variable management."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
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

    # Lakebase Postgres on Neon (pooled connection string from `neon env pull`)
    DATABASE_URL: str = ""
    NEON_BRANCH: Optional[str] = None
    # "https" = Neon SQL-over-HTTP on port 443 (works where 5432 is blocked);
    # "tcp" = psycopg connection pool over the Postgres wire protocol (5432).
    NEON_DB_TRANSPORT: str = "https"

    # Neon Auth (Managed Better Auth). The backend verifies the JWTs it issues.
    NEON_AUTH_BASE_URL: str = ""
    NEON_AUTH_JWKS_URL: str = ""

    # CORS Configuration
    CORS_ORIGINS: str = "http://localhost:3000"
    ALLOWED_ORIGINS: Optional[str] = None  # Backward-compatibility alias

    # AI Configuration
    AI_PROVIDER: str = "none"

    @property
    def environment_name(self) -> str:
        """Normalized environment name."""
        return (self.APP_ENV or self.ENVIRONMENT or "development").strip().lower()

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment_name in ("production", "prod")

    @property
    def is_database_configured(self) -> bool:
        """Check whether a Postgres connection string has been configured."""
        return bool(self.DATABASE_URL and self.DATABASE_URL.strip())

    @property
    def is_auth_configured(self) -> bool:
        return bool(self.NEON_AUTH_JWKS_URL and self.NEON_AUTH_JWKS_URL.strip())

    @property
    def database_name(self) -> str:
        """Database name parsed from DATABASE_URL (for health reporting)."""
        from urllib.parse import urlparse
        if not self.is_database_configured:
            return ""
        return urlparse(self.DATABASE_URL).path.lstrip("/") or ""

    @property
    def cors_origins(self) -> List[str]:
        """Parsed list of allowed origins for CORS middleware."""
        origins_str = self.CORS_ORIGINS or self.ALLOWED_ORIGINS or "http://localhost:3000"
        return [origin.strip() for origin in origins_str.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_configuration(self) -> "Settings":
        """Validate critical configuration settings based on environment."""
        # Production security & database integrity checks
        if self.is_production:
            if not self.is_auth_configured:
                raise ValueError(
                    "Production Configuration Error: NEON_AUTH_JWKS_URL must be set "
                    "(run `neon env pull`)."
                )
            if not self.is_database_configured:
                raise ValueError(
                    "Production Configuration Error: DATABASE_URL must be set to your Neon "
                    "Postgres connection string (run `neon env pull`)."
                )
        return self


settings = Settings()
