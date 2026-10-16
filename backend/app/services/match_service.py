import logging
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Union
from bson import ObjectId
from app.database.mongodb import get_database
from app.database.utils import serialize_doc, serialize_docs

logger = logging.getLogger(__name__)

# Core benchmark syndicate partners representing major investment verticals
DEMO_INVESTORS = [
    {
        "user_id": "investor-001",
        "id_num": 101,
        "name": "Dr. Sarah Lin",
        "firm": "Apex Horizon Ventures",
        "title": "General Partner",
        "bio": "Investing in Healthcare AI, MedTech diagnostics, and clinical automation infrastructure.",
        "location": "New York & Boston",
        "thesis": "Leading Seed and Series A rounds for high-defensibility technical founders solving critical clinical bottleneck problems.",
        "min_check": "$500,000",
        "max_check": "$1,500,000",
        "preferences": {
            "preferred_industries": ["Healthcare & AI", "MedTech", "BioTech", "Digital Health", "Life Sciences"],
            "preferred_stages": ["Seed", "Pre-seed", "Series A"],
            "min_investment": 500000.0,
            "max_investment": 1500000.0,
            "preferred_business_models": ["B2B SaaS", "Enterprise Licensing", "Hospital Hardware Lease", "B2B Enterprise SaaS"],
            "geography": "North America & Europe",
            "tech_preferences": ["Edge Machine Learning", "Bioinformatics", "Generative AI & LLMs", "Clinical Diagnostics"],
        }
    },
    {
        "user_id": "investor-002",
        "id_num": 102,
        "name": "Marcus Sterling",
        "firm": "BlueShift Capital",
        "title": "Managing Director",
        "bio": "Backing technical teams applying deep learning and robotics to physical industry bottlenecks.",
        "location": "San Francisco & Austin",
        "thesis": "Focusing on AI-native industrial automation, neural hardware acceleration, and edge intelligence.",
        "min_check": "$750,000",
        "max_check": "$2,500,000",
        "preferences": {
            "preferred_industries": ["AI/ML", "DeepTech", "Edge Computing", "Robotics & Logistics", "Infrastructure"],
            "preferred_stages": ["Seed", "Series A", "Early Traction"],
            "min_investment": 750000.0,
            "max_investment": 2500000.0,
            "preferred_business_models": ["B2B Enterprise SaaS", "RaaS (Robotics as a Service)", "Developer Tools", "B2B SaaS"],
            "geography": "Global Mandate",
            "tech_preferences": ["Neuromorphic Computing", "Autonomous Robotics", "Edge AI", "Computer Vision"],
        }
    },
    {
        "user_id": "investor-003",
        "id_num": 103,
        "name": "Elena Rostova",
        "firm": "TerraNext Climate Fund",
        "title": "Founding Partner",
        "bio": "Decarbonizing industrial supply chains through satellite telemetry and automated climate verification.",
        "location": "London & Zurich",
        "thesis": "Deploying dedicated climate capital into high-integrity carbon measurement and energy transition software.",
        "min_check": "$800,000",
        "max_check": "$2,000,000",
        "preferences": {
            "preferred_industries": ["ClimateTech", "CleanTech", "AgTech", "Supply Chain", "Sustainability"],
            "preferred_stages": ["MVP / Beta", "Seed", "Series A"],
            "min_investment": 800000.0,
            "max_investment": 2000000.0,
            "preferred_business_models": ["Usage-Based API", "Enterprise ESG", "Verification Fee", "B2B SaaS"],
            "geography": "Europe & North America",
            "tech_preferences": ["Satellite Remote Sensing", "IoT Telemetry", "Carbon Accounting", "CleanTech"],
        }
    },
    {
        "user_id": "investor-004",
        "id_num": 104,
        "name": "David Vance",
        "firm": "Aegis Defense Partners",
        "title": "Principal",
        "bio": "Exclusively funding critical infrastructure protection, dual-use national security, and cryptographic resilience.",
        "location": "Washington D.C. & Tel Aviv",
        "thesis": "Securing national energy grids, SCADA networks, and industrial systems against post-quantum vector threats.",
        "min_check": "$1,000,000",
        "max_check": "$3,000,000",
        "preferences": {
            "preferred_industries": ["Cybersecurity", "DefenseTech", "Industrial IoT", "Quantum Computing", "DeepTech"],
            "preferred_stages": ["Seed", "Pre-seed", "Series A"],
            "min_investment": 1000000.0,
            "max_investment": 3000000.0,
            "preferred_business_models": ["Per-Node Licensing", "OEM Integration", "Annual Licensing", "B2B SaaS"],
            "geography": "Five Eyes & NATO Allies",
            "tech_preferences": ["Post-Quantum Cryptography", "SCADA Security", "Lattice Encryption", "Zero Trust"],
        }
    },
]


