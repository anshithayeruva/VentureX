"""Founder updates to their investors."""
from datetime import date
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

Amount = Optional[Decimal]


class CustomMetric(BaseModel):
    label: str = Field(..., min_length=1, max_length=60)
    value: str = Field(..., min_length=1, max_length=60)


class UpdateMetrics(BaseModel):
    """All optional: founders report what they track. Money is in rupees."""
    model_config = ConfigDict(extra="ignore")
    monthly_revenue: Amount = Field(None, ge=0, max_digits=16, decimal_places=2)
    customers: Optional[int] = Field(None, ge=0, le=1_000_000_000)
    cash_in_bank: Amount = Field(None, ge=0, max_digits=16, decimal_places=2)
    monthly_burn: Amount = Field(None, ge=0, max_digits=16, decimal_places=2)
    headcount: Optional[int] = Field(None, ge=0, le=1_000_000)
    # Post-money valuation from a priced round; investors can apply it to their holding.
    post_money_valuation: Amount = Field(None, ge=0, max_digits=18, decimal_places=2)
    custom: List[CustomMetric] = Field(default_factory=list, max_length=6)


class UpdateInput(BaseModel):
    period_type: Literal["month", "quarter"] = "month"
    period_end: date
    period_label: Optional[str] = Field(None, max_length=40)
    metrics: UpdateMetrics = Field(default_factory=UpdateMetrics)
    highlights: str = Field("", max_length=4000)
    challenges: str = Field("", max_length=4000)
    asks: List[str] = Field(default_factory=list, max_length=5)
    audience: Literal["investors", "investors_and_connected"] = "investors"

    @field_validator("asks", mode="after")
    @classmethod
    def _asks(cls, v):
        out = [a.strip()[:300] for a in v if a and a.strip()]
        return out

    @field_validator("period_end", mode="after")
    @classmethod
    def _not_future(cls, v):
        from datetime import date as _d, timedelta
        if v > _d.today() + timedelta(days=31):
            raise ValueError("The period can't end more than a month from now.")
        return v


class SendInput(BaseModel):
    # Also refresh the project's public traction (revenue, customers, team size) from this update.
    apply_to_project: bool = True


class ResponseInput(BaseModel):
    message: str = Field(..., min_length=2, max_length=2000)
    ask_index: Optional[int] = Field(None, ge=0, le=4)


class ApplyValuationInput(BaseModel):
    investment_id: int = Field(..., ge=1)
