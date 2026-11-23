"""Rate limiting, shared across server instances when Redis is configured.

* `rate_limit(name, limit, per_seconds)` is a FastAPI dependency for expensive or abusable
  endpoints (AI analysis, uploads, intro requests, messages, imports). It is keyed by the
  signed-in user, or by client IP when there is none.
* `GlobalRateLimitMiddleware` caps every client IP at a generous request rate.

Where counts live:
* With UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set, counts are kept in Upstash
  Redis (over HTTPS), so every server instance enforces the same limits. Fixed windows:
  one counter per key per window, expiring with the window.
* Otherwise, or whenever Redis can't be reached, counts are kept in this process's memory
  (sliding window). The API never fails closed because the limiter's store is down.

Behind a proxy or load balancer, run uvicorn with --proxy-headers (and a matching
--forwarded-allow-ips) so the client IP is the visitor's, not the proxy's.
"""
import logging
import math
import time
from collections import defaultdict, deque
from typing import Deque, Dict, List, Optional, Tuple

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.auth import CurrentUser, get_current_user

logger = logging.getLogger(__name__)

_hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)
_client: Optional[httpx.AsyncClient] = None
_warned_at = 0.0


# ---------------------------------------------------------------- in-memory store


def _check_memory(bucket: str, key: str, limit: int, per_seconds: int) -> Optional[int]:
    """Record a hit; return seconds to wait if over the limit, else None."""
    now = time.monotonic()
    window = _hits[(bucket, key)]
    while window and now - window[0] >= per_seconds:
        window.popleft()
    if len(window) >= limit:
        return max(1, math.ceil(per_seconds - (now - window[0])))
    window.append(now)
    return None


# ---------------------------------------------------------------- Redis store


def _redis_config() -> Optional[Tuple[str, str]]:
    from app.core.config import settings
    url = (settings.UPSTASH_REDIS_REST_URL or "").strip().rstrip("/")
    token = (settings.UPSTASH_REDIS_REST_TOKEN or "").strip()
    return (url, token) if url and token else None


async def _redis_pipeline(url: str, token: str, commands: List[list]) -> list:
    """Run commands in one Upstash REST pipeline call; returns each command's result."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(1.0, connect=1.0))
    res = await _client.post(f"{url}/pipeline", json=commands, headers={"Authorization": f"Bearer {token}"})
    res.raise_for_status()
    out = []
    for item in res.json():
        if item.get("error"):
            raise RuntimeError(item["error"])
        out.append(item.get("result"))
    return out


async def _check_redis(url: str, token: str, bucket: str, key: str, limit: int, per_seconds: int) -> Optional[int]:
    now = time.time()
    window = int(now // per_seconds)
    redis_key = f"vx:rl:{bucket}:{key}:{window}"
    count, _ = await _redis_pipeline(url, token, [
        ["INCR", redis_key],
        ["EXPIRE", redis_key, str(per_seconds + 5), "NX"],
    ])
    if int(count) > limit:
        return max(1, math.ceil((window + 1) * per_seconds - now))
    return None


async def _check(bucket: str, key: str, limit: int, per_seconds: int) -> Optional[int]:
    """Record a hit in the shared store when there is one, else in memory."""
    global _warned_at
    cfg = _redis_config()
    if cfg:
        try:
            return await _check_redis(*cfg, bucket, key, limit, per_seconds)
        except Exception as e:  # never block the API because the limiter's store is down
            if time.monotonic() - _warned_at > 60:
                _warned_at = time.monotonic()
                logger.warning("Shared rate limit store unavailable, using in-memory limits: %s", e)
    return _check_memory(bucket, key, limit, per_seconds)


# ---------------------------------------------------------------- FastAPI glue


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def reset() -> None:
    """Forget all in-memory counts (used by tests)."""
    _hits.clear()


def rate_limit(name: str, limit: int, per_seconds: int):
    """Dependency: at most `limit` calls per `per_seconds` per user (or IP when signed out)."""

    async def dependency(request: Request, user: Optional[CurrentUser] = Depends(get_current_user)) -> None:
        key = f"user:{user.id}" if user else f"ip:{_client_ip(request)}"
        wait = await _check(name, key, limit, per_seconds)
        if wait is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Please wait {wait} seconds and try again.",
                headers={"Retry-After": str(wait)},
            )

    return dependency


class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    """Caps each client IP at `limit` requests per `per_seconds` across the whole API."""

    def __init__(self, app, limit: int = 600, per_seconds: int = 60):
        super().__init__(app)
        self.limit = limit
        self.per_seconds = per_seconds

    async def dispatch(self, request: Request, call_next):
        wait = await _check("global", _client_ip(request), self.limit, self.per_seconds)
        if wait is not None:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": f"Too many requests. Please wait {wait} seconds and try again."},
                headers={"Retry-After": str(wait)},
            )
        return await call_next(request)
