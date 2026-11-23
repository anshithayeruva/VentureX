from datetime import datetime
from typing import Optional, Dict, Any, List, Literal, Union
from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    tagline: Optional[str] = None
    description: str = Field(..., min_length=5)
    problem: str = Field(..., min_length=5)
    solution: str = Field(..., min_length=5)
    industry: str = Field(..., min_length=2, max_length=100)
    stage: str = Field(..., min_length=2, max_length=100)
    funding_required: float = Field(..., ge=0)
    business_model: str = Field(..., min_length=2, max_length=100)
    target_market: str = Field(..., min_length=3)
    website: Optional[str] = None
    pitch_deck_url: Optional[str] = None
    github_url: Optional[str] = Field(None, max_length=300)
    demo_url: Optional[str] = Field(None, max_length=500)
    # Optional, self-reported facts investors can filter on.
    country: Optional[str] = Field(None, max_length=80)
    city: Optional[str] = Field(None, max_length=80)
    monthly_revenue: Optional[float] = Field(None, ge=0, le=1e12)
    customer_count: Optional[int] = Field(None, ge=0, le=1_000_000_000)
    product_status: Optional[Literal["", "idea", "prototype", "beta", "launched", "scaling"]] = None
    team_size: Optional[int] = Field(None, ge=1, le=100_000)
    technical_founder: Optional[bool] = None
    repeat_founder: Optional[bool] = None
    domain_expertise: Optional[bool] = None
    full_time_team: Optional[bool] = None
    ip_protected: Optional[bool] = None


class ProjectCreate(ProjectBase):
    is_published: bool = False


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    problem: Optional[str] = None
    solution: Optional[str] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    funding_required: Optional[float] = None
    business_model: Optional[str] = None
    target_market: Optional[str] = None
    website: Optional[str] = None
    pitch_deck_url: Optional[str] = None
    github_url: Optional[str] = Field(None, max_length=300)
    demo_url: Optional[str] = Field(None, max_length=500)
    country: Optional[str] = Field(None, max_length=80)
    city: Optional[str] = Field(None, max_length=80)
    monthly_revenue: Optional[float] = Field(None, ge=0, le=1e12)
    customer_count: Optional[int] = Field(None, ge=0, le=1_000_000_000)
    product_status: Optional[Literal["", "idea", "prototype", "beta", "launched", "scaling"]] = None
    team_size: Optional[int] = Field(None, ge=1, le=100_000)
    technical_founder: Optional[bool] = None
    repeat_founder: Optional[bool] = None
    domain_expertise: Optional[bool] = None
    full_time_team: Optional[bool] = None
    ip_protected: Optional[bool] = None
    is_published: Optional[bool] = None


class ProjectResponse(ProjectBase):
    id: Union[int, str]
    company_verified: Optional[bool] = None
    founder_id: Optional[Union[int, str]] = None
    is_published: bool = False
    readiness_score: Optional[float] = None
    ai_readiness_breakdown: Optional[Dict[str, Any]] = None
    ai_feedback_summary: Optional[str] = None
    strengths: Optional[List[str]] = None
    recommendations: Optional[List[str]] = None
    created_at: Optional[Union[datetime, str]] = None
    updated_at: Optional[Union[datetime, str]] = None

    class Config:
        from_attributes = True


class PublishToggleInput(BaseModel):
    is_published: bool


class ProjectReadinessResponse(BaseModel):
    project_id: Union[int, str]
    title: str
    readiness_score: float
    model_version: str
    status_label: str
    dimensions: List[Dict[str, Any]]
    strengths: List[str]
    recommendations: List[str]
    is_confidential: bool = True
    # AI project intelligence (latest analysis)
    engine: Optional[str] = None            # "claude" | "rules" | None (never analyzed)
    is_ai_generated: bool = False
    summary: Optional[str] = None
    gaps: List[Dict[str, Any]] = []
    suggestions: List[Dict[str, Any]] = []
    industry_insights: List[str] = []
    inputs: Optional[Dict[str, Any]] = None
    analyzed_at: Optional[datetime] = None
    analysis_id: Optional[int] = None
    ai_readiness_breakdown: Optional[Dict[str, Any]] = None
    ai_feedback_summary: Optional[str] = None


class ProjectDocumentResponse(BaseModel):
    id: int
    project_id: int
    category: str
    original_name: str
    url: str
    content_type: str
    size_bytes: int
    page_count: Optional[int] = None
    text_chars: int = 0
    extraction_note: Optional[str] = None
    created_at: datetime


class AnalysisHistoryItem(BaseModel):
    id: int
    engine: str
    model: Optional[str] = None
    overall_score: float
    status_label: str
    dimensions: List[Dict[str, Any]]
    created_at: datetime
