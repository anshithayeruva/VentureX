from datetime import datetime
from typing import Optional, List, Union, Dict, Any
from pydantic import BaseModel, Field


class InvestorPreferenceBase(BaseModel):
    preferred_industries: List[str] = Field(default_factory=list)
    preferred_stages: List[str] = Field(default_factory=list)
    min_investment: float = 500000.0
    max_investment: float = 1500000.0
    preferred_business_models: List[str] = Field(default_factory=list)
    geography: str = "North America & Europe"
    tech_preferences: List[str] = Field(default_factory=list)


class InvestorPreferenceUpdate(BaseModel):
    preferred_industries: Optional[List[str]] = None
    preferred_stages: Optional[List[str]] = None
    min_investment: Optional[float] = None
    max_investment: Optional[float] = None
    preferred_business_models: Optional[List[str]] = None
    geography: Optional[str] = None
    tech_preferences: Optional[List[str]] = None


class InvestorPreferenceCreate(InvestorPreferenceBase):
    pass


class InvestorPreferenceResponse(InvestorPreferenceBase):
    id: Optional[Union[int, str]] = None
    investor_id: Optional[Union[int, str]] = None
    created_at: Optional[Union[datetime, str]] = None
    updated_at: Optional[Union[datetime, str]] = None


class InvestorSettings(BaseModel):
    autoNotifyHighConviction: bool = Field(default=True, alias="auto_notify_high_conviction")
    weeklyDealflowSummary: bool = Field(default=True, alias="weekly_dealflow_summary")
    directFounderMessaging: bool = Field(default=True, alias="direct_founder_messaging")

    class Config:
        populate_by_name = True


class InvestorProfileBase(BaseModel):
    name: Optional[str] = Field(None, alias="full_name")
    firm: Optional[str] = Field(None, alias="firm_name")
    title: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    thesis: Optional[str] = Field(None, alias="investment_thesis")
    minCheck: Optional[Union[str, float]] = Field(None, alias="min_check")
    maxCheck: Optional[Union[str, float]] = Field(None, alias="max_check")

    class Config:
        populate_by_name = True


class InvestorProfileUpdate(InvestorProfileBase):
    pass


class InvestorProfileCreate(InvestorProfileBase):
    pass


class InvestorProfileResponse(InvestorProfileBase):
    id: Optional[Union[int, str]] = None
    user_id: Optional[Union[int, str]] = None
    preference: Optional[InvestorPreferenceResponse] = None
    settings: Optional[InvestorSettings] = None
    created_at: Optional[Union[datetime, str]] = None
    updated_at: Optional[Union[datetime, str]] = None

    class Config:
        populate_by_name = True
