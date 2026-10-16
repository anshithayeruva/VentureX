import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from app.database.mongodb import get_database
from app.database.utils import serialize_doc, serialize_docs
from app.schemas.investor import (
    InvestorProfileUpdate,
    InvestorPreferenceUpdate,
    InvestorSettings,
)

logger = logging.getLogger(__name__)

DEFAULT_INVESTOR_USER_ID = "investor-001"


class InvestorService:
    @classmethod
    async def get_or_create_profile(cls, user_id: str = DEFAULT_INVESTOR_USER_ID) -> Dict[str, Any]:
        db = get_database()
        if db is None:
            return {}

        profile = await db.investor_profiles.find_one({"user_id": user_id})
        if not profile:
            now = datetime.now(timezone.utc)
            profile = {
                "user_id": user_id,
                "name": "Dr. Sarah Lin",
                "firm": "Apex Horizon Ventures",
                "title": "General Partner",
                "bio": "Investing in Healthcare AI, MedTech diagnostics, and clinical automation infrastructure.",
                "location": "New York & Boston",
                "thesis": "Leading Seed and Series A rounds for high-defensibility technical founders solving critical clinical bottleneck problems.",
                "min_check": "$500,000",
                "max_check": "$1,500,000",
                "settings": {
                    "auto_notify_high_conviction": True,
                    "weekly_dealflow_summary": True,
                    "direct_founder_messaging": True,
                },
                "created_at": now,
                "updated_at": now,
            }
            await db.investor_profiles.insert_one(profile)

        # Attach preferences
        prefs = await cls.get_or_create_preferences(user_id)
        serialized = serialize_doc(profile)
        serialized["preference"] = prefs
        return serialized

    @classmethod
    async def update_profile(
        cls,
        data: InvestorProfileUpdate,
        user_id: str = DEFAULT_INVESTOR_USER_ID,
    ) -> Dict[str, Any]:
        db = get_database()
        if db is None:
            return {}

        update_fields = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        update_fields["updated_at"] = datetime.now(timezone.utc)

        await db.investor_profiles.update_one(
            {"user_id": user_id},
            {"$set": update_fields},
            upsert=True
        )
        return await cls.get_or_create_profile(user_id)

    @classmethod
    async def get_or_create_preferences(cls, investor_id: str = DEFAULT_INVESTOR_USER_ID) -> Dict[str, Any]:
        db = get_database()
        if db is None:
            return {}

        pref = await db.investor_preferences.find_one({"investor_id": investor_id})
        if not pref:
            now = datetime.now(timezone.utc)
            pref = {
                "investor_id": investor_id,
                "preferred_industries": ["Healthcare & AI", "AI/ML", "BioTech", "Cybersecurity"],
                "preferred_stages": ["Seed", "Pre-seed", "Series A"],
                "min_investment": 500000.0,
                "max_investment": 1500000.0,
                "preferred_business_models": ["B2B SaaS", "Enterprise Infrastructure", "DeepTech IP Licensing"],
                "geography": "North America & Europe",
                "tech_preferences": ["Edge Machine Learning", "Bioinformatics", "Generative AI & LLMs"],
                "created_at": now,
                "updated_at": now,
            }
            await db.investor_preferences.insert_one(pref)

        return serialize_doc(pref)

    @classmethod
    async def update_preferences(
        cls,
        data: InvestorPreferenceUpdate,
        investor_id: str = DEFAULT_INVESTOR_USER_ID,
    ) -> Dict[str, Any]:
        db = get_database()
        if db is None:
            return {}

        update_fields = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        update_fields["updated_at"] = datetime.now(timezone.utc)

        await db.investor_preferences.update_one(
            {"investor_id": investor_id},
            {"$set": update_fields},
            upsert=True
        )

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
        settings = profile.get("settings") or {
            "auto_notify_high_conviction": True,
            "weekly_dealflow_summary": True,
            "direct_founder_messaging": True,
        }
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
        db = get_database()
        if db is None:
            return {}

        now = datetime.now(timezone.utc)
        settings_data = {
            "auto_notify_high_conviction": settings_in.autoNotifyHighConviction,
            "weekly_dealflow_summary": settings_in.weeklyDealflowSummary,
            "direct_founder_messaging": settings_in.directFounderMessaging,
        }

        await db.investor_profiles.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "settings": settings_data,
                    "updated_at": now,
                }
            },
            upsert=True
        )
        return await cls.get_settings(user_id)

    @classmethod
    async def list_all(cls, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        db = get_database()
        if db is None:
            return []

        cursor = db.investor_profiles.find({}).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return serialize_docs(docs)
