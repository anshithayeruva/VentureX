"""Neon Auth (Managed Better Auth) token verification for the FastAPI backend.

The Next.js app signs users in through Neon Auth and sends the session JWT
(`authClient.token()`) as `Authorization: Bearer <jwt>`. Tokens are EdDSA
(Ed25519) signed and short-lived; we verify them against the branch's JWKS
(`NEON_AUTH_JWKS_URL`, written by `neon env pull`).

The app-specific role (FOUNDER / INVESTOR) lives in the `app_users` table,
keyed by the Neon Auth user id (the JWT `sub`).
"""
import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.database import postgres as pg

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)
_jwks_client: Optional[jwt.PyJWKClient] = None


@dataclass
class CurrentUser:
    id: str
    email: str
    name: Optional[str]
    role: Optional[str]  # "FOUNDER" | "INVESTOR" | None until onboarding

    @property
    def is_founder(self) -> bool:
        return self.role == "FOUNDER"

    @property
    def is_investor(self) -> bool:
        return self.role == "INVESTOR"


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not settings.is_auth_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication is not configured (NEON_AUTH_JWKS_URL missing)",
            )
        # Keys are cached; an unknown `kid` triggers one refetch (key rotation).
        _jwks_client = jwt.PyJWKClient(settings.NEON_AUTH_JWKS_URL, cache_keys=True, lifespan=3600)
    return _jwks_client


def _expected_issuer() -> Optional[str]:
    """Neon Auth issues tokens with the Auth URL's origin as `iss`."""
    if not settings.NEON_AUTH_BASE_URL:
        return None
    parsed = urlparse(settings.NEON_AUTH_BASE_URL)
    return f"{parsed.scheme}://{parsed.netloc}"


def _decode(token: str) -> Dict[str, Any]:
    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    issuer = _expected_issuer()
    # Neon Auth sets both `iss` and `aud` to the Auth URL's origin.
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["EdDSA"],
        issuer=issuer,
        audience=issuer,
        options={
            "require": ["exp", "sub", "iss", "aud"],
            "verify_iss": issuer is not None,
            "verify_aud": issuer is not None,
        },
        leeway=10,
    )


async def verify_token(token: str) -> Dict[str, Any]:
    try:
        # PyJWKClient fetches over HTTP on a cache miss; keep it off the event loop.
        return await asyncio.to_thread(_decode, token)
    except HTTPException:
        raise
    except jwt.PyJWKClientError as e:
        logger.error("Could not load Neon Auth signing keys: %s", e)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth keys unavailable")
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[CurrentUser]:
    """The signed-in user, or None when no bearer token was sent. A bad token is a 401."""
    if not credentials:
        return None
    return await user_from_token(credentials.credentials)


async def user_from_token(token: str) -> CurrentUser:
    """Verify a Neon Auth JWT and load the VentureX user (also used by the WebSocket, which
    cannot send an Authorization header). Raises HTTPException 401 for a bad token."""
    claims = await verify_token(token)
    user_id = str(claims["sub"])
    email = claims.get("email") or ""
    name = claims.get("name")

    row = await pg.fetch_one("SELECT role, name FROM app_users WHERE id = %s", [user_id])
    if row is None:
        # First request from this Neon Auth user: register them (role chosen at onboarding).
        row = await pg.upsert(
            "app_users",
            {"id": user_id, "email": email, "name": name},
            ["id"],
            update=["email"],
        )
    return CurrentUser(id=user_id, email=email, name=row.get("name") or name, role=row.get("role"))


async def require_user(user: Optional[CurrentUser] = Depends(get_current_user)) -> CurrentUser:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def require_founder(user: CurrentUser = Depends(require_user)) -> CurrentUser:
    if not user.is_founder:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Founder account required")
    return user


async def require_investor(user: CurrentUser = Depends(require_user)) -> CurrentUser:
    if not user.is_investor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Investor account required")
    return user
