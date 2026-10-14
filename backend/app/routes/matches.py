import logging
from typing import List, Optional
from fastapi import APIRouter, Query
from app.schemas.match import MatchResponse
from app.services.match_service import MatchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/matches", tags=["Matches"])


@router.get("", response_model=List[MatchResponse])
async def list_matches(
    search: Optional[str] = Query(None, description="Filter matches by investor, fund or project"),
    project_id: Optional[str] = Query(None, description="Filter matches for specific project"),
    limit: int = Query(50, ge=1, le=100),
):
    """Retrieve AI-synthesized matches with explainable reasoning."""
    matches = await MatchService.list_matches(search=search, project_id=project_id, limit=limit)
    return matches
