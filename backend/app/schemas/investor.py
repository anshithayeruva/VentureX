from datetime import datetime
from typing import Optional, List, Union, Dict, Any
from pydantic import BaseModel, Field, field_validator

from app.schemas.thesis import InvestmentThesis


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
    # The structured thesis (criteria page). When given, it is the source of truth and
    # the flat fields above are derived from it.
    thesis: Optional[InvestmentThesis] = None


class InvestorPreferenceCreate(InvestorPreferenceBase):
    pass


class InvestorPreferenceResponse(InvestorPreferenceBase):
    id: Optional[Union[int, str]] = None
    investor_id: Optional[Union[int, str]] = None
    thesis: Optional[Dict[str, Any]] = None
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
    # Shown to founders on the investor's profile in the founder directory.
    valueAdd: Optional[str] = Field(None, alias="value_add", max_length=1500)
    portfolio: Optional[List["PortfolioEntry"]] = Field(None, max_length=50)
    listedForFounders: Optional[bool] = Field(None, alias="listed_for_founders")

    class Config:
        populate_by_name = True


class PortfolioEntry(BaseModel):
    """A past investment the investor chooses to show founders."""
    company: str = Field(..., min_length=1, max_length=120)
    stage: Optional[str] = Field(None, max_length=40)
    year: Optional[int] = Field(None, ge=1980, le=2100)
    url: Optional[str] = Field(None, max_length=300)


InvestorProfileBase.model_rebuild()


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


# ---------------------------------------------------------------- discovery & deal flow


class DiscoverItem(BaseModel):
    """A published startup as an investor sees it in Discover: public facts plus their own fit."""
    id: int
    title: str
    tagline: Optional[str] = None
    description: str
    industry: str
    stage: str
    funding_required: float
    business_model: str
    target_market: str
    website: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    monthly_revenue: Optional[float] = None
    customer_count: Optional[int] = None
    product_status: Optional[str] = None
    team_size: Optional[int] = None
    technical_founder: Optional[bool] = None
    repeat_founder: Optional[bool] = None
    domain_expertise: Optional[bool] = None
    full_time_team: Optional[bool] = None
    ip_protected: Optional[bool] = None
    created_at: Optional[datetime] = None
    match_score: Optional[float] = None
    reasons: List[Dict[str, Any]] = Field(default_factory=list)
    saved: bool = False
    interest_id: Optional[str] = None
    interest_status: Optional[str] = None
    interest_initiated_by: Optional[str] = None
    company_verified: bool = False
    has_logo: bool = False
    problem: Optional[str] = None
    solution: Optional[str] = None
    demo_url: Optional[str] = None
    # The startup's open funding round: name, type, instrument, target, tickets, and progress if disclosed.
    open_round: Optional[Dict[str, Any]] = None
    # Partners in your firm already pursuing this startup: [{name, status, initiated_by}]
    partners: List[Dict[str, Any]] = Field(default_factory=list)
    room_id: Optional[str] = None
    deal_stage: Optional[str] = None

    @field_validator("reasons", mode="before")
    @classmethod
    def _reasons(cls, v):  # no match row -> NULL
        return v or []


class DiscoverFacets(BaseModel):
    industries: List[str] = Field(default_factory=list)
    business_models: List[str] = Field(default_factory=list)
    countries: List[str] = Field(default_factory=list)


class DiscoverPage(BaseModel):
    items: List[DiscoverItem]
    total: int
    page: int
    page_size: int
    facets: DiscoverFacets
    criteria_set: bool = True


class DealFlowItem(BaseModel):
    project_id: int
    title: str
    industry: Optional[str] = None
    stage: Optional[str] = None
    funding_required: Optional[float] = None
    tagline: Optional[str] = None
    status: str  # saved | inbound | requested | active | closed | declined | passed | expired
    saved: bool = False
    interest_id: Optional[str] = None
    interest_status: Optional[str] = None
    initiated_by: Optional[str] = None
    pass_reason: Optional[str] = None
    message: Optional[str] = None
    response_note: Optional[str] = None
    founder_email: Optional[str] = None
    requested_at: Optional[datetime] = None
    room_id: Optional[str] = None
    deal_stage: Optional[str] = None
    founder_name: Optional[str] = None
    founder_company: Optional[str] = None
    last_message: Optional[str] = None
    messages_count: Optional[int] = None
    last_activity: Optional[datetime] = None
    investment_id: Optional[int] = None


class DealFlow(BaseModel):
    items: List[DealFlowItem]
    counts: Dict[str, int]


class CriteriaOptions(BaseModel):
    stages: List[str]
    regions: List[str]
    countries: List[str]
    instruments: List[str]
