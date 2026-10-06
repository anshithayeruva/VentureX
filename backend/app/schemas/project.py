from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    tagline: Optional[str] = None
    description: str = Field(..., min_length=10)
    problem: str = Field(..., min_length=10)
    solution: str = Field(..., min_length=10)
    industry: str = Field(..., min_length=2, max_length=100)
    stage: str = Field(..., min_length=2, max_length=100)
    funding_required: float = Field(..., ge=0)
    business_model: str = Field(..., min_length=2, max_length=100)
    target_market: str = Field(..., min_length=5)
    website: Optional[str] = None
    pitch_deck_url: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


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


class ProjectResponse(ProjectBase):
    id: int
    founder_id: int
    readiness_score: Optional[float] = None
    ai_readiness_breakdown: Optional[Dict[str, Any]] = None
    ai_feedback_summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectInterestCreate(BaseModel):
    project_id: int
    message: Optional[str] = None


class ProjectInterestResponse(BaseModel):
    id: int
    project_id: int
    investor_id: int
    status: str
    message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
