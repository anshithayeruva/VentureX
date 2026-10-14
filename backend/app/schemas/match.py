from typing import List, Optional, Union
from pydantic import BaseModel


class MatchReason(BaseModel):
    category: str
    explanation: str
    weight: float


class MatchResponse(BaseModel):
    id: str
    project_id: Union[int, str]
    project_title: str
    investor_id: Union[int, str]
    investor_name: str
    investor_firm: Optional[str] = None
    match_score: float
    reasons: List[MatchReason] = []
    status: str = "recommended"
