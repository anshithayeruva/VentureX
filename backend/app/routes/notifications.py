import logging
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.core.auth import CurrentUser, require_user
from app.schemas.notification import NotificationMarkReadResponse, NotificationResponse
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# Every endpoint here requires sign-in and is scoped to the signed-in user: their own alerts
# plus broadcasts to their role. Nothing in the request can choose whose alerts are returned
# (older clients still send ?role= / ?user_id=; those are ignored).


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    unread_only: bool = Query(False, description="Filter only unread alerts"),
    limit: int = Query(50, ge=1, le=100),
    user: CurrentUser = Depends(require_user),
):
    """Your recent notifications, newest first."""
    return await NotificationService.list_notifications(
        target_role=user.role,
        user_id=user.id,
        unread_only=unread_only,
        limit=limit,
    )


@router.get("/unread-count")
async def get_unread_count(user: CurrentUser = Depends(require_user)) -> Dict[str, int]:
    """How many of your notifications are unread."""
    count = await NotificationService.get_unread_count(target_role=user.role, user_id=user.id)
    return {"unread_count": count}


@router.patch("/{notification_id}/read", response_model=NotificationMarkReadResponse)
async def mark_notification_read(
    notification_id: str = Path(..., description="Notification ID to mark as read"),
    user: CurrentUser = Depends(require_user),
):
    """Mark one of your notifications as read."""
    success = await NotificationService.mark_as_read(notification_id, user_id=user.id, target_role=user.role)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found or already read")
    return NotificationMarkReadResponse(
        success=True,
        modified_count=1,
        message="Notification marked as read",
    )


@router.post("/mark-all-read", response_model=NotificationMarkReadResponse)
async def mark_all_notifications_read(user: CurrentUser = Depends(require_user)):
    """Mark all of your notifications as read."""
    count = await NotificationService.mark_all_read(target_role=user.role, user_id=user.id)
    return NotificationMarkReadResponse(
        success=True,
        modified_count=count,
        message=f"Marked {count} notifications as read",
    )
