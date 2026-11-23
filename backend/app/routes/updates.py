"""Founder updates to investors: founders draft and send; investors read, reply and apply valuations."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import CurrentUser, require_founder, require_investor
from app.core.rate_limit import rate_limit
from app.schemas.updates import ApplyValuationInput, ResponseInput, SendInput, UpdateInput
from app.services.updates_service import UpdateError, UpdatesService

router = APIRouter(tags=["Investor updates"])


def _err(e: UpdateError) -> HTTPException:
    return HTTPException(status_code=e.status, detail={"code": e.code, "message": e.message})


# ---------------------------------------------------------------- founders


@router.get("/projects/{project_id}/updates")
async def project_updates(project_id: int, user: CurrentUser = Depends(require_founder)):
    """Your updates for this company (drafts first), when the next one is due, and who would receive it."""
    try:
        return await UpdatesService.list_for_project(user.id, project_id)
    except UpdateError as e:
        raise _err(e)


@router.get("/projects/{project_id}/updates/audience")
async def update_audience(project_id: int, audience: str = Query("investors", pattern="^(investors|investors_and_connected)$"),
                          user: CurrentUser = Depends(require_founder)):
    try:
        await UpdatesService._owned_project(user.id, project_id)
    except UpdateError as e:
        raise _err(e)
    return await UpdatesService.audience(project_id, audience)


@router.post("/projects/{project_id}/updates", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(rate_limit("update_draft", 60, 3600))])
async def create_update(project_id: int, body: UpdateInput, user: CurrentUser = Depends(require_founder)):
    """Start a draft update."""
    try:
        return await UpdatesService.create(user.id, project_id, body.model_dump(mode="json") | {"period_end": body.period_end})
    except UpdateError as e:
        raise _err(e)


@router.get("/updates/{update_id}")
async def founder_update(update_id: int, user: CurrentUser = Depends(require_founder)):
    """One of your updates, with who received and read it and investors' replies."""
    try:
        return await UpdatesService.founder_detail(user.id, update_id)
    except UpdateError as e:
        raise _err(e)


@router.put("/updates/{update_id}")
async def edit_update(update_id: int, body: UpdateInput, user: CurrentUser = Depends(require_founder)):
    try:
        return await UpdatesService.edit(user.id, update_id, body.model_dump(mode="json") | {"period_end": body.period_end})
    except UpdateError as e:
        raise _err(e)


@router.delete("/updates/{update_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_update(update_id: int, user: CurrentUser = Depends(require_founder)):
    try:
        await UpdatesService.delete(user.id, update_id)
    except UpdateError as e:
        raise _err(e)


@router.post("/updates/{update_id}/send", dependencies=[Depends(rate_limit("update_send", 20, 86400))])
async def send_update(update_id: int, body: SendInput, user: CurrentUser = Depends(require_founder)):
    """Send to your investors (and, if chosen, investors you're connected with). Sent updates are final."""
    try:
        return await UpdatesService.send(user.id, update_id, body.apply_to_project)
    except UpdateError as e:
        raise _err(e)


# ---------------------------------------------------------------- investors


@router.get("/investors/updates")
async def investor_updates(
    project_id: Optional[int] = Query(None, ge=1),
    unread_only: bool = False,
    page: int = Query(1, ge=1, le=500),
    page_size: int = Query(20, ge=1, le=50),
    user: CurrentUser = Depends(require_investor),
):
    """Updates from companies you've invested in or are connected with, newest first."""
    return await UpdatesService.feed(user.id, project_id, unread_only, page, page_size)


@router.get("/investors/updates/unread-count")
async def investor_updates_unread(user: CurrentUser = Depends(require_investor)):
    return {"unread": await UpdatesService.unread_count(user.id)}


@router.post("/investors/updates/{update_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_update_read(update_id: int, user: CurrentUser = Depends(require_investor)):
    try:
        await UpdatesService.mark_read(user.id, update_id)
    except UpdateError as e:
        raise _err(e)


@router.post("/investors/updates/{update_id}/responses", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(rate_limit("update_reply", 30, 3600))])
async def reply_to_update(update_id: int, body: ResponseInput, user: CurrentUser = Depends(require_investor)):
    """Reply to the founder, or offer help with one of their asks."""
    try:
        return await UpdatesService.respond(user.id, update_id, body.message, body.ask_index)
    except UpdateError as e:
        raise _err(e)


@router.post("/investors/updates/{update_id}/apply-valuation", status_code=status.HTTP_201_CREATED)
async def apply_update_valuation(update_id: int, body: ApplyValuationInput, user: CurrentUser = Depends(require_investor)):
    """Value your holding from the post-money valuation in this update (your ownership % x post-money)."""
    try:
        return await UpdatesService.apply_valuation(user.id, update_id, body.investment_id)
    except UpdateError as e:
        raise _err(e)
