"""Funding rounds and investment allocations: the authoritative record both portals read.

Lifecycle of an allocation (an investor's place in a round):
  proposed   the investor offered an amount (expressing interest in a startup is NOT a proposal)
  accepted   the founder agreed terms (amount, and equity % or valuation if negotiated)
  committed  the investor confirmed those terms; counts toward committed capital
  partially_funded / funded   capital received against the commitment (founder-recorded receipts)
  rejected / cancelled        no longer counts
Founders can also record commitments from investors who aren't on VentureX ("external"); those start
committed and are labelled as founder-recorded.

Calculations (Decimal, done here only; the web app displays them):
  committed  = sum of committed_amount for committed, partially_funded and funded allocations
  received   = sum of receipts minus refunds on those allocations
  remaining  = max(target - committed, 0);  unreceived = committed - received
  progress   = committed / target (may exceed 100% when oversubscribed)
Ownership: an agreed equity % is shown as agreed. For priced equity without one, an INDICATIVE % is
amount / post-money, where post-money is the round's stated post-money or pre-money + committed so far.
SAFEs and convertible notes have no ownership until they convert; their cap and discount are shown.
"""
import logging
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Optional

from app.database import postgres as pg

logger = logging.getLogger(__name__)

ZERO = Decimal("0")
CENT = Decimal("0.01")
COUNTED = ("committed", "partially_funded", "funded")
NEGOTIATING = ("proposed", "accepted")
_MONEY_COLS = ("target_amount", "min_ticket", "max_ticket", "pre_money_valuation", "post_money_valuation",
               "valuation_cap", "discount_pct")
_ALLOC_MONEY = ("proposed_amount", "committed_amount", "agreed_equity_pct", "agreed_valuation", "discount_pct")


class FundingError(Exception):
    def __init__(self, message: str, status: int = 400, code: str = "invalid"):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code


def _d(v: Any) -> Optional[Decimal]:
    return None if v in (None, "") else Decimal(str(v))


def _s(v: Optional[Decimal]) -> Optional[str]:
    return None if v is None else str(v.quantize(CENT, rounding=ROUND_HALF_UP))


def _pct(num: Decimal, den: Decimal, places: str = "0.01") -> Optional[str]:
    if not den:
        return None
    return str((num / den * 100).quantize(Decimal(places), rounding=ROUND_HALF_UP))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cols(cols, prefix: str) -> str:
    return ", ".join(f"{prefix}.{c}::text AS {c}" for c in cols)


