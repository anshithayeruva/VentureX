from typing import List, Optional
from pydantic import BaseModel


class MatchReason(BaseModel):
    category: str  # e.g., "Industry Fit", "Stage Alignment", "Check Size Match"
    explanation: str
    weight: float


class MatchResponse(BaseModel):
    id: str
    project_id: int
    project_title: str
    investor_id: int
    investor_name: str
    investor_firm: Optional[str] = None
    match_score: float  # e.g., 94.5
    reasons: List[MatchReason] = []
    status: str = "recommended"  # recommended, pending, connected
