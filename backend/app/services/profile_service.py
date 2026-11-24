"""Founder and investor profiles (the full editable profile), profile photos and project logos,
the account summary, and founder profiles as investors may see them."""
import logging
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.database import postgres as pg
from app.services import settings_service

logger = logging.getLogger(__name__)

IMAGE_DIR = Path(__file__).resolve().parents[2] / "private_uploads" / "images"
MAX_IMAGE_BYTES = 2 * 1024 * 1024
_IMAGE_TYPES = {b"\x89PNG\r\n\x1a\n": ("png", "image/png"), b"\xff\xd8\xff": ("jpg", "image/jpeg")}


class ProfileError(Exception):
    def __init__(self, message: str, status: int = 400, code: str = "invalid"):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code


def _now() -> datetime:
    return datetime.now(timezone.utc)


def sniff_image(data: bytes) -> tuple:
    """(extension, content type) for PNG, JPEG or WebP, judged by the file's bytes, not its name."""
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"
    for magic, kind in _IMAGE_TYPES.items():
        if data.startswith(magic):
            return kind
    raise ProfileError("Use a PNG, JPEG or WebP image.", 415, "bad_image")


def save_image(prefix: str, data: bytes) -> str:
    if not data:
        raise ProfileError("The file is empty.", 400, "empty")
    if len(data) > MAX_IMAGE_BYTES:
        raise ProfileError("Use an image under 2 MB.", 413, "too_large")
    ext, _ = sniff_image(data)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{prefix}-{secrets.token_hex(8)}.{ext}"
    (IMAGE_DIR / name).write_bytes(data)
    return name


def image_file(name: Optional[str]) -> Optional[tuple]:
    if not name:
        return None
    path = (IMAGE_DIR / name).resolve()
    if IMAGE_DIR.resolve() not in path.parents or not path.exists():
        return None
    data = path.read_bytes()
    return path, sniff_image(data)[1]


def remove_image(name: Optional[str]) -> None:
    found = image_file(name)
    if found:
        try:
            found[0].unlink()
        except OSError:
            pass


FOUNDER_FIELDS = ("first_name", "last_name", "phone", "location", "headline", "bio", "linkedin", "website",
                  "expertise", "designation", "experience", "skills", "previous_startups", "company",
                  "startup_role", "background")
INVESTOR_FIELDS = ("first_name", "last_name", "phone", "location", "headline", "bio", "linkedin_url", "website",
                   "expertise", "firm", "title", "investor_type", "experience", "focus", "value_add")


def _split_name(full: Optional[str]) -> tuple:
    parts = (full or "").strip().split(" ", 1)
    return parts[0] if parts else "", parts[1] if len(parts) > 1 else ""


