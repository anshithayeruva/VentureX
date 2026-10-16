import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from bson import ObjectId
from app.database.mongodb import get_database
from app.database.utils import serialize_docs, serialize_doc

logger = logging.getLogger(__name__)


def format_relative_time(dt: Optional[datetime]) -> str:
    """Format a datetime object into a concise relative time string."""
    if not dt:
        return "Recently"
    now = datetime.utcnow()
    diff = now - dt
    seconds = max(0, int(diff.total_seconds()))
    if seconds < 60:
        return "Just now"
    elif seconds < 3600:
        mins = seconds // 60
        return f"{mins}m ago"
    elif seconds < 86400:
        hours = seconds // 3600
        return f"{hours}h ago"
    elif seconds < 604800:
        days = seconds // 86400
        return f"{days}d ago"
    else:
        return dt.strftime("%b %d")


class NotificationService:
    @classmethod
    async def create_notification(
        cls,
        target_role: str,
        title: str,
        desc: str,
        user_id: Optional[Union[str, int]] = None,
        badge: str = "Alert",
        badge_variant: str = "primary",
        link: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Insert a new notification into the database and return the serialized document."""
        db = get_database()
        if db is None:
            logger.warning("Database unavailable, skipping notification creation")
            return {}

        now = datetime.utcnow()
        doc = {
            "target_role": target_role.upper(),
            "user_id": str(user_id) if user_id is not None else None,
            "title": title,
            "desc": desc,
            "time": "Just now",
            "badge": badge,
            "badge_variant": badge_variant,
            "link": link,
            "read": False,
            "created_at": now,
        }

        result = await db.notifications.insert_one(doc)
        doc["_id"] = result.inserted_id
        logger.info(f"Notification created [{result.inserted_id}] for {target_role} ({user_id}): {title}")
        return serialize_doc(doc)

    @classmethod
    async def list_notifications(
        cls,
        target_role: Optional[str] = None,
        user_id: Optional[str] = None,
        unread_only: bool = False,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """List notifications, recalculating relative timestamps dynamically."""
        db = get_database()
        if db is None:
            return []

        query: Dict[str, Any] = {}
        if target_role:
            query["target_role"] = target_role.upper()
        if user_id:
            query["$or"] = [{"user_id": str(user_id)}, {"user_id": None}]
        if unread_only:
            query["read"] = False

        cursor = db.notifications.find(query).sort("created_at", -1).limit(limit)
        docs = await cursor.to_list(length=limit)

        # Update dynamic relative time if created_at is a datetime
        for d in docs:
            created_at = d.get("created_at")
            if isinstance(created_at, datetime):
                d["time"] = format_relative_time(created_at)

        return serialize_docs(docs)

    @classmethod
    async def mark_as_read(cls, notification_id: str) -> bool:
        """Mark a single notification as read by its ObjectId string."""
        db = get_database()
        if db is None:
            return False

        try:
            oid = ObjectId(notification_id)
            query = {"_id": oid}
        except Exception:
            query = {"id": notification_id}

        result = await db.notifications.update_one(query, {"$set": {"read": True}})
        return result.modified_count > 0

    @classmethod
    async def mark_all_read(
        cls,
        target_role: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> int:
        """Mark all matching notifications as read."""
        db = get_database()
        if db is None:
            return 0

        query: Dict[str, Any] = {"read": False}
        if target_role:
            query["target_role"] = target_role.upper()
        if user_id:
            query["$or"] = [{"user_id": str(user_id)}, {"user_id": None}]

        result = await db.notifications.update_many(query, {"$set": {"read": True}})
        return result.modified_count

    @classmethod
    async def get_unread_count(
        cls,
        target_role: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> int:
        """Return the count of unread notifications for a role/user."""
        db = get_database()
        if db is None:
            return 0

        query: Dict[str, Any] = {"read": False}
        if target_role:
            query["target_role"] = target_role.upper()
        if user_id:
            query["$or"] = [{"user_id": str(user_id)}, {"user_id": None}]

        return await db.notifications.count_documents(query)

