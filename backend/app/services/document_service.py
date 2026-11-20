"""Project materials: private storage plus text extraction.

Founders upload pitch decks, business plans, market research and other
supporting documents. Files are stored outside the public /uploads mount
(they are confidential until the founder shares them) and their text is
extracted once at upload time:

* PDF  - pypdf text per page (Claude also reads the PDF pages visually during
         analysis, so image-only / scanned decks still get analyzed)
* DOCX - paragraphs and tables (python-docx)
* PPTX - slide text and speaker notes (python-pptx)
* TXT / MD / CSV - decoded as UTF-8
* PNG / JPG - no text; sent to Claude as images during analysis
"""
import io
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import UploadFile

from app.database import postgres as pg

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[2]
PRIVATE_DIR = BACKEND_DIR / "private_uploads"

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB per file
MAX_DOCUMENTS_PER_PROJECT = 20

CATEGORIES = {
    "pitch_deck",
    "business_plan",
    "market_research",
    "financial_model",
    "product_demo",
    "supporting_document",
}

CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}

# Columns returned to clients (never the full extracted text).
_PUBLIC_COLUMNS = (
    "id, project_id, category, original_name, url, content_type, size_bytes, page_count, "
    "extraction_note, created_at, length(extracted_text) AS text_chars"
)


def _sanitize(filename: str) -> str:
    name = os.path.basename(filename or "")
    clean = re.sub(r"[^\w.\-]", "_", name).strip("._")
    return clean or "document"


