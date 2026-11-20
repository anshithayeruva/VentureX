import logging
from typing import Optional
from fastapi import APIRouter, Depends
from app.core.auth import CurrentUser, get_current_user, require_founder
from app.schemas.founder import FounderProfileUpdate, FounderProfileResponse, FounderSettings
from app.services.founder_service import FounderService, DEFAULT_FOUNDER_USER_ID

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/founders", tags=["Founders"])


def _founder_id(user: Optional[CurrentUser]) -> str:
    """Signed-in founders see their own profile; anonymous visitors see the demo founder."""
    return user.id if user and user.is_founder else DEFAULT_FOUNDER_USER_ID


@router.get("/profile", response_model=FounderProfileResponse)
async def get_founder_profile(user: Optional[CurrentUser] = Depends(get_current_user)):
    """Retrieve the founder's credentials and company profile."""
    return await FounderService.get_or_create_profile(_founder_id(user))


@router.put("/profile", response_model=FounderProfileResponse)
async def update_founder_profile(
    profile_in: FounderProfileUpdate,
    user: CurrentUser = Depends(require_founder),
):
    """Update the signed-in founder's public profile and venture details."""
    return await FounderService.update_profile(profile_in, user.id)


@router.get("/settings", response_model=FounderSettings)
async def get_founder_settings(user: Optional[CurrentUser] = Depends(get_current_user)):
    """Retrieve the founder's workspace privacy and notification settings."""
    return await FounderService.get_settings(_founder_id(user))


@router.put("/settings", response_model=FounderSettings)
async def update_founder_settings(
    settings_in: FounderSettings,
    user: CurrentUser = Depends(require_founder),
):
    """Update the signed-in founder's workspace privacy and notification settings."""
    return await FounderService.update_settings(settings_in, user.id)
