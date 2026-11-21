import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from app.core.auth import CurrentUser, get_current_user, require_user
from app.schemas.match import MatchResponse
from app.services.match_service import MatchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/matches", tags=["Matches"])


@router.get("", response_model=List[MatchResponse])
async def list_matches(
    search: Optional[str] = Query(None, description="Filter matches by investor, fund or project"),
    project_id: Optional[str] = Query(None, description="Filter matches for specific project"),
    limit: int = Query(50, ge=1, le=100),
    user: Optional[CurrentUser] = Depends(get_current_user),
):
    """Matches with explainable reasoning: an investor sees their own matches, a founder sees
    matches for their projects; anonymous demo browsing sees all."""
    matches = await MatchService.list_matches(
        search=search,
        project_id=project_id,
        limit=limit,
        investor_id=user.id if user and user.is_investor else None,
        founder_id=user.id if user and user.is_founder else None,
    )
    return matches


@router.post("/recalculate")
async def recalculate_matches(user: CurrentUser = Depends(require_user)):
    """Trigger full dynamic recalculation of matches across all projects and investors."""
    total = await MatchService.recompute_all_matches()
    return {"status": "success", "matches_computed": total}

