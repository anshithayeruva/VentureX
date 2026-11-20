import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.core.auth import CurrentUser, get_current_user, require_founder
from fastapi.responses import Response
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    PublishToggleInput,
    ProjectReadinessResponse,
)
from app.services.project_service import ProjectService
from app.utils.pdf_generator import PDFGenerator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["Projects"])


async def _owned_project(project_id: str, user: CurrentUser):
    """Load a project the signed-in founder owns, or raise 404/403."""
    project = await ProjectService.get_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    if project["founder_id"] != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this project")
    return project


async def _readable_project(project_id: str, user: Optional[CurrentUser]):
    """Published projects are public; drafts are visible only to their founder."""
    project = await ProjectService.get_by_id(project_id)
    if not project or (
        not project["is_published"]
        and project["founder_id"] != "founder-001"  # demo drafts stay browsable
        and (user is None or project["founder_id"] != user.id)
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return project


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project_in: ProjectCreate, user: CurrentUser = Depends(require_founder)):
    """Create and submit a new startup project, automatically evaluating AI readiness."""
    try:
        project = await ProjectService.create(project_in, founder_id=user.id)
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
    user: Optional[CurrentUser] = Depends(get_current_user),
):
    """List startup projects. In investor mode, only published projects are returned."""
    projects = await ProjectService.list_all(
        founder_only=founder_only,
        founder_id=user.id if user and user.is_founder else None,
        industry=industry,
        search=search,
        skip=skip,
        limit=limit,
    )
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, user: Optional[CurrentUser] = Depends(get_current_user)):
    """Retrieve details of a specific startup project by ID."""
    return await _readable_project(project_id, user)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_in: ProjectUpdate,
    user: CurrentUser = Depends(require_founder),
):
    """Update details of a startup project."""
    await _owned_project(project_id, user)
    updated = await ProjectService.update(project_id, project_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return updated


@router.patch("/{project_id}/publish", response_model=ProjectResponse)
async def toggle_project_publish(
    project_id: str,
    toggle_in: PublishToggleInput,
    user: CurrentUser = Depends(require_founder),
):
    """Toggle publication status of a project between private draft and syndicate visibility."""
    await _owned_project(project_id, user)
    updated = await ProjectService.toggle_publish(project_id, toggle_in.is_published)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return updated


@router.get("/{project_id}/readiness", response_model=ProjectReadinessResponse)
async def get_project_readiness_report(
    project_id: str,
    user: Optional[CurrentUser] = Depends(get_current_user),
):
    """Retrieve the confidential AI readiness diagnostic report for a project."""
    await _readable_project(project_id, user)
    report = await ProjectService.get_readiness_report(project_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return report


@router.post("/{project_id}/re-evaluate", response_model=ProjectReadinessResponse)
async def re_evaluate_project_readiness(project_id: str, user: CurrentUser = Depends(require_founder)):
    """Recalculate AI readiness diagnostic scores."""
    await _owned_project(project_id, user)
    report = await ProjectService.re_evaluate_readiness(project_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return report


@router.get("/{project_id}/export-report")
async def export_project_readiness_pdf(
    project_id: str,
    user: Optional[CurrentUser] = Depends(get_current_user),
):
    """Generate and download a branded, investor-ready AI Pitch Readiness Diagnostic Report PDF."""
    project = await _readable_project(project_id, user)

    try:
        pdf_bytes = PDFGenerator.generate_readiness_pdf(project)
        title_slug = (project.get("title") or "Startup").replace(" ", "_")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="VentureX_Readiness_Report_{title_slug}.pdf"'
            },
        )
    except Exception as e:
        logger.error("Failed to generate readiness PDF for project %s: %s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not generate readiness PDF: {str(e)}",
        )
