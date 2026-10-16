from datetime import datetime
from typing import Optional, Union, Dict, Any
from pydantic import BaseModel


class ProjectInterestCreate(BaseModel):
    project_id: Union[int, str]
    investor_id: Optional[str] = "investor-001"
    message: Optional[str] = None


class ProjectInterestStatusUpdate(BaseModel):
    status: str  # "accepted" | "declined" | "pending"
    response_note: Optional[str] = None


class DealRoomDetails(BaseModel):
    unlocked: bool = True
    unlocked_at: Optional[str] = None
    founder_name: Optional[str] = None
    founder_email: Optional[str] = None
    founder_phone: Optional[str] = None
    founder_linkedin: Optional[str] = None
    direct_messaging_channel: Optional[str] = None
    meeting_scheduler_url: Optional[str] = None
    data_room_url: Optional[str] = None
    pitch_deck_url: Optional[str] = None
    financial_model_url: Optional[str] = None
    cap_table_verified: bool = True


class ProjectInterestResponse(BaseModel):
    id: Union[int, str]
    project_id: Union[int, str]
    project_title: Optional[str] = None
    project_industry: Optional[str] = None
    investor_id: Optional[Union[int, str]] = None
    investor_name: Optional[str] = None
    investor_firm: Optional[str] = None
    investor_email: Optional[str] = None
    founder_id: Optional[Union[int, str]] = None
    founder_name: Optional[str] = None
    founder_email: Optional[str] = None
    status: str = "pending"  # "pending", "accepted", "declined"
    message: Optional[str] = None
    response_note: Optional[str] = None
    deal_room: Optional[Dict[str, Any]] = None
    created_at: Optional[Union[datetime, str]] = None
    updated_at: Optional[Union[datetime, str]] = None
