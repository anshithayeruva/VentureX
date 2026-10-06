from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.session import Base


class FounderProfile(Base):
    """Profile details for startup founders."""
    __tablename__ = "founder_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    full_name = Column(String(255), nullable=True)
    company_name = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    linkedin_url = Column(String(512), nullable=True)
    website = Column(String(512), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="founder_profile")
    projects = relationship("Project", back_populates="founder", cascade="all, delete-orphan")
