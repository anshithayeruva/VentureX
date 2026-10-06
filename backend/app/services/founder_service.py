from typing import Optional
from sqlalchemy.orm import Session
from app.models.founder import FounderProfile
from app.schemas.founder import FounderProfileUpdate


class FounderService:
    """Business operations for Founder profiles."""

    @staticmethod
    def get_by_user_id(db: Session, user_id: int) -> Optional[FounderProfile]:
        return db.query(FounderProfile).filter(FounderProfile.user_id == user_id).first()

    @staticmethod
    def get_or_create(db: Session, user_id: int) -> FounderProfile:
        profile = db.query(FounderProfile).filter(FounderProfile.user_id == user_id).first()
        if not profile:
            profile = FounderProfile(user_id=user_id)
            db.add(profile)
            db.commit()
            db.refresh(profile)
        return profile

    @staticmethod
    def update(db: Session, user_id: int, data: FounderProfileUpdate) -> FounderProfile:
        profile = FounderService.get_or_create(db, user_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)
        db.commit()
        db.refresh(profile)
        return profile
