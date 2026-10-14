import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query
from app.schemas.interest import ProjectInterestCreate, ProjectInterestResponse
from app.services.interest_service import InterestService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/interests", tags=["Interests & Introductions"])


@router.post("", response_model=ProjectInterestResponse, status_code=status.HTTP_201_CREATED)
async def express_interest(interest_in: ProjectInterestCreate):
    """Express interest / request introduction for a startup project."""
    try:
        interest = await InterestService.express_interest(
            project_id=interest_in.project_id,
            message=interest_in.message,
        )
        return interest
    except Exception as e:
        logger.error("Failed to record interest: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not record interest: {str(e)}",
        )


@router.get("", response_model=List[ProjectInterestResponse])
async def list_interests(
    investor_id: Optional[str] = Query(None),
    founder_id: Optional[str] = Query(None),
):
    """List expressed interests and introduction requests."""
    interests = await InterestService.list_interests(
        investor_id=investor_id,
        founder_id=founder_id,
    )
    return interests
