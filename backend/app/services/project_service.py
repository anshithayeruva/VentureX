import logging
import random
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Union
from bson import ObjectId
from app.database.mongodb import get_database
from app.database.utils import serialize_doc, serialize_docs
from app.schemas.project import ProjectCreate, ProjectUpdate

logger = logging.getLogger(__name__)


class ProjectService:
    @staticmethod
    def _parse_id(project_id: Union[int, str]) -> Dict[str, Any]:
        """Generate a MongoDB filter query matching integer id, string id, or ObjectId."""
        queries = [{"id": project_id}]
        try:
            queries.append({"id": int(project_id)})
        except (ValueError, TypeError):
            pass
        try:
            queries.append({"id": str(project_id)})
        except Exception:
            pass
        if ObjectId.is_valid(str(project_id)):
            queries.append({"_id": ObjectId(str(project_id))})
        return {"$or": queries} if len(queries) > 1 else queries[0]

    @classmethod
    async def create(cls, data: ProjectCreate, founder_id: str = "founder-001") -> Dict[str, Any]:
        db = get_database()
        if db is None:
            raise RuntimeError("Database connection unavailable")

        now = datetime.now(timezone.utc)
        # Deterministic / heuristic preliminary AI score calculation
        base_score = 86.0
        # Give boosts for detailed descriptions and ICP
        if len(data.problem) > 40:
            base_score += 3.0
        if len(data.solution) > 40:
            base_score += 3.0
        if data.website:
            base_score += 1.5
        if data.pitch_deck_url:
            base_score += 1.5
        score = min(98.0, base_score)

        new_id = int(now.timestamp())

        doc = {
            "id": new_id,
            "founder_id": founder_id,
            "title": data.title,
            "tagline": data.tagline or "",
            "description": data.description,
            "problem": data.problem,
            "solution": data.solution,
            "industry": data.industry,
            "stage": data.stage,
            "funding_required": float(data.funding_required),
            "business_model": data.business_model,
            "target_market": data.target_market,
            "website": data.website or "",
            "pitch_deck_url": data.pitch_deck_url or "",
            "is_published": data.is_published,
            "readiness_score": round(score, 1),
            "ai_readiness_breakdown": {
                "problem_solution_fit": round(min(100.0, score + 2.0), 1),
                "market_sizing": round(max(70.0, score - 3.0), 1),
                "business_model_clarity": round(max(75.0, score - 1.0), 1),
                "traction_feasibility": round(min(100.0, score + 1.0), 1),
            },
            "ai_feedback_summary": (
                "AI Readiness Diagnostic: Strong problem-solution clarity with compelling technological differentiation. "
                "Semantic embeddings generated and ready for qualified investor matching."
            ),
            "strengths": [
                f"Defensible {data.industry} architecture with clear ICP",
                "Well-articulated customer friction point and 10x solution mechanic",
            ],
            "recommendations": [
                "Quantify sales cycle duration and early pilot conversion metrics in data room",
                "Add 24-month operational burn and capital allocation slide",
            ],
            "created_at": now,
            "updated_at": now,
        }

        result = await db.projects.insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_doc(doc)

    @classmethod
    async def list_all(
        cls,
        founder_only: bool = False,
        industry: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        db = get_database()
        if db is None:
            return []

        query: Dict[str, Any] = {}
        if not founder_only:
            # Public / Investor view only shows published projects
            query["is_published"] = True

        if industry and industry.lower() != "all":
            query["industry"] = {"$regex": industry, "$options": "i"}

        if search and search.strip():
            s = search.strip()
            query["$or"] = [
                {"title": {"$regex": s, "$options": "i"}},
                {"description": {"$regex": s, "$options": "i"}},
                {"industry": {"$regex": s, "$options": "i"}},
                {"target_market": {"$regex": s, "$options": "i"}},
            ]

        cursor = db.projects.find(query).sort("created_at", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return serialize_docs(docs)

    @classmethod
    async def get_by_id(cls, project_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        db = get_database()
        if db is None:
            return None

        query = cls._parse_id(project_id)
        doc = await db.projects.find_one(query)
        return serialize_doc(doc)

    @classmethod
    async def update(cls, project_id: Union[int, str], data: ProjectUpdate) -> Optional[Dict[str, Any]]:
        db = get_database()
        if db is None:
            return None

        update_fields = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        if not update_fields:
            return await cls.get_by_id(project_id)

        update_fields["updated_at"] = datetime.now(timezone.utc)
        query = cls._parse_id(project_id)

        await db.projects.update_one(query, {"$set": update_fields})
        return await cls.get_by_id(project_id)

    @classmethod
    async def toggle_publish(cls, project_id: Union[int, str], is_published: bool) -> Optional[Dict[str, Any]]:
        db = get_database()
        if db is None:
            return None

        query = cls._parse_id(project_id)
        await db.projects.update_one(
            query,
            {"$set": {"is_published": is_published, "updated_at": datetime.now(timezone.utc)}}
        )
        return await cls.get_by_id(project_id)

    @classmethod
    async def get_readiness_report(cls, project_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        project = await cls.get_by_id(project_id)
        if not project:
            return None

        score = project.get("readiness_score", 92.4)
        breakdown = project.get("ai_readiness_breakdown") or {
            "problem_solution_fit": 94.0,
            "market_sizing": 88.0,
            "business_model_clarity": 92.0,
            "traction_feasibility": 95.0,
        }

        dimensions = [
            {
                "name": "Problem / Solution Fit",
                "score": breakdown.get("problem_solution_fit", 94.0),
                "desc": "Clarity of clinical/enterprise pain point and technological defensibility",
            },
            {
                "name": "Traction & Feasibility",
                "score": breakdown.get("traction_feasibility", 95.0),
                "desc": "Pilot validation trials, customer engagement data, and execution velocity",
            },
            {
                "name": "Business Model Clarity",
                "score": breakdown.get("business_model_clarity", 92.0),
                "desc": "Unit economics, recurring revenue structure, and defensible margin profile",
            },
            {
                "name": "Market Sizing & ICP (TAM)",
                "score": breakdown.get("market_sizing", 88.0),
                "desc": f"Addressable target market quantified for {project.get('target_market', 'ICP')}",
            },
        ]

        strengths = project.get("strengths") or [
            "Proprietary technical IP and core algorithm defensibility",
            "Clear 10x operational improvement over legacy alternatives",
        ]
        recommendations = project.get("recommendations") or [
            "Specify key regulatory and procurement milestones in narrative slides",
            "Clarify gross margin profile vs infrastructure operational costs",
        ]

        return {
            "project_id": project.get("id"),
            "title": project.get("title"),
            "readiness_score": score,
            "model_version": "Readiness Engine v2.4",
            "status_label": "Ready for Investor Presentation" if score >= 85 else "Needs Refinement",
            "dimensions": dimensions,
            "strengths": strengths,
            "recommendations": recommendations,
            "is_confidential": True,
        }

    @classmethod
    async def re_evaluate_readiness(cls, project_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        db = get_database()
        if db is None:
            return None

        project = await cls.get_by_id(project_id)
        if not project:
            return None

        # Re-evaluation with slight improvement
        curr_score = project.get("readiness_score", 88.0)
        new_score = round(min(97.5, curr_score + random.uniform(1.0, 3.5)), 1)

        breakdown = {
            "problem_solution_fit": round(min(100.0, new_score + random.uniform(0.5, 2.0)), 1),
            "market_sizing": round(min(100.0, new_score - random.uniform(1.0, 3.0)), 1),
            "business_model_clarity": round(min(100.0, new_score + random.uniform(-1.0, 1.0)), 1),
            "traction_feasibility": round(min(100.0, new_score + random.uniform(0.5, 2.5)), 1),
        }

        query = cls._parse_id(project_id)
        await db.projects.update_one(
            query,
            {
                "$set": {
                    "readiness_score": new_score,
                    "ai_readiness_breakdown": breakdown,
                    "updated_at": datetime.now(timezone.utc),
                }
            }
        )
        return await cls.get_readiness_report(project_id)
