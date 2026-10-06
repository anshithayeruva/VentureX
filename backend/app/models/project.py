from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database.session import Base


class Project(Base):
    """Startup project submission with detailed metadata and future AI hook fields."""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    founder_id = Column(Integer, ForeignKey("founder_profiles.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False, index=True)
    tagline = Column(String(512), nullable=True)
    description = Column(Text, nullable=False)
    problem = Column(Text, nullable=False)
    solution = Column(Text, nullable=False)
    industry = Column(String(100), nullable=False, index=True)
    stage = Column(String(100), nullable=False)             # e.g., Idea, Prototype, MVP, Early Traction, Scaling
    funding_required = Column(Float, nullable=False)        # in USD
    business_model = Column(String(100), nullable=False)    # e.g., B2B SaaS, Marketplace, D2C
    target_market = Column(Text, nullable=False)            # description of ideal customer profile
    website = Column(String(512), nullable=True)
    pitch_deck_url = Column(String(512), nullable=True)     # Future AWS S3 document URL

    # Future AI / ML extensions (Ready for pgvector and analysis services)
    # vector_embedding = Column(Vector(768), nullable=True)
    readiness_score = Column(Float, nullable=True)          # Score 0.0 - 100.0 from AI analysis
    ai_readiness_breakdown = Column(JSON, nullable=True)    # Detailed scores for market, tech, traction
    ai_feedback_summary = Column(Text, nullable=True)       # Recommendations & missing info from AI

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    founder = relationship("FounderProfile", back_populates="projects")
    interests = relationship("ProjectInvestorInterest", back_populates="project", cascade="all, delete-orphan")


class ProjectInvestorInterest(Base):
    """Connection or expression of interest between an investor and a project."""
    __tablename__ = "project_investor_interests"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    investor_id = Column(Integer, ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    
    status = Column(String(50), default="interested", nullable=False)  # interested, connected, under_review, declined
    message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="interests")
    investor = relationship("InvestorProfile", back_populates="interests")
