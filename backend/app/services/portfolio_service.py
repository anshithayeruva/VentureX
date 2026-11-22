"""Portfolio & finances calculations. Every query is scoped to one investor_id.

Definitions (all from completed transactions; pending ones are listed but not counted):
  cost basis     = investment + follow_on + fee
  cash returned  = distribution + dividend + exit_proceeds + interest
  current value  = the holding's latest valuation; held at cost when none is recorded;
                   0 once the holding is exited or written off
  unrealized     = current value - cost basis, for active holdings
  net gain       = cash returned + current value - cost basis
  realized gain  = net gain - unrealized gain
  multiple       = (cash returned + current value) / cost basis
"""
from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

from app.database import postgres as pg
from app.schemas.portfolio import InvestmentCreate, InvestmentUpdate, TransactionCreate, ValuationCreate

CENT = Decimal("0.01")
ZERO = Decimal("0")
COST_TYPES = {"investment", "follow_on", "fee"}
RETURN_TYPES = {"distribution", "dividend", "exit_proceeds", "interest"}
INCOME_TYPES = {"dividend", "interest"}
MAX_SERIES_POINTS = 120

_INV_COLS = (
    "id, investor_id, project_id, company_name, industry, stage, instrument, investment_date, currency, "
    "ownership_pct::text AS ownership_pct, status, notes, created_at, updated_at"
)
_TXN_COLS = "t.id, t.investment_id, t.txn_date, t.type, t.amount::text AS amount, t.status, t.description"
_VAL_COLS = "id, investment_id, valuation_date, value::text AS value, source, note"


def _d(value: Any) -> Decimal:
    return Decimal(str(value)) if value is not None else ZERO


def money(value: Decimal) -> str:
    return str(value.quantize(CENT, rounding=ROUND_HALF_UP))


def _ratio(num: Decimal, den: Decimal, scale: Decimal = Decimal("0.01")) -> Optional[str]:
    if den <= 0:
        return None
    return str((num / den).quantize(scale, rounding=ROUND_HALF_UP))


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investment not found")


