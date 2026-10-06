from datetime import datetime
from typing import Optional
from pydantic import BaseModel, HttpUrl


class FounderProfileBase(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None


class FounderProfileCreate(FounderProfileBase):
    pass


class FounderProfileUpdate(FounderProfileBase):
    pass


class FounderProfileResponse(FounderProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
