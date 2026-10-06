from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.founder import FounderProfile
from app.models.investor import InvestorProfile, InvestorPreference
from app.core.security import get_password_hash, verify_password, create_access_token
from app.schemas.auth import UserRegister, UserLogin, Token


class AuthService:
    """Handles user registration, authentication, and token issuance."""

    @staticmethod
    def register(db: Session, user_in: UserRegister) -> User:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_in.email).first()
        if existing_user:
            raise ValueError("Email is already registered")

        # Create user
        new_user = User(
            email=user_in.email,
            password_hash=get_password_hash(user_in.password),
            role=user_in.role,
        )
        db.add(new_user)
        db.flush()

        # Initialize corresponding role profile
        if new_user.role == UserRole.FOUNDER:
            founder_prof = FounderProfile(user_id=new_user.id)
            db.add(founder_prof)
        elif new_user.role == UserRole.INVESTOR:
            investor_prof = InvestorProfile(user_id=new_user.id)
            db.add(investor_prof)
            db.flush()
            pref = InvestorPreference(investor_id=investor_prof.id)
            db.add(pref)

        db.commit()
        db.refresh(new_user)
        return new_user

    @staticmethod
    def authenticate(db: Session, login_in: UserLogin) -> Optional[Token]:
        user = db.query(User).filter(User.email == login_in.email).first()
        if not user or not verify_password(login_in.password, user.password_hash):
            return None

        access_token = create_access_token(
            subject=user.id,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
        )
        return Token(
            access_token=access_token,
            token_type="bearer",
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            user_id=user.id,
        )
