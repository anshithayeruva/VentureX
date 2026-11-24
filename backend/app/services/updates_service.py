"""Founder updates to their investors: drafted and sent by the founder, read and answered by investors.

Recipients are fixed when an update is sent:
  * "investors": investors who recorded an active investment in this company in their portfolio;
  * "investors_and_connected": also investors with an accepted intro (an open deal room).
Sending can refresh the project's public traction, and an investor can apply a reported post-money
valuation to their holding (their ownership % x post-money), so portfolio values don't go stale.
"""
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.services.settings_service import email_allowed
from app.database import postgres as pg
from app.utils.money import inr

logger = logging.getLogger(__name__)

QUARTER_MONTHS = {1: "Q1", 2: "Q1", 3: "Q1", 4: "Q2", 5: "Q2", 6: "Q2", 7: "Q3", 8: "Q3", 9: "Q3",
                  10: "Q4", 11: "Q4", 12: "Q4"}


class UpdateError(Exception):
    def __init__(self, message: str, status: int = 400, code: str = "invalid"):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code


def _now() -> datetime:
    return datetime.now(timezone.utc)


def default_label(period_type: str, period_end: date) -> str:
    if period_type == "quarter":
        return f"{QUARTER_MONTHS[period_end.month]} {period_end.year}"
    return period_end.strftime("%B %Y")


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _with_runway(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """Runway in months from cash and burn, when both are reported."""
    m = dict(metrics or {})
    cash, burn = _num(m.get("cash_in_bank")), _num(m.get("monthly_burn"))
    m["runway_months"] = round(cash / burn, 1) if cash is not None and burn else None
    return m


def _add_months(d: date, months: int) -> date:
    y, mo = divmod(d.month - 1 + months, 12)
    y, mo = d.year + y, mo + 1
    import calendar
    return date(y, mo, min(d.day, calendar.monthrange(y, mo)[1]))


class UpdatesService:
    # ------------------------------------------------------------------ founders

    @staticmethod
    async def _owned_project(founder_id: str, project_id: int) -> Dict[str, Any]:
        p = await pg.fetch_one("SELECT id, founder_id, title FROM projects WHERE id = %s", [project_id])
        from app.services.team_service import TeamService
        if not await TeamService.can_work_on(founder_id, p):
            raise UpdateError("Project not found.", 404, "not_found")
        return p

    @staticmethod
    async def _owned_update(founder_id: str, update_id: int) -> Dict[str, Any]:
        u = await pg.fetch_one("SELECT * FROM company_updates WHERE id = %s", [update_id])
        from app.services.team_service import TeamService
        if not u or not (u["founder_id"] == founder_id or await TeamService.can_work_on(
                founder_id, await pg.fetch_one("SELECT id, founder_id FROM projects WHERE id = %s", [u["project_id"]]))):
            raise UpdateError("Update not found.", 404, "not_found")
        return u

    @staticmethod
    async def audience(project_id: int, audience: str) -> List[Dict[str, Any]]:
        """Who would receive an update now, with why."""
        rows = await pg.fetch_all(
            """
            SELECT DISTINCT ON (x.investor_id) x.investor_id, x.reason,
                   COALESCE(NULLIF(p.name, ''), u.name, 'Investor') AS name, COALESCE(p.firm, u.organization, '') AS firm
            FROM (
                SELECT investor_id, 'investor' AS reason, 1 AS rank FROM investments
                WHERE project_id = %s AND status = 'active'
                UNION ALL
                SELECT investor_id, 'connected' AS reason, 2 AS rank FROM project_interests
                WHERE project_id = %s AND status = 'accepted' AND %s
            ) x
            LEFT JOIN investor_profiles p ON p.user_id = x.investor_id
            LEFT JOIN app_users u ON u.id = x.investor_id
            ORDER BY x.investor_id, x.rank
            """,
            [project_id, project_id, audience == "investors_and_connected"],
        )
        return sorted(rows, key=lambda r: (r["reason"] != "investor", (r["name"] or "").lower()))

    @staticmethod
    def _out(u: Dict[str, Any]) -> Dict[str, Any]:
        return {**u, "metrics": _with_runway(u.get("metrics") or {}), "asks": u.get("asks") or []}

    @classmethod
    async def list_for_project(cls, founder_id: str, project_id: int) -> Dict[str, Any]:
        project = await cls._owned_project(founder_id, project_id)
        rows = await pg.fetch_all(
            """
            SELECT u.*,
                   (SELECT count(*) FROM company_update_recipients r WHERE r.update_id = u.id AND r.read_at IS NOT NULL) AS read_count,
                   (SELECT count(*) FROM company_update_responses s WHERE s.update_id = u.id) AS responses_count
            FROM company_updates u WHERE u.project_id = %s
            ORDER BY (u.status = 'draft') DESC, u.period_end DESC, u.id DESC
            """,
            [project_id],
        )
        sent = [r for r in rows if r["status"] == "sent"]
        last = sent[0] if sent else None
        next_due = None
        if last:
            next_due = _add_months(last["period_end"], 3 if last["period_type"] == "quarter" else 1)
        reach = {a: len(await cls.audience(project_id, a)) for a in ("investors", "investors_and_connected")}
        return {
            "project": project,
            "updates": [cls._out(r) for r in rows],
            "last_sent_at": last["sent_at"] if last else None,
            "next_due": next_due,
            "audience_counts": reach,
        }

    @classmethod
    async def create(cls, founder_id: str, project_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        await cls._owned_project(founder_id, project_id)
        doc = cls._fields(data)
        row = await pg.insert("company_updates", {**doc, "project_id": project_id, "founder_id": founder_id,
                                                  "status": "draft", "created_at": _now(), "updated_at": _now()})
        return await cls.founder_detail(founder_id, row["id"])

    @staticmethod
    def _fields(data: Dict[str, Any]) -> Dict[str, Any]:
        label = (data.get("period_label") or "").strip() or default_label(data["period_type"], data["period_end"])
        metrics = {k: v for k, v in (data.get("metrics") or {}).items() if v not in (None, [], "")}
        return {
            "period_type": data["period_type"], "period_end": data["period_end"], "period_label": label,
            "metrics": pg.Jsonb(metrics), "highlights": data.get("highlights", "").strip(),
            "challenges": data.get("challenges", "").strip(), "asks": pg.Jsonb(data.get("asks") or []),
            "audience": data.get("audience", "investors"),
        }

    @classmethod
    async def edit(cls, founder_id: str, update_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        u = await cls._owned_update(founder_id, update_id)
        if u["status"] != "draft":
            raise UpdateError("Sent updates can't be edited.", 409, "already_sent")
        await pg.update_where("company_updates", {**cls._fields(data), "updated_at": _now()}, "id = %s", [update_id])
        return await cls.founder_detail(founder_id, update_id)

    @classmethod
    async def delete(cls, founder_id: str, update_id: int) -> None:
        u = await cls._owned_update(founder_id, update_id)
        if u["status"] != "draft":
            raise UpdateError("Sent updates can't be deleted.", 409, "already_sent")
        await pg.execute("DELETE FROM company_updates WHERE id = %s", [update_id])

    @classmethod
    async def _previous(cls, update: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        prev = await pg.fetch_one(
            "SELECT period_label, metrics FROM company_updates WHERE project_id = %s AND status = 'sent' "
            "AND id <> %s AND period_end < %s ORDER BY period_end DESC LIMIT 1",
            [update["project_id"], update["id"], update["period_end"]],
        )
        return {"period_label": prev["period_label"], "metrics": _with_runway(prev["metrics"])} if prev else None

    @classmethod
    async def founder_detail(cls, founder_id: str, update_id: int) -> Dict[str, Any]:
        u = await cls._owned_update(founder_id, update_id)
        project = await pg.fetch_one("SELECT id, title FROM projects WHERE id = %s", [u["project_id"]])
        if u["status"] == "sent":
            recipients = await pg.fetch_all(
                """
                SELECT r.investor_id, r.reason, r.read_at,
                       COALESCE(NULLIF(p.name, ''), a.name, 'Investor') AS name, COALESCE(p.firm, '') AS firm
                FROM company_update_recipients r
                LEFT JOIN investor_profiles p ON p.user_id = r.investor_id LEFT JOIN app_users a ON a.id = r.investor_id
                WHERE r.update_id = %s ORDER BY name
                """, [update_id])
        else:
            recipients = [{**r, "read_at": None} for r in await cls.audience(u["project_id"], u["audience"])]
        responses = await pg.fetch_all(
            """
            SELECT s.id, s.ask_index, s.message, s.created_at, s.investor_id,
                   COALESCE(NULLIF(p.name, ''), a.name, 'Investor') AS name, COALESCE(p.firm, '') AS firm
            FROM company_update_responses s
            LEFT JOIN investor_profiles p ON p.user_id = s.investor_id LEFT JOIN app_users a ON a.id = s.investor_id
            WHERE s.update_id = %s ORDER BY s.created_at
            """, [update_id])
        return {**cls._out(u), "project": project, "recipients": recipients, "responses": responses,
                "previous": await cls._previous(u)}

    @classmethod
    async def send(cls, founder_id: str, update_id: int, apply_to_project: bool) -> Dict[str, Any]:
        u = await cls._owned_update(founder_id, update_id)
        if u["status"] != "draft":
            raise UpdateError("This update was already sent.", 409, "already_sent")
        m = u.get("metrics") or {}
        if not (u["highlights"] or u["challenges"] or u["asks"] or any(k != "custom" for k in m) or m.get("custom")):
            raise UpdateError("Add at least one metric, highlight, challenge or ask before sending.", 422, "empty")
        recipients = await cls.audience(u["project_id"], u["audience"])
        if not recipients:
            raise UpdateError(
                "No one to send to yet. Investors receive updates once they record their investment in this company "
                "on VentureX" + ("" if u["audience"] == "investors_and_connected"
                                 else ", or choose to include investors you're connected with") + ".",
                422, "no_recipients")
        now = _now()
        await pg.run_batch(
            [("INSERT INTO company_update_recipients (update_id, investor_id, reason) VALUES (%s, %s, %s) "
              "ON CONFLICT DO NOTHING", [update_id, r["investor_id"], r["reason"]]) for r in recipients]
            + [("UPDATE company_updates SET status = 'sent', sent_at = %s, recipients_count = %s, updated_at = %s "
                "WHERE id = %s", [now, len(recipients), now, update_id])]
        )
        project = await pg.fetch_one("SELECT id, title FROM projects WHERE id = %s", [u["project_id"]])
        if apply_to_project:
            fields: Dict[str, Any] = {}
            if m.get("monthly_revenue") is not None:
                fields["monthly_revenue"] = float(m["monthly_revenue"])
            if m.get("customers") is not None:
                fields["customer_count"] = int(m["customers"])
            if m.get("headcount") is not None:
                fields["team_size"] = int(m["headcount"])
            if fields:
                await pg.update_where("projects", {**fields, "updated_at": now}, "id = %s", [u["project_id"]])
        await cls._notify_investors(project, u, recipients)
        return await cls.founder_detail(founder_id, update_id)

    @staticmethod
    async def _notify_investors(project: Dict[str, Any], u: Dict[str, Any], recipients: List[Dict[str, Any]]) -> None:
        from app.services.email_service import EmailService
        from app.services.notification_service import NotificationService
        emails = {r["id"]: r["email"] for r in await pg.fetch_all(
            "SELECT id, email FROM app_users WHERE id = ANY(%s::text[])",
            ["{" + ",".join(r["investor_id"] for r in recipients) + "}"])}
        teaser = (u["highlights"] or u["challenges"] or "New metrics and asks.").strip().splitlines()[0][:160]
        for r in recipients:
            try:
                await NotificationService.create_notification(
                    category="company_updates",
                    target_role="INVESTOR", user_id=r["investor_id"],
                    title=f"{project['title']}: {u['period_label']} update",
                    desc=teaser, badge="Update", badge_variant="primary", link=f"/investor/updates?update={u['id']}",
                )
                if emails.get(r["investor_id"]):
                    if await email_allowed(r["investor_id"], "company_updates"):
                        EmailService.send_company_update_email(
                            emails[r["investor_id"]], r["name"], project["title"], u["period_label"], teaser, u["id"])
            except Exception as e:
                logger.warning("Could not notify %s of update %s: %s", r["investor_id"], u["id"], e)

    # ------------------------------------------------------------------ investors

    @classmethod
    async def feed(cls, investor_id: str, project_id: Optional[int] = None, unread_only: bool = False,
                   page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        where, params = ["r.investor_id = %s", "u.status = 'sent'"], [investor_id]
        if project_id:
            where.append("u.project_id = %s")
            params.append(project_id)
        if unread_only:
            where.append("r.read_at IS NULL")
        rows = await pg.fetch_all(
            f"""
            SELECT u.id, u.project_id, u.period_type, u.period_label, u.period_end, u.metrics, u.highlights,
                   u.challenges, u.asks, u.sent_at, r.read_at, p.title AS project_title, p.industry AS project_industry,
                   count(*) OVER () AS total
            FROM company_update_recipients r JOIN company_updates u ON u.id = r.update_id
            JOIN projects p ON p.id = u.project_id
            WHERE {' AND '.join(where)}
            ORDER BY u.sent_at DESC, u.id DESC OFFSET %s LIMIT %s
            """,
            [*params, (page - 1) * page_size, page_size],
        )
        total = int(rows[0]["total"]) if rows else 0
        ids = [r["id"] for r in rows]
        responses: Dict[int, List[Dict[str, Any]]] = {}
        if ids:
            for s in await pg.fetch_all(
                "SELECT id, update_id, ask_index, message, created_at FROM company_update_responses "
                "WHERE investor_id = %s AND update_id = ANY(%s::bigint[]) ORDER BY created_at",
                [investor_id, "{" + ",".join(str(i) for i in ids) + "}"]):
                responses.setdefault(s["update_id"], []).append(s)
        holdings = {h["project_id"]: h for h in await pg.fetch_all(
            "SELECT DISTINCT ON (project_id) id, project_id, ownership_pct::text AS ownership_pct FROM investments "
            "WHERE investor_id = %s AND project_id IS NOT NULL ORDER BY project_id, id", [investor_id])}
        items = []
        for r in rows:
            r.pop("total", None)
            item = {**cls._out(r), "my_responses": responses.get(r["id"], []),
                    "previous": await cls._previous(r)}
            h = holdings.get(r["project_id"])
            pm = _num((r.get("metrics") or {}).get("post_money_valuation"))
            item["holding"] = None
            if h:
                pct = _num(h["ownership_pct"])
                item["holding"] = {
                    "investment_id": h["id"], "ownership_pct": pct,
                    "suggested_value": round(pct / 100 * pm, 2) if pct is not None and pm is not None else None,
                }
            items.append(item)
        unread = await cls.unread_count(investor_id)
        return {"items": items, "total": total, "page": page, "page_size": page_size, "unread": unread}

    @staticmethod
    async def unread_count(investor_id: str) -> int:
        return int(await pg.fetch_val(
            "SELECT count(*) FROM company_update_recipients r JOIN company_updates u ON u.id = r.update_id "
            "WHERE r.investor_id = %s AND r.read_at IS NULL AND u.status = 'sent'", [investor_id]) or 0)

    @staticmethod
    async def _recipient(investor_id: str, update_id: int) -> Dict[str, Any]:
        row = await pg.fetch_one(
            "SELECT u.*, p.title AS project_title, r.read_at FROM company_update_recipients r "
            "JOIN company_updates u ON u.id = r.update_id JOIN projects p ON p.id = u.project_id "
            "WHERE r.update_id = %s AND r.investor_id = %s", [update_id, investor_id])
        if not row:
            raise UpdateError("Update not found.", 404, "not_found")
        return row

    @classmethod
    async def mark_read(cls, investor_id: str, update_id: int) -> None:
        await cls._recipient(investor_id, update_id)
        await pg.execute("UPDATE company_update_recipients SET read_at = COALESCE(read_at, now()) "
                         "WHERE update_id = %s AND investor_id = %s", [update_id, investor_id])

    @classmethod
    async def respond(cls, investor_id: str, update_id: int, message: str, ask_index: Optional[int]) -> Dict[str, Any]:
        u = await cls._recipient(investor_id, update_id)
        asks = u.get("asks") or []
        if ask_index is not None and ask_index >= len(asks):
            raise UpdateError("That ask isn't in this update.", 422, "bad_ask")
        row = await pg.insert("company_update_responses", {
            "update_id": update_id, "investor_id": investor_id, "ask_index": ask_index, "message": message.strip()})
        await pg.execute("UPDATE company_update_recipients SET read_at = COALESCE(read_at, now()) "
                         "WHERE update_id = %s AND investor_id = %s", [update_id, investor_id])
        who = await pg.fetch_one(
            "SELECT COALESCE(NULLIF(p.name, ''), a.name, 'An investor') AS name, COALESCE(p.firm, '') AS firm "
            "FROM app_users a LEFT JOIN investor_profiles p ON p.user_id = a.id WHERE a.id = %s", [investor_id]) or {}
        name = who.get("name") or "An investor"
        about = f"your ask “{asks[ask_index]}”" if ask_index is not None else f"your {u['period_label']} update"
        try:
            from app.services.notification_service import NotificationService
            await NotificationService.create_notification(
                category="connections",
                target_role="FOUNDER", user_id=u["founder_id"],
                title=f"{name} replied to {about}"[:200], desc=message.strip()[:200],
                badge="Reply", badge_variant="primary", link=f"/founder/updates?update={update_id}",
            )
            founder_email = await pg.fetch_val("SELECT email FROM app_users WHERE id = %s", [u["founder_id"]])
            if founder_email:
                from app.services.email_service import EmailService
                if await email_allowed(u["founder_id"], "connections"):
                    EmailService.send_update_reply_email(founder_email, name, who.get("firm") or "", u["project_title"],
                                                         about, message.strip(), update_id)
        except Exception as e:
            logger.warning("Could not notify founder of reply on update %s: %s", update_id, e)
        return row

    @classmethod
    async def apply_valuation(cls, investor_id: str, update_id: int, investment_id: int) -> Dict[str, Any]:
        """Record the reported post-money valuation on the investor's holding: ownership % x post-money."""
        u = await cls._recipient(investor_id, update_id)
        pm = _num((u.get("metrics") or {}).get("post_money_valuation"))
        if pm is None:
            raise UpdateError("This update doesn't report a valuation.", 422, "no_valuation")
        inv = await pg.fetch_one("SELECT id, project_id, ownership_pct::text AS ownership_pct, investment_date "
                                 "FROM investments WHERE id = %s AND investor_id = %s", [investment_id, investor_id])
        if not inv or inv["project_id"] != u["project_id"]:
            raise UpdateError("Choose your holding in this company.", 404, "not_found")
        pct = _num(inv["ownership_pct"])
        if pct is None:
            raise UpdateError("Add your ownership % to this holding first, so its value can be worked out.", 422,
                              "no_ownership")
        from app.schemas.portfolio import ValuationCreate
        from app.services.portfolio_service import PortfolioService
        when = max(u["period_end"], inv["investment_date"])
        value = (Decimal(str(pct)) / 100 * Decimal(str(pm))).quantize(Decimal("0.01"))
        return await PortfolioService.add_valuation(investor_id, investment_id, ValuationCreate(
            valuation_date=min(when, date.today()), value=value, source="company_report",
            note=f"{u['project_title']} {u['period_label']} update: post-money {inr(pm)} × {pct:g}%"[:500],
        ))
