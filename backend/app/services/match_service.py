import logging
from typing import List, Dict, Any, Optional
from app.database.mongodb import get_database
from app.database.utils import serialize_docs

logger = logging.getLogger(__name__)


class MatchService:
    @classmethod
    async def list_matches(
        cls,
        search: Optional[str] = None,
        project_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        db = get_database()
        if db is None:
            return []

        query: Dict[str, Any] = {}
        if project_id:
            try:
                query["project_id"] = int(project_id)
            except ValueError:
                query["project_id"] = project_id

        if search and search.strip():
            s = search.strip()
            query["$or"] = [
                {"investor_name": {"$regex": s, "$options": "i"}},
                {"investor_firm": {"$regex": s, "$options": "i"}},
                {"project_title": {"$regex": s, "$options": "i"}},
            ]

        cursor = db.matches.find(query).sort("match_score", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return serialize_docs(docs)
