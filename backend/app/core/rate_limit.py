"""Simple in-memory rate limiting.

* `rate_limit(name, limit, per_seconds)` is a FastAPI dependency for expensive or abusable
  endpoints (AI analysis, uploads, intro requests, messages). It is keyed by the signed-in
  user, or by client IP when there is none.
* `GlobalRateLimitMiddleware` caps every client IP at a generous request rate.

Counts live in this process's memory: they reset on restart and are not shared between
server instances. Behind several instances, move this to a shared store (e.g. Redis) or to
the hosting provider's edge rate limiting.
"""
import math
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional, Tuple

from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.auth import CurrentUser, get_current_user

_hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)


def _check(bucket: str, key: str, limit: int, per_seconds: int) -> Optional[int]:
    """Record a hit; return seconds to wait if over the limit, else None."""
    now = time.monotonic()
    window = _hits[(bucket, key)]
    while window and now - window[0] >= per_seconds:
        window.popleft()
    if len(window) >= limit:
        return max(1, math.ceil(per_seconds - (now - window[0])))
    window.append(now)
    return None


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def reset() -> None:
    """Forget all counts (used by tests)."""
    _hits.clear()


def rate_limit(name: str, limit: int, per_seconds: int):
    """Dependency: at most `limit` calls per `per_seconds` per user (or IP when signed out)."""

    async def dependency(request: Request, user: Optional[CurrentUser] = Depends(get_current_user)) -> None:
        key = f"user:{user.id}" if user else f"ip:{_client_ip(request)}"
        wait = _check(name, key, limit, per_seconds)
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
        wait = _check("global", _client_ip(request), self.limit, self.per_seconds)
        if wait is not None:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": f"Too many requests. Please wait {wait} seconds and try again."},
                headers={"Retry-After": str(wait)},
            )
        return await call_next(request)
