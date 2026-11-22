"""Portfolio CSV export and import.

Export: holdings (with computed figures) and the transaction ledger, scoped to one investor.
Import: one investment per row, all rows validated first; nothing is saved if any row is wrong.
Every import row is the investor's own record (self-reported), exactly like entering it by hand.
"""
import csv
import io
import re
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from pydantic import ValidationError

from app.database import postgres as pg
from app.schemas.portfolio import InvestmentCreate, ValuationCreate
from app.services.portfolio_service import PortfolioService

MAX_ROWS = 500
MAX_BYTES = 1_000_000

TEMPLATE_COLUMNS = [
    "company_name", "investment_date", "amount", "instrument", "industry", "stage",
    "ownership_pct", "notes", "current_value", "valuation_date",
]

_INSTRUMENTS = {
    "equity": "equity", "shares": "equity", "safe": "safe", "convertible": "convertible_note",
    "convertible note": "convertible_note", "convertible_note": "convertible_note", "ccd": "convertible_note",
    "ccps": "equity", "debt": "debt", "loan": "debt", "revenue based": "revenue_based",
    "revenue-based financing": "revenue_based", "revenue_based": "revenue_based", "rbf": "revenue_based",
    "other": "other",
}


# ---------------------------------------------------------------- export


def _cell(value: Any) -> str:
    """Text for a CSV cell. Text that a spreadsheet would run as a formula is neutralised."""
    if value is None:
        return ""
    text = value.isoformat() if isinstance(value, (date, datetime)) else str(value)
    if text and text[0] in "=+-@\t\r" and not re.fullmatch(r"-?\d+(\.\d+)?", text):
        return "'" + text
    return text


