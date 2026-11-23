import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import CurrentUser, require_founder
from app.core.rate_limit import rate_limit
from app.schemas.founder import FounderProfileResponse, FounderProfileUpdate, FounderSettings
from app.schemas.interest import FounderIntroInput, ProjectInterestResponse
from app.services.founder_outreach_service import FounderOutreachService, OutreachError
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


# ---------------------------------------------------------------- finding investors


def _outreach_error(e: OutreachError) -> HTTPException:
    return HTTPException(status_code=e.status, detail={"code": e.code, "message": e.message})


@router.get("/investors")
async def find_investors(
    project_id: Optional[int] = Query(None, ge=1),
    q: Optional[str] = Query(None, max_length=120),
    stage: Optional[str] = Query(None, max_length=40),
    sector: Optional[str] = Query(None, max_length=80),
    min_check: Optional[float] = Query(None, ge=0),
    max_check: Optional[float] = Query(None, ge=0),
    location: Optional[str] = Query(None, max_length=80),
    role: Optional[Literal["lead", "co_invest"]] = None,
    verified_only: bool = False,
    sort: Literal["fit", "name"] = "fit",
    page: int = Query(1, ge=1, le=500),
    page_size: int = Query(20, ge=1, le=50),
    user: CurrentUser = Depends(require_founder),
):
    """Investors who chose to be listed, filtered, and ranked by fit for the chosen project."""
    try:
        return await FounderOutreachService.directory(
            user.id, project_id=project_id, q=q, stage=stage, sector=sector, min_check=min_check,
            max_check=max_check, location=location, role=role, verified_only=verified_only, sort=sort,
            page=page, page_size=page_size,
        )
    except OutreachError as e:
        raise _outreach_error(e)


@router.get("/investors/{investor_id}")
async def investor_profile(
    investor_id: str,
    project_id: Optional[int] = Query(None, ge=1),
    user: CurrentUser = Depends(require_founder),
):
    """An investor's public profile, their fit for the chosen project, and whether you can request an intro."""
    try:
        return await FounderOutreachService.investor_profile(user.id, investor_id, project_id)
    except OutreachError as e:
        raise _outreach_error(e)


@router.post("/investors/{investor_id}/intro-requests", response_model=ProjectInterestResponse, status_code=201,
             dependencies=[Depends(rate_limit("founder_intro_burst", 20, 3600))])
async def request_intro(investor_id: str, body: FounderIntroInput, user: CurrentUser = Depends(require_founder)):
    """Ask an investor for an intro. The project must be published and ready, fit the investor's
    criteria, and stay within the daily limit."""
    try:
        return await FounderOutreachService.request_intro(user.id, investor_id, body.project_id, body.note)
    except OutreachError as e:
        raise _outreach_error(e)