class MatchService:
    @classmethod
    async def ensure_investors_initialized(cls, db) -> None:
        """Ensure all benchmark syndicate investors are registered in the database."""
        now = datetime.now(timezone.utc)
        for inv in DEMO_INVESTORS:
            user_id = inv["user_id"]
            existing = await db.investor_profiles.find_one({"user_id": user_id})
            if not existing:
                profile_doc = {
                    "user_id": user_id,
                    "name": inv["name"],
                    "firm": inv["firm"],
                    "title": inv["title"],
                    "bio": inv["bio"],
                    "location": inv["location"],
                    "thesis": inv["thesis"],
                    "min_check": inv["min_check"],
                    "max_check": inv["max_check"],
                    "created_at": now,
                    "updated_at": now,
                }
                await db.investor_profiles.update_one(
                    {"user_id": user_id},
                    {"$set": profile_doc},
                    upsert=True
                )

            pref_existing = await db.investor_preferences.find_one({"investor_id": user_id})
            if not pref_existing:
                pref_doc = {
                    "investor_id": user_id,
                    **inv["preferences"],
                    "created_at": now,
                    "updated_at": now,
                }
                await db.investor_preferences.update_one(
                    {"investor_id": user_id},
                    {"$set": pref_doc},
                    upsert=True
                )

    @staticmethod
    def _tokenize(text: str) -> set:
        """Extract lowercase alphabetic tokens for keyword matching."""
        if not text:
            return set()
        return set(re.findall(r"[a-z0-9]+", str(text).lower()))

    @classmethod
    def calculate_match(
        cls,
        project: Dict[str, Any],
        investor_profile: Dict[str, Any],
        preference: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Calculate dynamic explainable match score between a startup and an investor."""
        firm_name = investor_profile.get("firm") or investor_profile.get("name") or "Investor"
        project_title = project.get("title", "Project")
        industry = project.get("industry", "")
        stage = project.get("stage", "")
        funding = float(project.get("funding_required", 0))
        business_model = project.get("business_model", "")
        tech_context = f"{project.get('title', '')} {project.get('description', '')} {project.get('problem', '')} {project.get('solution', '')}"

        pref_industries = preference.get("preferred_industries") or []
        pref_stages = preference.get("preferred_stages") or []
        min_check = float(preference.get("min_investment", 250000.0))
        max_check = float(preference.get("max_investment", 3000000.0))
        pref_models = preference.get("preferred_business_models") or []
        tech_prefs = preference.get("tech_preferences") or []

        # 1. Industry / Sector Fit (Weight: 0.40)
        proj_ind_lower = industry.lower().strip()
        pref_ind_lower = [i.lower().strip() for i in pref_industries]
        proj_tokens = cls._tokenize(industry)
        all_pref_tokens = set().union(*[cls._tokenize(i) for i in pref_industries]) if pref_industries else set()
        tech_tokens = cls._tokenize(tech_context)
        all_tech_pref_tokens = set().union(*[cls._tokenize(t) for t in tech_prefs]) if tech_prefs else set()

        if proj_ind_lower in pref_ind_lower:
            sector_score = 98.0
            matched_name = next(i for i in pref_industries if i.lower().strip() == proj_ind_lower)
            sector_reason = f"{firm_name} prioritizes {matched_name} startups as a central pillar in its fund thesis."
        elif proj_tokens.intersection(all_pref_tokens):
            overlap = ", ".join(proj_tokens.intersection(all_pref_tokens)).title()
            sector_score = 88.0
            sector_reason = f"{firm_name} thesis overlaps with {industry} ({overlap} focus area)."
        elif tech_tokens.intersection(all_tech_pref_tokens):
            sector_score = 83.0
            sector_reason = f"Proprietary technology stack aligns with {firm_name}'s technical mandate."
        else:
            sector_score = 42.0
            sector_reason = f"{industry} is outside {firm_name}'s primary sector mandate, considered opportunistically."

        # 2. Stage Alignment (Weight: 0.30)
        proj_stage_lower = stage.lower().strip()
        pref_stages_lower = [s.lower().strip() for s in pref_stages]
        stage_tokens = cls._tokenize(stage)
        all_stage_tokens = set().union(*[cls._tokenize(s) for s in pref_stages]) if pref_stages else set()

        if proj_stage_lower in pref_stages_lower:
            stage_score = 96.0
            stage_reason = f"Founder is raising at {stage} stage, matching {firm_name}'s primary deployment entry window."
        elif stage_tokens.intersection(all_stage_tokens):
            stage_score = 86.0
            stage_reason = f"Stage ({stage}) aligns with fund's active follow-on and syndicate horizon."
        elif any(adj in proj_stage_lower for adj in ["mvp", "seed", "pre-seed", "prototype"]):
            stage_score = 78.0
            stage_reason = f"Early-stage trajectory ({stage}) qualifies for fund's acceleration pipeline."
        else:
            stage_score = 48.0
            stage_reason = f"{stage} stage differs from fund's stated target investment stage."

        # 3. Capital Mandate & Check Size (Weight: 0.20)
        if min_check <= funding <= max_check:
            check_score = 96.0
            check_reason = f"Target raise (${funding:,.0f}) fits squarely inside fund's check bracket (${min_check:,.0f} - ${max_check:,.0f})."
        elif (funding >= min_check * 0.7) and (funding <= max_check * 1.35):
            check_score = 82.0
            check_reason = f"Target raise (${funding:,.0f}) is within co-investment syndication margin of fund's check size."
        else:
            check_score = 45.0
            check_reason = f"Target raise (${funding:,.0f}) deviates from fund's typical check range (${min_check:,.0f} - ${max_check:,.0f})."

        # 4. Business Model & Operations (Weight: 0.10)
        proj_model_lower = business_model.lower().strip()
        pref_models_lower = [m.lower().strip() for m in pref_models]
        model_tokens = cls._tokenize(business_model)
        all_model_tokens = set().union(*[cls._tokenize(m) for m in pref_models]) if pref_models else set()

        if proj_model_lower in pref_models_lower or any(m in proj_model_lower for m in pref_models_lower):
            model_score = 95.0
            model_reason = f"{business_model} model matches {firm_name}'s commercialization playbook."
        elif model_tokens.intersection(all_model_tokens):
            model_score = 85.0
            model_reason = f"Monetization mechanics ({business_model}) synergize with portfolio network."
        else:
            model_score = 60.0
            model_reason = f"{business_model} evaluated against fund's operating margin benchmarks."

        # Composite Weighted Percentage
        match_score = round(
            (sector_score * 0.40) +
            (stage_score * 0.30) +
            (check_score * 0.20) +
            (model_score * 0.10),
            1
        )
        match_score = max(40.0, min(98.8, match_score))

        # Only recommend matches with decent synergy
        if match_score < 45.0:
            return None

        inv_user_id = investor_profile.get("user_id") or preference.get("investor_id") or "investor-001"
        # Determine numeric id if available for compatibility
        inv_id_val = investor_profile.get("id_num") or investor_profile.get("id") or inv_user_id

        proj_id_val = project.get("id")

        reasons = [
            {"category": "Industry Focus", "explanation": sector_reason, "weight": 0.40},
            {"category": "Stage Alignment", "explanation": stage_reason, "weight": 0.30},
            {"category": "Target Check Size", "explanation": check_reason, "weight": 0.20},
            {"category": "Business Model", "explanation": model_reason, "weight": 0.10},
        ]

        now = datetime.now(timezone.utc)
        return {
            "id": f"match-{proj_id_val}-{inv_id_val}",
            "project_id": proj_id_val,
            "project_title": project_title,
            "investor_id": inv_id_val,
            "investor_name": investor_profile.get("name", "Angel Partner"),
            "investor_firm": firm_name,
            "founder_id": project.get("founder_id", "founder-001"),
            "match_score": match_score,
            "reasons": reasons,
            "status": "recommended",
            "created_at": now,
            "updated_at": now,
        }

    @classmethod
    async def compute_matches_for_project(cls, project_id: Union[int, str]) -> List[Dict[str, Any]]:
        """Recalculate dynamic matches for a specific project across all investors."""
        db = get_database()
        if db is None:
            return []

        await cls.ensure_investors_initialized(db)

        # Parse project query
        query = {"$or": [{"id": project_id}]}
        try:
            query["$or"].append({"id": int(project_id)})
        except (ValueError, TypeError):
            pass
        try:
            query["$or"].append({"id": str(project_id)})
        except Exception:
            pass
        if ObjectId.is_valid(str(project_id)):
            query["$or"].append({"_id": ObjectId(str(project_id))})

        project = await db.projects.find_one(query)
        if not project:
            logger.warning("Project %s not found for match computation", project_id)
            return []

        # Load all investor profiles and preferences
        cursor = db.investor_profiles.find({})
        investors = await cursor.to_list(length=100)

        results = []
        for inv in investors:
            user_id = inv.get("user_id")
            pref = await db.investor_preferences.find_one({"investor_id": user_id})
            if not pref:
                # Fallback to default preference from demo list
                demo_match = next((d["preferences"] for d in DEMO_INVESTORS if d["user_id"] == user_id), None)
                pref = demo_match or {}

            match_data = cls.calculate_match(project, inv, pref)
            if match_data:
                await db.matches.update_one(
                    {"project_id": match_data["project_id"], "investor_id": match_data["investor_id"]},
                    {"$set": match_data},
                    upsert=True
                )
                results.append(match_data)

                # Emit automated notification for high-fit deals (> 90%)
                if match_data.get("match_score", 0) >= 90.0:
                    try:
                        from app.services.notification_service import NotificationService
                        p_title = project.get("title", "Startup")
                        p_ind = project.get("industry", "DeepTech")
                        score = match_data["match_score"]
                        existing = await db.notifications.find_one({
                            "user_id": user_id,
                            "title": {"$regex": f".*{p_title}.*"},
                        })
                        if not existing:
                            await NotificationService.create_notification(
                                target_role="INVESTOR",
                                user_id=user_id,
                                title=f"High-Fit Mandate Match: {p_title} ({score}%)",
                                desc=f"'{p_title}' in {p_ind} aligns strongly with your target sector, stage, and check size ({score}% match).",
                                badge="Match",
                                badge_variant="success",
                                link="/investor/dashboard?tab=matches",
                            )
                    except Exception as e:
                        logger.warning("Failed to emit high-match notification: %s", e)

        logger.info("Computed and stored %d dynamic matches for project %s", len(results), project_id)
        return results

    @classmethod
    async def compute_matches_for_investor(cls, investor_id: str) -> List[Dict[str, Any]]:
        """Recalculate dynamic matches for an investor across all startup projects."""
        db = get_database()
        if db is None:
            return []

        await cls.ensure_investors_initialized(db)

        investor = await db.investor_profiles.find_one({"user_id": investor_id})
        if not investor:
            investor = next((d for d in DEMO_INVESTORS if d["user_id"] == investor_id), None)
            if not investor:
                logger.warning("Investor %s not found for match calculation", investor_id)
                return []

        pref = await db.investor_preferences.find_one({"investor_id": investor_id})
        if not pref:
            pref = investor.get("preferences") or {}

        cursor = db.projects.find({})
        projects = await cursor.to_list(length=200)

        results = []
        for project in projects:
            match_data = cls.calculate_match(project, investor, pref)
            if match_data:
                await db.matches.update_one(
                    {"project_id": match_data["project_id"], "investor_id": match_data["investor_id"]},
                    {"$set": match_data},
                    upsert=True
                )
                results.append(match_data)

                # Emit automated notification for high-fit deals (> 90%)
                if match_data.get("match_score", 0) >= 90.0:
                    try:
                        from app.services.notification_service import NotificationService
                        p_title = project.get("title", "Startup")
                        p_ind = project.get("industry", "DeepTech")
                        score = match_data["match_score"]
                        existing = await db.notifications.find_one({
                            "user_id": investor_id,
                            "title": {"$regex": f".*{p_title}.*"},
                        })
                        if not existing:
                            await NotificationService.create_notification(
                                target_role="INVESTOR",
                                user_id=investor_id,
                                title=f"High-Fit Mandate Match: {p_title} ({score}%)",
                                desc=f"'{p_title}' in {p_ind} aligns strongly with your target sector, stage, and check size ({score}% match).",
                                badge="Match",
                                badge_variant="success",
                                link="/investor/dashboard?tab=matches",
                            )
                    except Exception as e:
                        logger.warning("Failed to emit high-match notification: %s", e)

        logger.info("Computed and stored %d dynamic matches for investor %s", len(results), investor_id)
        return results

    @classmethod
    async def recompute_all_matches(cls) -> int:
        """Full recomputation of matches across all projects and registered investors."""
        db = get_database()
        if db is None:
            return 0

        await cls.ensure_investors_initialized(db)

        cursor = db.projects.find({})
        projects = await cursor.to_list(length=200)

        total = 0
        for p in projects:
            p_id = p.get("id")
            if p_id is not None:
                matches = await cls.compute_matches_for_project(p_id)
                total += len(matches)

        logger.info("Successfully refreshed total of %d dynamic matches in MongoDB Atlas.", total)
        return total

    @classmethod
    async def list_matches(
        cls,
        search: Optional[str] = None,
        project_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Retrieve matches with explainable reasoning, ensuring calculations are up to date."""
        db = get_database()
        if db is None:
            return []

        # If database currently has 0 matches, auto-compute
        current_count = await db.matches.count_documents({})
        if current_count == 0:
            logger.info("No matches found in collection; running initial dynamic match synthesis...")
            await cls.recompute_all_matches()

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
