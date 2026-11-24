"""Profile, settings and account schemas shared by founders and investors (snake_case)."""
import re
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

_PHONE = re.compile(r"^\+?[0-9][0-9 ()-]{6,19}$")


def _url(v: Optional[str], linkedin: bool = False) -> str:
    v = (v or "").strip()
    if not v:
        return ""
    if "://" not in v:
        v = "https://" + v
    parsed = urlparse(v)
    if parsed.scheme not in ("http", "https") or "." not in (parsed.hostname or ""):
        raise ValueError("Enter a valid web address.")
    if linkedin and not (parsed.hostname or "").lower().endswith("linkedin.com"):
        raise ValueError("Use your LinkedIn address (linkedin.com/in/...).")
    return v[:300]


def _tags(v: List[str]) -> List[str]:
    seen, out = set(), []
    for t in v or []:
        t = str(t).strip()[:40]
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    if len(out) > 15:
        raise ValueError("Add up to 15.")
    return out


class _ProfileCommon(BaseModel):
    first_name: str = Field("", max_length=60)
    last_name: str = Field("", max_length=60)
    phone: str = Field("", max_length=24)
    location: str = Field("", max_length=120)
    headline: str = Field("", max_length=120)
    bio: str = Field("", max_length=2000)
    linkedin: str = Field("", max_length=300)
    website: str = Field("", max_length=300)
    expertise: List[str] = Field(default_factory=list)

    @field_validator("first_name", "last_name", "location", "headline", "bio", mode="after")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("phone", mode="after")
    @classmethod
    def _phone(cls, v: str) -> str:
        v = v.strip()
        if v and not _PHONE.fullmatch(v):
            raise ValueError("Enter a phone number with digits only (and an optional + country code).")
        return v

    @field_validator("linkedin", mode="after")
    @classmethod
    def _linkedin(cls, v: str) -> str:
        return _url(v, linkedin=True)

    @field_validator("website", mode="after")
    @classmethod
    def _website(cls, v: str) -> str:
        return _url(v)

    @field_validator("expertise", mode="after")
    @classmethod
    def _expertise(cls, v):
        return _tags(v)


class FounderProfileInput(_ProfileCommon):
    designation: str = Field("", max_length=100)
    experience: str = Field("", max_length=2000)
    skills: List[str] = Field(default_factory=list)
    previous_startups: str = Field("", max_length=1000)
    company: str = Field("", max_length=120)
    startup_role: str = Field("", max_length=100)
    background: str = Field("", max_length=2000)

    @field_validator("skills", mode="after")
    @classmethod
    def _skills(cls, v):
        return _tags(v)


INVESTOR_TYPES = ("angel", "vc", "micro_vc", "family_office", "corporate_vc", "accelerator", "syndicate", "other")


class InvestorProfileInput(_ProfileCommon):
    firm: str = Field("", max_length=120)
    title: str = Field("", max_length=100)
    investor_type: Literal["", "angel", "vc", "micro_vc", "family_office", "corporate_vc", "accelerator", "syndicate", "other"] = ""
    experience: str = Field("", max_length=2000)
    focus: str = Field("", max_length=1000)
    value_add: str = Field("", max_length=1500)


class SettingsInput(BaseModel):
    """The whole settings object as returned by GET /me/settings (validated per role on save)."""
    notifications: Dict[str, Any]
    privacy: Dict[str, Any]
    preferences: Dict[str, Any]


class DeletionRequestInput(BaseModel):
    reason: Optional[str] = Field(None, max_length=1000)
