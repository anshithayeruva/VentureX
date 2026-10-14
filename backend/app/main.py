import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routes import api_router
from app.database.mongodb import (
    get_database,
    init_db_indexes,
    seed_initial_data_if_empty,
    close_mongodb_connection,
)

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
        db = get_database()
        if db is not None:
            logger.info("Connected to MongoDB Atlas: %s", db.name)
            # Safe index initialization
            await init_db_indexes(db)
            # Seed initial sample data if empty so UI pages work immediately
            await seed_initial_data_if_empty(db)
        else:
            logger.warning("MongoDB Atlas is not configured in .env. Running in offline mode.")
    except Exception as e:
        logger.error("Error during MongoDB initialization on startup: %s", e)

    yield

    logger.info("Shutting down Venture X Backend API...")
    await close_mongodb_connection()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="Venture X - AI-powered platform connecting early-stage founders with investors.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

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


@app.get("/", tags=["Root"])
def root():
    return {
        "name": settings.PROJECT_NAME,
        "status": "online",
        "version": "0.1.0",
        "docs_url": "/docs",
        "health_check": f"{settings.API_V1_STR}/health"
    }
