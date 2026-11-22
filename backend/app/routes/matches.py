import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.core.auth import CurrentUser, require_user
from app.schemas.match import MatchResponse
from app.services.match_service import MatchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/matches", tags=["Matches"])

# Matches are recomputed automatically whenever a project is created, edited or published and
# whenever an investor saves their criteria, so there is no public "recalculate everything"
# endpoint (it let any signed-in user trigger an expensive full recomputation).


@router.get("", response_model=List[MatchResponse])
async def list_matches(
    search: Optional[str] = Query(None, description="Filter matches by investor, fund or project"),
    project_id: Optional[str] = Query(None, description="Filter matches for specific project"),
    limit: int = Query(50, ge=1, le=100),
    user: CurrentUser = Depends(require_user),
):
    """Your matches with their reasons: an investor sees their own, a founder sees matches for
    their projects. Only published projects are ever matched."""
    if not (user.is_investor or user.is_founder):
        return []
    return await MatchService.list_matches(
        search=search,
        project_id=project_id,
        limit=limit,
        investor_id=user.id if user.is_investor else None,
        founder_id=user.id if user.is_founder else None,
    )
