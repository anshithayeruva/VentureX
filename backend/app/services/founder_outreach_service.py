"""Founder outreach: the investor directory, investor profiles, founder-initiated intro requests
and the investor's Interested / Pass reply.

Safeguards so investors aren't spammed:
  * the project must be published and its readiness score at least FOUNDER_INTRO_MIN_READINESS;
  * the investor's own criteria must not exclude it (rules, then an AI read of their written notes);
  * each founder can send FOUNDER_INTRO_DAILY_LIMIT requests per rolling 24 hours;
  * one request per project and investor; after a Pass the founder can't ask again for that project.
Requests with no reply in 14 days become "expired" ("No response").
"""
import logging
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Any, Dict, List, Optional, Tuple

from app.services.settings_service import email_allowed
from app.core.config import settings
from app.database import postgres as pg
from app.schemas.interest import PASS_REASONS
from app.services.criteria import has_criteria, regions_for_country, thesis_from_row
from app.services.interest_service import InterestService
from app.services.match_service import DEMO_INVESTORS, MatchService
from app.services.team_service import TEAM_PROJECTS, TeamService
from app.utils.money import inr

logger = logging.getLogger(__name__)

# After a request went unanswered, the founder can try the same investor again after this long.
RETRY_AFTER_EXPIRY_DAYS = 30
# Reply stats are shown once an investor has this many resolved founder requests.
MIN_REQUESTS_FOR_STATS = 3

_PROFILE_SQL = """
    SELECT p.user_id, p.name, p.firm, p.title, p.bio, p.location, p.min_check, p.max_check,
           p.value_add, p.portfolio, p.verification_status, p.settings, p.phone, p.photo_path, u.email AS account_email, u.name AS account_name, u.organization AS account_org
    FROM investor_profiles p LEFT JOIN app_users u ON u.id = p.user_id
    WHERE p.listed_for_founders
      AND (u.role = 'INVESTOR' OR (u.id IS NULL AND p.user_id = ANY(%s::text[])))
"""


def _priv(row: Dict[str, Any]) -> Dict[str, Any]:
    from app.services.settings_service import merge
    return merge("INVESTOR", row.get("settings") or {})["privacy"]


class OutreachError(Exception):
    def __init__(self, message: str, status: int = 400, code: str = "invalid"):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code


def _demo_ids() -> str:
    ids = [d["user_id"] for d in DEMO_INVESTORS] if settings.seed_demo_data else []
    return "{" + ",".join(ids) + "}"


def _money(value: Any) -> Optional[float]:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _public_thesis(thesis: Dict[str, Any]) -> Dict[str, Any]:
    """What founders may see of an investor's criteria: no private notes, priorities or fund size."""
    cs, st = thesis["check_size"], thesis["structure"]
    return {
        "sectors": {k: thesis["sectors"][k] for k in
                    ("industries", "sub_industries", "sectors", "technologies", "excluded_industries", "business_models")},
        "stages": thesis["stages"],
        "check_size": {"min_check": _money(cs.get("min_check")), "max_check": _money(cs.get("max_check")),
                       "preferred_check": _money(cs.get("preferred_check"))},
        "geography": thesis["geography"],
        "traction": {**thesis["traction"], "min_monthly_revenue": _money(thesis["traction"].get("min_monthly_revenue"))},
        "team": thesis["team"],
        "structure": {"instruments": st["instruments"], "role": st["role"], "board_seat": st["board_seat"]},
    }


def _summary(project: Dict[str, Any]) -> str:
    """One-liner, amount raising and traction, for the investor's email and the founder's draft."""
    line = (project.get("tagline") or (project.get("description") or "")[:160]).strip()
    if line and line[-1] not in ".!?":
        line += "."
    parts = [line]
    if project.get("funding_required"):
        parts.append(f"Raising {inr(float(project['funding_required']))} at {project.get('stage') or 'an early'} stage.")
    traction = []
    if project.get("monthly_revenue"):
        traction.append(f"{inr(float(project['monthly_revenue']))} monthly revenue")
    if project.get("customer_count"):
        traction.append(f"{int(project['customer_count']):,} customers")
    if project.get("product_status"):
        traction.append(f"product {project['product_status']}")
    if traction:
        parts.append("Traction: " + ", ".join(traction) + ".")
    return " ".join(p for p in parts if p)


