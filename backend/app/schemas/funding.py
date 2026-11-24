"""Funding rounds and investment allocations. Amounts are rupees with 2 decimals (Decimal, never float)."""
from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

Money = Optional[Decimal]
Instrument = Literal["equity", "safe", "convertible_note", "other"]


def _money(**kw):
    return Field(None, gt=0, max_digits=16, decimal_places=2, **kw)


class RoundInput(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    round_type: Literal["pre_seed", "seed", "series_a", "series_b", "series_c", "bridge", "other"] = "seed"
    instrument: Instrument = "equity"
    target_amount: Decimal = Field(..., gt=0, max_digits=16, decimal_places=2)
    min_ticket: Money = _money()
    max_ticket: Money = _money()
    pre_money_valuation: Money = _money()
    post_money_valuation: Money = _money()
    valuation_cap: Money = _money()
    discount_pct: Optional[Decimal] = Field(None, ge=0, lt=100, max_digits=5, decimal_places=2)
    opens_on: Optional[date] = None
    closes_on: Optional[date] = None
    disclose_progress: bool = True

    @model_validator(mode="after")
    def _consistent(self):
        if self.min_ticket and self.max_ticket and self.min_ticket > self.max_ticket:
            raise ValueError("The minimum ticket can't be larger than the maximum.")
        if self.max_ticket and self.max_ticket > self.target_amount:
            raise ValueError("The maximum ticket can't be larger than the round target.")
        if self.opens_on and self.closes_on and self.opens_on > self.closes_on:
            raise ValueError("The round can't close before it opens.")
        if self.pre_money_valuation and self.post_money_valuation and self.post_money_valuation <= self.pre_money_valuation:
            raise ValueError("Post-money valuation must be larger than pre-money.")
        if self.instrument == "equity" and (self.valuation_cap or self.discount_pct):
            raise ValueError("A valuation cap and discount apply to SAFEs and convertible notes, not priced equity.")
        return self


class RoundStatusInput(BaseModel):
    status: Literal["draft", "open", "closed", "cancelled"]


class ProposalInput(BaseModel):
    """An investor offers to invest in an open round."""
    amount: Decimal = Field(..., gt=0, max_digits=16, decimal_places=2)
    note: str = Field("", max_length=1000)


class AcceptInput(BaseModel):
    """The founder accepts a proposal, setting the agreed terms (the investor then confirms)."""
    amount: Decimal = Field(..., gt=0, max_digits=16, decimal_places=2)
    agreed_equity_pct: Optional[Decimal] = Field(None, gt=0, le=100, max_digits=7, decimal_places=4)
    agreed_valuation: Money = _money()
    discount_pct: Optional[Decimal] = Field(None, ge=0, lt=100, max_digits=5, decimal_places=2)
    terms: str = Field("", max_length=2000)
    note: str = Field("", max_length=1000)


class RejectInput(BaseModel):
    note: str = Field("", max_length=1000)


class ExternalAllocationInput(BaseModel):
    """A commitment from an investor who isn't on VentureX, recorded by the founder."""
    investor_name: str = Field(..., min_length=2, max_length=120)
    amount: Decimal = Field(..., gt=0, max_digits=16, decimal_places=2)
    instrument: Optional[Instrument] = None
    agreed_equity_pct: Optional[Decimal] = Field(None, gt=0, le=100, max_digits=7, decimal_places=4)
    agreed_valuation: Money = _money()
    committed_on: Optional[date] = None
    terms: str = Field("", max_length=2000)


class ReceiptInput(BaseModel):
    """Capital actually received against a commitment (recorded by the founder)."""
    amount: Decimal = Field(..., gt=0, max_digits=16, decimal_places=2)
    received_on: date
    reference: str = Field("", max_length=200)
    type: Literal["receipt", "refund"] = "receipt"
