import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Path
from app.core.auth import CurrentUser, get_current_user, require_user
from app.schemas.notification import NotificationResponse, NotificationMarkReadResponse
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _scope(user: Optional[CurrentUser], role: Optional[str], user_id: Optional[str]):
    """Signed-in users always get their own alerts (plus broadcasts to their role);
    the query parameters only apply to anonymous demo browsing."""
    if user is not None:
        return user.role, user.id
    return role, user_id


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    role: Optional[str] = Query(None, description="Target role: FOUNDER or INVESTOR"),
    user_id: Optional[str] = Query(None),
    unread_only: bool = Query(False, description="Filter only unread alerts"),
    limit: int = Query(50, ge=1, le=100),
    user: Optional[CurrentUser] = Depends(get_current_user),
):
    """Retrieve recent notifications and portal activity alerts with live relative timestamps."""
    role, user_id = _scope(user, role, user_id)
    notifs = await NotificationService.list_notifications(
        target_role=role,
        user_id=user_id,
        unread_only=unread_only,
        limit=limit,
    )
    return notifs


@router.get("/unread-count")
async def get_unread_count(
    role: Optional[str] = Query(None, description="Target role: FOUNDER or INVESTOR"),
    user_id: Optional[str] = Query(None),
    user: Optional[CurrentUser] = Depends(get_current_user),
) -> Dict[str, int]:
    """Get the current count of unread notifications."""
    role, user_id = _scope(user, role, user_id)
    count = await NotificationService.get_unread_count(target_role=role, user_id=user_id)
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
async def mark_all_notifications_read(
    role: Optional[str] = Query(None, description="Target role: FOUNDER or INVESTOR"),
    user_id: Optional[str] = Query(None),
    user: CurrentUser = Depends(require_user),
):
    """Mark all of your notifications as read."""
    role, user_id = _scope(user, role, user_id)
    count = await NotificationService.mark_all_read(target_role=role, user_id=user_id)
    return NotificationMarkReadResponse(
        success=True,
        modified_count=count,
        message=f"Marked {count} notifications as read",
    )

