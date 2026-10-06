from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services.ai.project_analysis import ProjectAnalysisService


class ProjectService:
    """Business operations for Startup Projects."""

    @staticmethod
    def create(db: Session, founder_id: int, data: ProjectCreate) -> Project:
        project_dict = data.model_dump()
        
        # Trigger future AI Project Readiness Analysis hook
        ai_readiness = ProjectAnalysisService.analyze_readiness(project_dict)
        
        project = Project(
            founder_id=founder_id,
            **project_dict,
            readiness_score=ai_readiness.get("overall_score"),
            ai_readiness_breakdown=ai_readiness.get("breakdown"),
            ai_feedback_summary="\n".join(ai_readiness.get("recommendations", [])),
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def list_all(
        db: Session,
        founder_id: Optional[int] = None,
        industry: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[Project]:
        query = db.query(Project)
        if founder_id:
            query = query.filter(Project.founder_id == founder_id)
        if industry:
            query = query.filter(Project.industry.ilike(f"%{industry}%"))
        return query.order_by(Project.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, project_id: int) -> Optional[Project]:
        return db.query(Project).filter(Project.id == project_id).first()

    @staticmethod
    def update(db: Session, project_id: int, data: ProjectUpdate) -> Optional[Project]:
        project = ProjectService.get_by_id(db, project_id)
        if not project:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(project, field, value)
            
        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def delete(db: Session, project_id: int) -> bool:
        project = ProjectService.get_by_id(db, project_id)
        if not project:
            return False
        db.delete(project)
        db.commit()
        return True
