import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Union
from app.database.mongodb import get_database
from app.database.utils import serialize_doc, serialize_docs

logger = logging.getLogger(__name__)


class InterestService:
    @classmethod
    async def express_interest(
        cls,
        project_id: Union[int, str],
        investor_id: str = "investor-001",
        founder_id: str = "founder-001",
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        db = get_database()
        if db is None:
            raise RuntimeError("Database unavailable")

        now = datetime.now(timezone.utc)
        # Check if project exists to get actual founder_id and title
        try:
            p_query = {"$or": [{"id": int(project_id)}, {"id": str(project_id)}]}
        except ValueError:
            p_query = {"id": project_id}

        project = await db.projects.find_one(p_query)
        if project:
            founder_id = project.get("founder_id", founder_id)

        doc = {
            "project_id": project_id,
            "investor_id": investor_id,
            "founder_id": founder_id,
            "status": "pending",
            "message": message or "Introduction requested for confidential data room review.",
            "created_at": now,
            "updated_at": now,
        }

        # Upsert interest
        await db.project_interests.update_one(
            {"project_id": project_id, "investor_id": investor_id},
            {"$set": doc},
            upsert=True
        )

        saved = await db.project_interests.find_one({"project_id": project_id, "investor_id": investor_id})
        return serialize_doc(saved)

    @classmethod
    async def list_interests(
        cls,
        investor_id: Optional[str] = None,
        founder_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        db = get_database()
        if db is None:
            return []

        query: Dict[str, Any] = {}
        if investor_id:
            query["investor_id"] = investor_id
        if founder_id:
            query["founder_id"] = founder_id

        cursor = db.project_interests.find(query).sort("created_at", -1)
        docs = await cursor.to_list(length=100)
        return serialize_docs(docs)
