import logging
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.rate_limit import GlobalRateLimitMiddleware
from app.database import postgres as pg
from app.database.seed import seed_all
from app.routes import api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("venturex.main")


class _RedactTokens(logging.Filter):
    """Blank out sign-in tokens in log lines. The deal-room WebSocket carries the user's
    token in its URL (browsers can't send headers there), and uvicorn logs request paths."""

    _pattern = re.compile(r"(token=)[^&\s\"']+", re.IGNORECASE)

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if "token=" in message.lower():
            record.msg = self._pattern.sub(r"\1[redacted]", message)
            record.args = ()
        return True


for _name in ("uvicorn.access", "uvicorn.error", "uvicorn"):
    logging.getLogger(_name).addFilter(_RedactTokens())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown events."""
    logger.info("Starting up Venture X Backend API...")
    try:
        if await pg.open_pool() is not None:
            await pg.apply_schema()
            if settings.seed_demo_data:
                # Demo projects, investors, intros and rooms into empty tables (development only
                # unless SEED_DEMO_DATA=true).
                await seed_all()
            logger.info("Connected to Lakebase Postgres on Neon (branch: %s)", settings.NEON_BRANCH or "unknown")
    except Exception as e:
        logger.error("Postgres initialization failed on startup: %s", e)

    yield

    logger.info("Shutting down Venture X Backend API...")
    await pg.close_pool()


# Interactive API docs only outside production.
_docs = not settings.is_production
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="Venture X - AI-powered platform connecting early-stage founders with investors.",
    lifespan=lifespan,
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)


@app.exception_handler(pg.DatabaseUnavailable)
async def database_unavailable_handler(request: Request, exc: pg.DatabaseUnavailable):
    return JSONResponse(status_code=503, content={"detail": "Database is unavailable. Check DATABASE_URL and connectivity to Neon."})


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    """Log the details; never send internal error text to the client."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Basic hardening headers on every API response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response


# Middleware runs outermost-last: CORS wraps everything so even 429s carry CORS headers.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(GlobalRateLimitMiddleware, limit=600, per_seconds=60)

origins = settings.cors_origins
logger.info("Enabling CORS for origins: %s", origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
        "docs_url": "/docs" if _docs else None,
        "health_check": f"{settings.API_V1_STR}/health",
    }
