import logging
from fastapi import APIRouter
from app.core.config import settings
from app.database import postgres as pg

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Health check endpoint to verify backend service and Neon Postgres connectivity."""
    db_status = "unconfigured"
    if pg.is_configured():
        try:
            db_status = "connected" if await pg.ping() else "degraded"
        except Exception as e:
            logger.error("Postgres health ping failed: %s", e)
            db_status = f"unavailable: {str(e)[:80]}"

    return {
        "status": "healthy" if db_status == "connected" else "mock",
        "service": settings.PROJECT_NAME,
        "database": db_status,
        "database_name": settings.database_name,
        "database_provider": "neon-postgres",
        "branch": settings.NEON_BRANCH,
        "auth_configured": settings.is_auth_configured,
        "environment": settings.APP_ENV,
        "version": "0.1.0",
    }