class ProfileService:
    # ------------------------------------------------------------------ own profile

    @staticmethod
    async def _ensure(user_id: str, role: str) -> Dict[str, Any]:
        if role == "FOUNDER":
            from app.services.founder_service import FounderService
            return await FounderService.get_or_create_profile(user_id)
        from app.services.investor_service import InvestorService
        return await InvestorService.get_or_create_profile(user_id)

    @classmethod
    async def get(cls, user_id: str, role: str) -> Dict[str, Any]:
        await cls._ensure(user_id, role)
        table = "founder_profiles" if role == "FOUNDER" else "investor_profiles"
        row = await pg.fetch_one(f"SELECT * FROM {table} WHERE user_id = %s", [user_id]) or {}
        account = await pg.fetch_one("SELECT email, name, created_at FROM app_users WHERE id = %s", [user_id]) or {}
        first, last = row.get("first_name") or "", row.get("last_name") or ""
        if not first and not last:
            first, last = _split_name(row.get("name") or account.get("name"))
        out: Dict[str, Any] = {
            "first_name": first, "last_name": last, "email": account.get("email") or "",
            "phone": row.get("phone") or "", "location": row.get("location") or "",
            "headline": row.get("headline") or "", "bio": row.get("bio") or "",
            "website": row.get("website") or "", "expertise": row.get("expertise") or [],
            "experience": row.get("experience") or "", "has_photo": bool(image_file(row.get("photo_path"))),
            "user_id": user_id, "updated_at": row.get("updated_at"),
        }
        if role == "FOUNDER":
            out.update({
                "linkedin": row.get("linkedin") or "", "designation": row.get("designation") or "",
                "skills": row.get("skills") or [], "previous_startups": row.get("previous_startups") or "",
                "company": row.get("company") or "", "startup_role": row.get("startup_role") or "",
                "background": row.get("background") or "",
            })
            from app.services.team_service import TEAM_PROJECTS
            out["startups"] = await pg.fetch_all(
                f"SELECT id, title, is_published, (founder_id = %s) AS is_owner FROM projects WHERE id IN {TEAM_PROJECTS} "
                "ORDER BY created_at", [user_id, user_id, user_id])
        else:
            from app.services.team_service import TeamService
            firm = await TeamService.firm_of(user_id)
            out.update({
                "linkedin": row.get("linkedin_url") or "", "firm": (firm or {}).get("name") or row.get("firm") or "",
                "firm_managed": bool(firm), "title": row.get("title") or "",
                "investor_type": row.get("investor_type") or "", "focus": row.get("focus") or "",
                "value_add": row.get("value_add") or "",
                "verification_status": row.get("verification_status") or "unverified",
            })
            pref = await pg.fetch_one("SELECT * FROM investor_preferences WHERE investor_id = %s", [user_id])
            from app.services.criteria import thesis_from_row
            t = thesis_from_row(pref or {})
            # Read-only here: the investment criteria page is the single place these are edited.
            out["criteria"] = {"sectors": t["sectors"]["industries"], "stages": t["stages"],
                               "geography": "Global" if t["geography"]["is_global"] else
                               ", ".join(t["geography"]["regions"] + t["geography"]["countries"] + t["geography"]["cities"])}
        return out

    @classmethod
    async def update(cls, user_id: str, role: str, data: Dict[str, Any]) -> Dict[str, Any]:
        await cls._ensure(user_id, role)
        name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
        if role == "FOUNDER":
            fields = {k: data.get(k) for k in FOUNDER_FIELDS}
            fields["skills"], fields["expertise"] = pg.Jsonb(fields["skills"]), pg.Jsonb(fields["expertise"])
            table = "founder_profiles"
        else:
            data = {**data, "linkedin_url": data.get("linkedin", "")}
            fields = {k: data.get(k) for k in INVESTOR_FIELDS}
            fields["expertise"] = pg.Jsonb(fields["expertise"])
            from app.services.team_service import TeamService
            firm = await TeamService.firm_of(user_id)
            if firm:
                fields["firm"] = firm["name"]  # firm members show the firm's name; admins rename it on the Firm page
            table = "investor_profiles"
        if name:
            fields["name"] = name
        fields["updated_at"] = _now()
        await pg.update_where(table, fields, "user_id = %s", [user_id])
        if name:
            await pg.execute("UPDATE app_users SET name = %s, updated_at = now() WHERE id = %s", [name, user_id])
        return await cls.get(user_id, role)

    @classmethod
    async def set_photo(cls, user_id: str, role: str, data: Optional[bytes]) -> Dict[str, Any]:
        await cls._ensure(user_id, role)
        table = "founder_profiles" if role == "FOUNDER" else "investor_profiles"
        old = await pg.fetch_val(f"SELECT photo_path FROM {table} WHERE user_id = %s", [user_id])
        new = save_image(f"user-{user_id[:12]}", data) if data is not None else None
        await pg.execute(f"UPDATE {table} SET photo_path = %s, updated_at = now() WHERE user_id = %s", [new, user_id])
        remove_image(old)
        return await cls.get(user_id, role)

    @staticmethod
    async def photo_for(user_id: str) -> Optional[tuple]:
        row = await pg.fetch_one(
            "SELECT COALESCE((SELECT photo_path FROM founder_profiles WHERE user_id = %s), "
            "(SELECT photo_path FROM investor_profiles WHERE user_id = %s)) AS p", [user_id, user_id])
        return image_file((row or {}).get("p"))

    # ------------------------------------------------------------------ account

    @staticmethod
    async def account(user) -> Dict[str, Any]:
        row = await pg.fetch_one("SELECT email, role, created_at, deletion_requested_at FROM app_users WHERE id = %s",
                                 [user.id]) or {}
        out = {"email": row.get("email") or user.email, "email_verified": user.email_verified,
               "role": row.get("role"), "created_at": row.get("created_at"),
               "deletion_requested_at": row.get("deletion_requested_at"), "status": "active"}
        if row.get("deletion_requested_at"):
            out["status"] = "deletion_requested"
        if row.get("role") == "INVESTOR":
            from app.services.verification_service import VerificationService
            out["verification_status"] = await VerificationService.investor_status(user.id)
        return out

    @staticmethod
    async def request_deletion(user_id: str, reason: Optional[str]) -> None:
        await pg.execute("UPDATE app_users SET deletion_requested_at = now(), deletion_reason = %s WHERE id = %s",
                         [(reason or "").strip()[:1000] or None, user_id])

    @staticmethod
    async def cancel_deletion(user_id: str) -> None:
        await pg.execute("UPDATE app_users SET deletion_requested_at = NULL, deletion_reason = NULL WHERE id = %s", [user_id])

    @staticmethod
    async def deletion_requests() -> List[Dict[str, Any]]:
        return await pg.fetch_all(
            "SELECT id AS user_id, email, name, role, deletion_requested_at, deletion_reason FROM app_users "
            "WHERE deletion_requested_at IS NOT NULL ORDER BY deletion_requested_at")

    # ------------------------------------------------------------------ founders as investors see them

    @staticmethod
    async def founders_for_viewer(project: Dict[str, Any], viewer) -> List[Dict[str, Any]]:
        """The startup's founders as this viewer may see them, following each founder's privacy settings:
        profile visibility (investors / connected investors / hidden) and contact details for connected
        investors only."""
        from app.services.team_service import TeamService
        member_ids = await TeamService.team_user_ids(project["id"])
        connected = False
        if viewer and viewer.is_investor:
            connected = bool(await pg.fetch_val(
                "SELECT EXISTS (SELECT 1 FROM project_interests WHERE project_id = %s AND investor_id = %s "
                "AND status = 'accepted')", [project["id"], viewer.id]))
        out = []
        for uid in member_ids:
            row = await pg.fetch_one(
                "SELECT f.*, u.email, u.name AS account_name FROM app_users u LEFT JOIN founder_profiles f ON f.user_id = u.id "
                "WHERE u.id = %s", [uid])
            if not row:
                continue
            priv = settings_service.merge("FOUNDER", row.get("settings") or {})["privacy"]
            vis = priv["profile_visibility"]
            if vis == "hidden" or (vis == "connected" and not connected):
                continue
            first, last = row.get("first_name") or "", row.get("last_name") or ""
            name = f"{first} {last}".strip() or row.get("name") or row.get("account_name") or "Founder"
            entry = {
                "user_id": uid, "name": name, "role": "Owner" if uid == project["founder_id"] else "Co-founder",
                "headline": row.get("headline") or "", "designation": row.get("designation") or "",
                "startup_role": row.get("startup_role") or "", "bio": row.get("bio") or "",
                "location": row.get("location") or "", "background": row.get("background") or "",
                "experience": row.get("experience") or "", "skills": row.get("skills") or [],
                "expertise": row.get("expertise") or [], "previous_startups": row.get("previous_startups") or "",
                "has_photo": bool(image_file(row.get("photo_path"))),
                "email": None, "phone": None, "linkedin": None,
            }
            if connected:
                entry["email"] = row.get("email") if priv["show_email"] else None
                entry["phone"] = (row.get("phone") or None) if priv["show_phone"] else None
                entry["linkedin"] = (row.get("linkedin") or None) if priv["show_linkedin"] else None
            out.append(entry)
        return out
