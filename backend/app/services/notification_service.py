import logging
from typing import List, Dict, Any, Optional
from app.database.mongodb import get_database
from app.database.utils import serialize_docs

logger = logging.getLogger(__name__)


class NotificationService:
    @classmethod
    async def list_notifications(
        cls,
        target_role: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        db = get_database()
        if db is None:
            return []

        query: Dict[str, Any] = {}
        if target_role:
            query["target_role"] = target_role.upper()
        if user_id:
            query["user_id"] = user_id

        cursor = db.notifications.find(query).sort("created_at", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return serialize_docs(docs)
