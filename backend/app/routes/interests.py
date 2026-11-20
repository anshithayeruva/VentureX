import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.core.auth import CurrentUser, require_founder, require_investor
from app.schemas.interest import (
    ProjectInterestCreate,
    ProjectInterestResponse,
    ProjectInterestStatusUpdate,
)
from app.services.interest_service import InterestService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/interests", tags=["Interests & Introductions"])


@router.post("", response_model=ProjectInterestResponse, status_code=status.HTTP_201_CREATED)
async def express_interest(
    interest_in: ProjectInterestCreate,
    user: CurrentUser = Depends(require_investor),
):
    """Express interest / request introduction for a startup project (as the signed-in investor)."""
    try:
        interest = await InterestService.express_interest(
            project_id=interest_in.project_id,
            investor_id=user.id,
            message=interest_in.message,
        )
        return interest
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
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
    user: CurrentUser = Depends(require_founder),
):
    """Founder action: Accept or decline introduction request and manage Deal Room access."""
    current = await InterestService.get_by_id(interest_id)
    if not current:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Interest record '{interest_id}' not found")
    if current.get("founder_id") != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the project's founder can respond")
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


@router.delete("/{interest_id}", status_code=status.HTTP_200_OK)
async def withdraw_interest(interest_id: str, user: CurrentUser = Depends(require_investor)):
    """Investor action: Withdraw a pending introduction request."""
    current = await InterestService.get_by_id(interest_id)
    if current and current.get("investor_id") != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the requesting investor can withdraw")
    deleted = await InterestService.delete_interest(interest_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interest record '{interest_id}' not found",
        )
    return {"status": "withdrawn", "id": interest_id}
