import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from app.core.auth import CurrentUser, get_current_user, require_investor
from app.schemas.investor import (
    InvestorProfileResponse,
    InvestorProfileUpdate,
    InvestorPreferenceResponse,
    InvestorPreferenceUpdate,
    InvestorSettings,
)
from app.services.investor_service import InvestorService, DEFAULT_INVESTOR_USER_ID

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/investors", tags=["Investors"])


def _investor_id(user: Optional[CurrentUser]) -> str:
    """Signed-in investors see their own data; anonymous visitors see the demo investor."""
    return user.id if user and user.is_investor else DEFAULT_INVESTOR_USER_ID


@router.get("/profile", response_model=InvestorProfileResponse)
async def get_investor_profile(user: Optional[CurrentUser] = Depends(get_current_user)):
    """Retrieve the current investor's partner and fund profile."""
    return await InvestorService.get_or_create_profile(_investor_id(user))


@router.put("/profile", response_model=InvestorProfileResponse)
async def update_investor_profile(
    profile_in: InvestorProfileUpdate,
    user: CurrentUser = Depends(require_investor),
):
    """Update the signed-in investor's profile."""
    return await InvestorService.update_profile(profile_in, user.id)


@router.get("/preferences", response_model=InvestorPreferenceResponse)
async def get_preferences(user: Optional[CurrentUser] = Depends(get_current_user)):
    """Retrieve the investor's current matching criteria."""
    return await InvestorService.get_or_create_preferences(_investor_id(user))


@router.put("/preferences", response_model=InvestorPreferenceResponse)
async def update_preferences(
    pref_in: InvestorPreferenceUpdate,
    user: CurrentUser = Depends(require_investor),
):
    """Update investment preferences (industries, stages, check sizes, geography)."""
    return await InvestorService.update_preferences(pref_in, user.id)


@router.get("/settings", response_model=InvestorSettings)
async def get_investor_settings(user: Optional[CurrentUser] = Depends(get_current_user)):
    """Retrieve the investor's dealflow notification settings."""
    return await InvestorService.get_settings(_investor_id(user))


@router.put("/settings", response_model=InvestorSettings)
async def update_investor_settings(
    settings_in: InvestorSettings,
    user: CurrentUser = Depends(require_investor),
):
    """Update the signed-in investor's dealflow notification settings."""
    return await InvestorService.update_settings(settings_in, user.id)


@router.get("", response_model=List[InvestorProfileResponse])
async def list_investors(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
):
    """List registered investor profiles."""
    return await InvestorService.list_all(skip=skip, limit=limit)
