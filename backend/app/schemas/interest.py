from datetime import datetime
from typing import Literal, Optional, Union, Dict, Any
from pydantic import BaseModel, Field


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
    founder_linkedin: Optional[str] = None
    founder_website: Optional[str] = None
    pitch_deck_url: Optional[str] = None
    room_id: Optional[str] = None


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
    status: str = "pending"  # "pending", "accepted", "declined", "expired" (no reply in 14 days)
    initiated_by: str = "investor"  # who asked to connect: "investor" or "founder"
    pass_reason: Optional[str] = None
    responded_at: Optional[Union[datetime, str]] = None
    message: Optional[str] = None
    response_note: Optional[str] = None
    deal_room: Optional[Dict[str, Any]] = None
    created_at: Optional[Union[datetime, str]] = None
    updated_at: Optional[Union[datetime, str]] = None


PASS_REASONS = {
    "too_early": "Too early for us",
    "outside_focus": "Outside our focus",
    "market_size": "Market size",
    "team": "Team",
    "traction": "Not enough traction yet",
    "timing": "Not investing right now",
    "other": "Other",
}


class InvestorResponseInput(BaseModel):
    """An investor's reply to a founder's intro request."""
    decision: Literal["interested", "pass"]
    reason: Optional[Literal["too_early", "outside_focus", "market_size", "team", "traction", "timing", "other"]] = None
    note: Optional[str] = Field(None, max_length=1000)


class FounderIntroInput(BaseModel):
    """A founder asking an investor for an intro, for one of their published projects."""
    project_id: int = Field(..., ge=1)
    note: str = Field(..., min_length=20, max_length=1000)
