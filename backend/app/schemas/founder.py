from datetime import datetime
from typing import Optional, Union, Dict, Any
from pydantic import BaseModel, Field


class FounderSettings(BaseModel):
    defaultPrivate: bool = Field(default=True, alias="default_private")
    hideGapsFromInvestors: bool = Field(default=True, alias="hide_gaps_from_investors")
    emailAlerts: bool = Field(default=True, alias="email_alerts")
    weeklyDigest: bool = Field(default=False, alias="weekly_digest")

    class Config:
        populate_by_name = True


class FounderProfileBase(BaseModel):
    name: Optional[str] = Field(None, alias="full_name")
    company: Optional[str] = Field(None, alias="company_name")
    bio: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = Field(None, alias="linkedin_url")
    website: Optional[str] = None

    class Config:
        populate_by_name = True


class FounderProfileUpdate(FounderProfileBase):
    pass


class FounderProfileCreate(FounderProfileBase):
    pass


class FounderProfileResponse(FounderProfileBase):
    id: Optional[Union[int, str]] = None
    user_id: Optional[Union[int, str]] = None
    settings: Optional[FounderSettings] = None
    created_at: Optional[Union[datetime, str]] = None
    updated_at: Optional[Union[datetime, str]] = None

    class Config:
        populate_by_name = True
