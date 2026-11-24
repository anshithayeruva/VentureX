"""Verification of investors (admin-reviewed evidence) and companies (domain email code, or a
registration number an admin checks).

Investor statuses: unverified (nothing sent) -> pending (evidence sent) -> verified | rejected.
Company statuses:  unverified -> code_sent -> verified (domain email), or
                   unverified -> pending -> verified | rejected (registration number, admin review).
"""
import hashlib
import hmac
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

from app.core.config import settings
from app.database import postgres as pg

logger = logging.getLogger(__name__)

# Free email providers can't prove that someone works at a company.
FREE_EMAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "ymail.com", "outlook.com", "hotmail.com",
    "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "zoho.com",
    "zohomail.in", "rediffmail.com", "gmx.com", "mail.com", "yandex.com", "tutanota.com", "fastmail.com",
}

# Indian company identifiers, checked by format here and by an admin against the registry.
REGISTRATION_TYPES = {
    "gstin": ("GSTIN", re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")),
    "cin": ("Company registration number (CIN)", re.compile(r"^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$")),
    "llpin": ("LLP identification number (LLPIN)", re.compile(r"^[A-Z]{3}-\d{4}$")),
    "udyam": ("Udyam registration number", re.compile(r"^UDYAM-[A-Z]{2}-\d{2}-\d{7}$")),
}

RESEND_AFTER_SECONDS = 60


class VerificationError(Exception):
    def __init__(self, message: str, status: int = 400, code: str = "invalid"):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _host(url: str) -> str:
    """The lowercase host of a URL, without 'www.' (accepts 'example.com' without a scheme)."""
    url = (url or "").strip()
    if not url:
        return ""
    if "://" not in url:
        url = "https://" + url
    host = (urlparse(url).hostname or "").lower().rstrip(".")
    return host[4:] if host.startswith("www.") else host


def _clean_url(url: str, field: str) -> str:
    url = (url or "").strip()
    if not url:
        raise VerificationError(f"Add your {field}.", 422, "missing_" + field.replace(" ", "_"))
    if "://" not in url:
        url = "https://" + url
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or "." not in (parsed.hostname or ""):
        raise VerificationError(f"That {field} isn't a valid web address.", 422, "bad_" + field.replace(" ", "_"))
    return url[:300]


def _hash_code(code: str, salt: str) -> str:
    return hmac.new(salt.encode(), code.encode(), hashlib.sha256).hexdigest()


def _mask(email: str) -> str:
    local, _, domain = email.partition("@")
    return (local[:2] + "•" * max(1, len(local) - 2)) + "@" + domain


def domain_matches(email_domain: str, site_host: str) -> bool:
    """The email's domain is the website's domain, or one is a subdomain of the other."""
    e, s = email_domain.lower(), site_host.lower()
    return bool(e and s) and (e == s or e.endswith("." + s) or s.endswith("." + e))


class VerificationService:
    # ------------------------------------------------------------------ investors

    @staticmethod
    async def investor_status(user_id: str) -> str:
        return await pg.fetch_val(
            "SELECT verification_status FROM investor_profiles WHERE user_id = %s", [user_id]
        ) or "unverified"

    @classmethod
    async def investor_is_verified(cls, user_id: str) -> bool:
        """Whether the investor may contact founders (always true when verification is switched off)."""
        if not settings.REQUIRE_INVESTOR_VERIFICATION:
            return True
        return await cls.investor_status(user_id) == "verified"

    @staticmethod
    async def verified_investors(user_ids: Iterable[str]) -> set:
        ids = [u for u in user_ids if u]
        if not ids:
            return set()
        rows = await pg.fetch_all(
            "SELECT user_id FROM investor_profiles WHERE verification_status = 'verified' AND user_id = ANY(%s::text[])",
            ["{" + ",".join(ids) + "}"],
        )
        return {r["user_id"] for r in rows}

    @staticmethod
    async def get_investor(user_id: str) -> Dict[str, Any]:
        row = await pg.fetch_one(
            "SELECT verification_status, verification_note, verification_submitted_at, verification_reviewed_at, "
            "linkedin_url, website, portfolio FROM investor_profiles WHERE user_id = %s",
            [user_id],
        ) or {}
        return {
            "status": row.get("verification_status") or "unverified",
            "review_note": row.get("verification_note"),
            "submitted_at": row.get("verification_submitted_at"),
            "reviewed_at": row.get("verification_reviewed_at"),
            "linkedin_url": row.get("linkedin_url") or "",
            "website": row.get("website") or "",
            "past_investments": row.get("portfolio") or [],
            "required": settings.REQUIRE_INVESTOR_VERIFICATION,
        }

    @classmethod
    async def submit_investor(cls, user_id: str, linkedin_url: str, website: str,
                              past_investments: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Send evidence for review. The past investments also appear on the investor's public profile."""
        from app.services.investor_service import InvestorService
        await InvestorService.get_or_create_profile(user_id)
        if await cls.investor_status(user_id) == "verified":
            raise VerificationError("Your account is already verified.", 409, "already_verified")
        linkedin = _clean_url(linkedin_url, "LinkedIn profile")
        if not _host(linkedin).endswith("linkedin.com"):
            raise VerificationError("Use your LinkedIn profile address (linkedin.com/in/...).", 422, "bad_linkedin")
        site = _clean_url(website, "firm website")
        if _host(site).endswith("linkedin.com"):
            raise VerificationError("Add your firm's own website, not a LinkedIn page.", 422, "bad_website")
        deals = [d for d in past_investments if (d.get("company") or "").strip()]
        if not deals:
            raise VerificationError("Add at least one past investment.", 422, "missing_past_investments")
        await pg.update_where("investor_profiles", {
            "linkedin_url": linkedin,
            "website": site,
            "portfolio": pg.Jsonb(deals),
            "verification_status": "pending",
            "verification_note": None,
            "verification_submitted_at": _now(),
            "verification_reviewed_at": None,
            "verification_reviewed_by": None,
            "updated_at": _now(),
        }, "user_id = %s", [user_id])
        return await cls.get_investor(user_id)

    @classmethod
    async def review_investor(cls, admin_id: str, user_id: str, decision: str, note: Optional[str]) -> Dict[str, Any]:
        status = await pg.fetch_val("SELECT verification_status FROM investor_profiles WHERE user_id = %s", [user_id])
        if status is None:
            raise VerificationError("Investor not found.", 404, "not_found")
        if decision == "reject" and not (note or "").strip():
            raise VerificationError("Add a note so the investor knows what to fix.", 422, "note_required")
        new_status = {"approve": "verified", "reject": "rejected", "revoke": "unverified"}[decision]
        await pg.update_where("investor_profiles", {
            "verification_status": new_status,
            "verification_note": (note or "").strip() or None,
            "verification_reviewed_at": _now(),
            "verification_reviewed_by": admin_id,
            "updated_at": _now(),
        }, "user_id = %s", [user_id])
        await cls._notify("INVESTOR", user_id, new_status, "Your investor account", note, "/investor/verification")
        return await cls.get_investor(user_id)

    # ------------------------------------------------------------------ companies

    @staticmethod
    async def company_statuses(project_ids: Iterable[int]) -> Dict[int, str]:
        ids = [int(i) for i in project_ids if i is not None]
        if not ids:
            return {}
        rows = await pg.fetch_all(
            "SELECT project_id, status FROM company_verifications WHERE project_id = ANY(%s::bigint[])",
            ["{" + ",".join(str(i) for i in ids) + "}"],
        )
        return {r["project_id"]: r["status"] for r in rows}

    @classmethod
    async def company_is_verified(cls, project_id: int) -> bool:
        return (await cls.company_statuses([project_id])).get(int(project_id)) == "verified"

    @staticmethod
    async def _owned(founder_id: str, project_id: int) -> Dict[str, Any]:
        project = await pg.fetch_one("SELECT id, founder_id, title, website FROM projects WHERE id = %s", [project_id])
        from app.services.team_service import TeamService
        if not await TeamService.can_work_on(founder_id, project):
            raise VerificationError("Project not found.", 404, "not_found")
        return project

    @staticmethod
    def _view(row: Optional[Dict[str, Any]], project: Dict[str, Any]) -> Dict[str, Any]:
        row = row or {}
        site = _host(project.get("website") or "")
        return {
            "project_id": project["id"],
            "status": row.get("status") or "unverified",
            "method": row.get("method"),
            "email": _mask(row["email"]) if row.get("email") else None,
            "domain": row.get("domain"),
            "website_domain": site or None,
            "registration_type": row.get("registration_type"),
            "registration_number": row.get("registration_number"),
            "review_note": row.get("review_note"),
            "submitted_at": row.get("submitted_at"),
            "verified_at": row.get("verified_at"),
            "code_expires_at": row.get("code_expires_at") if row.get("status") == "code_sent" else None,
            "registration_types": {k: label for k, (label, _) in REGISTRATION_TYPES.items()},
        }

    @classmethod
    async def get_company(cls, founder_id: str, project_id: int) -> Dict[str, Any]:
        project = await cls._owned(founder_id, project_id)
        row = await pg.fetch_one("SELECT * FROM company_verifications WHERE project_id = %s", [project_id])
        return cls._view(row, project)

    @staticmethod
    async def _save(project: Dict[str, Any], fields: Dict[str, Any]) -> None:
        await pg.upsert("company_verifications",
                        {"project_id": project["id"], "founder_id": project["founder_id"], **fields, "updated_at": _now()},
                        ["project_id"], update=[*fields.keys(), "updated_at"])

    @classmethod
    async def send_code(cls, founder_id: str, project_id: int, email: str) -> Dict[str, Any]:
        """Email a 6-digit code to an address on the startup's own website domain."""
        project = await cls._owned(founder_id, project_id)
        row = await pg.fetch_one("SELECT * FROM company_verifications WHERE project_id = %s", [project_id]) or {}
        if row.get("status") == "verified":
            raise VerificationError("This company is already verified.", 409, "already_verified")
        site = _host(project.get("website") or "")
        if not site:
            raise VerificationError("Add your startup's website to the project first; the email must be on its domain.",
                                    422, "no_website")
        email = (email or "").strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise VerificationError("Enter a valid email address.", 422, "bad_email")
        domain = email.split("@", 1)[1]
        if domain in FREE_EMAIL_DOMAINS:
            raise VerificationError("Use an email on your company's domain, not a free email provider.", 422, "free_email")
        if not domain_matches(domain, site):
            raise VerificationError(f"The email must be on {site}, your project's website.", 422, "domain_mismatch")
        sent = row.get("code_sent_at")
        if sent and (_now() - sent).total_seconds() < RESEND_AFTER_SECONDS:
            raise VerificationError("A code was just sent. Wait a minute before asking for another.", 429, "too_soon")

        code = f"{secrets.randbelow(10 ** 6):06d}"
        salt = secrets.token_hex(8)
        await cls._save(project, {
            "status": "code_sent", "method": "domain_email", "email": email, "domain": domain,
            "code_hash": f"{salt}${_hash_code(code, salt)}",
            "code_expires_at": _now() + timedelta(minutes=settings.VERIFICATION_CODE_TTL_MINUTES),
            "code_attempts": 0, "code_sent_at": _now(), "submitted_at": _now(),
            "review_note": None, "verified_at": None,
        })
        from app.services.email_service import EmailService
        EmailService.send_verification_code_email(email, project["title"], code, settings.VERIFICATION_CODE_TTL_MINUTES)
        return await cls.get_company(founder_id, project_id)

    @classmethod
    async def confirm_code(cls, founder_id: str, project_id: int, code: str) -> Dict[str, Any]:
        project = await cls._owned(founder_id, project_id)
        row = await pg.fetch_one("SELECT * FROM company_verifications WHERE project_id = %s", [project_id]) or {}
        if row.get("status") != "code_sent" or not row.get("code_hash"):
            raise VerificationError("Ask for a code first.", 409, "no_code")
        if row["code_expires_at"] < _now():
            raise VerificationError("That code has expired. Send a new one.", 410, "expired")
        if row["code_attempts"] >= settings.VERIFICATION_CODE_MAX_ATTEMPTS:
            raise VerificationError("Too many wrong codes. Send a new one.", 429, "too_many_attempts")
        salt, digest = row["code_hash"].split("$", 1)
        if not hmac.compare_digest(_hash_code((code or "").strip(), salt), digest):
            await pg.execute("UPDATE company_verifications SET code_attempts = code_attempts + 1 WHERE project_id = %s",
                             [project_id])
            left = settings.VERIFICATION_CODE_MAX_ATTEMPTS - row["code_attempts"] - 1
            raise VerificationError(f"That code isn't right. {max(left, 0)} tries left.", 422, "wrong_code")
        await cls._save(project, {"status": "verified", "code_hash": None, "code_expires_at": None,
                                  "verified_at": _now(), "reviewed_by": None, "reviewed_at": None})
        return await cls.get_company(founder_id, project_id)

    @classmethod
    async def submit_registration(cls, founder_id: str, project_id: int, reg_type: str, number: str,
                                  note: Optional[str]) -> Dict[str, Any]:
        """For startups without their own domain: a registration number an admin checks by hand."""
        project = await cls._owned(founder_id, project_id)
        row = await pg.fetch_one("SELECT status FROM company_verifications WHERE project_id = %s", [project_id]) or {}
        if row.get("status") == "verified":
            raise VerificationError("This company is already verified.", 409, "already_verified")
        if reg_type not in REGISTRATION_TYPES:
            raise VerificationError("Choose the kind of registration number.", 422, "bad_type")
        label, pattern = REGISTRATION_TYPES[reg_type]
        clean = re.sub(r"\s+", "", (number or "")).upper()
        if not pattern.fullmatch(clean):
            raise VerificationError(f"That doesn't look like a valid {label}.", 422, "bad_number")
        await cls._save(project, {
            "status": "pending", "method": "registration", "registration_type": reg_type,
            "registration_number": clean, "evidence_note": (note or "").strip()[:1000] or None,
            "submitted_at": _now(), "review_note": None, "verified_at": None,
            "code_hash": None, "code_expires_at": None,
        })
        return await cls.get_company(founder_id, project_id)

    @classmethod
    async def review_company(cls, admin_id: str, project_id: int, decision: str, note: Optional[str]) -> Dict[str, Any]:
        row = await pg.fetch_one(
            "SELECT v.*, p.title, p.website FROM company_verifications v JOIN projects p ON p.id = v.project_id "
            "WHERE v.project_id = %s", [project_id])
        if not row:
            raise VerificationError("Nothing to review for this company.", 404, "not_found")
        if decision == "reject" and not (note or "").strip():
            raise VerificationError("Add a note so the founder knows what to fix.", 422, "note_required")
        new_status = {"approve": "verified", "reject": "rejected", "revoke": "unverified"}[decision]
        await pg.update_where("company_verifications", {
            "status": new_status, "review_note": (note or "").strip() or None, "reviewed_by": admin_id,
            "reviewed_at": _now(), "verified_at": _now() if new_status == "verified" else None,
            "code_hash": None, "code_expires_at": None, "updated_at": _now(),
        }, "project_id = %s", [project_id])
        await cls._notify("FOUNDER", row["founder_id"], new_status, row["title"], note,
                          f"/founder/projects/{project_id}")
        return cls._view({**row, "status": new_status, "review_note": note}, {**row, "id": project_id})

    @staticmethod
    async def website_changed(project_id: int, new_website: str) -> None:
        """A domain-email verification no longer holds once the website moves to another domain."""
        row = await pg.fetch_one("SELECT status, method, domain FROM company_verifications WHERE project_id = %s",
                                 [project_id])
        if row and row["method"] == "domain_email" and row["status"] in ("verified", "code_sent") \
                and not domain_matches(row.get("domain") or "", _host(new_website)):
            await pg.update_where("company_verifications", {
                "status": "unverified", "code_hash": None, "verified_at": None, "updated_at": _now(),
            }, "project_id = %s", [project_id])

    # ------------------------------------------------------------------ admin queue

    @staticmethod
    async def queue(kind: str, status: Optional[str]) -> List[Dict[str, Any]]:
        if kind == "investor":
            where, params = "u.role = 'INVESTOR'", []
            if status:
                where += " AND p.verification_status = %s"
                params.append(status)
            else:
                where += " AND p.verification_status <> 'unverified'"
            return await pg.fetch_all(
                f"""
                SELECT p.user_id, COALESCE(NULLIF(p.name, ''), u.name) AS name, p.firm, p.title, p.location,
                       p.linkedin_url, p.website, p.portfolio, p.verification_status AS status,
                       p.verification_note AS review_note, p.verification_submitted_at AS submitted_at,
                       p.verification_reviewed_at AS reviewed_at, u.email
                FROM investor_profiles p JOIN app_users u ON u.id = p.user_id
                WHERE {where}
                ORDER BY (p.verification_status = 'pending') DESC, p.verification_submitted_at DESC NULLS LAST
                LIMIT 200
                """, params)
        where, params = "v.status <> 'unverified'", []
        if status:
            where, params = "v.status = %s", [status]
        return await pg.fetch_all(
            f"""
            SELECT v.project_id, v.status, v.method, v.email, v.domain, v.registration_type, v.registration_number,
                   v.evidence_note, v.review_note, v.submitted_at, v.reviewed_at, v.verified_at,
                   p.title, p.website, p.industry, p.city, p.country,
                   COALESCE(NULLIF(f.name, ''), u.name) AS founder_name, u.email AS founder_email
            FROM company_verifications v JOIN projects p ON p.id = v.project_id
            LEFT JOIN app_users u ON u.id = v.founder_id LEFT JOIN founder_profiles f ON f.user_id = v.founder_id
            WHERE {where}
            ORDER BY (v.status = 'pending') DESC, v.submitted_at DESC NULLS LAST
            LIMIT 200
            """, params)

    @staticmethod
    async def counts() -> Dict[str, int]:
        inv = await pg.fetch_val(
            "SELECT count(*) FROM investor_profiles p JOIN app_users u ON u.id = p.user_id "
            "WHERE u.role = 'INVESTOR' AND p.verification_status = 'pending'")
        com = await pg.fetch_val("SELECT count(*) FROM company_verifications WHERE status = 'pending'")
        return {"investors_pending": int(inv or 0), "companies_pending": int(com or 0)}

    # ------------------------------------------------------------------ notices

    @staticmethod
    async def _notify(role: str, user_id: str, status: str, subject: str, note: Optional[str], link: str) -> None:
        if status not in ("verified", "rejected"):
            return
        try:
            from app.services.notification_service import NotificationService
            if status == "verified":
                title = f"{subject} is verified"
                desc = "Founders and investors now see your Verified badge."
            else:
                title = f"{subject}: verification not approved"
                desc = f"Reviewer's note: {note}" if note else "See what to fix and send it again."
            await NotificationService.create_notification(
                category="account",
                target_role=role, user_id=user_id, title=title, desc=desc,
                badge="Verified" if status == "verified" else "Action needed",
                badge_variant="success" if status == "verified" else "warning", link=link,
            )
        except Exception as e:
            logger.warning("Could not send verification notice: %s", e)
