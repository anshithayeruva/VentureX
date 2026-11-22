import logging

from fastapi import APIRouter, Depends

from app.core.auth import CurrentUser, require_founder
from app.schemas.founder import FounderProfileResponse, FounderProfileUpdate, FounderSettings
from app.services.founder_service import FounderService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/founders", tags=["Founders"])

# Every endpoint needs a signed-in founder, who reads and writes only their own profile and
# settings; there is no anonymous fallback to a demo founder.


@router.get("/profile", response_model=FounderProfileResponse)
async def get_founder_profile(user: CurrentUser = Depends(require_founder)):
    """Your founder profile."""
    return await FounderService.get_or_create_profile(user.id)


@router.put("/profile", response_model=FounderProfileResponse)
async def update_founder_profile(profile_in: FounderProfileUpdate, user: CurrentUser = Depends(require_founder)):
    """Update your founder profile."""
    return await FounderService.update_profile(profile_in, user.id)


@router.get("/settings", response_model=FounderSettings)
async def get_founder_settings(user: CurrentUser = Depends(require_founder)):
    """Your privacy and notification settings."""
    return await FounderService.get_settings(user.id)


@router.put("/settings", response_model=FounderSettings)
async def update_founder_settings(settings_in: FounderSettings, user: CurrentUser = Depends(require_founder)):
    """Update your privacy and notification settings."""
    return await FounderService.update_settings(settings_in, user.id)
