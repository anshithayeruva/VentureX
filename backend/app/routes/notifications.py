import logging
from typing import List, Optional
from fastapi import APIRouter, Query
from app.schemas.notification import NotificationResponse
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    role: Optional[str] = Query(None, description="Target role: FOUNDER or INVESTOR"),
    user_id: Optional[str] = Query(None),
):
    """Retrieve recent notifications and portal activity alerts."""
    notifs = await NotificationService.list_notifications(target_role=role, user_id=user_id)
    return notifs
