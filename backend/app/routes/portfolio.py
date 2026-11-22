from typing import List, Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.auth import CurrentUser, require_investor
from app.core.rate_limit import rate_limit
from app.schemas.portfolio import (
    InvestmentCreate,
    InvestmentDetail,
    InvestmentUpdate,
    PortfolioSummary,
    TransactionCreate,
    TransactionPage,
    TransactionType,
    ValuationCreate,
)
from app.services import portfolio_csv
from app.services.portfolio_service import PortfolioService

# Investor-only. Every query is scoped to the signed-in investor, so one investor can never
# read or change another's records (a foreign id is simply "not found").
router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

_writes = [Depends(rate_limit("portfolio_write", 120, 3600))]


@router.get("/summary", response_model=PortfolioSummary)
async def portfolio_summary(user: CurrentUser = Depends(require_investor)):
    """Totals, holdings, value over time and allocation, computed from your own records."""
    return await PortfolioService.summary(user.id)


@router.get("/transactions", response_model=TransactionPage)
async def list_transactions(
    type: Optional[TransactionType] = Query(None),
    investment_id: Optional[int] = Query(None, ge=1),
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(require_investor),
):
    return await PortfolioService.list_transactions(user.id, type, investment_id, page, page_size)


@router.post("/investments", response_model=InvestmentDetail, status_code=status.HTTP_201_CREATED, dependencies=_writes)
async def create_investment(data: InvestmentCreate, user: CurrentUser = Depends(require_investor)):
    """Record an investment you made. The amount becomes its first transaction."""
    return await PortfolioService.create(user.id, data)


@router.get("/investments/{investment_id}", response_model=InvestmentDetail)
async def get_investment(investment_id: int, user: CurrentUser = Depends(require_investor)):
    return await PortfolioService.detail(user.id, investment_id)


@router.put("/investments/{investment_id}", response_model=InvestmentDetail, dependencies=_writes)
async def update_investment(investment_id: int, data: InvestmentUpdate, user: CurrentUser = Depends(require_investor)):
    return await PortfolioService.update(user.id, investment_id, data)


@router.delete("/investments/{investment_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_writes)
async def delete_investment(investment_id: int, user: CurrentUser = Depends(require_investor)):
    await PortfolioService.delete(user.id, investment_id)


@router.post(
    "/investments/{investment_id}/transactions",
    response_model=InvestmentDetail,
    status_code=status.HTTP_201_CREATED,
    dependencies=_writes,
)
async def add_transaction(investment_id: int, data: TransactionCreate, user: CurrentUser = Depends(require_investor)):
    """Add a follow-on, distribution, dividend, exit proceeds, interest or fee."""
    return await PortfolioService.add_transaction(user.id, investment_id, data)


@router.delete("/transactions/{txn_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_writes)
async def delete_transaction(txn_id: int, user: CurrentUser = Depends(require_investor)):
    await PortfolioService.delete_transaction(user.id, txn_id)


@router.post(
    "/investments/{investment_id}/valuations",
    response_model=InvestmentDetail,
    status_code=status.HTTP_201_CREATED,
    dependencies=_writes,
)
async def add_valuation(investment_id: int, data: ValuationCreate, user: CurrentUser = Depends(require_investor)):
    """Record what your stake is worth on a date (and where that figure came from)."""
    return await PortfolioService.add_valuation(user.id, investment_id, data)


@router.delete("/valuations/{valuation_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_writes)
async def delete_valuation(valuation_id: int, user: CurrentUser = Depends(require_investor)):
    await PortfolioService.delete_valuation(user.id, valuation_id)


# ---------------------------------------------------------------- CSV export / import


def _csv(content: str, filename: str) -> Response:
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@router.get("/export/holdings.csv")
async def export_holdings(user: CurrentUser = Depends(require_investor)):
    """Your holdings with invested, current value, returns and gains, as CSV."""
    return _csv(await portfolio_csv.holdings_csv(user.id), "venturex-holdings.csv")


@router.get("/export/transactions.csv")
async def export_transactions(user: CurrentUser = Depends(require_investor)):
    """Your full transaction ledger, as CSV."""
    return _csv(await portfolio_csv.transactions_csv(user.id), "venturex-transactions.csv")


@router.get("/import/template.csv")
async def import_template(user: CurrentUser = Depends(require_investor)):
    """A CSV template with the expected columns and one example row."""
    return _csv(portfolio_csv.template_csv(), "venturex-portfolio-template.csv")


class ImportError_(BaseModel):
    row: int
    message: str


class ImportResult(BaseModel):
    valid_rows: int
    errors: List[ImportError_]
    imported: int


@router.post("/import", response_model=ImportResult, dependencies=[Depends(rate_limit("portfolio_import", 30, 3600))])
async def import_csv(
    file: UploadFile = File(...),
    dry_run: bool = Query(True, description="Check the file without saving anything"),
    user: CurrentUser = Depends(require_investor),
):
    """Check (dry_run) or import investments from a CSV. Nothing is saved if any row has a problem."""
    content = await file.read(portfolio_csv.MAX_BYTES + 1)
    rows, errors = portfolio_csv.parse_rows(content)
    imported = 0
    if not dry_run and not errors and rows:
        imported = await portfolio_csv.save_rows(user.id, rows)
    return {"valid_rows": len(rows), "errors": errors, "imported": imported}
