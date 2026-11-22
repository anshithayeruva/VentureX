import logging
from typing import List

from fastapi import APIRouter, Depends, Query

from app.core.auth import CurrentUser, require_investor, require_user
from app.schemas.investor import (
    InvestorPreferenceResponse,
    InvestorPreferenceUpdate,
    InvestorProfileResponse,
    InvestorProfileUpdate,
    InvestorSettings,
)
from app.services.investor_service import InvestorService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/investors", tags=["Investors"])

# Every endpoint needs sign-in. An investor reads and writes only their own profile, criteria
# and settings; there is no anonymous fallback to a demo investor.


@router.get("/profile", response_model=InvestorProfileResponse)
async def get_investor_profile(user: CurrentUser = Depends(require_investor)):
    """Your investor profile."""
    return await InvestorService.get_or_create_profile(user.id)


@router.put("/profile", response_model=InvestorProfileResponse)
async def update_investor_profile(profile_in: InvestorProfileUpdate, user: CurrentUser = Depends(require_investor)):
    """Update your investor profile."""
    return await InvestorService.update_profile(profile_in, user.id)


@router.get("/preferences", response_model=InvestorPreferenceResponse)
async def get_preferences(user: CurrentUser = Depends(require_investor)):
    """Your matching criteria."""
    return await InvestorService.get_or_create_preferences(user.id)


@router.put("/preferences", response_model=InvestorPreferenceResponse)
async def update_preferences(pref_in: InvestorPreferenceUpdate, user: CurrentUser = Depends(require_investor)):
    """Update your criteria (industries, stages, check size, geography); recomputes your matches."""
    return await InvestorService.update_preferences(pref_in, user.id)


@router.get("/settings", response_model=InvestorSettings)
async def get_investor_settings(user: CurrentUser = Depends(require_investor)):
    """Your notification settings."""
    return await InvestorService.get_settings(user.id)


@router.put("/settings", response_model=InvestorSettings)
async def update_investor_settings(settings_in: InvestorSettings, user: CurrentUser = Depends(require_investor)):
    """Update your notification settings."""
    return await InvestorService.update_settings(settings_in, user.id)


@router.get("", response_model=List[InvestorProfileResponse])
async def list_investors(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    user: CurrentUser = Depends(require_user),
):
    """Investor profiles (signed-in users only)."""
    return await InvestorService.list_all(skip=skip, limit=limit)
