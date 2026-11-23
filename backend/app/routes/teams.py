"""Team endpoints: startup co-founders, investor firms, and invitations."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser, require_founder, require_investor, require_user
from app.core.rate_limit import rate_limit
from app.services.team_service import TeamError, TeamService

router = APIRouter(tags=["Teams"])


def _err(e: TeamError) -> HTTPException:
    return HTTPException(status_code=e.status, detail={"code": e.code, "message": e.message})


class InviteInput(BaseModel):
    email: str = Field(..., max_length=254)


class FirmInviteInput(InviteInput):
    role: Literal["partner", "admin"] = "partner"


class FirmInput(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    website: Optional[str] = Field("", max_length=300)


class RoleInput(BaseModel):
    role: Literal["partner", "admin"]


_invites = [Depends(rate_limit("team_invite", 30, 3600))]

# ---------------------------------------------------------------- startup teams


@router.get("/projects/{project_id}/team")
async def project_team(project_id: int, user: CurrentUser = Depends(require_founder)):
    """The startup's owner and co-founders, and (for the owner) pending invitations."""
    try:
        return await TeamService.project_team(user.id, project_id)
    except TeamError as e:
        raise _err(e)


@router.post("/projects/{project_id}/team/invitations", status_code=status.HTTP_201_CREATED, dependencies=_invites)
async def invite_cofounder(project_id: int, body: InviteInput, user: CurrentUser = Depends(require_founder)):
    """Invite a co-founder by email (owner only). They can do everything on the project except manage the team."""
    try:
        return await TeamService.invite_to_project(user.id, project_id, body.email)
    except TeamError as e:
        raise _err(e)


@router.delete("/projects/{project_id}/team/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_cofounder(project_id: int, member_id: str, user: CurrentUser = Depends(require_founder)):
    """The owner removes a co-founder, or a co-founder leaves (their own id)."""
    try:
        await TeamService.remove_project_member(user.id, project_id, member_id)
    except TeamError as e:
        raise _err(e)


# ---------------------------------------------------------------- firms


@router.get("/firms/mine")
async def my_firm(user: CurrentUser = Depends(require_investor)):
    return await TeamService.my_firm(user.id)


@router.post("/firms", status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit("firm_create", 10, 3600))])
async def create_firm(body: FirmInput, user: CurrentUser = Depends(require_investor)):
    """Start a firm; you become its admin."""
    try:
        return await TeamService.create_firm(user.id, body.name, body.website or "")
    except TeamError as e:
        raise _err(e)


@router.put("/firms/mine")
async def update_firm(body: FirmInput, user: CurrentUser = Depends(require_investor)):
    try:
        return await TeamService.update_firm(user.id, body.name, body.website or "")
    except TeamError as e:
        raise _err(e)


@router.post("/firms/mine/invitations", status_code=status.HTTP_201_CREATED, dependencies=_invites)
async def invite_partner(body: FirmInviteInput, user: CurrentUser = Depends(require_investor)):
    try:
        return await TeamService.invite_to_firm(user.id, body.email, body.role)
    except TeamError as e:
        raise _err(e)


@router.put("/firms/mine/members/{member_id}/role")
async def set_partner_role(member_id: str, body: RoleInput, user: CurrentUser = Depends(require_investor)):
    try:
        return await TeamService.set_firm_role(user.id, member_id, body.role)
    except TeamError as e:
        raise _err(e)


@router.delete("/firms/mine/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_partner(member_id: str, user: CurrentUser = Depends(require_investor)):
    """An admin removes a partner, or you leave (your own id)."""
    try:
        await TeamService.remove_firm_member(user.id, member_id)
    except TeamError as e:
        raise _err(e)


@router.get("/firms/mine/activity")
async def partner_activity(project_id: int, user: CurrentUser = Depends(require_investor)):
    """Which of your partners already asked for an intro to, or are in a deal room with, this startup."""
    return (await TeamService.partner_activity(user.id, [project_id])).get(project_id, [])


@router.get("/firms/mine/pipeline")
async def firm_pipeline(user: CurrentUser = Depends(require_investor)):
    """Startups any partner is pursuing, so the firm doesn't contact a founder twice."""
    try:
        return await TeamService.firm_pipeline(user.id)
    except TeamError as e:
        raise _err(e)


# ---------------------------------------------------------------- invitations


@router.get("/invitations")
async def my_invitations(user: CurrentUser = Depends(require_user)):
    """Pending invitations sent to your sign-in email."""
    return await TeamService.my_invitations(user.email)


@router.get("/invitations/{invite_id}")
async def invitation(invite_id: str, user: CurrentUser = Depends(require_user)):
    try:
        return await TeamService.invitation(user.email, invite_id)
    except TeamError as e:
        raise _err(e)


@router.post("/invitations/{invite_id}/accept")
async def accept_invitation(invite_id: str, user: CurrentUser = Depends(require_user)):
    try:
        return await TeamService.respond(user, invite_id, accept=True)
    except TeamError as e:
        raise _err(e)


@router.post("/invitations/{invite_id}/decline")
async def decline_invitation(invite_id: str, user: CurrentUser = Depends(require_user)):
    try:
        return await TeamService.respond(user, invite_id, accept=False)
    except TeamError as e:
        raise _err(e)


@router.delete("/invitations/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(invite_id: str, user: CurrentUser = Depends(require_user)):
    """Withdraw an invitation you can manage (project owner or firm admin)."""
    try:
        await TeamService.revoke(user.id, invite_id)
    except TeamError as e:
        raise _err(e)
