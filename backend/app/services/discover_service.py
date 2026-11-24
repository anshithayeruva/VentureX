"""Investor-side discovery (search over published startups) and the Deal Flow pipeline."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from app.database import postgres as pg
from app.services.criteria import REGIONS, _STAGE_ALIASES, has_criteria, thesis_from_row

# Only public facts leave this service: never readiness scores, AI feedback or contact details.
_PUBLIC = (
    "p.id, p.title, p.tagline, p.description, p.problem, p.solution, p.demo_url, p.industry, p.stage, p.funding_required, p.business_model, "
    "p.target_market, p.website, p.country, p.city, p.monthly_revenue, p.customer_count, p.product_status, "
    "p.team_size, p.technical_founder, p.repeat_founder, p.domain_expertise, p.full_time_team, p.ip_protected, "
    "p.created_at"
)

SORTS = {
    "fit": "m.match_score DESC NULLS LAST, p.created_at DESC",
    "newest": "p.created_at DESC",
    "raise_asc": "p.funding_required ASC, p.created_at DESC",
    "raise_desc": "p.funding_required DESC, p.created_at DESC",
}


def pg_text_array(values: List[str]) -> str:
    """A Postgres text[] literal, safely quoted."""
    def q(v: str) -> str:
        return '"' + v.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return "{" + ",".join(q(v) for v in values) + "}"


def _raw_stage_names(stages: List[str]) -> List[str]:
    wanted = {s.lower() for s in stages}
    names = {alias for alias, canon in _STAGE_ALIASES.items() if canon.lower() in wanted}
    return sorted(names | wanted)


class DiscoverService:
    @classmethod
    async def search(
        cls,
        investor_id: str,
        q: Optional[str] = None,
        industries: Optional[List[str]] = None,
        stages: Optional[List[str]] = None,
        business_models: Optional[List[str]] = None,
        countries: Optional[List[str]] = None,
        regions: Optional[List[str]] = None,
        min_raise: Optional[float] = None,
        max_raise: Optional[float] = None,
        min_monthly_revenue: Optional[float] = None,
        min_customers: Optional[int] = None,
        live_product: bool = False,
        matched_only: bool = False,
        saved_only: bool = False,
        verified_only: bool = False,
        round_status: Optional[str] = None,
        ticket_min: Optional[float] = None,
        ticket_max: Optional[float] = None,
        sort: str = "fit",
        page: int = 1,
        page_size: int = 12,
        limited: bool = False,
    ) -> Dict[str, Any]:
        if page == 1 and not await pg.fetch_val(
            "SELECT EXISTS (SELECT 1 FROM matches WHERE investor_id = %s) AS e", [investor_id]
        ):
            # Fit scores are stored when criteria or startups change; an investor who has none
            # yet (new account, never saved criteria) gets them computed now.
            from app.services.match_service import MatchService
            await MatchService.compute_matches_for_investor(investor_id)

        where = ["p.is_published"]
        params: List[Any] = [investor_id, investor_id, investor_id, investor_id]

        if q and q.strip():
            pattern = f"%{pg.escape_like(q.strip()[:100])}%"
            where.append(
                "(p.title ILIKE %s OR p.tagline ILIKE %s OR p.description ILIKE %s "
                "OR p.industry ILIKE %s OR p.target_market ILIKE %s)"
            )
            params.extend([pattern] * 5)
        if industries:
            where.append("lower(p.industry) = ANY(%s::text[])")
            params.append(pg_text_array([i.lower() for i in industries]))
        if stages:
            where.append("lower(p.stage) = ANY(%s::text[])")
            params.append(pg_text_array(_raw_stage_names(stages)))
        if business_models:
            where.append("lower(p.business_model) = ANY(%s::text[])")
            params.append(pg_text_array([m.lower() for m in business_models]))
        place = [c.lower() for c in (countries or [])]
        for r in regions or []:
            place += [c.lower() for c in REGIONS.get(r, [])]
        if place:
            where.append("lower(p.country) = ANY(%s::text[])")
            params.append(pg_text_array(sorted(set(place))))
        if min_raise is not None:
            where.append("p.funding_required >= %s")
            params.append(min_raise)
        if max_raise is not None:
            where.append("p.funding_required <= %s")
            params.append(max_raise)
        if min_monthly_revenue is not None:
            where.append("p.monthly_revenue >= %s AND COALESCE((fps.settings->'privacy'->>'share_traction')::boolean, TRUE)")
            params.append(min_monthly_revenue)
        if min_customers is not None:
            where.append("p.customer_count >= %s AND COALESCE((fps.settings->'privacy'->>'share_traction')::boolean, TRUE)")
            params.append(min_customers)
        if live_product:
            where.append("p.product_status IN ('launched', 'scaling')")
        if matched_only:
            where.append("m.match_score IS NOT NULL")
        if saved_only:
            where.append("s.project_id IS NOT NULL")
        if verified_only:
            where.append("cv.status = 'verified'")
        if round_status == "open":
            where.append("fr.id IS NOT NULL")
        elif round_status == "none":
            where.append("fr.id IS NULL")
        if ticket_min is not None or ticket_max is not None:
            # Startups whose open round accepts a ticket inside the investor's range.
            where.append("fr.id IS NOT NULL")
            if ticket_min is not None:
                where.append("(fr.max_ticket IS NULL OR fr.max_ticket >= %s)")
                params.append(ticket_min)
            if ticket_max is not None:
                where.append("(fr.min_ticket IS NULL OR fr.min_ticket <= %s)")
                params.append(ticket_max)

        order = SORTS.get(sort, SORTS["fit"])
        sql = f"""
            SELECT {_PUBLIC},
                   m.match_score, m.reasons,
                   (s.project_id IS NOT NULL) AS saved,
                   i.id AS interest_id, i.status AS interest_status, i.initiated_by AS interest_initiated_by,
                   d.id AS room_id, d.stage AS deal_stage,
                   COALESCE(cv.status = 'verified', FALSE) AS company_verified,
                   (p.logo_path IS NOT NULL) AS has_logo,
                   COALESCE((fps.settings->'privacy'->>'share_traction')::boolean, TRUE) AS share_traction,
                   count(*) OVER () AS total
            FROM projects p
            LEFT JOIN company_verifications cv ON cv.project_id = p.id
            LEFT JOIN founder_profiles fps ON fps.user_id = p.founder_id
            LEFT JOIN funding_rounds fr ON fr.project_id = p.id AND fr.status = 'open'
            LEFT JOIN matches m ON m.project_id = p.id AND m.investor_id = %s
            LEFT JOIN saved_opportunities s ON s.project_id = p.id AND s.investor_id = %s
            LEFT JOIN project_interests i ON i.project_id = p.id AND i.investor_id = %s
            LEFT JOIN LATERAL (
                SELECT id, stage FROM deal_rooms
                WHERE project_id = p.id AND investor_id = %s ORDER BY updated_at DESC LIMIT 1
            ) d ON TRUE
            WHERE {' AND '.join(where)}
            ORDER BY {order}, p.id DESC
            OFFSET %s LIMIT %s
        """
        rows = await pg.fetch_all(sql, [*params, (page - 1) * page_size, page_size])
        total = int(rows[0]["total"]) if rows else 0
        if not rows and page > 1:
            # Past the last page: still report the real total.
            total = int(await pg.fetch_val(
                "SELECT count(*) AS n FROM projects p "
                "LEFT JOIN company_verifications cv ON cv.project_id = p.id "
                "LEFT JOIN founder_profiles fps ON fps.user_id = p.founder_id "
                "LEFT JOIN funding_rounds fr ON fr.project_id = p.id AND fr.status = 'open' "
                "LEFT JOIN matches m ON m.project_id = p.id AND m.investor_id = %s "
                "LEFT JOIN saved_opportunities s ON s.project_id = p.id AND s.investor_id = %s "
                f"WHERE {' AND '.join(where)}",
                [investor_id, investor_id, *params[4:]],
            ) or 0)
        for r in rows:
            r.pop("total", None)
            if limited:
                r["website"] = None
            if not r.pop("share_traction", True):
                r["monthly_revenue"] = None
                r["customer_count"] = None
                r["reasons"] = [
                    {**x, "explanation": "The founder keeps traction figures private."} if x.get("category") == "Traction" else x
                    for x in (r.get("reasons") or [])
                ]
        pref = await pg.fetch_one("SELECT * FROM investor_preferences WHERE investor_id = %s", [investor_id])
        criteria_set = has_criteria(thesis_from_row(pref)) if pref else False
        return {
            "items": rows, "total": total, "page": page, "page_size": page_size,
            "facets": await cls.facets(), "criteria_set": criteria_set,
        }

    @staticmethod
    async def facets() -> Dict[str, List[str]]:
        """Values that actually occur among published startups, for filter menus."""
        row = await pg.fetch_one(
            """
            SELECT
              COALESCE((SELECT jsonb_agg(DISTINCT industry ORDER BY industry) FROM projects WHERE is_published AND industry <> ''), '[]') AS industries,
              COALESCE((SELECT jsonb_agg(DISTINCT business_model ORDER BY business_model) FROM projects WHERE is_published AND business_model <> ''), '[]') AS business_models,
              COALESCE((SELECT jsonb_agg(DISTINCT country ORDER BY country) FROM projects WHERE is_published AND country <> ''), '[]') AS countries
            """
        )
        return row or {"industries": [], "business_models": [], "countries": []}

    # ---------------------------------------------------------------- saved

    @staticmethod
    async def save(investor_id: str, project_id: int) -> None:
        if not await pg.fetch_val("SELECT EXISTS (SELECT 1 FROM projects WHERE id = %s AND is_published) AS e", [project_id]):
            raise HTTPException(status_code=404, detail="Startup not found")
        await pg.upsert(
            "saved_opportunities",
            {"investor_id": investor_id, "project_id": project_id, "created_at": datetime.now(timezone.utc)},
            ["investor_id", "project_id"],
            update=[],
        )

    @staticmethod
    async def unsave(investor_id: str, project_id: int) -> None:
        await pg.execute(
            "DELETE FROM saved_opportunities WHERE investor_id = %s AND project_id = %s", [investor_id, project_id]
        )

    # ---------------------------------------------------------------- deal flow

    @staticmethod
    async def deal_flow(investor_id: str) -> Dict[str, Any]:
        """Every startup the investor is pursuing, in one list, from saved through closed,
        plus founders' requests waiting for the investor's reply."""
        from app.services.interest_service import InterestService
        await InterestService.expire_stale()
        interests = await pg.fetch_all(
            """
            SELECT i.id AS interest_id, i.project_id, i.status AS interest_status, i.created_at, i.updated_at,
                   i.response_note, i.founder_email, i.founder_id, i.initiated_by, i.pass_reason, i.message,
                   i.founder_name AS requester_name,
                   COALESCE(p.title, i.project_title) AS title, COALESCE(p.industry, i.project_industry) AS industry,
                   p.stage, p.funding_required, p.tagline
            FROM project_interests i LEFT JOIN projects p ON p.id = i.project_id
            WHERE i.investor_id = %s
            """,
            [investor_id],
        )
        rooms = await pg.fetch_all(
            """
            SELECT id AS room_id, project_id, interest_id, stage AS deal_stage, project_title, project_industry,
                   founder_name, founder_company, last_message, last_message_at, messages_count, created_at, updated_at
            FROM deal_rooms WHERE investor_id = %s ORDER BY updated_at DESC
            """,
            [investor_id],
        )
        saved = await pg.fetch_all(
            f"""
            SELECT s.created_at AS saved_at, {_PUBLIC}
            FROM saved_opportunities s JOIN projects p ON p.id = s.project_id
            WHERE s.investor_id = %s AND p.is_published
            """,
            [investor_id],
        )
        invested = await pg.fetch_all(
            "SELECT project_id, min(id) AS investment_id FROM investments "
            "WHERE investor_id = %s AND project_id IS NOT NULL GROUP BY project_id",
            [investor_id],
        )
        investment_by_project = {r["project_id"]: r["investment_id"] for r in invested}
        saved_ids = {s["id"] for s in saved}

        items: Dict[int, Dict[str, Any]] = {}
        for i in interests:
            items[i["project_id"]] = {
                "project_id": i["project_id"],
                "title": i["title"] or f"Startup #{i['project_id']}",
                "industry": i["industry"],
                "stage": i["stage"],
                "funding_required": i["funding_required"],
                "tagline": i["tagline"],
                "interest_id": i["interest_id"],
                "interest_status": i["interest_status"],
                "response_note": i["response_note"],
                "initiated_by": i["initiated_by"],
                "pass_reason": i["pass_reason"],
                "message": i["message"] if i["initiated_by"] == "founder" else None,
                "founder_name": i["requester_name"] if i["initiated_by"] == "founder" else None,
                "founder_email": i["founder_email"] if i["interest_status"] == "accepted" else None,
                "_founder_id": i.get("founder_id"),
                "requested_at": i["created_at"],
                "last_activity": i["updated_at"],
            }
        for r in rooms:
            item = items.setdefault(r["project_id"], {
                "project_id": r["project_id"],
                "title": r["project_title"] or f"Startup #{r['project_id']}",
                "industry": r["project_industry"],
                "last_activity": r["updated_at"],
            })
            if "room_id" in item:
                continue  # keep the most recently updated room
            item.update({
                "room_id": r["room_id"],
                "deal_stage": r["deal_stage"],
                "founder_name": r["founder_name"],
                "founder_company": r["founder_company"],
                "last_message": r["last_message"],
                "messages_count": r["messages_count"],
            })
            item["last_activity"] = max(filter(None, [item.get("last_activity"), r["updated_at"], r["last_message_at"]]))
        for s in saved:
            if s["id"] in items:
                continue
            items[s["id"]] = {
                "project_id": s["id"],
                "title": s["title"],
                "industry": s["industry"],
                "stage": s["stage"],
                "funding_required": s["funding_required"],
                "tagline": s["tagline"],
                "last_activity": s["saved_at"],
            }

        from app.services.settings_service import privacy as _privacy
        for item in items.values():
            fid = item.pop("_founder_id", None)
            if item.get("founder_email") and fid and not (await _privacy(fid, "FOUNDER")).get("show_email", True):
                item["founder_email"] = None
        out = []
        for pid, item in items.items():
            stage = item.get("deal_stage")
            interest = item.get("interest_status")
            if stage == "CLOSED":
                bucket = "closed"
            elif stage == "PASSED":
                bucket = "passed"
            elif stage or interest == "accepted":
                bucket = "active"
            elif interest == "pending" and item.get("initiated_by") == "founder":
                bucket = "inbound"  # a founder asked to connect; waiting on this investor
            elif interest == "pending":
                bucket = "requested"
            elif interest == "declined" and item.get("initiated_by") == "founder":
                bucket = "passed"  # the investor passed on the founder's request
            elif interest == "expired":
                bucket = "expired"  # a founder's request the investor never answered
            elif interest == "declined":
                bucket = "declined"
            else:
                bucket = "saved"
            item["status"] = bucket
            item["saved"] = pid in saved_ids
            item["investment_id"] = investment_by_project.get(pid)
            out.append(item)
        out.sort(key=lambda x: x.get("last_activity") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        counts: Dict[str, int] = {}
        for item in out:
            counts[item["status"]] = counts.get(item["status"], 0) + 1
        return {"items": out, "counts": counts}
