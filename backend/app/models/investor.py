from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database.session import Base


class InvestorProfile(Base):
    """Profile details for angel investors, VCs, and syndicates."""
    __tablename__ = "investor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    full_name = Column(String(255), nullable=True)
    firm_name = Column(String(255), nullable=True)
    title = Column(String(255), nullable=True)  # Partner, Angel, Principal, etc.
    bio = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    linkedin_url = Column(String(512), nullable=True)
    website = Column(String(512), nullable=True)
    investment_thesis = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="investor_profile")
    preference = relationship("InvestorPreference", back_populates="investor", uselist=False, cascade="all, delete-orphan")
    interests = relationship("ProjectInvestorInterest", back_populates="investor", cascade="all, delete-orphan")


class InvestorPreference(Base):
    """Investment criteria and matching preferences."""
    __tablename__ = "investor_preferences"

    id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investor_profiles.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Criteria stored as structured JSON or delimited strings for flexible querying
    preferred_industries = Column(JSON, default=list, nullable=False)  # e.g. ["Fintech", "AI/ML", "B2B SaaS"]
    preferred_stages = Column(JSON, default=list, nullable=False)      # e.g. ["Pre-seed", "Seed", "Series A"]
    min_investment = Column(Float, nullable=True, default=10000.0)
    max_investment = Column(Float, nullable=True, default=250000.0)
    preferred_business_models = Column(JSON, default=list, nullable=False)  # e.g. ["SaaS", "Marketplace"]
    geography = Column(String(255), nullable=True, default="Global")
    tech_preferences = Column(JSON, default=list, nullable=False)   # e.g. ["LLMs", "Computer Vision"]

    # Extension point for future pgvector preferences embedding:
    # preference_embedding = Column(Vector(768), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    investor = relationship("InvestorProfile", back_populates="preference")
