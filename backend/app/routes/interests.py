import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.services.team_service import TEAM_PROJECTS, TeamService
from app.core.auth import CurrentUser, get_current_user, require_founder, require_investor, require_user
from app.core.rate_limit import rate_limit
from app.schemas.dealroom import DealRoomCreateInput
from app.services.deal_room_service import DealRoomService
from app.schemas.interest import (
    InvestorResponseInput,
    ProjectInterestCreate,
    ProjectInterestResponse,
    ProjectInterestStatusUpdate,
)
from app.services.founder_outreach_service import FounderOutreachService, OutreachError
from app.services.interest_service import InterestService
from app.services.verification_service import VerificationService


async def _on_team(user: CurrentUser, interest: dict) -> bool:
    """The startup's owner or a co-founder."""
    if interest.get("founder_id") == user.id:
        return True
    return user.is_founder and await TeamService.is_member(user.id, interest.get("project_id"))


async def _require_verified_investor(user: CurrentUser) -> None:
    if not await VerificationService.investor_is_verified(user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={
            "code": "verification_required",
            "message": "Get your investor account verified to contact founders. Send your evidence on the Verification page.",
        })

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/interests", tags=["Interests & Introductions"])


@router.post("", response_model=ProjectInterestResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(rate_limit("intro_request", 30, 3600))])
async def express_interest(
    interest_in: ProjectInterestCreate,
    user: CurrentUser = Depends(require_investor),
):
    """Express interest / request introduction for a startup project (as the signed-in investor)."""
    await _require_verified_investor(user)
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
            detail="Could not record interest. Please try again.",
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
    if user is not None and user.is_founder:
        # An investor's contact details reach the founder only once they say Interested.
        for item in interests:
            if item.get("initiated_by") == "founder" and item.get("status") != "accepted":
                item["investor_email"] = None
    # Badges: verified investors and verified companies.
    verified = await VerificationService.verified_investors({i.get("investor_id") for i in interests})
    companies = await VerificationService.company_statuses({i.get("project_id") for i in interests})
    for item in interests:
        item["investor_verified"] = item.get("investor_id") in verified
        item["company_verified"] = companies.get(item.get("project_id")) == "verified"
    return interests


@router.get("/{interest_id}", response_model=ProjectInterestResponse)
async def get_interest(interest_id: str, user: CurrentUser = Depends(require_user)):
    """Retrieve details and unlocked deal room for one of your introduction requests."""
    interest = await InterestService.get_by_id(interest_id)
    if not interest or not (user.id == interest.get("investor_id") or await _on_team(user, interest)):
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
    if not await _on_team(user, current):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the project's founders can respond")
    if current.get("initiated_by") == "founder":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="You sent this request; the investor replies to it.")
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


@router.post("/{interest_id}/respond", response_model=ProjectInterestResponse)
async def respond_to_founder_request(
    interest_id: str,
    body: InvestorResponseInput,
    user: CurrentUser = Depends(require_investor),
):
    """Investor action on a founder's request: Interested opens the deal room; Pass needs a reason,
    which the founder sees."""
    if body.decision == "interested":
        await _require_verified_investor(user)
    try:
        updated = await FounderOutreachService.respond(user.id, interest_id, body.decision, body.reason, body.note)
    except OutreachError as e:
        raise HTTPException(status_code=e.status, detail={"code": e.code, "message": e.message})
    if body.decision == "interested":
        updated = await _open_deal_room(updated, response_note=body.note or "Interested. Let's talk.")
    return updated


@router.delete("/{interest_id}", status_code=status.HTTP_200_OK)
async def withdraw_interest(interest_id: str, user: CurrentUser = Depends(require_user)):
    """Withdraw a pending request you sent: an investor's intro request, or a founder's request to an investor."""
    current = await InterestService.get_by_id(interest_id)
    if current:
        by_founder = current.get("initiated_by") == "founder"
        allowed = await _on_team(user, current) if by_founder else current.get("investor_id") == user.id
        if not allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only whoever sent the request can withdraw it")
        if by_founder and current.get("status") != "pending":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only a request still waiting for a reply can be withdrawn")
    deleted = await InterestService.delete_interest(interest_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interest record '{interest_id}' not found",
        )
    return {"status": "withdrawn", "id": interest_id}
