import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.database import postgres as pg
from app.schemas.founder import FounderProfileUpdate, FounderSettings

logger = logging.getLogger(__name__)


async def account_defaults(user_id: str, org_field: str) -> Dict[str, Any]:
    """Name and organization from the user's account (set at sign-up/onboarding), for new profiles."""
    row = await pg.fetch_one("SELECT name, organization FROM app_users WHERE id = %s", [user_id])
    if not row:
        return {}
    return {k: v for k, v in (("name", row.get("name")), (org_field, row.get("organization"))) if v}

DEFAULT_FOUNDER_USER_ID = "founder-001"

DEFAULT_SETTINGS = {
    "default_private": True,
    "hide_gaps_from_investors": True,
    "email_alerts": True,
    "weekly_digest": False,
}

# Profile model field name -> founder_profiles column
_PROFILE_COLUMNS = {
    "name": "name",
    "company": "company",
    "bio": "bio",
    "location": "location",
    "linkedin": "linkedin",
    "website": "website",
}


class FounderService:
    @classmethod
    async def get_or_create_profile(
        cls,
        user_id: str = DEFAULT_FOUNDER_USER_ID,
        defaults: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        profile = await pg.fetch_one("SELECT * FROM founder_profiles WHERE user_id = %s", [user_id])
        if profile:
            return profile

        now = datetime.now(timezone.utc)
        if user_id == DEFAULT_FOUNDER_USER_ID:
            doc = {
                "user_id": user_id,
                "name": "Alex Rivers",
                "company": "NeuroPulse AI",
                "bio": "Founding engineer & biomedical researcher building ultra-low-latency edge diagnostic hardware for cardiology.",
                "location": "San Francisco, CA",
                "linkedin": "https://linkedin.com/in/alexrivers",
                "website": "https://neuropulse.demo",
            }
        else:
            # A real signed-in founder starts with an empty profile.
            # A real signed-in user starts from their account name/organization.
            doc = {"user_id": user_id, **(await account_defaults(user_id, "company")), **(defaults or {})}
        doc.update({"settings": DEFAULT_SETTINGS, "created_at": now, "updated_at": now})
        return await pg.upsert("founder_profiles", doc, ["user_id"], update=["updated_at"])

    @classmethod
    async def update_profile(
        cls,
        data: FounderProfileUpdate,
        user_id: str = DEFAULT_FOUNDER_USER_ID,
    ) -> Dict[str, Any]:
        await cls.get_or_create_profile(user_id)
        fields = {
            _PROFILE_COLUMNS[k]: v
            for k, v in data.model_dump(exclude_unset=True).items()
            if v is not None and k in _PROFILE_COLUMNS
        }
        fields["updated_at"] = datetime.now(timezone.utc)
        await pg.update_where("founder_profiles", fields, "user_id = %s", [user_id])
        return await cls.get_or_create_profile(user_id)

    @classmethod
    async def get_settings(cls, user_id: str = DEFAULT_FOUNDER_USER_ID) -> Dict[str, Any]:
        profile = await cls.get_or_create_profile(user_id)
        settings = profile.get("settings") or DEFAULT_SETTINGS
        return {
            "defaultPrivate": settings.get("default_private", True),
            "hideGapsFromInvestors": True,
            "emailAlerts": settings.get("email_alerts", True),
            "weeklyDigest": settings.get("weekly_digest", False),
        }

    @classmethod
    async def update_settings(
        cls,
        settings_in: FounderSettings,
        user_id: str = DEFAULT_FOUNDER_USER_ID,
    ) -> Dict[str, Any]:
        await cls.get_or_create_profile(user_id)
        settings_data = {
            "default_private": settings_in.defaultPrivate,
            "hide_gaps_from_investors": True,
            "email_alerts": settings_in.emailAlerts,
            "weekly_digest": settings_in.weeklyDigest,
        }
        await pg.update_where(
            "founder_profiles",
            {"settings": settings_data, "updated_at": datetime.now(timezone.utc)},
            "user_id = %s",
            [user_id],
        )
        return await cls.get_settings(user_id)