class FounderOutreachService:
    # ------------------------------------------------------------------ shared lookups

    @staticmethod
    async def _founder_projects(founder_id: str) -> List[Dict[str, Any]]:
        return await pg.fetch_all(
            f"SELECT * FROM projects WHERE id IN {TEAM_PROJECTS} ORDER BY is_published DESC, updated_at DESC LIMIT 50",
            [founder_id, founder_id],
        )

    @classmethod
    async def _pick_project(cls, founder_id: str, project_id: Optional[int]) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
        projects = await cls._founder_projects(founder_id)
        flags = await cls._company_flags(projects)
        projects = [{**p, "company_verified": flags.get(p["id"], False)} for p in projects]
        if project_id is not None:
            chosen = next((p for p in projects if p["id"] == project_id), None)
            if chosen is None:
                raise OutreachError("Project not found.", 404, "not_found")
            return chosen, projects
        return (projects[0] if projects else None), projects

    @staticmethod
    async def _company_flags(projects: List[Dict[str, Any]]) -> Dict[int, bool]:
        from app.services.verification_service import VerificationService
        statuses = await VerificationService.company_statuses([p["id"] for p in projects])
        return {pid: s == "verified" for pid, s in statuses.items()}

    @staticmethod
    def _project_option(p: Dict[str, Any]) -> Dict[str, Any]:
        return {"id": p["id"], "title": p["title"], "is_published": bool(p.get("is_published")),
                "readiness_score": p.get("readiness_score"), "stage": p.get("stage"),
                "industry": p.get("industry"), "tagline": p.get("tagline"),
                "funding_required": p.get("funding_required"), "summary": _summary(p),
                "company_verified": bool(p.get("company_verified"))}

    @staticmethod
    async def _preferences(ids: List[str]) -> Dict[str, Dict[str, Any]]:
        if not ids:
            return {}
        rows = await pg.fetch_all(
            "SELECT * FROM investor_preferences WHERE investor_id = ANY(%s::text[])",
            ["{" + ",".join(ids) + "}"],
        )
        return {r["investor_id"]: r for r in rows}

    @staticmethod
    async def _relationships(project_id: Optional[int], ids: List[str]) -> Dict[str, Dict[str, Any]]:
        if project_id is None or not ids:
            return {}
        rows = await pg.fetch_all(
            "SELECT id, investor_id, status, initiated_by, pass_reason, response_note, deal_room, created_at, "
            "updated_at, responded_at FROM project_interests WHERE project_id = %s AND investor_id = ANY(%s::text[])",
            [project_id, "{" + ",".join(ids) + "}"],
        )
        return {r["investor_id"]: r for r in rows}

    @staticmethod
    def _relationship_view(rel: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not rel:
            return None
        return {
            "interest_id": rel["id"],
            "status": rel["status"],
            "initiated_by": rel.get("initiated_by") or "investor",
            "pass_reason": rel.get("pass_reason"),
            "pass_reason_label": PASS_REASONS.get(rel.get("pass_reason") or ""),
            "response_note": rel.get("response_note"),
            "room_id": (rel.get("deal_room") or {}).get("room_id"),
            "requested_at": rel.get("created_at"),
        }

    @staticmethod
    def _identity(row: Dict[str, Any]) -> Dict[str, Any]:
        from app.services.settings_service import merge
        priv = merge("INVESTOR", row.get("settings") or {})["privacy"]
        return {
            "investor_id": row["user_id"],
            "name": row.get("name") or row.get("account_name") or "Investor",
            "firm": (row.get("firm") or row.get("account_org") or "") if priv["show_organization"] else "",
            "has_photo": bool(row.get("photo_path")),
            "title": row.get("title") or "",
            "location": row.get("location") or "",
            "verified": row.get("verification_status") == "verified",
        }

    @staticmethod
    def _fit(project: Optional[Dict[str, Any]], profile: Dict[str, Any], pref: Dict[str, Any]) -> Dict[str, Any]:
        if project is None:
            return {"match_score": None, "reasons": [], "excluded_reason": None}
        match = MatchService.calculate_match(project, {**profile, "name": profile.get("name")}, pref)
        if match:
            return {"match_score": match["match_score"], "reasons": match["reasons"], "excluded_reason": None}
        return {"match_score": None, "reasons": [], "excluded_reason": MatchService.exclusion_reason(project, pref)}

    # ------------------------------------------------------------------ directory

    @classmethod
    async def directory(
        cls,
        founder_id: str,
        project_id: Optional[int] = None,
        q: Optional[str] = None,
        stage: Optional[str] = None,
        sector: Optional[str] = None,
        min_check: Optional[float] = None,
        max_check: Optional[float] = None,
        location: Optional[str] = None,
        role: Optional[str] = None,
        verified_only: bool = False,
        sort: str = "fit",
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        await InterestService.expire_stale()
        await MatchService.ensure_investors_initialized()
        project, projects = await cls._pick_project(founder_id, project_id)
        rows = await pg.fetch_all(_PROFILE_SQL + " ORDER BY p.updated_at DESC LIMIT 500", [_demo_ids()])
        ids = [r["user_id"] for r in rows]
        prefs = await cls._preferences(ids)
        rels = await cls._relationships(project["id"] if project else None, ids)

        needle = (q or "").strip().lower()
        loc = (location or "").strip().lower()
        loc_regions = {r.lower() for r in regions_for_country(location or "")}
        sector_l = (sector or "").strip().lower()
        sectors_seen, stages_seen = set(), set()
        items = []
        for row in rows:
            pref = prefs.get(row["user_id"]) or {}
            thesis = thesis_from_row(pref)
            sec, geo, cs = thesis["sectors"], thesis["geography"], thesis["check_size"]
            focus = sec["industries"] + sec["sub_industries"] + sec["sectors"]
            sectors_seen.update(focus)
            stages_seen.update(thesis["stages"])
            ident = cls._identity(row)
            lo, hi = _money(cs.get("min_check")), _money(cs.get("max_check"))

            if needle:
                hay = " ".join([ident["name"], ident["firm"], ident["title"], row.get("bio") or "",
                                row.get("value_add") or "", *focus, *sec["technologies"]]).lower()
                if needle not in hay:
                    continue
            if stage and stage not in thesis["stages"]:
                continue
            if sector_l and sector_l not in {s.lower() for s in focus}:
                continue
            if min_check is not None or max_check is not None:
                if lo is None and hi is None:
                    continue
                if max_check is not None and (lo or 0) > max_check:
                    continue
                if min_check is not None and hi is not None and hi < min_check:
                    continue
            if loc:
                places = {x.lower() for x in geo["countries"] + geo["cities"]}
                regions = {x.lower() for x in geo["regions"]}
                if not (geo["is_global"] or loc in places or regions & loc_regions or loc in regions
                        or loc in (row.get("location") or "").lower()):
                    continue
            if role in ("lead", "co_invest") and thesis["structure"]["role"] not in (role, "either"):
                continue
            if verified_only and row.get("verification_status") != "verified":
                continue

            fit = cls._fit(project, row, pref)
            items.append({
                **ident,
                "stages": thesis["stages"],
                "sectors": focus[:6],
                "min_check": lo,
                "max_check": hi,
                "role": thesis["structure"]["role"],
                "is_global": geo["is_global"],
                "regions": geo["regions"],
                "countries": geo["countries"],
                "criteria_set": has_criteria(thesis),
                **fit,
                "reasons": fit["reasons"][:3],
                "relationship": cls._relationship_view(rels.get(row["user_id"])),
            })

        if sort == "name":
            items.sort(key=lambda i: (i["name"].lower(), i["firm"].lower()))
        else:
            # Best fit first; investors with no criteria next; ones whose criteria exclude the project last.
            items.sort(key=lambda i: (
                0 if i["match_score"] is not None else (2 if i["excluded_reason"] else 1),
                -(i["match_score"] or 0),
                i["name"].lower(),
            ))
        total = len(items)
        start = (page - 1) * page_size
        return {
            "items": items[start:start + page_size],
            "total": total,
            "page": page,
            "page_size": page_size,
            "project": cls._project_option(project) if project else None,
            "projects": [cls._project_option(p) for p in projects],
            "facets": {"sectors": sorted(sectors_seen, key=str.lower), "stages": sorted(stages_seen)},
            "min_readiness": settings.FOUNDER_INTRO_MIN_READINESS,
        }

    # ------------------------------------------------------------------ profile

    @staticmethod
    async def response_stats(investor_id: str) -> Dict[str, Any]:
        """How often and how fast the investor answers founders' requests (shown once there's enough data)."""
        rows = await pg.fetch_all(
            "SELECT status, created_at, responded_at FROM project_interests "
            "WHERE investor_id = %s AND initiated_by = 'founder' AND status <> 'pending'",
            [investor_id],
        )
        if len(rows) < MIN_REQUESTS_FOR_STATS:
            return {"enough_data": False, "resolved_requests": len(rows), "reply_rate": None, "median_reply_days": None}
        replied = [r for r in rows if r.get("responded_at")]
        days = [max(0.0, (r["responded_at"] - r["created_at"]).total_seconds() / 86400) for r in replied]
        return {
            "enough_data": True,
            "resolved_requests": len(rows),
            "reply_rate": round(100 * len(replied) / len(rows)),
            "median_reply_days": round(median(days), 1) if days else None,
        }

    @classmethod
    async def investor_profile(cls, founder_id: str, investor_id: str, project_id: Optional[int] = None) -> Dict[str, Any]:
        await InterestService.expire_stale()
        await MatchService.ensure_investors_initialized()
        row = await pg.fetch_one(_PROFILE_SQL + " AND p.user_id = %s", [_demo_ids(), investor_id])
        if not row:
            raise OutreachError("Investor not found.", 404, "not_found")
        project, projects = await cls._pick_project(founder_id, project_id)
        pref = (await cls._preferences([investor_id])).get(investor_id) or {}
        thesis = thesis_from_row(pref)
        rel = (await cls._relationships(project["id"] if project else None, [investor_id])).get(investor_id)

        # Contact details only once this founder has an accepted intro with the investor (any project).
        connected = await pg.fetch_val(
            f"SELECT EXISTS (SELECT 1 FROM project_interests WHERE project_id IN {TEAM_PROJECTS} AND investor_id = %s "
            "AND status = 'accepted') AS c",
            [founder_id, founder_id, investor_id],
        )
        portfolio = row.get("portfolio") or []
        return {
            **cls._identity(row),
            "bio": row.get("bio") or "",
            "value_add": row.get("value_add") or "",
            "portfolio": portfolio if isinstance(portfolio, list) else [],
            "thesis": _public_thesis(thesis),
            "criteria_set": has_criteria(thesis),
            "email": row.get("account_email") if connected and _priv(row)["show_email"] else None,
            "phone": (row.get("phone") or None) if connected and _priv(row)["show_phone"] else None,
            "connected": bool(connected),
            "stats": await cls.response_stats(investor_id),
            "partners": await TeamService.firm_partners_public(investor_id),
            **cls._fit(project, row, pref),
            "relationship": cls._relationship_view(rel),
            "eligibility": await cls._eligibility(founder_id, project, pref, rel) if project else
                           {"can_request": False, "blockers": [{"code": "no_project", "message": "Add a project first."}],
                            "sent_today": 0, "daily_limit": settings.FOUNDER_INTRO_DAILY_LIMIT},
            "project": cls._project_option(project) if project else None,
            "projects": [cls._project_option(p) for p in projects],
            "min_readiness": settings.FOUNDER_INTRO_MIN_READINESS,
        }

    # ------------------------------------------------------------------ requesting an intro

    @staticmethod
    async def _sent_today(founder_id: str) -> int:
        return int(await pg.fetch_val(
            "SELECT count(*) FROM project_interests WHERE founder_id = %s AND initiated_by = 'founder' "
            "AND created_at > now() - interval '1 day'",
            [founder_id],
        ) or 0)

    @classmethod
    async def _eligibility(cls, founder_id: str, project: Dict[str, Any], pref: Dict[str, Any],
                           rel: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Every reason the founder can't send this request right now (rule checks only; the AI check runs on send)."""
        blockers: List[Dict[str, str]] = []

        def block(code: str, message: str) -> None:
            blockers.append({"code": code, "message": message})

        minimum = settings.FOUNDER_INTRO_MIN_READINESS
        if not project.get("is_published"):
            block("not_published", "Publish this project before asking investors for an intro.")
        score = project.get("readiness_score")
        if score is None or float(score) < minimum:
            shown = "not scored yet" if score is None else f"{round(float(score))}"
            block("low_readiness", f"Your readiness score is {shown}. Reach {round(minimum)} to request intros; "
                                   "the Readiness page shows what to improve.")
        reason = MatchService.exclusion_reason(project, pref)
        if reason:
            block("excluded", reason)
        if rel:
            status, by = rel["status"], rel.get("initiated_by") or "investor"
            if status == "accepted":
                block("connected", "You're already connected with this investor for this project.")
            elif status == "pending" and by == "investor":
                block("investor_requested", "This investor already asked for an intro. Accept it in Intros.")
            elif status == "pending":
                block("already_requested", "You've already sent a request for this project. Waiting for a reply.")
            elif status == "declined" and by == "founder":
                block("passed", "This investor passed on this project, so you can't request again for it.")
            elif status == "expired":
                retry = rel["updated_at"] + timedelta(days=RETRY_AFTER_EXPIRY_DAYS)
                if retry > datetime.now(timezone.utc):
                    block("recently_expired", f"Your last request got no response. You can try again from "
                                              f"{retry.strftime('%d %b %Y')}.")
        sent = await cls._sent_today(founder_id)
        from app.services.verification_service import VerificationService
        verified_company = await VerificationService.company_is_verified(project["id"])
        limit = settings.FOUNDER_INTRO_DAILY_LIMIT_VERIFIED if verified_company else settings.FOUNDER_INTRO_DAILY_LIMIT
        if sent >= limit:
            block("daily_limit", f"You've sent {limit} intro requests in the last 24 hours, the daily limit. "
                                 "Try again tomorrow.")
        return {"can_request": not blockers, "blockers": blockers, "sent_today": sent, "daily_limit": limit,
                "company_verified": verified_company}

    @classmethod
    async def request_intro(cls, founder_id: str, investor_id: str, project_id: int, note: str) -> Dict[str, Any]:
        await InterestService.expire_stale(force=True)
        await MatchService.ensure_investors_initialized()
        row = await pg.fetch_one(_PROFILE_SQL + " AND p.user_id = %s", [_demo_ids(), investor_id])
        if not row:
            raise OutreachError("Investor not found.", 404, "not_found")
        project, _ = await cls._pick_project(founder_id, project_id)
        pref = (await cls._preferences([investor_id])).get(investor_id) or {}
        rel = (await cls._relationships(project["id"], [investor_id])).get(investor_id)

        gate = await cls._eligibility(founder_id, project, pref, rel)
        if gate["blockers"]:
            first = gate["blockers"][0]
            status = 429 if first["code"] == "daily_limit" else 409 if first["code"] in (
                "connected", "investor_requested", "already_requested", "passed", "recently_expired") else 422
            raise OutreachError(first["message"], status, first["code"])

        notes = (thesis_from_row(pref).get("additional") or {}).get("notes") or ""
        from app.services.intro_screen import ai_exclusion_reason
        ai_reason = await ai_exclusion_reason(project, notes)
        if ai_reason:
            raise OutreachError(ai_reason, 422, "excluded")

        ident = cls._identity(row)
        founder = await pg.fetch_one(
            "SELECT p.name, u.name AS account_name, u.email FROM app_users u "
            "LEFT JOIN founder_profiles p ON p.user_id = u.id WHERE u.id = %s",
            [founder_id],
        ) or {}
        founder_name = founder.get("name") or founder.get("account_name") or "A founder"
        now = datetime.now(timezone.utc)
        doc = {
            "id": rel["id"] if rel else f"intro-{project['id']}-{investor_id}",
            "project_id": project["id"],
            "project_title": project["title"],
            "project_industry": project.get("industry"),
            "investor_id": investor_id,
            "investor_name": ident["name"],
            "investor_firm": ident["firm"] or "Independent investor",
            "investor_email": row.get("account_email"),
            "founder_id": founder_id,
            "founder_name": founder_name,
            "founder_email": founder.get("email"),
            "status": "pending",
            "initiated_by": "founder",
            "pass_reason": None,
            "responded_at": None,
            "response_note": None,
            "message": note.strip(),
            "created_at": now,
            "updated_at": now,
        }
        await pg.upsert("project_interests", doc, ["project_id", "investor_id"],
                        update=[c for c in doc if c not in ("id", "project_id", "investor_id")])

        try:
            from app.services.notification_service import NotificationService
            await NotificationService.create_notification(
                category="founder_responses",
                target_role="INVESTOR",
                user_id=investor_id,
                title=f"{founder_name} wants to connect: {project['title']}",
                desc=f"{project['title']} ({project.get('industry') or 'Startup'}) asked for an intro. "
                     "Reply Interested or Pass in Deal Flow.",
                badge="Intro request",
                badge_variant="primary",
                link="/investor/deal-flow",
            )
        except Exception as e:
            logger.warning("Failed to notify investor of founder intro request: %s", e)
        try:
            if row.get("account_email"):
                from app.services.email_service import EmailService
                if await email_allowed(investor_id, "founder_responses"):
                    EmailService.send_founder_intro_request_email(
                        investor_email=row["account_email"],
                        investor_name=ident["name"],
                        founder_name=founder_name,
                        project_title=project["title"],
                        summary=_summary(project),
                        note=note.strip(),
                    )
        except Exception as e:
            logger.warning("Failed to email investor about founder intro request: %s", e)

        saved = await InterestService.get_by_id(doc["id"])
        if saved:
            saved["investor_email"] = None  # shared only after the investor says Interested
        return saved or doc

    # ------------------------------------------------------------------ investor reply

    @classmethod
    async def respond(cls, investor_id: str, interest_id: str, decision: str,
                      reason: Optional[str], note: Optional[str]) -> Dict[str, Any]:
        await InterestService.expire_stale(force=True)
        current = await InterestService.get_by_id(interest_id)
        if not current or current.get("investor_id") != investor_id:
            raise OutreachError("Request not found.", 404, "not_found")
        if (current.get("initiated_by") or "investor") != "founder":
            raise OutreachError("Only founders' requests are answered here.", 400, "not_founder_request")
        if current["status"] == "expired":
            raise OutreachError("This request expired after 14 days without a reply.", 409, "expired")
        if current["status"] != "pending":
            raise OutreachError("You've already replied to this request.", 409, "already_replied")

        now = datetime.now(timezone.utc)
        note = (note or "").strip() or None
        title = current.get("project_title") or "your project"
        investor = current.get("investor_name") or "The investor"
        firm = current.get("investor_firm")
        who = f"{investor} ({firm})" if firm else investor
        from app.services.notification_service import NotificationService

        if decision == "interested":
            updated = await InterestService.update_status(
                interest_id, "accepted", response_note=note, notify=False,
                extra_fields={"responded_at": now, "pass_reason": None},
            )
            try:
                await NotificationService.create_notification(
                    category="investor_interest",
                    target_role="FOUNDER", user_id=current["founder_id"],
                    title=f"{investor} is interested in {title}",
                    desc=f"{who} said Interested. Your deal room is open.",
                    badge="Interested", badge_variant="success",
                    link="/founder/dashboard?tab=intros",
                )
            except Exception as e:
                logger.warning("Failed to notify founder of investor interest: %s", e)
            return updated or current

        if not reason:
            raise OutreachError("Choose a reason for passing.", 422, "reason_required")
        updated = await InterestService.update_status(
            interest_id, "declined", response_note=note, notify=False,
            extra_fields={"responded_at": now, "pass_reason": reason},
        )
        try:
            await NotificationService.create_notification(
                category="investor_interest",
                target_role="FOUNDER", user_id=current["founder_id"],
                title=f"{investor} passed on {title}",
                desc=f"Reason: {PASS_REASONS.get(reason, 'Other')}." + (f" \"{note}\"" if note else ""),
                badge="Passed", badge_variant="secondary",
                link="/founder/dashboard?tab=intros",
            )
        except Exception as e:
            logger.warning("Failed to notify founder of investor pass: %s", e)
        return updated or current
