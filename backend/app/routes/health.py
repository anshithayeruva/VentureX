import logging
from fastapi import APIRouter
from app.database.mongodb import get_mongodb_client
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Health check endpoint to verify backend service and MongoDB Atlas connectivity."""
    db_status = "unconfigured"
    client = get_mongodb_client()

    if client is not None:
        try:
            res = await client.admin.command("ping")
            if res.get("ok") == 1.0:
                db_status = "connected"
            else:
                db_status = "degraded"
        except Exception as e:
            logger.error("MongoDB Atlas health ping failed: %s", e)
            db_status = f"unavailable: {str(e)[:80]}"

    return {
        "status": "healthy" if db_status == "connected" else "mock",
        "service": settings.PROJECT_NAME,
        "database": db_status,
        "database_name": settings.MONGODB_DATABASE,
        "environment": settings.APP_ENV,
        "version": "0.1.0",
    }
