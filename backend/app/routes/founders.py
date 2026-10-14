import logging
from fastapi import APIRouter, HTTPException, status
from app.schemas.founder import FounderProfileUpdate, FounderProfileResponse, FounderSettings
from app.services.founder_service import FounderService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/founders", tags=["Founders"])


@router.get("/profile", response_model=FounderProfileResponse)
async def get_founder_profile():
    """Retrieve the founder's credentials and company profile."""
    profile = await FounderService.get_or_create_profile()
    return profile


@router.put("/profile", response_model=FounderProfileResponse)
async def update_founder_profile(profile_in: FounderProfileUpdate):
    """Update the founder's public profile and venture details."""
    updated = await FounderService.update_profile(profile_in)
    return updated


@router.get("/settings", response_model=FounderSettings)
async def get_founder_settings():
    """Retrieve the founder's workspace privacy and notification settings."""
    settings = await FounderService.get_settings()
    return settings


@router.put("/settings", response_model=FounderSettings)
async def update_founder_settings(settings_in: FounderSettings):
    """Update the founder's workspace privacy and notification settings."""
    updated = await FounderService.update_settings(settings_in)
    return updated
