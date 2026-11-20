import os
import re
import uuid
import logging
from typing import Dict, Any, Optional
from fastapi import UploadFile

logger = logging.getLogger(__name__)

# Base upload directory relative to backend app
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".pptx",
    ".xlsx",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
    ".txt",
}

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25MB limit


class StorageService:
    """Handles secure file uploads, local persistent storage, and basic document metadata extraction."""

    @classmethod
    def get_upload_dir(cls) -> str:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        return UPLOAD_DIR

    @classmethod
    def sanitize_filename(cls, filename: str) -> str:
        # Strip path traversal and non-standard chars
        name = os.path.basename(filename)
        clean = re.sub(r"[^\w\.-]", "_", name)
        return clean or "unnamed_file"

    @classmethod
    async def save_upload(
        cls,
        upload_file: UploadFile,
        category: str = "general",
    ) -> Dict[str, Any]:
        """Save an uploaded file safely, return accessible URL and metadata."""
        original_name = cls.sanitize_filename(upload_file.filename or "uploaded_document")
        _, ext = os.path.splitext(original_name.lower())

        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file type '{ext}'. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )

        unique_prefix = uuid.uuid4().hex[:12]
        stored_filename = f"{unique_prefix}_{original_name}"
        category_dir = os.path.join(cls.get_upload_dir(), category)
        os.makedirs(category_dir, exist_ok=True)

        destination_path = os.path.join(category_dir, stored_filename)

        content = await upload_file.read()
        file_size = len(content)

        if file_size > MAX_FILE_SIZE_BYTES:
            raise ValueError(f"File size exceeds limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.")

        with open(destination_path, "wb") as f:
            f.write(content)

        size_kb = round(file_size / 1024, 1)
        public_url = f"/uploads/{category}/{stored_filename}"

        # Basic document inspection (e.g. for pitch decks)
        extracted_info = cls.extract_document_insights(content, original_name, ext)

        logger.info(
            "Saved uploaded file '%s' (category: %s, size: %.1f KB)",
            original_name,
            category,
            size_kb,
        )

        return {
            "filename": stored_filename,
            "original_name": original_name,
            "category": category,
            "url": public_url,
            "size_kb": size_kb,
            "content_type": upload_file.content_type or "application/octet-stream",
            "insights": extracted_info,
        }

    @classmethod
    def extract_document_insights(
        cls,
        content: bytes,
        filename: str,
        extension: str,
    ) -> Dict[str, Any]:
        """Inspects uploaded deck/model and extracts structural signals."""
        insights = {
            "filename": filename,
            "extension": extension,
            "size_bytes": len(content),
            "estimated_pages": 1,
            "has_financials": False,
            "detected_keywords": [],
        }

        # Quick heuristic scan in content
        try:
            raw_text = content.decode("utf-8", errors="ignore").lower()
            keywords = ["tam", "sam", "som", "cac", "ltv", "arr", "ebitda", "gross margin", "seed", "series a", "runway"]
            detected = [kw.upper() for kw in keywords if kw in raw_text]
            insights["detected_keywords"] = detected
            insights["has_financials"] = any(k in ["CAC", "LTV", "ARR", "EBITDA"] for k in detected)

            if extension == ".pdf":
                # Rough page count estimate from PDF header markers
                page_markers = raw_text.count("/type /page") or raw_text.count("/type/page")
                if page_markers > 0:
                    insights["estimated_pages"] = page_markers
        except Exception as e:
            logger.warning("Could not extract document insights: %s", e)

        return insights