def _extract_pdf(content: bytes) -> Tuple[str, int, Optional[str]]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(content))
    pages = []
    for number, page in enumerate(reader.pages, 1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append(f"[Page {number}]\n{text}")
    text = "\n\n".join(pages)
    note = None
    if len(reader.pages) and len(text) < 40 * len(reader.pages):
        note = (
            "Little selectable text found (likely image-based slides). "
            "Claude reads the PDF pages visually during analysis."
        )
    return text, len(reader.pages), note


def _extract_docx(content: bytes) -> Tuple[str, Optional[int], Optional[str]]:
    import docx

    document = docx.Document(io.BytesIO(content))
    parts = [p.text.strip() for p in document.paragraphs if p.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            if any(cells):
                parts.append(" | ".join(cells))
    return "\n".join(parts), None, None


def _extract_pptx(content: bytes) -> Tuple[str, int, Optional[str]]:
    from pptx import Presentation

    deck = Presentation(io.BytesIO(content))
    slides = []
    for number, slide in enumerate(deck.slides, 1):
        lines = []
        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False) and shape.text_frame.text.strip():
                lines.append(shape.text_frame.text.strip())
            if getattr(shape, "has_table", False):
                for row in shape.table.rows:
                    cells = [c.text.strip() for c in row.cells]
                    if any(cells):
                        lines.append(" | ".join(cells))
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame.text.strip():
            lines.append("Speaker notes: " + slide.notes_slide.notes_text_frame.text.strip())
        if lines:
            slides.append(f"[Slide {number}]\n" + "\n".join(lines))
    return "\n\n".join(slides), len(deck.slides), None


def extract_text(content: bytes, extension: str) -> Tuple[str, Optional[int], Optional[str]]:
    """Return (text, page_or_slide_count, note). Never raises for a bad file."""
    try:
        if extension == ".pdf":
            return _extract_pdf(content)
        if extension == ".docx":
            return _extract_docx(content)
        if extension == ".pptx":
            return _extract_pptx(content)
        if extension in (".txt", ".md", ".csv"):
            return content.decode("utf-8", errors="replace"), None, None
        if extension in (".png", ".jpg", ".jpeg"):
            return "", 1, "Image: analyzed visually by Claude."
    except Exception as e:  # corrupt or password-protected files
        logger.warning("Text extraction failed (%s): %s", extension, e)
        return "", None, f"Could not read this file's text ({type(e).__name__})."
    return "", None, None


class DocumentService:
    @staticmethod
    def _absolute(storage_path: str) -> Path:
        path = (PRIVATE_DIR / storage_path).resolve()
        if PRIVATE_DIR.resolve() not in path.parents:
            raise ValueError("Invalid storage path")
        return path

    @classmethod
    async def save(cls, project_id: int, upload: UploadFile, category: str) -> Dict[str, Any]:
        category = category if category in CATEGORIES else "supporting_document"
        original_name = _sanitize(upload.filename or "document")
        extension = os.path.splitext(original_name.lower())[1]
        if extension not in CONTENT_TYPES:
            raise ValueError(
                f"Unsupported file type '{extension or 'none'}'. "
                f"Allowed: {', '.join(sorted(CONTENT_TYPES))}"
            )

        count = await pg.fetch_val(
            "SELECT count(*) AS n FROM project_documents WHERE project_id = %s", [project_id]
        )
        if count >= MAX_DOCUMENTS_PER_PROJECT:
            raise ValueError(f"A project can have at most {MAX_DOCUMENTS_PER_PROJECT} documents.")

        content = await upload.read(MAX_FILE_SIZE_BYTES + 1)
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise ValueError(f"File is larger than {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.")
        if not content:
            raise ValueError("The uploaded file is empty.")

        storage_path = f"projects/{project_id}/{uuid.uuid4().hex[:12]}_{original_name}"
        destination = cls._absolute(storage_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)

        text, page_count, note = extract_text(content, extension)
        row = await pg.insert(
            "project_documents",
            {
                "project_id": project_id,
                "category": category,
                "original_name": original_name,
                "storage_path": storage_path,
                "url": "",  # filled in below once the id is known
                "content_type": CONTENT_TYPES[extension],
                "size_bytes": len(content),
                "page_count": page_count,
                "extracted_text": text,
                "extraction_note": note,
            },
        )
        url = f"/api/projects/{project_id}/documents/{row['id']}/file"
        await pg.execute("UPDATE project_documents SET url = %s WHERE id = %s", [url, row["id"]])
        logger.info(
            "Stored %s for project %s (%d bytes, %d text chars)",
            original_name, project_id, len(content), len(text),
        )
        return await cls.get(project_id, row["id"])

    @classmethod
    async def list(cls, project_id: int) -> List[Dict[str, Any]]:
        return await pg.fetch_all(
            f"SELECT {_PUBLIC_COLUMNS} FROM project_documents WHERE project_id = %s ORDER BY created_at, id",
            [project_id],
        )

    @classmethod
    async def get(cls, project_id: int, doc_id: int) -> Optional[Dict[str, Any]]:
        return await pg.fetch_one(
            f"SELECT {_PUBLIC_COLUMNS} FROM project_documents WHERE project_id = %s AND id = %s",
            [project_id, doc_id],
        )

    @classmethod
    async def file_path(cls, project_id: int, doc_id: int) -> Optional[Tuple[Path, str, str]]:
        row = await pg.fetch_one(
            "SELECT storage_path, content_type, original_name FROM project_documents "
            "WHERE project_id = %s AND id = %s",
            [project_id, doc_id],
        )
        if not row:
            return None
        path = cls._absolute(row["storage_path"])
        return (path, row["content_type"], row["original_name"]) if path.exists() else None

    @classmethod
    async def delete(cls, project_id: int, doc_id: int) -> bool:
        row = await pg.fetch_one(
            "DELETE FROM project_documents WHERE project_id = %s AND id = %s RETURNING storage_path",
            [project_id, doc_id],
        )
        if not row:
            return False
        try:
            cls._absolute(row["storage_path"]).unlink(missing_ok=True)
        except OSError as e:
            logger.warning("Could not delete stored file %s: %s", row["storage_path"], e)
        return True

    @classmethod
    async def load_for_analysis(cls, project_id: int) -> List[Dict[str, Any]]:
        """Full rows (with extracted text) plus file bytes for PDFs and images."""
        rows = await pg.fetch_all(
            "SELECT * FROM project_documents WHERE project_id = %s ORDER BY created_at, id",
            [project_id],
        )
        for row in rows:
            row["content"] = None
            if row["content_type"] == "application/pdf" or row["content_type"].startswith("image/"):
                try:
                    row["content"] = cls._absolute(row["storage_path"]).read_bytes()
                except OSError as e:
                    logger.warning("Stored file missing for document %s: %s", row["id"], e)
        return rows
