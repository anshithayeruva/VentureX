from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.investor import InvestorProfile, InvestorPreference
from app.schemas.investor import InvestorProfileUpdate, InvestorPreferenceUpdate


class InvestorService:
    """Business operations for Investor profiles and investment preferences."""

    @staticmethod
    def get_by_user_id(db: Session, user_id: int) -> Optional[InvestorProfile]:
        return db.query(InvestorProfile).filter(InvestorProfile.user_id == user_id).first()

    @staticmethod
    def get_or_create(db: Session, user_id: int) -> InvestorProfile:
        profile = db.query(InvestorProfile).filter(InvestorProfile.user_id == user_id).first()
        if not profile:
            profile = InvestorProfile(user_id=user_id)
            db.add(profile)
            db.commit()
            db.refresh(profile)
            
            # Ensure preferences row exists
            pref = InvestorPreference(investor_id=profile.id)
            db.add(pref)
            db.commit()
            db.refresh(profile)
        return profile

    @staticmethod
    def update_profile(db: Session, user_id: int, data: InvestorProfileUpdate) -> InvestorProfile:
        profile = InvestorService.get_or_create(db, user_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)
        db.commit()
        db.refresh(profile)
        return profile

    @staticmethod
    def list_all(db: Session, skip: int = 0, limit: int = 50) -> List[InvestorProfile]:
        return db.query(InvestorProfile).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, investor_id: int) -> Optional[InvestorProfile]:
        return db.query(InvestorProfile).filter(InvestorProfile.id == investor_id).first()

    @staticmethod
    def get_or_create_preference(db: Session, investor_id: int) -> InvestorPreference:
        pref = db.query(InvestorPreference).filter(InvestorPreference.investor_id == investor_id).first()
        if not pref:
            pref = InvestorPreference(investor_id=investor_id)
            db.add(pref)
            db.commit()
            db.refresh(pref)
        return pref

    @staticmethod
    def update_preference(db: Session, investor_id: int, data: InvestorPreferenceUpdate) -> InvestorPreference:
        pref = InvestorService.get_or_create_preference(db, investor_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(pref, field, value)
        db.commit()
        db.refresh(pref)
        return pref
