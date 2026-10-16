from datetime import datetime
from typing import Optional, Union, List
from pydantic import BaseModel, Field


class NotificationCreate(BaseModel):
    user_id: Optional[Union[int, str]] = None
    target_role: Optional[str] = "INVESTOR"
    title: str
    desc: str
    badge: str = "Alert"
    badge_variant: str = "primary"
    link: Optional[str] = None
    read: bool = False


class NotificationResponse(BaseModel):
    id: Optional[Union[int, str]] = None
    user_id: Optional[Union[int, str]] = None
    target_role: Optional[str] = None
    title: str
    desc: str
    time: Optional[str] = None
    badge: str
    badge_variant: str = "primary"
    read: bool = False
    link: Optional[str] = None
    created_at: Optional[Union[datetime, str]] = None


class NotificationMarkReadResponse(BaseModel):
    success: bool
    modified_count: int
    message: str

