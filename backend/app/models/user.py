import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.orm import relationship
from app.database.session import Base


class UserRole(str, enum.Enum):
    FOUNDER = "FOUNDER"
    INVESTOR = "INVESTOR"
    ADMIN = "ADMIN"


class User(Base):
    """Core User model with authentication details and role-based access."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.FOUNDER)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    founder_profile = relationship("FounderProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    investor_profile = relationship("InvestorProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
