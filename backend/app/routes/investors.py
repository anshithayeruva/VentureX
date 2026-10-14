import logging
from typing import List
from fastapi import APIRouter, HTTPException, status, Query
from app.schemas.investor import (
    InvestorProfileResponse,
    InvestorProfileUpdate,
    InvestorPreferenceResponse,
    InvestorPreferenceUpdate,
    InvestorSettings,
)
from app.services.investor_service import InvestorService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/investors", tags=["Investors"])


@router.get("/profile", response_model=InvestorProfileResponse)
async def get_investor_profile():
    """Retrieve the current investor's partner and fund profile."""
    profile = await InvestorService.get_or_create_profile()
    return profile


@router.put("/profile", response_model=InvestorProfileResponse)
async def update_investor_profile(profile_in: InvestorProfileUpdate):
    """Update current investor's profile."""
    updated = await InvestorService.update_profile(profile_in)
    return updated


@router.get("/preferences", response_model=InvestorPreferenceResponse)
async def get_preferences():
    """Retrieve the investor's current matching criteria."""
    pref = await InvestorService.get_or_create_preferences()
    return pref


@router.put("/preferences", response_model=InvestorPreferenceResponse)
async def update_preferences(pref_in: InvestorPreferenceUpdate):
    """Update investment preferences (industries, stages, check sizes, geography)."""
    pref = await InvestorService.update_preferences(pref_in)
    return pref


@router.get("/settings", response_model=InvestorSettings)
async def get_investor_settings():
    """Retrieve the investor's dealflow notification settings."""
    settings = await InvestorService.get_settings()
    return settings


@router.put("/settings", response_model=InvestorSettings)
async def update_investor_settings(settings_in: InvestorSettings):
    """Update dealflow notification settings."""
    updated = await InvestorService.update_settings(settings_in)
    return updated


@router.get("", response_model=List[InvestorProfileResponse])
async def list_investors(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
):
    """List registered investor profiles."""
    investors = await InvestorService.list_all(skip=skip, limit=limit)
    return investors
