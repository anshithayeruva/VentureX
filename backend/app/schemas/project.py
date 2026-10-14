from datetime import datetime
from typing import Optional, Dict, Any, List, Union
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
    is_published: Optional[bool] = None


class ProjectResponse(ProjectBase):
    id: Union[int, str]
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
    model_version: str = "Readiness Engine v2.4"
    status_label: str = "Ready for Investor Presentation"
    dimensions: List[Dict[str, Any]]
    strengths: List[str]
    recommendations: List[str]
    is_confidential: bool = True
