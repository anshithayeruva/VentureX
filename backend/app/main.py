import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routes import api_router
from app.database.session import engine, Base
import app.models  # Ensure all models are registered with Base metadata

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("venturex.main")


# Ensure tables exist
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logger.warning("Database tables will be initialized when connection is ready: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown events."""
    logger.info("Starting up Venture X Backend API...")
    try:
        # Create tables automatically on startup if database is available
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created successfully.")
    except Exception as e:
        logger.warning(
            "Could not connect to database on startup (%s). Tables will be created once DB is available.",
            e
        )
    yield
    logger.info("Shutting down Venture X Backend API...")


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
