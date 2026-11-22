"""Portfolio & finances: an investor's own record of investments, cash flows and valuations.

Everything here is entered by the investor (self-reported). Money is Decimal on the way in and
a 2-decimal rupee string on the way out, so no amount ever passes through floating point.
"""
from datetime import date
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

InvestmentStatus = Literal["active", "exited", "written_off"]
Instrument = Literal["equity", "safe", "convertible_note", "debt", "revenue_based", "other"]
TransactionType = Literal["investment", "follow_on", "distribution", "dividend", "exit_proceeds", "interest", "fee"]
TransactionStatus = Literal["completed", "pending"]
ValuationSource = Literal["self_reported", "company_report", "funding_round", "third_party"]

Amount = Decimal  # validated per field: > 0, at most 2 decimal places
_EARLIEST = date(1980, 1, 1)


def _check_date(value: date) -> date:
    if value > date.today():
        raise ValueError("The date can't be in the future.")
    if value < _EARLIEST:
        raise ValueError("The date is too far in the past.")
    return value


class _In(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class InvestmentCreate(_In):
    company_name: Optional[str] = Field(None, max_length=160)
    project_id: Optional[int] = Field(None, ge=1)
    industry: str = Field("", max_length=100)
    stage: str = Field("", max_length=60)
    instrument: Instrument = "equity"
    investment_date: date
    amount: Decimal = Field(..., gt=0, max_digits=16, decimal_places=2)
    ownership_pct: Optional[Decimal] = Field(None, ge=0, le=100, max_digits=7, decimal_places=4)
    notes: str = Field("", max_length=2000)

    _date = field_validator("investment_date")(lambda cls, v: _check_date(v))


class InvestmentUpdate(_In):
    company_name: Optional[str] = Field(None, min_length=1, max_length=160)
    industry: Optional[str] = Field(None, max_length=100)
    stage: Optional[str] = Field(None, max_length=60)
    instrument: Optional[Instrument] = None
    investment_date: Optional[date] = None
    ownership_pct: Optional[Decimal] = Field(None, ge=0, le=100, max_digits=7, decimal_places=4)
    status: Optional[InvestmentStatus] = None
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("investment_date")
    @classmethod
    def _d(cls, v):
        return _check_date(v) if v is not None else v


class TransactionCreate(_In):
    txn_date: date
    type: TransactionType
    amount: Decimal = Field(..., gt=0, max_digits=16, decimal_places=2)
    status: TransactionStatus = "completed"
    description: str = Field("", max_length=500)

    _date = field_validator("txn_date")(lambda cls, v: _check_date(v))


class ValuationCreate(_In):
    valuation_date: date
    value: Decimal = Field(..., ge=0, max_digits=16, decimal_places=2)
    source: ValuationSource = "self_reported"
    note: str = Field("", max_length=500)

    _date = field_validator("valuation_date")(lambda cls, v: _check_date(v))


# ---------------------------------------------------------------- responses
# Amounts are strings like "125000.00".


class TransactionOut(BaseModel):
    id: int
    investment_id: int
    company_name: Optional[str] = None
    txn_date: date
    type: TransactionType
    amount: str
    status: TransactionStatus
    description: str


class ValuationOut(BaseModel):
    id: int
    investment_id: int
    valuation_date: date
    value: str
    source: ValuationSource
    note: str


class HoldingOut(BaseModel):
    id: int
    project_id: Optional[int] = None
    company_name: str
    industry: str
    stage: str
    instrument: Instrument
    investment_date: date
    ownership_pct: Optional[str] = None
    status: InvestmentStatus
    notes: str
    cost_basis: str            # invested + follow-ons + fees (completed only)
    cash_returned: str         # distributions, dividends, exit proceeds, interest
    current_value: str         # latest valuation, cost if none (active only); 0 once exited
    valuation_basis: Literal["valuation", "cost", "exited", "written_off"]
    valuation_date: Optional[date] = None
    valuation_source: Optional[ValuationSource] = None
    unrealized_gain: str
    net_gain: str
    multiple: Optional[str] = None


class PortfolioTotals(BaseModel):
    total_invested: str
    current_value: str
    cash_returned: str
    income: str                 # dividends + interest
    realized_gain: str
    unrealized_gain: str
    net_gain: str
    roi_pct: Optional[str] = None
    multiple: Optional[str] = None
    active_count: int
    exited_count: int
    written_off_count: int
    held_at_cost_count: int
    pending_transactions: int


class SeriesPoint(BaseModel):
    date: date
    invested: str
    value: str
    returned: str


class AllocationSlice(BaseModel):
    label: str
    cost_basis: str
    share_pct: str


class PortfolioSummary(BaseModel):
    currency: str = "INR"
    totals: PortfolioTotals
    holdings: List[HoldingOut]
    value_over_time: List[SeriesPoint]
    allocation_by_industry: List[AllocationSlice]


class InvestmentDetail(BaseModel):
    holding: HoldingOut
    transactions: List[TransactionOut]
    valuations: List[ValuationOut]


class TransactionPage(BaseModel):
    items: List[TransactionOut]
    total: int
    page: int
    page_size: int
