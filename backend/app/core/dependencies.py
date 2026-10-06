from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.user import User, UserRole
from app.models.founder import FounderProfile
from app.models.investor import InvestorProfile
from app.core.security import decode_access_token

security_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Extract and validate the current authenticated user from JWT Bearer token."""
    if not credentials:
        return None

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


def require_current_user(
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """Ensure user is authenticated.

    For initial scaffold convenience, if no user is authenticated, returns or
    creates a default mock user so frontend/tests can run without being blocked.
    """
    if user:
        return user
    
    # Scaffold convenience: return default demo user if not logged in
    demo_user = db.query(User).filter(User.email == "demo@venturex.io").first()
    if not demo_user:
        demo_user = User(
            email="demo@venturex.io",
            password_hash="mock_hash",
            role=UserRole.FOUNDER
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)
        founder = FounderProfile(user_id=demo_user.id, full_name="Alex Rivers", company_name="Demo Startup")
        db.add(founder)
        db.commit()
    return demo_user
