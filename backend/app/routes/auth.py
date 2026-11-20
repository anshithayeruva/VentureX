"""Identity endpoints.

Sign-up, sign-in, sessions and password reset are handled by Neon Auth
(Managed Better Auth) through the Next.js app; this API only verifies the
resulting JWT and stores the VentureX-specific role.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, require_user
from app.database import postgres as pg
from app.schemas.auth import MeResponse, OnboardingInput
from app.services.founder_service import FounderService
from app.services.investor_service import InvestorService

router = APIRouter(prefix="/me", tags=["Authentication"])


@router.get("", response_model=MeResponse)
async def get_me(user: CurrentUser = Depends(require_user)):
    """Return the signed-in user and their role (null until onboarding)."""
    row = await pg.fetch_one("SELECT * FROM app_users WHERE id = %s", [user.id])
    return row


@router.post("", response_model=MeResponse)
async def complete_onboarding(body: OnboardingInput, user: CurrentUser = Depends(require_user)):
    """Set the user's role once and create the matching founder/investor profile."""
    if user.role and user.role != body.role:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This account is already registered as {user.role}",
        )

    name = body.name or user.name
    row = await pg.fetch_one(
        """
        UPDATE app_users
        SET role = %s, name = COALESCE(%s, name), organization = COALESCE(%s, organization), updated_at = %s
        WHERE id = %s
        RETURNING *
        """,
        [body.role, name, body.organization, datetime.now(timezone.utc), user.id],
    )

    if body.role == "FOUNDER":
        await FounderService.get_or_create_profile(
            user.id, defaults={"name": name, "company": body.organization}
        )
    else:
        await InvestorService.get_or_create_profile(
            user.id, defaults={"name": name, "firm": body.organization}
        )
    return row
