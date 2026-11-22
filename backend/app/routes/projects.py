import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, status, Query, UploadFile
from app.core.auth import CurrentUser, get_current_user, require_founder, require_user
from app.core.rate_limit import rate_limit
from fastapi.responses import FileResponse, Response
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    PublishToggleInput,
    ProjectReadinessResponse,
    ProjectDocumentResponse,
    AnalysisHistoryItem,
)
from app.services.analysis_service import AnalysisError, AnalysisService
from app.services.document_service import DocumentService
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
        and (user is None or project["founder_id"] != user.id)
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return project


# Readiness scores and AI feedback are private to the founder who owns the project.
_PRIVATE_FIELDS = ("readiness_score", "ai_readiness_breakdown", "ai_feedback_summary", "strengths", "recommendations")


def _public_view(project: dict, user: Optional[CurrentUser]) -> dict:
    """A project as someone other than its founder may see it."""
    if user is not None and project.get("founder_id") == user.id:
        return project
    return {**project, **{k: None for k in _PRIVATE_FIELDS}}


async def _private_report_project(project_id: str, user: Optional[CurrentUser]):
    """Readiness reports are private to the project's founder (404 for everyone else)."""
    project = await ProjectService.get_by_id(project_id)
    if not project or user is None or project["founder_id"] != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return project


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(rate_limit("create_project", 20, 3600))])
async def create_project(project_in: ProjectCreate, user: CurrentUser = Depends(require_founder)):
    """Create and submit a new startup project, automatically evaluating AI readiness."""
    try:
        project = await ProjectService.create(project_in, founder_id=user.id)
        return project
    except Exception as e:
        logger.error("Failed to create project: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create project. Please try again.",
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
    return [_public_view(p, user) for p in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, user: Optional[CurrentUser] = Depends(get_current_user)):
    """Retrieve details of a specific startup project by ID."""
    return _public_view(await _readable_project(project_id, user), user)


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
    """Retrieve the confidential AI readiness report for a project (founder only)."""
    await _private_report_project(project_id, user)
    report = await ProjectService.get_readiness_report(project_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found",
        )
    return report


@router.post("/{project_id}/re-evaluate", response_model=ProjectReadinessResponse,
             dependencies=[Depends(rate_limit("analyze", 10, 3600))])
async def re_evaluate_project_readiness(project_id: str, user: CurrentUser = Depends(require_founder)):
    """Re-run the readiness analysis (same as POST /analyze; kept for existing clients)."""
    await _owned_project(project_id, user)
    try:
        report = await ProjectService.re_evaluate_readiness(project_id)
    except AnalysisError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
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
    project = await _private_report_project(project_id, user)

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
            detail="Could not generate readiness PDF. Please try again.",
        )


# ---------------------------------------------------------------------------
# AI project intelligence: materials and analysis
# ---------------------------------------------------------------------------

@router.post(
    "/{project_id}/documents",
    response_model=ProjectDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("upload", 60, 3600))],
)
async def upload_project_document(
    project_id: str,
    file: UploadFile = File(...),
    category: str = Form("supporting_document"),
    user: CurrentUser = Depends(require_founder),
):
    """Upload a pitch deck, business plan, research or other material (PDF, DOCX, PPTX, TXT, MD, CSV, PNG, JPG)."""
    project = await _owned_project(project_id, user)
    try:
        return await DocumentService.save(project["id"], file, category)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{project_id}/documents", response_model=List[ProjectDocumentResponse])
async def list_project_documents(project_id: str, user: CurrentUser = Depends(require_user)):
    """List a project's materials (signed-in users only; others see them once it is published)."""
    project = await _readable_project(project_id, user)
    return await DocumentService.list(project["id"])


@router.get("/{project_id}/documents/{doc_id}/file")
async def download_project_document(
    project_id: str,
    doc_id: int,
    user: CurrentUser = Depends(require_user),
):
    """Download one of a project's materials (signed-in users only)."""
    project = await _readable_project(project_id, user)
    found = await DocumentService.file_path(project["id"], doc_id)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    path, content_type, name = found
    return FileResponse(path, media_type=content_type, filename=name)


@router.delete("/{project_id}/documents/{doc_id}", status_code=status.HTTP_200_OK)
async def delete_project_document(project_id: str, doc_id: int, user: CurrentUser = Depends(require_founder)):
    """Remove one of your project's materials."""
    project = await _owned_project(project_id, user)
    if not await DocumentService.delete(project["id"], doc_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return {"status": "deleted", "id": doc_id}


@router.post("/{project_id}/analyze", response_model=ProjectReadinessResponse,
             dependencies=[Depends(rate_limit("analyze", 10, 3600))])
async def analyze_project(project_id: str, user: CurrentUser = Depends(require_founder)):
    """Analyze the project's profile, materials and repository; returns the new readiness report."""
    project = await _owned_project(project_id, user)
    try:
        await AnalysisService.analyze(project)
    except AnalysisError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return await ProjectService.get_readiness_report(project["id"])


@router.get("/{project_id}/analyses", response_model=List[AnalysisHistoryItem])
async def list_project_analyses(project_id: str, user: Optional[CurrentUser] = Depends(get_current_user)):
    """Readiness analysis history, newest first (founder only)."""
    project = await _private_report_project(project_id, user)
    return await AnalysisService.history(project["id"])
