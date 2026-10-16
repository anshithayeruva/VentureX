import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query
from app.schemas.interest import (
    ProjectInterestCreate,
    ProjectInterestResponse,
    ProjectInterestStatusUpdate,
)
from app.services.interest_service import InterestService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/interests", tags=["Interests & Introductions"])


@router.post("", response_model=ProjectInterestResponse, status_code=status.HTTP_201_CREATED)
async def express_interest(interest_in: ProjectInterestCreate):
    """Express interest / request introduction for a startup project."""
    try:
        interest = await InterestService.express_interest(
            project_id=interest_in.project_id,
            investor_id=interest_in.investor_id or "investor-001",
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
    status: Optional[str] = Query(None),
):
    """List expressed interests and introduction requests."""
    interests = await InterestService.list_interests(
        investor_id=investor_id,
        founder_id=founder_id,
        status=status,
    )
    return interests


@router.get("/{interest_id}", response_model=ProjectInterestResponse)
async def get_interest(interest_id: str):
    """Retrieve details and unlocked deal room for a specific introduction request."""
    interest = await InterestService.get_by_id(interest_id)
    if not interest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interest record '{interest_id}' not found",
        )
    return interest


@router.patch("/{interest_id}/status", response_model=ProjectInterestResponse)
async def update_interest_status(
    interest_id: str,
    status_in: ProjectInterestStatusUpdate,
):
    """Founder action: Accept or decline introduction request and manage Deal Room access."""
    clean_status = status_in.status.lower().strip()
    if clean_status not in ["accepted", "declined", "pending"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{status_in.status}'. Must be 'accepted', 'declined', or 'pending'.",
        )

    updated = await InterestService.update_status(
        interest_id=interest_id,
        status=clean_status,
        response_note=status_in.response_note,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interest record '{interest_id}' not found",
        )
    return updated
