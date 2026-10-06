from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import require_current_user
from app.models.user import User
from app.schemas.founder import FounderProfileUpdate, FounderProfileResponse
from app.services.founder_service import FounderService

router = APIRouter(prefix="/founders", tags=["Founders"])


@router.get("/profile", response_model=FounderProfileResponse)
def get_founder_profile(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve the current founder's profile."""
    profile = FounderService.get_or_create(db, current_user.id)
    return profile


@router.put("/profile", response_model=FounderProfileResponse)
def update_founder_profile(
    profile_in: FounderProfileUpdate,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """Update the current founder's profile details."""
    updated = FounderService.update(db, current_user.id, profile_in)
    return updated
