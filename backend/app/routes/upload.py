import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from app.core.auth import CurrentUser, require_user
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["File Storage & Uploads"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    category: str = Form("general"),
    user: CurrentUser = Depends(require_user),
):
    """Upload a pitch deck, financial model, cap table, or deal room attachment.

    Accepts PDF, DOCX, PPTX, XLSX, CSV, PNG, JPG up to 25MB.
    """
    try:
        result = await StorageService.save_upload(file, category=category)
        return result
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as e:
        logger.error("File upload failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload processing error: {str(e)}",
        )
