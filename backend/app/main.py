import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.core.config import settings
from app.routes import api_router
from app.database import postgres as pg
from app.database.seed import seed_all
from app.services.storage_service import StorageService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("venturex.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown events."""
    logger.info("Starting up Venture X Backend API...")
    try:
        if await pg.open_pool() is not None:
            await pg.apply_schema()
            # Seed demo data into empty tables so UI pages work immediately
            await seed_all()
            logger.info("Connected to Lakebase Postgres on Neon (branch: %s)", settings.NEON_BRANCH or "unknown")
    except Exception as e:
        logger.error("Postgres initialization failed on startup: %s", e)

    yield

    logger.info("Shutting down Venture X Backend API...")
    await pg.close_pool()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="Venture X - AI-powered platform connecting early-stage founders with investors.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

@app.exception_handler(pg.DatabaseUnavailable)
async def database_unavailable_handler(request: Request, exc: pg.DatabaseUnavailable):
    return JSONResponse(status_code=503, content={"detail": "Database is unavailable. Check DATABASE_URL and connectivity to Neon."})


# CORS configuration
origins = settings.cors_origins
logger.info("Enabling CORS for origins: %s", origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routes under /api
app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve uploaded static files
upload_directory = StorageService.get_upload_dir()
app.mount("/uploads", StaticFiles(directory=upload_directory), name="uploads")


@app.get("/", tags=["Root"])
def root():
    return {
        "name": settings.PROJECT_NAME,
        "status": "online",
        "version": "0.1.0",
        "docs_url": "/docs",
        "health_check": f"{settings.API_V1_STR}/health"
    }
