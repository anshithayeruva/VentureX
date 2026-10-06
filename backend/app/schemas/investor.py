from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class InvestorPreferenceBase(BaseModel):
    preferred_industries: List[str] = []
    preferred_stages: List[str] = []
    min_investment: Optional[float] = 10000.0
    max_investment: Optional[float] = 250000.0
    preferred_business_models: List[str] = []
    geography: Optional[str] = "Global"
    tech_preferences: List[str] = []


class InvestorPreferenceCreate(InvestorPreferenceBase):
    pass


class InvestorPreferenceUpdate(InvestorPreferenceBase):
    pass


class InvestorPreferenceResponse(InvestorPreferenceBase):
    id: int
    investor_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InvestorProfileBase(BaseModel):
    full_name: Optional[str] = None
    firm_name: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    investment_thesis: Optional[str] = None


class InvestorProfileCreate(InvestorProfileBase):
    pass


class InvestorProfileUpdate(InvestorProfileBase):
    pass


class InvestorProfileResponse(InvestorProfileBase):
    id: int
    user_id: int
    preference: Optional[InvestorPreferenceResponse] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
