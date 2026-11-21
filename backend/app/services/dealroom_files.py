"""Private file storage for deal rooms.

Files a founder or investor uploads into a deal room are stored outside the web root
(`private_uploads/dealrooms/<room id>/`) and are only ever served through an authorized
endpoint that checks the caller is one of the room's two participants. Nothing here is
reachable by URL alone.
"""
import logging
import re
import uuid
from pathlib import Path
from typing import Optional, Tuple

from fastapi import UploadFile

from app.services.document_service import CONTENT_TYPES, MAX_FILE_SIZE_BYTES, PRIVATE_DIR, _sanitize

logger = logging.getLogger(__name__)

ROOM_FILES_DIR = PRIVATE_DIR / "dealrooms"

# Same types as project materials, plus spreadsheets (financial models, cap tables).
ALLOWED_TYPES = {
    **CONTENT_TYPES,
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

_ROOM_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_FILE_ID_RE = re.compile(r"^[0-9a-f]{32}$")


def _room_dir(room_id: str) -> Path:
    if not _ROOM_ID_RE.match(room_id or ""):
        raise ValueError("Invalid deal room id.")
    return ROOM_FILES_DIR / room_id


def file_url(room_id: str, file_id: str) -> str:
    """API-relative path the frontend downloads through (with the user's token)."""
    return f"/dealrooms/{room_id}/files/{file_id}"


async def save(room_id: str, upload: UploadFile) -> Tuple[str, str, int]:
    """Validate and store an upload. Returns (file_id, original_name, size_kb)."""
    original = upload.filename or "document"
    extension = Path(original).suffix.lower()
    if extension not in ALLOWED_TYPES:
        allowed = ", ".join(sorted(e.lstrip(".").upper() for e in ALLOWED_TYPES))
        raise ValueError(f"That file type isn't supported. Use one of: {allowed}.")

    content = await upload.read(MAX_FILE_SIZE_BYTES + 1)
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"File is larger than {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.")
    if not content:
        raise ValueError("The file is empty.")

    file_id = uuid.uuid4().hex
    folder = _room_dir(room_id)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{file_id}_{_sanitize(original)}").write_bytes(content)
    return file_id, original, max(1, round(len(content) / 1024))


def locate(room_id: str, file_id: str) -> Optional[Tuple[Path, str, str]]:
    """(path, download name, content type) for a stored file, or None."""
    if not _FILE_ID_RE.match(file_id or ""):
        return None
    try:
        folder = _room_dir(room_id)
    except ValueError:
        return None
    matches = list(folder.glob(f"{file_id}_*")) if folder.is_dir() else []
    if not matches:
        return None
    path = matches[0]
    name = path.name[len(file_id) + 1:]
    return path, name, ALLOWED_TYPES.get(path.suffix.lower(), "application/octet-stream")