def _to_csv(header: List[str], rows: List[List[Any]]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    for row in rows:
        writer.writerow([_cell(v) for v in row])
    return "﻿" + buf.getvalue()  # BOM so Excel reads ₹ and Indian names correctly


async def holdings_csv(investor_id: str) -> str:
    summary = await PortfolioService.summary(investor_id)
    header = [
        "company_name", "industry", "stage", "instrument", "investment_date", "status", "ownership_pct",
        "invested_inr", "current_value_inr", "value_basis", "valuation_date", "cash_returned_inr",
        "unrealized_gain_inr", "net_gain_inr", "multiple",
    ]
    rows = [
        [
            h["company_name"], h["industry"], h["stage"], h["instrument"], h["investment_date"], h["status"],
            h.get("ownership_pct"), h["cost_basis"], h["current_value"], h["valuation_basis"],
            h.get("valuation_date"), h["cash_returned"], h["unrealized_gain"], h["net_gain"], h.get("multiple"),
        ]
        for h in summary["holdings"]
    ]
    return _to_csv(header, rows)


async def transactions_csv(investor_id: str) -> str:
    rows = await pg.fetch_all(
        "SELECT t.txn_date, i.company_name, t.type, t.amount::text AS amount, t.status, t.description "
        "FROM investment_transactions t JOIN investments i ON i.id = t.investment_id "
        "WHERE t.investor_id = %s ORDER BY t.txn_date DESC, t.id DESC",
        [investor_id],
    )
    header = ["date", "company_name", "type", "amount_inr", "status", "description"]
    return _to_csv(header, [[r["txn_date"], r["company_name"], r["type"], r["amount"], r["status"], r["description"]] for r in rows])


def template_csv() -> str:
    example = ["Kisan Ledger", "15/03/2024", "25,00,000", "Equity", "Fintech", "Seed", "2.5",
               "Lead: Example Capital", "41,00,000", "30/09/2025"]
    return _to_csv(TEMPLATE_COLUMNS, [example])


# ---------------------------------------------------------------- import


def _money(raw: str) -> Optional[str]:
    text = re.sub(r"[\s,₹]|^rs\.?|^inr", "", (raw or "").strip(), flags=re.IGNORECASE)
    return text or None


def _date(raw: str) -> Optional[str]:
    text = (raw or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError(f"'{text}' isn't a date. Use DD/MM/YYYY or YYYY-MM-DD.")


def _friendly(err: ValidationError) -> str:
    first = err.errors()[0]
    field = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    msg = str(first.get("msg", "invalid value")).replace("Value error, ", "")
    if "valid decimal" in msg:
        msg = "enter a number, like 2500000 or 25,00,000"
    return f"{field}: {msg}" if field else msg


def parse_rows(content: bytes) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Validate an uploaded CSV. Returns (rows ready to save, errors as {row, message})."""
    if len(content) > MAX_BYTES:
        return [], [{"row": 0, "message": "The file is larger than 1 MB."}]
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], [{"row": 0, "message": "Save the file as CSV (UTF-8) and try again."}]

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return [], [{"row": 0, "message": "The file is empty."}]
    norm = {f: re.sub(r"[\s-]+", "_", (f or "").strip().lower()) for f in reader.fieldnames}
    missing = [c for c in ("company_name", "investment_date", "amount") if c not in norm.values()]
    if missing:
        return [], [{"row": 1, "message": f"Missing column(s): {', '.join(missing)}. Start from the template."}]

    ready: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    for index, raw in enumerate(reader, start=2):  # row 1 is the header
        row = {norm[k]: (v or "").strip() for k, v in raw.items() if k is not None}
        if not any(row.values()):
            continue
        if len(ready) + len(errors) >= MAX_ROWS:
            errors.append({"row": index, "message": f"Only {MAX_ROWS} rows can be imported at once."})
            break
        try:
            instrument_raw = row.get("instrument", "").lower()
            instrument = _INSTRUMENTS.get(instrument_raw, None) if instrument_raw else "equity"
            if instrument is None:
                raise ValueError(f"instrument: '{row['instrument']}' isn't one of Equity, SAFE, Convertible note, Debt, Revenue-based, Other.")
            investment = InvestmentCreate(
                company_name=row.get("company_name") or None,
                investment_date=_date(row.get("investment_date", "")),
                amount=_money(row.get("amount", "")),
                instrument=instrument,
                industry=row.get("industry", ""),
                stage=row.get("stage", ""),
                ownership_pct=_money(row.get("ownership_pct", "").rstrip("%")),
                notes=row.get("notes", ""),
            )
            if not investment.company_name:
                raise ValueError("company_name: add the company name.")
            valuation = None
            if row.get("current_value"):
                valuation = ValuationCreate(
                    valuation_date=_date(row.get("valuation_date", "")) or date.today().isoformat(),
                    value=_money(row["current_value"]),
                    source="self_reported",
                    note="Imported",
                )
                if valuation.valuation_date < investment.investment_date:
                    raise ValueError("valuation_date: can't be before the investment date.")
            ready.append({"investment": investment, "valuation": valuation})
        except ValidationError as e:
            errors.append({"row": index, "message": _friendly(e)})
        except (ValueError, ArithmeticError) as e:
            errors.append({"row": index, "message": str(e)})
    if not ready and not errors:
        errors.append({"row": 2, "message": "No rows to import."})
    return ready, errors


async def save_rows(investor_id: str, rows: List[Dict[str, Any]]) -> int:
    """Insert every row in one transaction: all or nothing."""
    now = datetime.now(timezone.utc)
    statements = []
    for r in rows:
        inv: InvestmentCreate = r["investment"]
        val: Optional[ValuationCreate] = r["valuation"]
        params: List[Any] = [
            investor_id, inv.company_name, inv.industry, inv.stage, inv.instrument, inv.investment_date,
            inv.ownership_pct, inv.notes, now, now,
            investor_id, inv.investment_date, inv.amount,
        ]
        valuation_sql = ""
        if val is not None:
            valuation_sql = (
                ", val AS (INSERT INTO investment_valuations (investor_id, investment_id, valuation_date, value, source, note) "
                "SELECT %s, inv.id, %s, %s, %s, %s FROM inv) "
            )
            params += [investor_id, val.valuation_date, val.value, val.source, val.note]
        statements.append((
            "WITH inv AS (INSERT INTO investments (investor_id, company_name, industry, stage, instrument, "
            "investment_date, ownership_pct, notes, created_at, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id), "
            "txn AS (INSERT INTO investment_transactions (investor_id, investment_id, txn_date, type, amount, status, description) "
            "SELECT %s, inv.id, %s, 'investment', %s, 'completed', 'Imported' FROM inv)"
            + valuation_sql
            + " SELECT id FROM inv",
            params,
        ))
    await pg.run_batch(statements)
    return len(statements)
