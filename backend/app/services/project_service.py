import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Union
from app.services.team_service import TEAM_PROJECTS, TeamService
from app.database import postgres as pg
from app.schemas.project import ProjectCreate, ProjectUpdate

logger = logging.getLogger(__name__)


class ProjectService:
    @staticmethod
    def parse_id(project_id: Union[int, str]) -> Optional[int]:
        """Project ids are BIGINTs; anything non-numeric can never match."""
        try:
            return int(str(project_id).strip())
        except (ValueError, TypeError):
            return None

    @classmethod
    async def create(cls, data: ProjectCreate, founder_id: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        doc = {
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
            "github_url": data.github_url or "",
            "demo_url": data.demo_url or "",
            "country": (data.country or "").strip(),
            "city": (data.city or "").strip(),
            "monthly_revenue": data.monthly_revenue,
            "customer_count": data.customer_count,
            "product_status": data.product_status or "",
            "team_size": data.team_size,
            "technical_founder": data.technical_founder,
            "repeat_founder": data.repeat_founder,
            "domain_expertise": data.domain_expertise,
            "full_time_team": data.full_time_team,
            "ip_protected": data.ip_protected,
            "is_published": data.is_published,
            "created_at": now,
            "updated_at": now,
        }

        created = await pg.insert("projects", doc)
        new_id = created["id"]

        # Baseline readiness check right away (fast, no AI cost). The founder runs the
        # full AI analysis after uploading materials.
        try:
            from app.services.analysis_service import AnalysisService
            await AnalysisService.analyze(created, engine="rules", notify=False)
        except Exception as e:
            logger.warning("Baseline analysis failed for project %s: %s", new_id, e)

        # Trigger dynamic matching pipeline for the newly created project
        try:
            from app.services.match_service import MatchService
            await MatchService.compute_matches_for_project(new_id)
        except Exception as e:
            logger.warning("Could not auto-generate matches for project %s: %s", new_id, e)

        return await cls.get_by_id(new_id)

    @classmethod
    async def list_all(
        cls,
        founder_only: bool = False,
        founder_id: Optional[str] = None,
        industry: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        where: List[str] = []
        params: List[Any] = []
        if founder_only:
            # A founder's own workspace: their drafts and published projects.
            # Projects they created plus ones they're a co-founder on.
            where.append(f"id IN {TEAM_PROJECTS}")
            params.extend([founder_id or "founder-001"] * 2)
        else:
            # Public / Investor view only shows published projects
            where.append("is_published")

        if industry and industry.lower() != "all":
            where.append("industry ILIKE %s")
            params.append(f"%{pg.escape_like(industry)}%")

        if search and search.strip():
            pattern = f"%{pg.escape_like(search.strip())}%"
            where.append(
                "(title ILIKE %s OR description ILIKE %s OR industry ILIKE %s OR target_market ILIKE %s)"
            )
            params.extend([pattern] * 4)

        sql = "SELECT * FROM projects"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY created_at DESC, id DESC OFFSET %s LIMIT %s"
        params.extend([skip, limit])
        return await pg.fetch_all(sql, params)

    @classmethod
    async def get_by_id(cls, project_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        pid = cls.parse_id(project_id)
        if pid is None:
            return None
        return await pg.fetch_one("SELECT * FROM projects WHERE id = %s", [pid])

    @classmethod
    async def update(cls, project_id: Union[int, str], data: ProjectUpdate) -> Optional[Dict[str, Any]]:
        pid = cls.parse_id(project_id)
        if pid is None:
            return None

        # Optional traction figures can be cleared back to "not reported".
        clearable = {"monthly_revenue", "customer_count", "team_size", "technical_founder", "repeat_founder",
                     "domain_expertise", "full_time_team", "ip_protected"}
        update_fields = {
            k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None or k in clearable
        }
        if not update_fields:
            return await cls.get_by_id(project_id)

        update_fields["updated_at"] = datetime.now(timezone.utc)
        if not await pg.update_where("projects", update_fields, "id = %s", [pid]):
            return None

        # Recalculate matches if thesis-critical fields changed
        thesis_keys = {"industry", "stage", "funding_required", "business_model", "target_market", "description",
                       "country", "city", "monthly_revenue", "customer_count", "product_status",
                       "team_size", "technical_founder", "repeat_founder", "domain_expertise",
                       "full_time_team", "ip_protected"}
        if any(k in update_fields for k in thesis_keys):
            try:
                from app.services.match_service import MatchService
                await MatchService.compute_matches_for_project(project_id)
            except Exception as e:
                logger.warning("Could not refresh matches for project %s: %s", project_id, e)

        return await cls.get_by_id(project_id)

    @classmethod
    async def toggle_publish(cls, project_id: Union[int, str], is_published: bool) -> Optional[Dict[str, Any]]:
        pid = cls.parse_id(project_id)
        if pid is None:
            return None
        updated = await pg.update_where(
            "projects",
            {"is_published": is_published, "updated_at": datetime.now(timezone.utc)},
            "id = %s",
            [pid],
        )
        if not updated:
            return None

        try:
            from app.services.match_service import MatchService
            await MatchService.compute_matches_for_project(project_id)
        except Exception as e:
            logger.warning("Could not update matches after publish toggle for %s: %s", project_id, e)

        return await cls.get_by_id(project_id)

    @classmethod
    async def get_readiness_report(cls, project_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        """The private readiness report: the latest stored analysis, or the project's seeded scores."""
        project = await cls.get_by_id(project_id)
        if not project:
            return None

        from app.services.analysis_service import AnalysisService, DIMENSIONS
        analysis = await AnalysisService.latest(project["id"])
        if analysis:
            engine = analysis["engine"]
            return {
                "project_id": project["id"],
                "title": project["title"],
                "readiness_score": analysis["overall_score"],
                "model_version": (
                    "Claude (" + (analysis["model"] or "") + ")" if engine == "claude"
                    else "Gemini (" + (analysis["model"] or "") + ")" if engine == "gemini"
                    else "Rule-based check (AI not configured)"
                ),
                "status_label": analysis["status_label"],
                "dimensions": [
                    {"key": d["key"], "name": d["name"], "score": d["score"],
                     "desc": d["rationale"], "description": d["description"]}
                    for d in analysis["dimensions"]
                ],
                "strengths": analysis["strengths"],
                "recommendations": [s["title"] + ": " + s["detail"] for s in analysis["suggestions"]],
                "is_confidential": True,
                "engine": engine,
                "is_ai_generated": engine in ("claude", "gemini"),
                "summary": analysis["summary"],
                "gaps": analysis["gaps"],
                "suggestions": analysis["suggestions"],
                "industry_insights": analysis["industry_insights"],
                "inputs": analysis["inputs"],
                "analyzed_at": analysis["created_at"],
                "analysis_id": analysis["id"],
                "ai_readiness_breakdown": project.get("ai_readiness_breakdown"),
                "ai_feedback_summary": project.get("ai_feedback_summary"),
            }

        # Seeded demo projects carry curated scores but no analysis run yet.
        breakdown = project.get("ai_readiness_breakdown") or {}
        return {
            "project_id": project["id"],
            "title": project["title"],
            "readiness_score": project.get("readiness_score") or 0.0,
            "model_version": "Not yet analyzed",
            "status_label": "Run an analysis to get your readiness report",
            "dimensions": [
                {"key": key, "name": name, "score": breakdown.get(key), "desc": desc, "description": desc}
                for key, name, desc in DIMENSIONS
                if breakdown.get(key) is not None
            ],
            "strengths": project.get("strengths") or [],
            "recommendations": project.get("recommendations") or [],
            "is_confidential": True,
            "engine": None,
            "is_ai_generated": False,
            "summary": project.get("ai_feedback_summary"),
            "gaps": [],
            "suggestions": [],
            "industry_insights": [],
            "inputs": None,
            "analyzed_at": None,
            "analysis_id": None,
            "ai_readiness_breakdown": breakdown,
            "ai_feedback_summary": project.get("ai_feedback_summary"),
        }

    @classmethod
    async def re_evaluate_readiness(cls, project_id: Union[int, str]) -> Optional[Dict[str, Any]]:
        """Run a fresh analysis (Claude when configured) and return the new report."""
        project = await cls.get_by_id(project_id)
        if not project:
            return None
        from app.services.analysis_service import AnalysisService
        await AnalysisService.analyze(project)
        return await cls.get_readiness_report(project["id"])
