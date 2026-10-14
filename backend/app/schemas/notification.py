from datetime import datetime
from typing import Optional, Union
from pydantic import BaseModel


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
    created_at: Optional[Union[datetime, str]] = None
