"""Shared vocabulary for investor criteria and startup facts (stages, regions)."""
from typing import Any, Dict, List, Optional

from app.schemas.thesis import INVESTOR_STAGES, InvestmentThesis

# Founder-facing stage names -> the investor stage ladder.
_STAGE_ALIASES = {
    "idea": "Idea",
    "idea phase": "Idea",
    "prototype": "Idea",
    "mvp": "Pre-seed",
    "mvp / private beta": "Pre-seed",
    "mvp / beta": "Pre-seed",
    "pre-seed": "Pre-seed",
    "preseed": "Pre-seed",
    "early traction": "Seed",
    "seed": "Seed",
    "series a": "Series A",
    "series b": "Series B",
    "series c": "Series C",
    "series c+": "Series C",
    "growth": "Growth",
    "pre-ipo": "Pre-IPO",
}


def canonical_stage(stage: Optional[str]) -> Optional[str]:
    if not stage:
        return None
    key = stage.strip().lower()
    if key in _STAGE_ALIASES:
        return _STAGE_ALIASES[key]
    return next((s for s in INVESTOR_STAGES if s.lower() == key), None)


REGIONS: Dict[str, List[str]] = {
    "North America": ["United States", "Canada", "Mexico"],
    "Latin America": ["Brazil", "Argentina", "Chile", "Colombia", "Peru", "Mexico"],
    "Europe": [
        "United Kingdom", "Ireland", "Germany", "France", "Netherlands", "Belgium", "Spain", "Portugal",
        "Italy", "Switzerland", "Austria", "Sweden", "Norway", "Denmark", "Finland", "Poland", "Estonia",
        "Czech Republic", "Greece",
    ],
    "Middle East": ["Israel", "United Arab Emirates", "Saudi Arabia", "Qatar", "Turkey"],
    "Africa": ["Nigeria", "Kenya", "South Africa", "Egypt", "Ghana", "Morocco"],
    "South Asia": ["India", "Pakistan", "Bangladesh", "Sri Lanka"],
    "East Asia": ["China", "Japan", "South Korea", "Taiwan", "Hong Kong"],
    "Southeast Asia": ["Singapore", "Indonesia", "Vietnam", "Malaysia", "Philippines", "Thailand"],
    "Oceania": ["Australia", "New Zealand"],
}
COUNTRIES = sorted({c for cs in REGIONS.values() for c in cs})


def regions_for_country(country: str) -> List[str]:
    c = (country or "").strip().lower()
    return [r for r, cs in REGIONS.items() if any(x.lower() == c for x in cs)]


def thesis_from_row(pref: Dict[str, Any]) -> Dict[str, Any]:
    """The saved thesis, or one rebuilt from the legacy preference columns."""
    saved = pref.get("thesis") or {}
    if saved:
        return InvestmentThesis.model_validate(saved).model_dump(mode="json")
    stages = []
    for s in pref.get("preferred_stages") or []:
        c = canonical_stage(s)
        if c and c not in stages:
            stages.append(c)
    legacy = {
        "sectors": {
            "industries": pref.get("preferred_industries") or [],
            "technologies": pref.get("tech_preferences") or [],
            "business_models": pref.get("preferred_business_models") or [],
        },
        "stages": stages,
        "check_size": {
            "min_check": _money(pref.get("min_investment")),
            "max_check": _money(pref.get("max_investment")),
        },
    }
    try:
        return InvestmentThesis.model_validate(legacy).model_dump(mode="json")
    except ValueError:
        legacy["check_size"] = {}
        return InvestmentThesis.model_validate(legacy).model_dump(mode="json")


def _money(value: Any) -> Optional[str]:
    if value is None:
        return None
    try:
        return f"{float(value):.2f}"
    except (TypeError, ValueError):
        return None


def legacy_columns(thesis: InvestmentThesis) -> Dict[str, Any]:
    """Mirror a thesis onto the older flat preference columns."""
    geo = thesis.geography
    if geo.is_global:
        geography = "Global"
    else:
        geography = ", ".join(geo.regions + geo.countries + geo.cities) or "Not specified"
    cols: Dict[str, Any] = {
        "preferred_industries": thesis.sectors.industries,
        "preferred_stages": thesis.stages,
        "preferred_business_models": thesis.sectors.business_models,
        "tech_preferences": thesis.sectors.technologies,
        "geography": geography[:200],
    }
    if thesis.check_size.min_check is not None:
        cols["min_investment"] = float(thesis.check_size.min_check)
    if thesis.check_size.max_check is not None:
        cols["max_investment"] = float(thesis.check_size.max_check)
    return cols
