import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    PublishToggleInput,
    ProjectReadinessResponse,
)
from app.services.project_service import ProjectService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project_in: ProjectCreate):
    """Create and submit a new startup project, automatically evaluating AI readiness."""
    try:
        project = await ProjectService.create(project_in)
        return project
    except Exception as e:
        logger.error("Failed to create project: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not create project: {str(e)}",
        )


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    industry: Optional[str] = Query(None, description="Filter projects by industry"),
    search: Optional[str] = Query(None, description="Search keyword in title, description, or market"),
    founder_only: bool = Query(False, description="Filter projects owned by founder (shows drafts)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List startup projects. In investor mode, only published projects are returned."""
    projects = await ProjectService.list_all(
        founder_only=founder_only,
        industry=industry,
        search=search,
        skip=skip,
        limit=limit,
    )
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """Retrieve details of a specific startup project by ID."""
    project = await ProjectService.get_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, project_in: ProjectUpdate):
    """Update details of a startup project."""
    updated = await ProjectService.update(project_id, project_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return updated


@router.patch("/{project_id}/publish", response_model=ProjectResponse)
async def toggle_project_publish(project_id: str, toggle_in: PublishToggleInput):
    """Toggle publication status of a project between private draft and syndicate visibility."""
    updated = await ProjectService.toggle_publish(project_id, toggle_in.is_published)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return updated


@router.get("/{project_id}/readiness", response_model=ProjectReadinessResponse)
async def get_project_readiness_report(project_id: str):
    """Retrieve the confidential AI readiness diagnostic report for a project."""
    report = await ProjectService.get_readiness_report(project_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return report


@router.post("/{project_id}/re-evaluate", response_model=ProjectReadinessResponse)
async def re_evaluate_project_readiness(project_id: str):
    """Recalculate AI readiness diagnostic scores."""
    report = await ProjectService.re_evaluate_readiness(project_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return report