class PortfolioService:
    # ---------------------------------------------------------------- reads

    @staticmethod
    async def _load(investor_id: str, investment_id: Optional[int] = None):
        where, params = "investor_id = %s", [investor_id]
        if investment_id is not None:
            where += " AND id = %s"
            params.append(investment_id)
        investments = await pg.fetch_all(
            f"SELECT {_INV_COLS} FROM investments WHERE {where} ORDER BY investment_date DESC, id DESC", params
        )
        ids = [i["id"] for i in investments]
        if not ids:
            return investments, [], []
        id_array = "{" + ",".join(str(i) for i in ids) + "}"
        txns = await pg.fetch_all(
            f"SELECT {_TXN_COLS} FROM investment_transactions t "
            "WHERE t.investor_id = %s AND t.investment_id = ANY(%s::bigint[]) ORDER BY t.txn_date, t.id",
            [investor_id, id_array],
        )
        vals = await pg.fetch_all(
            f"SELECT {_VAL_COLS} FROM investment_valuations "
            "WHERE investor_id = %s AND investment_id = ANY(%s::bigint[]) ORDER BY valuation_date, id",
            [investor_id, id_array],
        )
        return investments, txns, vals

    @staticmethod
    def _holding(inv: Dict[str, Any], txns: List[Dict[str, Any]], vals: List[Dict[str, Any]]) -> Dict[str, Any]:
        done = [t for t in txns if t["status"] == "completed"]
        cost = sum((_d(t["amount"]) for t in done if t["type"] in COST_TYPES), ZERO)
        returned = sum((_d(t["amount"]) for t in done if t["type"] in RETURN_TYPES), ZERO)
        latest = vals[-1] if vals else None

        if inv["status"] == "active":
            if latest:
                current, basis = _d(latest["value"]), "valuation"
            else:
                current, basis = cost, "cost"
            unrealized = current - cost
        else:
            current, basis, unrealized = ZERO, inv["status"] if inv["status"] == "written_off" else "exited", ZERO

        net = returned + current - cost
        return {
            "id": inv["id"],
            "project_id": inv.get("project_id"),
            "company_name": inv["company_name"],
            "industry": inv["industry"],
            "stage": inv["stage"],
            "instrument": inv["instrument"],
            "investment_date": inv["investment_date"],
            "ownership_pct": inv.get("ownership_pct"),
            "status": inv["status"],
            "notes": inv["notes"],
            "cost_basis": money(cost),
            "cash_returned": money(returned),
            "current_value": money(current),
            "valuation_basis": basis,
            "valuation_date": latest["valuation_date"] if latest and inv["status"] == "active" else None,
            "valuation_source": latest["source"] if latest and inv["status"] == "active" else None,
            "unrealized_gain": money(unrealized),
            "net_gain": money(net),
            "multiple": _ratio(returned + current, cost),
        }

    @classmethod
    async def summary(cls, investor_id: str) -> Dict[str, Any]:
        investments, txns, vals = await cls._load(investor_id)
        txns_by, vals_by = defaultdict(list), defaultdict(list)
        for t in txns:
            txns_by[t["investment_id"]].append(t)
        for v in vals:
            vals_by[v["investment_id"]].append(v)

        holdings = [cls._holding(i, txns_by[i["id"]], vals_by[i["id"]]) for i in investments]

        invested = sum((_d(h["cost_basis"]) for h in holdings), ZERO)
        current = sum((_d(h["current_value"]) for h in holdings), ZERO)
        returned = sum((_d(h["cash_returned"]) for h in holdings), ZERO)
        unrealized = sum((_d(h["unrealized_gain"]) for h in holdings), ZERO)
        income = sum(
            (_d(t["amount"]) for t in txns if t["status"] == "completed" and t["type"] in INCOME_TYPES), ZERO
        )
        net = returned + current - invested

        totals = {
            "total_invested": money(invested),
            "current_value": money(current),
            "cash_returned": money(returned),
            "income": money(income),
            "realized_gain": money(net - unrealized),
            "unrealized_gain": money(unrealized),
            "net_gain": money(net),
            "roi_pct": _ratio(net * 100, invested),
            "multiple": _ratio(returned + current, invested),
            "active_count": sum(1 for h in holdings if h["status"] == "active"),
            "exited_count": sum(1 for h in holdings if h["status"] == "exited"),
            "written_off_count": sum(1 for h in holdings if h["status"] == "written_off"),
            "held_at_cost_count": sum(1 for h in holdings if h["valuation_basis"] == "cost"),
            "pending_transactions": sum(1 for t in txns if t["status"] == "pending"),
        }

        by_industry: Dict[str, Decimal] = defaultdict(lambda: ZERO)
        for h in holdings:
            by_industry[h["industry"] or "Unspecified"] += _d(h["cost_basis"])
        allocation = [
            {"label": label, "cost_basis": money(amount), "share_pct": _ratio(amount * 100, invested, CENT) or "0.00"}
            for label, amount in sorted(by_industry.items(), key=lambda kv: -kv[1])
            if amount > 0
        ]

        return {
            "currency": "INR",
            "totals": totals,
            "holdings": holdings,
            "value_over_time": cls._series(investments, txns_by, vals_by),
            "allocation_by_industry": allocation,
        }

    @staticmethod
    def _series(investments, txns_by, vals_by) -> List[Dict[str, Any]]:
        """Month-end points: cumulative cost, cumulative cash returned, and holding value."""
        all_dates = [t["txn_date"] for ts in txns_by.values() for t in ts if t["status"] == "completed"]
        if not all_dates:
            return []
        start = min(all_dates)
        today = date.today()
        months = []
        y, m = start.year, start.month
        while (y, m) <= (today.year, today.month):
            months.append((y, m))
            m += 1
            if m == 13:
                y, m = y + 1, 1
        months = months[-MAX_SERIES_POINTS:]

        def month_end(y: int, m: int) -> date:
            nxt = date(y + (m == 12), 1 if m == 12 else m + 1, 1)
            return min(date.fromordinal(nxt.toordinal() - 1), today)

        # When an exited / written-off holding stopped counting: its last cash-flow date.
        closed_on: Dict[int, date] = {}
        for inv in investments:
            if inv["status"] != "active":
                ts = [t["txn_date"] for t in txns_by[inv["id"]] if t["status"] == "completed"]
                vs = [v["valuation_date"] for v in vals_by[inv["id"]]]
                closed_on[inv["id"]] = max(ts + vs) if ts or vs else inv["investment_date"]

        points = []
        for y, m in months:
            end = month_end(y, m)
            invested = returned = value = ZERO
            for inv in investments:
                done = [t for t in txns_by[inv["id"]] if t["status"] == "completed" and t["txn_date"] <= end]
                cost = sum((_d(t["amount"]) for t in done if t["type"] in COST_TYPES), ZERO)
                invested += cost
                returned += sum((_d(t["amount"]) for t in done if t["type"] in RETURN_TYPES), ZERO)
                if not done or (inv["id"] in closed_on and end >= closed_on[inv["id"]]):
                    continue
                marks = [v for v in vals_by[inv["id"]] if v["valuation_date"] <= end]
                value += _d(marks[-1]["value"]) if marks else cost
            points.append({"date": end, "invested": money(invested), "value": money(value), "returned": money(returned)})
        return points

    @classmethod
    async def detail(cls, investor_id: str, investment_id: int) -> Dict[str, Any]:
        investments, txns, vals = await cls._load(investor_id, investment_id)
        if not investments:
            raise _not_found()
        inv = investments[0]
        return {
            "holding": cls._holding(inv, txns, vals),
            "transactions": [cls._txn_out(t, inv["company_name"]) for t in reversed(txns)],
            "valuations": [cls._val_out(v) for v in reversed(vals)],
        }

    @staticmethod
    def _txn_out(t: Dict[str, Any], company: Optional[str] = None) -> Dict[str, Any]:
        return {**t, "amount": money(_d(t["amount"])), "company_name": company or t.get("company_name")}

    @staticmethod
    def _val_out(v: Dict[str, Any]) -> Dict[str, Any]:
        return {**v, "value": money(_d(v["value"]))}

    @classmethod
    async def list_transactions(
        cls,
        investor_id: str,
        txn_type: Optional[str] = None,
        investment_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 25,
    ) -> Dict[str, Any]:
        where, params = ["t.investor_id = %s"], [investor_id]
        if txn_type:
            where.append("t.type = %s")
            params.append(txn_type)
        if investment_id:
            where.append("t.investment_id = %s")
            params.append(investment_id)
        clause = " AND ".join(where)
        total = await pg.fetch_val(f"SELECT count(*) AS n FROM investment_transactions t WHERE {clause}", params)
        rows = await pg.fetch_all(
            f"SELECT {_TXN_COLS}, i.company_name FROM investment_transactions t "
            f"JOIN investments i ON i.id = t.investment_id WHERE {clause} "
            "ORDER BY t.txn_date DESC, t.id DESC OFFSET %s LIMIT %s",
            [*params, (page - 1) * page_size, page_size],
        )
        return {"items": [cls._txn_out(r) for r in rows], "total": int(total or 0), "page": page, "page_size": page_size}

    # ---------------------------------------------------------------- writes

    @staticmethod
    async def _owned(investor_id: str, investment_id: int) -> Dict[str, Any]:
        row = await pg.fetch_one(
            f"SELECT {_INV_COLS} FROM investments WHERE id = %s AND investor_id = %s", [investment_id, investor_id]
        )
        if not row:
            raise _not_found()
        return row

    @classmethod
    async def create(cls, investor_id: str, data: InvestmentCreate) -> Dict[str, Any]:
        name, industry, stage = data.company_name, data.industry, data.stage
        if data.project_id is not None:
            # Link only to a startup this investor can actually see: published, or one they
            # have a deal room with.
            project = await pg.fetch_one(
                "SELECT p.title, p.industry, p.stage FROM projects p WHERE p.id = %s AND (p.is_published OR EXISTS "
                "(SELECT 1 FROM deal_rooms d WHERE d.project_id = p.id AND d.investor_id = %s))",
                [data.project_id, investor_id],
            )
            if not project:
                raise HTTPException(status_code=400, detail="That startup isn't available to link.")
            name = name or project["title"]
            industry = industry or project["industry"]
            stage = stage or project["stage"]
        if not name:
            raise HTTPException(status_code=422, detail="Add the company name.")

        now = datetime.now(timezone.utc)
        rows = await pg.run_batch([
            (
                "WITH inv AS (INSERT INTO investments (investor_id, project_id, company_name, industry, stage, "
                "instrument, investment_date, ownership_pct, notes, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id) "
                "INSERT INTO investment_transactions (investor_id, investment_id, txn_date, type, amount, status, description) "
                "SELECT %s, inv.id, %s, 'investment', %s, 'completed', 'Initial investment' FROM inv RETURNING investment_id",
                [
                    investor_id, data.project_id, name, industry, stage, data.instrument, data.investment_date,
                    data.ownership_pct, data.notes, now, now,
                    investor_id, data.investment_date, data.amount,
                ],
            )
        ])
        new_id = rows[0][0]["investment_id"]
        return await cls.detail(investor_id, new_id)

    @classmethod
    async def update(cls, investor_id: str, investment_id: int, data: InvestmentUpdate) -> Dict[str, Any]:
        await cls._owned(investor_id, investment_id)
        fields = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        if "ownership_pct" in data.model_fields_set and data.ownership_pct is None:
            fields["ownership_pct"] = None
        if fields:
            fields["updated_at"] = datetime.now(timezone.utc)
            await pg.update_where("investments", fields, "id = %s AND investor_id = %s", [investment_id, investor_id])
        return await cls.detail(investor_id, investment_id)

    @classmethod
    async def delete(cls, investor_id: str, investment_id: int) -> None:
        if not await pg.execute("DELETE FROM investments WHERE id = %s AND investor_id = %s", [investment_id, investor_id]):
            raise _not_found()

    @classmethod
    async def add_transaction(cls, investor_id: str, investment_id: int, data: TransactionCreate) -> Dict[str, Any]:
        inv = await cls._owned(investor_id, investment_id)
        if data.txn_date < inv["investment_date"] and data.type not in ("investment", "fee"):
            raise HTTPException(status_code=422, detail="A return can't be dated before the investment was made.")
        await pg.insert(
            "investment_transactions",
            {"investor_id": investor_id, "investment_id": investment_id, **data.model_dump()},
            returning=False,
        )
        await pg.update_where(
            "investments", {"updated_at": datetime.now(timezone.utc)}, "id = %s AND investor_id = %s",
            [investment_id, investor_id],
        )
        return await cls.detail(investor_id, investment_id)

    @classmethod
    async def delete_transaction(cls, investor_id: str, txn_id: int) -> None:
        row = await pg.fetch_one(
            "SELECT investment_id, type, (SELECT count(*) FROM investment_transactions x WHERE x.investment_id = t.investment_id "
            "AND x.type IN ('investment', 'follow_on')) AS capital_rows FROM investment_transactions t "
            "WHERE t.id = %s AND t.investor_id = %s",
            [txn_id, investor_id],
        )
        if not row:
            raise HTTPException(status_code=404, detail="Transaction not found")
        if row["type"] in ("investment", "follow_on") and int(row["capital_rows"]) <= 1:
            raise HTTPException(
                status_code=409,
                detail="This is the holding's only capital contribution. Delete the investment instead.",
            )
        await pg.execute("DELETE FROM investment_transactions WHERE id = %s AND investor_id = %s", [txn_id, investor_id])

    @classmethod
    async def add_valuation(cls, investor_id: str, investment_id: int, data: ValuationCreate) -> Dict[str, Any]:
        inv = await cls._owned(investor_id, investment_id)
        if data.valuation_date < inv["investment_date"]:
            raise HTTPException(status_code=422, detail="A valuation can't be dated before the investment was made.")
        await pg.insert(
            "investment_valuations",
            {"investor_id": investor_id, "investment_id": investment_id, **data.model_dump()},
            returning=False,
        )
        return await cls.detail(investor_id, investment_id)

    @classmethod
    async def delete_valuation(cls, investor_id: str, valuation_id: int) -> None:
        if not await pg.execute(
            "DELETE FROM investment_valuations WHERE id = %s AND investor_id = %s", [valuation_id, investor_id]
        ):
            raise HTTPException(status_code=404, detail="Valuation not found")
