from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import require_current_user
from app.models.user import User
from app.schemas.investor import (
    InvestorProfileResponse,
    InvestorProfileUpdate,
    InvestorPreferenceResponse,
    InvestorPreferenceUpdate,
)
from app.services.investor_service import InvestorService

router = APIRouter(prefix="/investors", tags=["Investors"])


@router.get("/profile", response_model=InvestorProfileResponse)
def get_investor_profile(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve the current investor's profile."""
    profile = InvestorService.get_or_create(db, current_user.id)
    return profile


@router.put("/profile", response_model=InvestorProfileResponse)
def update_investor_profile(
    profile_in: InvestorProfileUpdate,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """Update current investor's profile."""
    updated = InvestorService.update_profile(db, current_user.id, profile_in)
    return updated


@router.get("/preferences", response_model=InvestorPreferenceResponse)
def get_preferences(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve the current investor's investment preferences."""
    profile = InvestorService.get_or_create(db, current_user.id)
    pref = InvestorService.get_or_create_preference(db, profile.id)
    return pref


@router.put("/preferences", response_model=InvestorPreferenceResponse)
def update_preferences(
    pref_in: InvestorPreferenceUpdate,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """Update investment preferences (industries, stages, check sizes, geography)."""
    profile = InvestorService.get_or_create(db, current_user.id)
    pref = InvestorService.update_preference(db, profile.id, pref_in)
    return pref


@router.get("", response_model=List[InvestorProfileResponse])
def list_investors(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """List registered investor profiles."""
    investors = InvestorService.list_all(db, skip=skip, limit=limit)
    return investors


@router.get("/{investor_id}", response_model=InvestorProfileResponse)
def get_investor(investor_id: int, db: Session = Depends(get_db)):
    """Retrieve public profile of a specific investor."""
    investor = InvestorService.get_by_id(db, investor_id)
    if not investor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investor with ID {investor_id} not found"
        )
    return investor
