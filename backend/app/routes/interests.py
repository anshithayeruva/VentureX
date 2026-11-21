import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.core.auth import CurrentUser, get_current_user, require_founder, require_investor, require_user
from app.schemas.dealroom import DealRoomCreateInput
from app.services.deal_room_service import DealRoomService
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
    user: Optional[CurrentUser] = Depends(get_current_user),
):
    """List introduction requests. Signed-in founders see requests for their projects,
    signed-in investors see their own requests; the query filters apply only to anonymous demo browsing."""
    if user is not None:
        founder_id = user.id if user.is_founder else None
        investor_id = user.id if user.is_investor else None
        if not (user.is_founder or user.is_investor):
            return []
    interests = await InterestService.list_interests(
        investor_id=investor_id,
        founder_id=founder_id,
        status=status,
    )
    if user is not None and user.is_investor:
        # The founder's contact details are only shared once they accept the intro.
        for item in interests:
            if item.get("status") != "accepted":
                item["founder_email"] = None
    return interests


@router.get("/{interest_id}", response_model=ProjectInterestResponse)
async def get_interest(interest_id: str, user: CurrentUser = Depends(require_user)):
    """Retrieve details and unlocked deal room for one of your introduction requests."""
    interest = await InterestService.get_by_id(interest_id)
    if not interest or user.id not in (interest.get("founder_id"), interest.get("investor_id")):
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
    if clean_status == "accepted":
        updated = await _open_deal_room(updated, response_note=status_in.response_note)
    return updated


async def _open_deal_room(interest: dict, response_note: Optional[str]) -> dict:
    """Accepting an intro opens (or reuses) the founder-investor deal room and links it to the intro."""
    try:
        room = await DealRoomService.create_or_get_from_interest(DealRoomCreateInput(
            interest_id=str(interest["id"]),
            project_id=interest["project_id"],
            project_title=interest.get("project_title") or "Project",
            founder_id=interest["founder_id"],
            founder_name=interest.get("founder_name") or "Founder",
            founder_email=interest.get("founder_email") or "",
            investor_id=interest["investor_id"],
            investor_name=interest.get("investor_name") or "Investor",
            investor_firm=interest.get("investor_firm"),
            investor_email=interest.get("investor_email"),
            initial_message=response_note or "Introduction accepted. This deal room is now open.",
        ))
    except Exception as e:
        logger.error("Could not open deal room for interest %s: %s", interest["id"], e)
        return interest
    return await InterestService.link_deal_room(interest["id"], room["id"]) or interest


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