class FundingService:
    # ------------------------------------------------------------------ loading

    @staticmethod
    async def _rounds(where: str, params: List[Any]) -> List[Dict[str, Any]]:
        rows = await pg.fetch_all(
            f"SELECT r.id, r.project_id, r.created_by, r.name, r.round_type, r.instrument, r.currency, r.status, "
            f"r.opens_on, r.closes_on, r.disclose_progress, r.created_at, r.updated_at, {_cols(_MONEY_COLS, 'r')} "
            f"FROM funding_rounds r WHERE {where} ORDER BY r.created_at DESC", params)
        return rows

    @staticmethod
    async def _allocations(round_ids: List[int]) -> List[Dict[str, Any]]:
        if not round_ids:
            return []
        return await pg.fetch_all(
            f"""
            SELECT a.id, a.round_id, a.project_id, a.investor_id, a.firm_id, a.external_investor_name, a.instrument,
                   a.currency, a.status, a.terms, a.investor_note, a.founder_note, a.committed_on, a.created_by,
                   a.created_at, a.updated_at, {_cols(_ALLOC_MONEY, 'a')},
                   COALESCE((SELECT sum(CASE WHEN t.type = 'receipt' THEN t.amount ELSE -t.amount END)
                             FROM round_investment_transactions t WHERE t.allocation_id = a.id), 0)::text AS received,
                   COALESCE(NULLIF(ip.name, ''), u.name, a.external_investor_name, 'Investor') AS investor_name,
                   COALESCE(f.name, NULLIF(ip.firm, ''), '') AS investor_firm
            FROM round_investments a
            LEFT JOIN investor_profiles ip ON ip.user_id = a.investor_id
            LEFT JOIN app_users u ON u.id = a.investor_id
            LEFT JOIN firms f ON f.id = a.firm_id
            WHERE a.round_id = ANY(%s::bigint[])
            ORDER BY a.created_at
            """, ["{" + ",".join(str(i) for i in round_ids) + "}"])

    # ------------------------------------------------------------------ calculations

    @staticmethod
    def summarize(rnd: Dict[str, Any], allocs: List[Dict[str, Any]]) -> Dict[str, Any]:
        target = _d(rnd["target_amount"]) or ZERO
        counted = [a for a in allocs if a["status"] in COUNTED]
        committed = sum((_d(a["committed_amount"]) or ZERO for a in counted), ZERO)
        received = sum((_d(a["received"]) or ZERO for a in counted), ZERO)
        negotiating = [a for a in allocs if a["status"] in NEGOTIATING]
        in_negotiation = sum(((_d(a["committed_amount"]) if a["status"] == "accepted" else _d(a["proposed_amount"])) or ZERO
                              for a in negotiating), ZERO)
        investors = {a["investor_id"] or f"ext:{a['id']}" for a in counted}
        return {
            "target": _s(target),
            "committed": _s(committed),
            "received": _s(received),
            "remaining": _s(max(target - committed, ZERO)),
            "unreceived_committed": _s(committed - received),
            "oversubscribed_by": _s(committed - target) if committed > target else None,
            "committed_pct": _pct(committed, target),
            "received_pct": _pct(received, target),
            "investor_count": len(investors),
            "in_negotiation": _s(in_negotiation),
            "in_negotiation_count": len(negotiating),
        }

    @staticmethod
    def ownership(rnd: Dict[str, Any], alloc: Dict[str, Any], round_committed: Decimal) -> Dict[str, Any]:
        """Agreed equity, or a clearly labelled indicative figure for priced equity; none for SAFEs/notes."""
        instrument = alloc["instrument"]
        amount = _d(alloc["committed_amount"]) or _d(alloc["proposed_amount"]) or ZERO
        agreed = _d(alloc["agreed_equity_pct"])
        out: Dict[str, Any] = {"instrument": instrument, "agreed_equity_pct": _s(agreed) if agreed else None,
                               "indicative_equity_pct": None, "basis": None}
        if agreed:
            out["basis"] = "Agreed in the investment terms."
            return out
        if instrument in ("safe", "convertible_note"):
            cap = _d(alloc["agreed_valuation"]) or _d(rnd.get("valuation_cap"))
            disc = _d(alloc["discount_pct"]) or _d(rnd.get("discount_pct"))
            parts = []
            if cap:
                parts.append(f"valuation cap ₹{_s(cap)}")
            if disc:
                parts.append(f"{disc.normalize()}% discount")
            out["basis"] = ("Converts to equity at a later priced round" + (f" ({', '.join(parts)})" if parts else "") +
                            "; ownership isn't fixed until then.")
            return out
        if instrument != "equity":
            out["basis"] = "Ownership depends on the instrument's terms."
            return out
        post = _d(rnd.get("post_money_valuation"))
        pre = _d(alloc["agreed_valuation"]) or _d(rnd.get("pre_money_valuation"))
        if post:
            basis_value, basis = post, f"amount ÷ the round's stated post-money of ₹{_s(post)}"
        elif pre and round_committed:
            basis_value = pre + round_committed
            basis = f"amount ÷ (pre-money ₹{_s(pre)} + ₹{_s(round_committed)} committed so far)"
        else:
            out["basis"] = "Add a pre- or post-money valuation to the round to see an indicative ownership."
            return out
        if amount and basis_value:
            out["indicative_equity_pct"] = str((amount / basis_value * 100).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))
            out["basis"] = f"Indicative only: {basis}. Not agreed terms."
        return out

    @classmethod
    def _round_view(cls, rnd: Dict[str, Any], allocs: List[Dict[str, Any]], for_founder: bool, viewer_id: Optional[str] = None) -> Dict[str, Any]:
        mine = [a for a in allocs if a["round_id"] == rnd["id"]]
        summary = cls.summarize(rnd, mine)
        committed = _d(summary["committed"]) or ZERO
        view = {k: rnd[k] for k in rnd}
        post = _d(rnd.get("post_money_valuation"))
        pre = _d(rnd.get("pre_money_valuation"))
        view["indicative_post_money"] = _s(post) if post else (_s(pre + committed) if pre and committed else None)
        agreed_total = sum((_d(a["agreed_equity_pct"]) or ZERO for a in mine if a["status"] in COUNTED), ZERO)
        view["combined_agreed_equity_pct"] = _s(agreed_total) if agreed_total else None
        if rnd["instrument"] == "equity" and (post or (pre and committed)):
            base = post or (pre + committed)
            view["combined_indicative_equity_pct"] = str((committed / base * 100).quantize(Decimal("0.0001"))) if committed else None
        else:
            view["combined_indicative_equity_pct"] = None
        items = []
        for a in mine:
            if not for_founder and a["investor_id"] != viewer_id:
                continue
            item = {k: a[k] for k in a}
            item["ownership"] = cls.ownership(rnd, a, committed)
            item["outstanding"] = _s((_d(a["committed_amount"]) or ZERO) - (_d(a["received"]) or ZERO)) if a["status"] in COUNTED else None
            item["external"] = a["investor_id"] is None
            items.append(item)
        view["allocations"] = items
        if for_founder or rnd["disclose_progress"]:
            view["summary"] = summary
        else:
            view["summary"] = {"target": summary["target"]}  # the founder keeps round progress private
            view["combined_agreed_equity_pct"] = None
            view["combined_indicative_equity_pct"] = None
        return view

    # ------------------------------------------------------------------ founder views and actions

    @staticmethod
    async def _team_project(user_id: str, project_id: int) -> Dict[str, Any]:
        from app.services.team_service import TeamService
        project = await pg.fetch_one("SELECT id, founder_id, title, funding_required::text AS funding_required, "
                                     "is_published FROM projects WHERE id = %s", [project_id])
        if not await TeamService.can_work_on(user_id, project):
            raise FundingError("Project not found.", 404, "not_found")
        return project

    @classmethod
    async def project_funding(cls, user_id: str, project_id: int) -> Dict[str, Any]:
        project = await cls._team_project(user_id, project_id)
        rounds = await cls._rounds("r.project_id = %s", [project_id])
        allocs = await cls._allocations([r["id"] for r in rounds])
        return {"project": {"id": project["id"], "title": project["title"], "funding_required": project["funding_required"]},
                "rounds": [cls._round_view(r, allocs, True) for r in rounds]}

    @classmethod
    async def create_round(cls, user_id: str, project_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        await cls._team_project(user_id, project_id)
        row = await pg.insert("funding_rounds", {**cls._round_fields(data), "project_id": project_id,
                                                 "created_by": user_id, "status": "draft"})
        await cls._event(user_id, None, row["id"], "round_created", None, "draft", {"name": data["name"]})
        return await cls.project_funding(user_id, project_id)

    @staticmethod
    def _round_fields(data: Dict[str, Any]) -> Dict[str, Any]:
        keys = ("name", "round_type", "instrument", "target_amount", "min_ticket", "max_ticket", "pre_money_valuation",
                "post_money_valuation", "valuation_cap", "discount_pct", "opens_on", "closes_on", "disclose_progress")
        return {k: data.get(k) for k in keys}

    @classmethod
    async def _round_for_team(cls, user_id: str, round_id: int) -> Dict[str, Any]:
        rounds = await cls._rounds("r.id = %s", [round_id])
        if not rounds:
            raise FundingError("Round not found.", 404, "not_found")
        await cls._team_project(user_id, rounds[0]["project_id"])
        return rounds[0]

    @classmethod
    async def update_round(cls, user_id: str, round_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        rnd = await cls._round_for_team(user_id, round_id)
        if rnd["status"] in ("closed", "cancelled"):
            raise FundingError("Closed or cancelled rounds can't be edited.", 409, "round_closed")
        allocs = await cls._allocations([round_id])
        committed = _d(cls.summarize(rnd, allocs)["committed"]) or ZERO
        if Decimal(str(data["target_amount"])) < committed:
            raise FundingError(f"The target can't be below the ₹{_s(committed)} already committed.", 422, "target_below_committed")
        if allocs and data["instrument"] != rnd["instrument"] and any(a["status"] not in ("rejected", "cancelled") for a in allocs):
            raise FundingError("The instrument can't change once investors are in the round.", 409, "instrument_locked")
        await pg.update_where("funding_rounds", {**cls._round_fields(data), "updated_at": _now()}, "id = %s", [round_id])
        await cls._event(user_id, None, round_id, "round_updated", None, None, {"target": str(data["target_amount"])})
        return await cls.project_funding(user_id, rnd["project_id"])

    @classmethod
    async def set_round_status(cls, user_id: str, round_id: int, status: str) -> Dict[str, Any]:
        rnd = await cls._round_for_team(user_id, round_id)
        allowed = {"draft": {"open", "cancelled"}, "open": {"closed", "cancelled", "draft"}, "closed": {"open"}, "cancelled": set()}
        if status not in allowed[rnd["status"]]:
            raise FundingError(f"A {rnd['status']} round can't become {status}.", 409, "bad_transition")
        if status == "open":
            other = await pg.fetch_val("SELECT id FROM funding_rounds WHERE project_id = %s AND status = 'open' AND id <> %s",
                                       [rnd["project_id"], round_id])
            if other:
                raise FundingError("Another round for this project is already open. Close it first.", 409, "one_open_round")
        if status == "cancelled":
            allocs = await cls._allocations([round_id])
            if any(a["status"] in COUNTED for a in allocs):
                raise FundingError("Rounds with commitments can't be cancelled; close the round instead.", 409, "has_commitments")
        await pg.run_batch([
            ("UPDATE funding_rounds SET status = %s, updated_at = now() WHERE id = %s", [status, round_id]),
            ("UPDATE round_investments SET status = 'cancelled', updated_at = now() WHERE round_id = %s AND status IN ('proposed', 'accepted') AND %s",
             [round_id, status in ("closed", "cancelled")]),
            ("INSERT INTO round_investment_events (round_id, actor_id, action, from_status, to_status) VALUES (%s, %s, 'round_status', %s, %s)",
             [round_id, user_id, rnd["status"], status]),
        ])
        return await cls.project_funding(user_id, rnd["project_id"])

    @classmethod
    async def _alloc_for_team(cls, user_id: str, alloc_id: int) -> tuple:
        a = await pg.fetch_one(f"SELECT a.id, a.round_id, a.project_id, a.investor_id, a.status, a.instrument, "
                               f"{_cols(_ALLOC_MONEY, 'a')} FROM round_investments a WHERE a.id = %s", [alloc_id])
        if not a:
            raise FundingError("Investment not found.", 404, "not_found")
        rnd = await cls._round_for_team(user_id, a["round_id"])
        return a, rnd

    @classmethod
    async def accept(cls, user_id: str, alloc_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        a, rnd = await cls._alloc_for_team(user_id, alloc_id)
        if a["status"] != "proposed":
            raise FundingError("Only proposals waiting for review can be accepted.", 409, "bad_transition")
        if rnd["status"] != "open":
            raise FundingError("The round isn't open.", 409, "round_not_open")
        cls._check_ticket(rnd, Decimal(str(data["amount"])))
        if data.get("agreed_equity_pct") and a["instrument"] != "equity":
            raise FundingError("An agreed equity % applies to priced equity. SAFEs and notes convert later.", 422, "equity_on_convertible")
        await pg.run_batch([
            ("UPDATE round_investments SET status = 'accepted', committed_amount = %s, agreed_equity_pct = %s, agreed_valuation = %s, "
             "discount_pct = %s, terms = %s, founder_note = %s, updated_at = now() WHERE id = %s AND status = 'proposed'",
             [data["amount"], data.get("agreed_equity_pct"), data.get("agreed_valuation"), data.get("discount_pct"),
              data.get("terms", ""), data.get("note", ""), alloc_id]),
            cls._event_sql(user_id, alloc_id, rnd["id"], "accepted", "proposed", "accepted",
                           {"amount": str(data["amount"]), "agreed_equity_pct": str(data.get("agreed_equity_pct") or "")}),
        ])
        await cls._notify_investor(a["investor_id"], rnd, "Your investment proposal was accepted",
                                   f"The founders agreed terms for ₹{_s(Decimal(str(data['amount'])))}. Confirm to commit.")
        return await cls.project_funding(user_id, rnd["project_id"])

    @classmethod
    async def reject(cls, user_id: str, alloc_id: int, note: str) -> Dict[str, Any]:
        a, rnd = await cls._alloc_for_team(user_id, alloc_id)
        if a["status"] not in NEGOTIATING:
            raise FundingError("Only proposals still in negotiation can be declined.", 409, "bad_transition")
        await pg.run_batch([
            ("UPDATE round_investments SET status = 'rejected', founder_note = %s, updated_at = now() WHERE id = %s", [note, alloc_id]),
            cls._event_sql(user_id, alloc_id, rnd["id"], "rejected", a["status"], "rejected", {"note": note}),
        ])
        await cls._notify_investor(a["investor_id"], rnd, "Your investment proposal was declined", note or "The founders declined it.")
        return await cls.project_funding(user_id, rnd["project_id"])

    @classmethod
    async def add_external(cls, user_id: str, round_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        rnd = await cls._round_for_team(user_id, round_id)
        if rnd["status"] in ("cancelled",):
            raise FundingError("The round was cancelled.", 409, "round_closed")
        instrument = data.get("instrument") or rnd["instrument"]
        if data.get("agreed_equity_pct") and instrument != "equity":
            raise FundingError("An agreed equity % applies to priced equity.", 422, "equity_on_convertible")
        row = await pg.insert("round_investments", {
            "round_id": round_id, "project_id": rnd["project_id"], "external_investor_name": data["investor_name"].strip(),
            "instrument": instrument, "committed_amount": data["amount"], "status": "committed",
            "agreed_equity_pct": data.get("agreed_equity_pct"), "agreed_valuation": data.get("agreed_valuation"),
            "terms": data.get("terms", ""), "committed_on": data.get("committed_on") or date.today(), "created_by": user_id,
        })
        await cls._event(user_id, row["id"], round_id, "external_recorded", None, "committed", {"amount": str(data["amount"])})
        return await cls.project_funding(user_id, rnd["project_id"])

    @classmethod
    async def cancel_by_founder(cls, user_id: str, alloc_id: int) -> Dict[str, Any]:
        a, rnd = await cls._alloc_for_team(user_id, alloc_id)
        received = await cls._received(alloc_id)
        if a["status"] in ("rejected", "cancelled"):
            raise FundingError("It's already closed.", 409, "bad_transition")
        if received > 0:
            raise FundingError("Capital was already received; record a refund first.", 409, "has_receipts")
        await pg.run_batch([
            ("UPDATE round_investments SET status = 'cancelled', updated_at = now() WHERE id = %s", [alloc_id]),
            cls._event_sql(user_id, alloc_id, rnd["id"], "cancelled_by_founder", a["status"], "cancelled", {}),
        ])
        await cls._notify_investor(a["investor_id"], rnd, "An investment was cancelled", "The founders cancelled this commitment.")
        return await cls.project_funding(user_id, rnd["project_id"])

    @staticmethod
    async def _received(alloc_id: int) -> Decimal:
        v = await pg.fetch_val("SELECT COALESCE(sum(CASE WHEN type = 'receipt' THEN amount ELSE -amount END), 0)::text "
                               "FROM round_investment_transactions WHERE allocation_id = %s", [alloc_id])
        return Decimal(str(v or "0"))

    @classmethod
    async def record_receipt(cls, user_id: str, alloc_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Capital actually received (or refunded). The status follows the running total, atomically."""
        a, rnd = await cls._alloc_for_team(user_id, alloc_id)
        if a["status"] not in COUNTED:
            raise FundingError("Record receipts only against confirmed commitments.", 409, "not_committed")
        amount = Decimal(str(data["amount"]))
        committed = _d(a["committed_amount"]) or ZERO
        received = await cls._received(alloc_id)
        if data["received_on"] > date.today():
            raise FundingError("The date can't be in the future.", 422, "future_date")
        if data["type"] == "receipt" and received + amount > committed:
            raise FundingError(f"That's more than the ₹{_s(committed - received)} still outstanding on this commitment.",
                               422, "over_commitment")
        if data["type"] == "refund" and amount > received:
            raise FundingError(f"Only ₹{_s(received)} has been received.", 422, "over_refund")
        new_total = received + amount if data["type"] == "receipt" else received - amount
        new_status = "funded" if new_total >= committed else ("partially_funded" if new_total > 0 else "committed")
        sign = "+" if data["type"] == "receipt" else "-"
        await pg.run_batch([
            # Guarded insert: only if the outstanding amount still allows it (protects against double submits).
            ("INSERT INTO round_investment_transactions (allocation_id, type, amount, received_on, reference, recorded_by) "
             "SELECT %s, %s, %s, %s, %s, %s WHERE "
             "(SELECT COALESCE(sum(CASE WHEN type = 'receipt' THEN amount ELSE -amount END), 0) FROM round_investment_transactions "
             f"WHERE allocation_id = %s) {sign} %s BETWEEN 0 AND %s",
             [alloc_id, data["type"], amount, data["received_on"], data.get("reference", ""), user_id, alloc_id, amount, committed]),
            # Status from the stored total (after the insert above, in the same transaction).
            ("UPDATE round_investments a SET status = CASE WHEN t.total >= a.committed_amount THEN 'funded' "
             "WHEN t.total > 0 THEN 'partially_funded' ELSE 'committed' END, updated_at = now() "
             "FROM (SELECT COALESCE(sum(CASE WHEN type = 'receipt' THEN amount ELSE -amount END), 0) AS total "
             "FROM round_investment_transactions WHERE allocation_id = %s) t WHERE a.id = %s", [alloc_id, alloc_id]),
            cls._event_sql(user_id, alloc_id, rnd["id"], data["type"], a["status"], new_status,
                           {"amount": str(amount), "received_on": str(data["received_on"]), "reference": data.get("reference", "")}),
        ])
        await cls._notify_investor(a["investor_id"], rnd,
                                   "Capital received" if data["type"] == "receipt" else "Refund recorded",
                                   f"The founders recorded ₹{_s(amount)} {'received' if data['type'] == 'receipt' else 'refunded'}.")
        return await cls.project_funding(user_id, rnd["project_id"])

    # ------------------------------------------------------------------ investors

    @classmethod
    async def investor_rounds(cls, investor_id: str, project_id: int) -> Dict[str, Any]:
        """Rounds an investor may see for a published startup: terms, disclosed progress and their own allocation."""
        project = await pg.fetch_one("SELECT id, title, is_published FROM projects WHERE id = %s", [project_id])
        if not project or not project["is_published"]:
            raise FundingError("Project not found.", 404, "not_found")
        rounds = await cls._rounds("r.project_id = %s AND r.status IN ('open', 'closed')", [project_id])
        allocs = await cls._allocations([r["id"] for r in rounds])
        connected = bool(await pg.fetch_val(
            "SELECT EXISTS (SELECT 1 FROM project_interests WHERE project_id = %s AND investor_id = %s AND status = 'accepted')",
            [project_id, investor_id]))
        mine_rounds = {a["round_id"] for a in allocs if a["investor_id"] == investor_id}
        views = [cls._round_view(r, allocs, False, investor_id) for r in rounds if r["status"] == "open" or r["id"] in mine_rounds]
        return {"project": {"id": project["id"], "title": project["title"]}, "rounds": views, "can_propose": connected}

    @classmethod
    async def propose(cls, investor_id: str, round_id: int, amount: Decimal, note: str) -> Dict[str, Any]:
        from app.services.verification_service import VerificationService
        rounds = await cls._rounds("r.id = %s", [round_id])
        if not rounds:
            raise FundingError("Round not found.", 404, "not_found")
        rnd = rounds[0]
        if rnd["status"] != "open":
            raise FundingError("This round isn't open for investment.", 409, "round_not_open")
        if not await VerificationService.investor_is_verified(investor_id):
            raise FundingError("Get your investor account verified first.", 403, "verification_required")
        connected = await pg.fetch_val(
            "SELECT EXISTS (SELECT 1 FROM project_interests WHERE project_id = %s AND investor_id = %s AND status = 'accepted')",
            [rnd["project_id"], investor_id])
        if not connected:
            raise FundingError("Connect with the founders first (an accepted intro opens a deal room).", 403, "not_connected")
        cls._check_ticket(rnd, amount)
        existing = await pg.fetch_val("SELECT id FROM round_investments WHERE round_id = %s AND investor_id = %s "
                                      "AND status NOT IN ('rejected', 'cancelled')", [round_id, investor_id])
        if existing:
            raise FundingError("You already have an investment in this round.", 409, "already_in_round")
        from app.services.team_service import TeamService
        firm = await TeamService.firm_of(investor_id)
        row = await pg.insert("round_investments", {
            "round_id": round_id, "project_id": rnd["project_id"], "investor_id": investor_id,
            "firm_id": (firm or {}).get("id"), "instrument": rnd["instrument"], "proposed_amount": amount,
            "status": "proposed", "investor_note": note.strip(), "created_by": investor_id,
        })
        await cls._event(investor_id, row["id"], round_id, "proposed", None, "proposed", {"amount": str(amount)})
        await cls._notify_team(rnd["project_id"], "investor_interest", "New investment proposal",
                               f"An investor proposed ₹{_s(amount)} in {rnd['name']}. Review it on the Funding page.")
        return await cls.investor_allocation(investor_id, row["id"])

    @staticmethod
    def _check_ticket(rnd: Dict[str, Any], amount: Decimal) -> None:
        lo, hi = _d(rnd.get("min_ticket")), _d(rnd.get("max_ticket"))
        if lo and amount < lo:
            raise FundingError(f"The minimum ticket in this round is ₹{_s(lo)}.", 422, "below_min_ticket")
        if hi and amount > hi:
            raise FundingError(f"The maximum ticket in this round is ₹{_s(hi)}.", 422, "above_max_ticket")

    @classmethod
    async def _own(cls, investor_id: str, alloc_id: int) -> tuple:
        a = await pg.fetch_one(f"SELECT a.id, a.round_id, a.project_id, a.status, {_cols(_ALLOC_MONEY, 'a')} "
                               "FROM round_investments a WHERE a.id = %s AND a.investor_id = %s", [alloc_id, investor_id])
        if not a:
            raise FundingError("Investment not found.", 404, "not_found")
        rnd = (await cls._rounds("r.id = %s", [a["round_id"]]))[0]
        return a, rnd

    @classmethod
    async def investor_confirm(cls, investor_id: str, alloc_id: int) -> Dict[str, Any]:
        a, rnd = await cls._own(investor_id, alloc_id)
        if a["status"] != "accepted":
            raise FundingError("Only terms the founders accepted can be confirmed.", 409, "bad_transition")
        await pg.run_batch([
            ("UPDATE round_investments SET status = 'committed', committed_on = %s, updated_at = now() WHERE id = %s AND status = 'accepted'",
             [date.today(), alloc_id]),
            cls._event_sql(investor_id, alloc_id, rnd["id"], "committed", "accepted", "committed", {"amount": a["committed_amount"]}),
        ])
        await cls._notify_team(rnd["project_id"], "project_status", "Investment committed",
                               f"An investor committed ₹{_s(_d(a['committed_amount']))} in {rnd['name']}.")
        return await cls.investor_allocation(investor_id, alloc_id)

    @classmethod
    async def investor_cancel(cls, investor_id: str, alloc_id: int) -> Dict[str, Any]:
        a, rnd = await cls._own(investor_id, alloc_id)
        if a["status"] not in NEGOTIATING:
            raise FundingError("Committed investments can't be withdrawn here; talk to the founders.", 409, "bad_transition")
        await pg.run_batch([
            ("UPDATE round_investments SET status = 'cancelled', updated_at = now() WHERE id = %s", [alloc_id]),
            cls._event_sql(investor_id, alloc_id, rnd["id"], "withdrawn", a["status"], "cancelled", {}),
        ])
        await cls._notify_team(rnd["project_id"], "investor_interest", "Investment proposal withdrawn",
                               f"An investor withdrew their proposal in {rnd['name']}.")
        return await cls.investor_allocation(investor_id, alloc_id)

    @classmethod
    async def acknowledge_receipt(cls, investor_id: str, txn_id: int) -> Dict[str, Any]:
        row = await pg.fetch_one("SELECT t.id, t.allocation_id FROM round_investment_transactions t JOIN round_investments a "
                                 "ON a.id = t.allocation_id WHERE t.id = %s AND a.investor_id = %s", [txn_id, investor_id])
        if not row:
            raise FundingError("Transaction not found.", 404, "not_found")
        await pg.execute("UPDATE round_investment_transactions SET investor_confirmed_at = COALESCE(investor_confirmed_at, now()) "
                         "WHERE id = %s", [txn_id])
        await cls._event(investor_id, row["allocation_id"], None, "receipt_confirmed", None, None, {"transaction_id": txn_id})
        return await cls.investor_allocation(investor_id, row["allocation_id"])

    @classmethod
    async def investor_allocation(cls, investor_id: str, alloc_id: int) -> Dict[str, Any]:
        a, rnd = await cls._own(investor_id, alloc_id)
        allocs = await cls._allocations([rnd["id"]])
        project = await pg.fetch_one("SELECT id, title FROM projects WHERE id = %s", [rnd["project_id"]])
        view = cls._round_view(rnd, allocs, False, investor_id)
        mine = next(x for x in view["allocations"] if x["id"] == alloc_id)
        txns = await pg.fetch_all("SELECT id, type, amount::text AS amount, received_on, reference, investor_confirmed_at, created_at "
                                  "FROM round_investment_transactions WHERE allocation_id = %s ORDER BY received_on, id", [alloc_id])
        history = await pg.fetch_all("SELECT action, from_status, to_status, details, created_at FROM round_investment_events "
                                     "WHERE allocation_id = %s ORDER BY created_at, id", [alloc_id])
        return {"allocation": mine, "round": {k: v for k, v in view.items() if k != "allocations"},
                "project": project, "transactions": txns, "history": history}

    @classmethod
    async def investor_portfolio(cls, investor_id: str) -> List[Dict[str, Any]]:
        """Every round allocation the investor has, newest first, with their own figures."""
        ids = [r["id"] for r in await pg.fetch_all(
            "SELECT id FROM round_investments WHERE investor_id = %s ORDER BY created_at DESC LIMIT 200", [investor_id])]
        out = []
        for alloc_id in ids:
            d = await cls.investor_allocation(investor_id, alloc_id)
            out.append({**d["allocation"], "round_name": d["round"]["name"], "round_status": d["round"]["status"],
                        "round_summary": d["round"]["summary"], "project_id": d["project"]["id"],
                        "project_title": d["project"]["title"]})
        return out

    # ------------------------------------------------------------------ discover

    @staticmethod
    async def open_round_progress(project_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """For Discover: each project's open round and, if the founder discloses it, its progress."""
        if not project_ids:
            return {}
        rows = await pg.fetch_all(
            """
            SELECT r.project_id, r.name, r.round_type, r.instrument, r.disclose_progress, r.target_amount::text AS target,
                   r.min_ticket::text AS min_ticket, r.max_ticket::text AS max_ticket,
                   COALESCE((SELECT sum(a.committed_amount) FROM round_investments a WHERE a.round_id = r.id
                             AND a.status IN ('committed', 'partially_funded', 'funded')), 0)::text AS committed
            FROM funding_rounds r WHERE r.status = 'open' AND r.project_id = ANY(%s::bigint[])
            """, ["{" + ",".join(str(i) for i in project_ids) + "}"])
        out = {}
        for r in rows:
            target, committed = Decimal(r["target"]), Decimal(r["committed"])
            out[r["project_id"]] = {
                "name": r["name"], "round_type": r["round_type"], "instrument": r["instrument"],
                "target": _s(target), "min_ticket": r["min_ticket"], "max_ticket": r["max_ticket"],
                "committed_pct": _pct(committed, target) if r["disclose_progress"] else None,
            }
        return out

    # ------------------------------------------------------------------ audit and notices

    @staticmethod
    def _event_sql(actor: str, alloc_id: Optional[int], round_id: Optional[int], action: str,
                   from_status: Optional[str], to_status: Optional[str], details: Dict[str, Any]):
        return ("INSERT INTO round_investment_events (allocation_id, round_id, actor_id, action, from_status, to_status, details) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)", [alloc_id, round_id, actor, action, from_status, to_status, pg.Jsonb(details)])

    @classmethod
    async def _event(cls, actor, alloc_id, round_id, action, from_status, to_status, details) -> None:
        sql, params = cls._event_sql(actor, alloc_id, round_id, action, from_status, to_status, details)
        await pg.execute(sql, params)

    @staticmethod
    async def _notify_investor(investor_id: Optional[str], rnd: Dict[str, Any], title: str, desc: str) -> None:
        if not investor_id:
            return
        try:
            from app.services.notification_service import NotificationService
            project = await pg.fetch_one("SELECT title FROM projects WHERE id = %s", [rnd["project_id"]]) or {}
            await NotificationService.create_notification(
                category="portfolio", target_role="INVESTOR", user_id=investor_id,
                title=f"{project.get('title', 'Startup')}: {title}", desc=desc, badge="Investment",
                badge_variant="primary", link="/investor/portfolio?tab=rounds")
        except Exception as e:
            logger.warning("Could not notify investor %s: %s", investor_id, e)

    @staticmethod
    async def _notify_team(project_id: int, category: str, title: str, desc: str) -> None:
        try:
            from app.services.notification_service import NotificationService
            from app.services.team_service import TeamService
            project = await pg.fetch_one("SELECT title FROM projects WHERE id = %s", [project_id]) or {}
            for uid in await TeamService.team_user_ids(project_id):
                await NotificationService.create_notification(
                    category=category, target_role="FOUNDER", user_id=uid, title=f"{project.get('title', 'Your startup')}: {title}",
                    desc=desc, badge="Funding", badge_variant="primary", link=f"/founder/projects/{project_id}/funding")
        except Exception as e:
            logger.warning("Could not notify founders of project %s: %s", project_id, e)
