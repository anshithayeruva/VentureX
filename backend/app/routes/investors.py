import logging
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.auth import CurrentUser, require_investor, require_user
from app.core.rate_limit import rate_limit
from app.schemas.investor import (
    CriteriaOptions,
    DealFlow,
    DiscoverPage,
    InvestorPreferenceResponse,
    InvestorPreferenceUpdate,
    InvestorProfileResponse,
    InvestorProfileUpdate,
    InvestorSettings,
)
from app.schemas.thesis import INSTRUMENTS, INVESTOR_STAGES
from app.services.criteria import COUNTRIES, REGIONS
from app.services.discover_service import DiscoverService
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


@router.get("/criteria-options", response_model=CriteriaOptions)
async def criteria_options(user: CurrentUser = Depends(require_investor)):
    """Fixed choices for the criteria page (stages, regions, countries, instruments)."""
    return {"stages": INVESTOR_STAGES, "regions": list(REGIONS), "countries": COUNTRIES, "instruments": INSTRUMENTS}


@router.get("/discover", response_model=DiscoverPage)
async def discover(
    q: Optional[str] = Query(None, max_length=100),
    industry: List[str] = Query(default_factory=list),
    stage: List[str] = Query(default_factory=list),
    business_model: List[str] = Query(default_factory=list),
    country: List[str] = Query(default_factory=list),
    region: List[str] = Query(default_factory=list),
    min_raise: Optional[float] = Query(None, ge=0),
    max_raise: Optional[float] = Query(None, ge=0),
    min_monthly_revenue: Optional[float] = Query(None, ge=0),
    min_customers: Optional[int] = Query(None, ge=0),
    live_product: bool = False,
    matched_only: bool = False,
    saved_only: bool = False,
    sort: Literal["fit", "newest", "raise_asc", "raise_desc"] = "fit",
    page: int = Query(1, ge=1, le=1000),
    page_size: int = Query(12, ge=1, le=50),
    user: CurrentUser = Depends(require_investor),
):
    """Search published startups with your fit score. Only public project facts are returned."""
    return await DiscoverService.search(
        user.id, q=q, industries=industry[:20], stages=stage[:10], business_models=business_model[:20],
        countries=country[:40], regions=region[:10], min_raise=min_raise, max_raise=max_raise,
        min_monthly_revenue=min_monthly_revenue, min_customers=min_customers, live_product=live_product,
        matched_only=matched_only, saved_only=saved_only, sort=sort, page=page, page_size=page_size,
    )


@router.put("/saved/{project_id}", status_code=status.HTTP_204_NO_CONTENT,
            dependencies=[Depends(rate_limit("save_opportunity", 300, 3600))])
async def save_opportunity(project_id: int, user: CurrentUser = Depends(require_investor)):
    """Save a published startup to your Deal Flow."""
    await DiscoverService.save(user.id, project_id)


@router.delete("/saved/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unsave_opportunity(project_id: int, user: CurrentUser = Depends(require_investor)):
    await DiscoverService.unsave(user.id, project_id)


@router.get("/deal-flow", response_model=DealFlow)
async def deal_flow(user: CurrentUser = Depends(require_investor)):
    """Saved startups, intro requests and deal rooms in one pipeline."""
    return await DiscoverService.deal_flow(user.id)


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
