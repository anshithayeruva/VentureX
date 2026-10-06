from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import require_current_user
from app.models.user import User
from app.schemas.match import MatchResponse
from app.services.ai.matching import MatchingEngineService

router = APIRouter(prefix="/matches", tags=["Matches (AI Placeholder)"])


@router.get("", response_model=List[MatchResponse])
def get_matches(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve recommended AI-generated matches.

    NOTE: Returns explainable match placeholders.
    The real ML model (Sentence Transformers + pgvector similarity)
    will be integrated in the upcoming AI phase.
    """
    matches_data = MatchingEngineService.get_matches_for_user(
        user_id=current_user.id,
        role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return matches_data
