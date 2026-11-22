"""Structured investment thesis: what an investor funds, stored as investor_preferences.thesis."""
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Requirement = Literal["required", "preferred", "not_relevant"]
Priority = Literal["high", "medium", "low", "ignore"]

INVESTOR_STAGES = ["Idea", "Pre-seed", "Seed", "Series A", "Series B", "Series C", "Growth", "Pre-IPO"]

INSTRUMENTS = [
    "Equity",
    "SAFE",
    "Convertible note",
    "Debt",
    "Revenue-based financing",
]

MAX_LIST = 40
Money = Optional[Decimal]


def _clean_list(values: List[str]) -> List[str]:
    seen, out = set(), []
    for v in values or []:
        text = str(v).strip()[:80]
        if text and text.lower() not in seen:
            seen.add(text.lower())
            out.append(text)
    return out[:MAX_LIST]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="ignore")


class SectorFocus(_Strict):
    industries: List[str] = Field(default_factory=list)
    sub_industries: List[str] = Field(default_factory=list)
    sectors: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    excluded_industries: List[str] = Field(default_factory=list)
    business_models: List[str] = Field(default_factory=list)

    @field_validator("*", mode="after")
    @classmethod
    def _lists(cls, v):
        return _clean_list(v)

    @model_validator(mode="after")
    def _no_overlap(self):
        excluded = {i.lower() for i in self.excluded_industries}
        clash = [i for i in self.industries if i.lower() in excluded]
        if clash:
            raise ValueError(f"{', '.join(clash)} can't be both a focus and excluded.")
        return self


class CheckSize(_Strict):
    """Per-company check size, plus the separate total capital set aside for startups."""
    min_check: Money = Field(None, ge=0, max_digits=16, decimal_places=2)
    max_check: Money = Field(None, ge=0, max_digits=16, decimal_places=2)
    preferred_check: Money = Field(None, ge=0, max_digits=16, decimal_places=2)
    total_allocation: Money = Field(None, ge=0, max_digits=16, decimal_places=2)
    currency: Literal["INR"] = "INR"

    @field_validator("currency", mode="before")
    @classmethod
    def _inr(cls, v):  # VentureX works in rupees; older saved criteria said "USD"
        return "INR"

    @model_validator(mode="after")
    def _ordered(self):
        lo, hi, pref, total = self.min_check, self.max_check, self.preferred_check, self.total_allocation
        if lo is not None and hi is not None and lo > hi:
            raise ValueError("The minimum check can't be larger than the maximum check.")
        if pref is not None and ((lo is not None and pref < lo) or (hi is not None and pref > hi)):
            raise ValueError("The preferred check should sit between the minimum and maximum.")
        if total is not None and hi is not None and total and total < hi:
            raise ValueError("Total capital allocated can't be smaller than a single maximum check.")
        return self


class Geography(_Strict):
    is_global: bool = False
    regions: List[str] = Field(default_factory=list)
    countries: List[str] = Field(default_factory=list)
    cities: List[str] = Field(default_factory=list)
    excluded_countries: List[str] = Field(default_factory=list)

    @field_validator("regions", "countries", "cities", "excluded_countries", mode="after")
    @classmethod
    def _lists(cls, v):
        return _clean_list(v)


class Traction(_Strict):
    revenue: Requirement = "not_relevant"
    min_monthly_revenue: Money = Field(None, ge=0, max_digits=16, decimal_places=2)
    customers: Requirement = "not_relevant"
    min_customers: Optional[int] = Field(None, ge=0, le=100_000_000)
    live_product: Requirement = "not_relevant"


class Structure(_Strict):
    instruments: List[str] = Field(default_factory=list)
    role: Literal["lead", "co_invest", "either"] = "either"
    min_ownership_pct: Optional[Decimal] = Field(None, ge=0, le=100, max_digits=6, decimal_places=2)
    max_ownership_pct: Optional[Decimal] = Field(None, ge=0, le=100, max_digits=6, decimal_places=2)
    board_seat: Requirement = "not_relevant"

    @field_validator("instruments", mode="after")
    @classmethod
    def _known(cls, v):
        return [i for i in _clean_list(v) if i in INSTRUMENTS]

    @model_validator(mode="after")
    def _ordered(self):
        if (
            self.min_ownership_pct is not None
            and self.max_ownership_pct is not None
            and self.min_ownership_pct > self.max_ownership_pct
        ):
            raise ValueError("Minimum ownership can't be above maximum ownership.")
        return self


class TeamPreferences(_Strict):
    technical_founder: Requirement = "not_relevant"
    repeat_founder: Requirement = "not_relevant"
    domain_expertise: Requirement = "not_relevant"
    full_time_team: Requirement = "not_relevant"
    min_team_size: Optional[int] = Field(None, ge=1, le=10_000)


class Additional(_Strict):
    horizon_years: Optional[int] = Field(None, ge=1, le=30)
    risk_tolerance: Optional[Literal["low", "moderate", "high"]] = None
    product_maturity: Optional[Literal["any", "prototype", "launched", "scaling"]] = None
    differentiation: Requirement = "not_relevant"
    ip_protection: Requirement = "not_relevant"
    scalability: Requirement = "not_relevant"
    exit_paths: List[str] = Field(default_factory=list)
    notes: str = Field("", max_length=2000)

    @field_validator("exit_paths", mode="after")
    @classmethod
    def _lists(cls, v):
        return _clean_list(v)


class Priorities(_Strict):
    """How much each criterion counts in the match score. 'ignore' leaves it out."""
    industry: Priority = "high"
    stage: Priority = "high"
    check_size: Priority = "medium"
    geography: Priority = "medium"
    business_model: Priority = "low"
    traction: Priority = "medium"
    team: Priority = "medium"


class InvestmentThesis(_Strict):
    sectors: SectorFocus = Field(default_factory=SectorFocus)
    stages: List[str] = Field(default_factory=list)
    check_size: CheckSize = Field(default_factory=CheckSize)
    geography: Geography = Field(default_factory=Geography)
    traction: Traction = Field(default_factory=Traction)
    structure: Structure = Field(default_factory=Structure)
    team: TeamPreferences = Field(default_factory=TeamPreferences)
    additional: Additional = Field(default_factory=Additional)
    priorities: Priorities = Field(default_factory=Priorities)

    @field_validator("stages", mode="after")
    @classmethod
    def _stages(cls, v):
        return [s for s in INVESTOR_STAGES if s in set(_clean_list(v))]
