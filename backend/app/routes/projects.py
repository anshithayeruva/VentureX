from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.dependencies import require_current_user
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.services.project_service import ProjectService
from app.services.founder_service import FounderService

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """Create and submit a new startup project."""
    founder = FounderService.get_or_create(db, current_user.id)
    project = ProjectService.create(db, founder_id=founder.id, data=project_in)
    return project


@router.get("", response_model=List[ProjectResponse])
def list_projects(
    industry: Optional[str] = Query(None, description="Filter projects by industry"),
    founder_only: bool = Query(False, description="Filter projects owned by current user"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """List startup projects with optional filtering."""
    founder_id = None
    if founder_only:
        founder = FounderService.get_or_create(db, current_user.id)
        founder_id = founder.id

    projects = ProjectService.list_all(
        db,
        founder_id=founder_id,
        industry=industry,
        skip=skip,
        limit=limit
    )
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Retrieve details of a specific startup project by ID."""
    project = ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """Update a startup project."""
    project = ProjectService.update(db, project_id, project_in)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """Delete a startup project."""
    success = ProjectService.delete(db, project_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )
    return None
