import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from app.database import postgres as pg
from app.schemas.investor import (
    InvestorProfileUpdate,
    InvestorPreferenceUpdate,
    InvestorSettings,
)

logger = logging.getLogger(__name__)

DEFAULT_INVESTOR_USER_ID = "investor-001"

DEFAULT_SETTINGS = {
    "auto_notify_high_conviction": True,
    "weekly_dealflow_summary": True,
    "direct_founder_messaging": True,
}

DEFAULT_PREFERENCES = {
    "preferred_industries": ["Healthcare & AI", "AI/ML", "BioTech", "Cybersecurity"],
    "preferred_stages": ["Seed", "Pre-seed", "Series A"],
    "min_investment": 500000.0,
    "max_investment": 1500000.0,
    "preferred_business_models": ["B2B SaaS", "Enterprise Infrastructure", "DeepTech IP Licensing"],
    "geography": "North America & Europe",
    "tech_preferences": ["Edge Machine Learning", "Bioinformatics", "Generative AI & LLMs"],
}

# Profile model field name -> investor_profiles column
_PROFILE_COLUMNS = {
    "name": "name",
    "firm": "firm",
    "title": "title",
    "bio": "bio",
    "location": "location",
    "thesis": "thesis",
    "minCheck": "min_check",
    "maxCheck": "max_check",
}

_PREFERENCE_COLUMNS = set(DEFAULT_PREFERENCES)


class InvestorService:
    @classmethod
    async def get_or_create_profile(
        cls,
        user_id: str = DEFAULT_INVESTOR_USER_ID,
        defaults: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        profile = await pg.fetch_one("SELECT * FROM investor_profiles WHERE user_id = %s", [user_id])
        if not profile:
            now = datetime.now(timezone.utc)
            if user_id == DEFAULT_INVESTOR_USER_ID:
                doc = {
                    "user_id": user_id,
                    "name": "Dr. Sarah Lin",
                    "firm": "Apex Horizon Ventures",
                    "title": "General Partner",
                    "bio": "Investing in Healthcare AI, MedTech diagnostics, and clinical automation infrastructure.",
                    "location": "New York & Boston",
                    "thesis": "Leading Seed and Series A rounds for high-defensibility technical founders solving critical clinical bottleneck problems.",
                    "min_check": "$500,000",
                    "max_check": "$1,500,000",
                }
            else:
                # A real signed-in investor starts with an empty profile.
                doc = {"user_id": user_id, **(defaults or {})}
            doc.update({"settings": DEFAULT_SETTINGS, "created_at": now, "updated_at": now})
            profile = await pg.upsert("investor_profiles", doc, ["user_id"], update=["updated_at"])

        # Attach preferences
        prefs = await cls.get_or_create_preferences(user_id)
        return {**profile, "preference": prefs}

    @classmethod
    async def update_profile(
        cls,
        data: InvestorProfileUpdate,
        user_id: str = DEFAULT_INVESTOR_USER_ID,
    ) -> Dict[str, Any]:
        await cls.get_or_create_profile(user_id)
        fields = {
            _PROFILE_COLUMNS[k]: (str(v) if k in ("minCheck", "maxCheck") else v)
            for k, v in data.model_dump(exclude_unset=True).items()
            if v is not None and k in _PROFILE_COLUMNS
        }
        fields["updated_at"] = datetime.now(timezone.utc)
        await pg.update_where("investor_profiles", fields, "user_id = %s", [user_id])
        return await cls.get_or_create_profile(user_id)

    @classmethod
    async def get_or_create_preferences(cls, investor_id: str = DEFAULT_INVESTOR_USER_ID) -> Dict[str, Any]:
        pref = await pg.fetch_one("SELECT * FROM investor_preferences WHERE investor_id = %s", [investor_id])
        if pref:
            return pref
        now = datetime.now(timezone.utc)
        doc = {"investor_id": investor_id, **DEFAULT_PREFERENCES, "created_at": now, "updated_at": now}
        return await pg.upsert("investor_preferences", doc, ["investor_id"], update=["updated_at"])

    @classmethod
    async def update_preferences(
        cls,
        data: InvestorPreferenceUpdate,
        investor_id: str = DEFAULT_INVESTOR_USER_ID,
    ) -> Dict[str, Any]:
        await cls.get_or_create_preferences(investor_id)
        fields = {
            k: v
            for k, v in data.model_dump(exclude_unset=True).items()
            if v is not None and k in _PREFERENCE_COLUMNS
        }
        fields["updated_at"] = datetime.now(timezone.utc)
        await pg.update_where("investor_preferences", fields, "investor_id = %s", [investor_id])

        # Trigger dynamic matching pipeline to refresh matches based on new criteria
        try:
            from app.services.match_service import MatchService
            await MatchService.compute_matches_for_investor(investor_id)
        except Exception as e:
            logger.warning("Could not recompute matches for investor %s: %s", investor_id, e)

        return await cls.get_or_create_preferences(investor_id)

    @classmethod
    async def get_settings(cls, user_id: str = DEFAULT_INVESTOR_USER_ID) -> Dict[str, Any]:
        profile = await cls.get_or_create_profile(user_id)
        settings = profile.get("settings") or DEFAULT_SETTINGS
        return {
            "autoNotifyHighConviction": settings.get("auto_notify_high_conviction", True),
            "weeklyDealflowSummary": settings.get("weekly_dealflow_summary", True),
            "directFounderMessaging": settings.get("direct_founder_messaging", True),
        }

    @classmethod
    async def update_settings(
        cls,
        settings_in: InvestorSettings,
        user_id: str = DEFAULT_INVESTOR_USER_ID,
    ) -> Dict[str, Any]:
        await cls.get_or_create_profile(user_id)
        settings_data = {
            "auto_notify_high_conviction": settings_in.autoNotifyHighConviction,
            "weekly_dealflow_summary": settings_in.weeklyDealflowSummary,
            "direct_founder_messaging": settings_in.directFounderMessaging,
        }
        await pg.update_where(
            "investor_profiles",
            {"settings": settings_data, "updated_at": datetime.now(timezone.utc)},
            "user_id = %s",
            [user_id],
        )
        return await cls.get_settings(user_id)

    @classmethod
    async def list_all(cls, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        return await pg.fetch_all(
            "SELECT * FROM investor_profiles ORDER BY created_at, user_id OFFSET %s LIMIT %s",
            [skip, limit],
        )
