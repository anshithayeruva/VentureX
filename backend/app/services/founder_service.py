import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.database.mongodb import get_database
from app.database.utils import serialize_doc
from app.schemas.founder import FounderProfileUpdate, FounderSettings

logger = logging.getLogger(__name__)

DEFAULT_FOUNDER_USER_ID = "founder-001"


class FounderService:
    @classmethod
    async def get_or_create_profile(cls, user_id: str = DEFAULT_FOUNDER_USER_ID) -> Dict[str, Any]:
        db = get_database()
        if db is None:
            return {}

        profile = await db.founder_profiles.find_one({"user_id": user_id})
        if not profile:
            now = datetime.now(timezone.utc)
            profile = {
                "user_id": user_id,
                "name": "Alex Rivers",
                "company": "NeuroPulse AI",
                "bio": "Founding engineer & biomedical researcher building ultra-low-latency edge diagnostic hardware for cardiology.",
                "location": "San Francisco, CA",
                "linkedin": "https://linkedin.com/in/alexrivers",
                "website": "https://neuropulse.demo",
                "settings": {
                    "default_private": True,
                    "hide_gaps_from_investors": True,
                    "email_alerts": True,
                    "weekly_digest": False,
                },
                "created_at": now,
                "updated_at": now,
            }
            await db.founder_profiles.insert_one(profile)

        return serialize_doc(profile)

    @classmethod
    async def update_profile(
        cls,
        data: FounderProfileUpdate,
        user_id: str = DEFAULT_FOUNDER_USER_ID,
    ) -> Dict[str, Any]:
        db = get_database()
        if db is None:
            return {}

        update_fields = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        update_fields["updated_at"] = datetime.now(timezone.utc)

        await db.founder_profiles.update_one(
            {"user_id": user_id},
            {"$set": update_fields},
            upsert=True
        )
        return await cls.get_or_create_profile(user_id)

    @classmethod
    async def get_settings(cls, user_id: str = DEFAULT_FOUNDER_USER_ID) -> Dict[str, Any]:
        profile = await cls.get_or_create_profile(user_id)
        settings = profile.get("settings") or {
            "default_private": True,
            "hide_gaps_from_investors": True,
            "email_alerts": True,
            "weekly_digest": False,
        }
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
        db = get_database()
        if db is None:
            return {}

        now = datetime.now(timezone.utc)
        settings_data = {
            "default_private": settings_in.defaultPrivate,
            "hide_gaps_from_investors": True,
            "email_alerts": settings_in.emailAlerts,
            "weekly_digest": settings_in.weeklyDigest,
        }

        await db.founder_profiles.update_one(
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
