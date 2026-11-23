import logging
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Union
from app.database import postgres as pg
from app.utils.money import inr
from app.schemas.thesis import INVESTOR_STAGES
from app.services.criteria import canonical_stage, has_criteria, regions_for_country, thesis_from_row

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
        "min_check": "₹5,00,000",
        "max_check": "₹15,00,000",
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
        "min_check": "₹7,50,000",
        "max_check": "₹25,00,000",
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
        "min_check": "₹8,00,000",
        "max_check": "₹20,00,000",
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
        "min_check": "₹10,00,000",
        "max_check": "₹30,00,000",
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


_PRIORITY_WEIGHT = {"high": 3.0, "medium": 2.0, "low": 1.0, "ignore": 0.0}
_STOP_WORDS = {"and", "the", "of", "for", "to", "a", "as", "ai", "b2b", "b2c", "tech"}


def _usd(amount: float) -> str:
    """Compact rupees for match explanations (name kept for the call sites)."""
    return inr(amount)


def _wants_fit_alerts(profile: Dict[str, Any]) -> bool:
    """The investor's "Notify me about strong fits" setting (on unless they turned it off)."""
    return bool((profile.get("settings") or {}).get("auto_notify_high_conviction", True))


class MatchService:
    # Set once the demo investors are known to exist, so match computations
    # don't repeat 8 insert-if-missing round trips on every call.
    _investors_ready = False

    @classmethod
    async def ensure_investors_initialized(cls) -> None:
        """Ensure all benchmark syndicate investors exist (insert-if-missing, never overwrite)."""
        if cls._investors_ready:
            return
        from app.core.config import settings
        if not settings.seed_demo_data:
            # Outside development, only real investors are matched.
            cls._investors_ready = True
            return
        now = datetime.now(timezone.utc)
        for inv in DEMO_INVESTORS:
            user_id = inv["user_id"]
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
            # update=[] -> ON CONFLICT DO NOTHING
            await pg.upsert("investor_profiles", profile_doc, ["user_id"], update=[])

            pref_doc = {
                "investor_id": user_id,
                **inv["preferences"],
                "created_at": now,
                "updated_at": now,
            }
            await pg.upsert("investor_preferences", pref_doc, ["investor_id"], update=[])
        cls._investors_ready = True

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
        """Score how well a published startup fits an investor's thesis, with the reasons.

        Each criterion gives a 0-100 score; the investor's priorities (high/medium/low/ignore)
        weight them. Hard exclusions (excluded industries or countries, an unmet *required*
        traction bar) drop the startup entirely.
        """
        firm_name = investor_profile.get("firm") or investor_profile.get("name") or "Investor"
        project_title = project.get("title", "Project")
        thesis = thesis_from_row(preference or {})
        if not has_criteria(thesis):
            return None  # nothing chosen yet: no fit score rather than a made-up one
        sectors, geo, traction = thesis["sectors"], thesis["geography"], thesis["traction"]
        priorities = thesis["priorities"]

        industry = project.get("industry", "") or ""
        country = (project.get("country") or "").strip()
        city = (project.get("city") or "").strip()

        # ---- hard exclusions ----
        if industry.lower().strip() in {i.lower() for i in sectors["excluded_industries"]}:
            return None
        if country and country.lower() in {c.lower() for c in geo["excluded_countries"]}:
            return None

        factors: List[Dict[str, Any]] = []

        def add(key: str, category: str, score: float, explanation: str) -> None:
            factors.append({"key": key, "category": category, "score": score, "explanation": explanation})

        add("industry", "Industry Focus", *cls._industry_fit(project, sectors, firm_name))
        add("stage", "Stage Alignment", *cls._stage_fit(project.get("stage", ""), thesis["stages"], firm_name))
        add("check_size", "Target Check Size", *cls._check_fit(project, thesis["check_size"], firm_name))
        add("business_model", "Business Model", *cls._model_fit(project.get("business_model", ""), sectors["business_models"], firm_name))

        # Geography counts only when the investor narrowed it.
        if not geo["is_global"] and (geo["regions"] or geo["countries"] or geo["cities"]):
            add("geography", "Geography", *cls._geo_fit(country, city, geo, firm_name))

        # Traction counts only when the investor set a requirement.
        t = cls._traction_fit(project, traction)
        if t == "excluded":
            return None
        if t is not None:
            add("traction", "Traction", *t)

        # Team and IP count only when the investor set a requirement.
        tm = cls._team_fit(project, thesis["team"], thesis["additional"])
        if tm == "excluded":
            return None
        if tm is not None:
            add("team", "Team", *tm)

        weights = {f["key"]: _PRIORITY_WEIGHT[priorities.get(f["key"], "medium")] for f in factors}
        total_weight = sum(weights.values())
        if total_weight == 0:
            # Every criterion set to "ignore": fall back to equal weights.
            weights = {k: 1.0 for k in weights}
            total_weight = float(len(weights))

        match_score = round(sum(f["score"] * weights[f["key"]] for f in factors) / total_weight, 1)
        match_score = max(40.0, min(98.8, match_score))

        # Only recommend matches with decent synergy
        if match_score < 45.0:
            return None

        reasons = [
            {
                "category": f["category"],
                "explanation": f["explanation"],
                "weight": round(weights[f["key"]] / total_weight, 2),
                "score": round(f["score"]),  # >= 75 means this criterion is met
            }
            for f in sorted(factors, key=lambda f: -weights[f["key"]])
            if weights[f["key"]] > 0
        ]

        inv_user_id = investor_profile.get("user_id") or preference.get("investor_id") or "investor-001"
        # Determine numeric id if available for compatibility
        inv_id_val = investor_profile.get("id_num") or investor_profile.get("id") or inv_user_id

        proj_id_val = project.get("id")

        now = datetime.now(timezone.utc)
        return {
            "id": f"match-{proj_id_val}-{inv_id_val}",
            "project_id": proj_id_val,
            "project_title": project_title,
            "investor_id": inv_id_val,
            # A profile can exist with an empty name; matches.investor_name is NOT NULL.
            "investor_name": investor_profile.get("name") or firm_name or "Investor",
            "investor_firm": firm_name,
            "founder_id": project.get("founder_id", "founder-001"),
            "match_score": match_score,
            "reasons": reasons,
            "status": "recommended",
            "created_at": now,
            "updated_at": now,
        }

    @classmethod
    def exclusion_reason(cls, project: Dict[str, Any], preference: Dict[str, Any]) -> Optional[str]:
        """Why the investor's own criteria rule this startup out, in plain words; None if they don't.

        The same hard rules calculate_match applies (excluded industry or country, an unmet *required*
        traction or team bar), plus a stage the investor doesn't back when they listed stages."""
        thesis = thesis_from_row(preference or {})
        if not has_criteria(thesis):
            return None
        sectors, geo = thesis["sectors"], thesis["geography"]
        industry = (project.get("industry") or "").strip()
        if industry and industry.lower() in {i.lower() for i in sectors["excluded_industries"]}:
            return f"This investor doesn't invest in {industry}."
        country = (project.get("country") or "").strip()
        if country and country.lower() in {c.lower() for c in geo["excluded_countries"]}:
            return f"This investor doesn't invest in startups based in {country}."
        stage = canonical_stage(project.get("stage"))
        if thesis["stages"] and stage and stage not in thesis["stages"]:
            return f"This investor backs {', '.join(thesis['stages'])} rounds; your project is at {stage}."
        if cls._traction_fit(project, thesis["traction"]) == "excluded":
            return "This investor requires traction your project doesn't report yet (revenue, customers or a live product)."
        if cls._team_fit(project, thesis["team"], thesis["additional"]) == "excluded":
            return "This investor requires a team profile your project doesn't meet (see their team requirements)."
        return None

    # ------------------------------------------------------------------ factors

    @classmethod
    def _industry_fit(cls, project: Dict[str, Any], sectors: Dict[str, Any], firm: str):
        industry = project.get("industry", "") or ""
        focus = sectors["industries"] + sectors["sub_industries"] + sectors["sectors"]
        if not focus and not sectors["technologies"]:
            return 75.0, f"{firm} is open to any industry."
        if industry.lower().strip() in [i.lower().strip() for i in focus]:
            return 98.0, f"{industry} is one of {firm}'s focus industries."
        focus_tokens = set().union(*[cls._tokenize(i) for i in focus]) if focus else set()
        overlap = (cls._tokenize(industry) & focus_tokens) - _STOP_WORDS
        if overlap:
            return 88.0, f"{industry} overlaps with {firm}'s focus ({', '.join(sorted(overlap)).title()})."
        context = " ".join(str(project.get(k, "")) for k in ("title", "tagline", "description", "problem", "solution"))
        tech_tokens = set().union(*[cls._tokenize(t) for t in sectors["technologies"]]) if sectors["technologies"] else set()
        if (tech_tokens - _STOP_WORDS) & cls._tokenize(context):
            return 83.0, f"The product uses technology {firm} looks for."
        return 42.0, f"{industry or 'This industry'} is outside {firm}'s focus industries."

    @staticmethod
    def _stage_fit(stage: str, wanted: List[str], firm: str):
        if not wanted:
            return 75.0, f"{firm} is open to any stage."
        canon = canonical_stage(stage)
        if canon in wanted:
            return 96.0, f"Raising at {stage}, a stage {firm} invests in."
        if canon:
            ladder = INVESTOR_STAGES.index(canon)
            if any(abs(ladder - INVESTOR_STAGES.index(w)) == 1 for w in wanted):
                return 78.0, f"{stage} is one step from the stages {firm} prefers."
        return 45.0, f"{stage or 'This stage'} is outside the stages {firm} invests in."

    @staticmethod
    def _check_fit(project: Dict[str, Any], check: Dict[str, Any], firm: str):
        funding = float(project.get("funding_required") or 0)
        lo = float(check["min_check"]) if check.get("min_check") is not None else None
        hi = float(check["max_check"]) if check.get("max_check") is not None else None
        if lo is None and hi is None:
            return 75.0, f"{firm} hasn't set a check size."
        lo_v = lo or 0.0
        hi_v = hi if hi is not None else float("inf")
        rng = f"{_usd(lo) if lo is not None else 'any'} - {_usd(hi) if hi is not None else 'any'}"
        if lo_v <= funding <= hi_v:
            return 96.0, f"The {_usd(funding)} raise is within {firm}'s check range ({rng})."
        if funding >= lo_v * 0.7 and funding <= hi_v * 1.35:
            return 82.0, f"The {_usd(funding)} raise is close to {firm}'s check range ({rng}); a co-investment could fit."
        return 45.0, f"The {_usd(funding)} raise is outside {firm}'s check range ({rng})."

    @classmethod
    def _model_fit(cls, model: str, wanted: List[str], firm: str):
        if not wanted:
            return 75.0, f"{firm} is open to any business model."
        m = (model or "").lower().strip()
        wanted_l = [w.lower().strip() for w in wanted]
        if m in wanted_l or any(w and w in m for w in wanted_l):
            return 95.0, f"{model} is a business model {firm} prefers."
        tokens = (cls._tokenize(model) & set().union(*[cls._tokenize(w) for w in wanted])) - _STOP_WORDS
        if tokens:
            return 85.0, f"{model} is similar to the business models {firm} prefers."
        return 60.0, f"{model or 'This business model'} isn't one {firm} listed."

    @staticmethod
    def _geo_fit(country: str, city: str, geo: Dict[str, Any], firm: str):
        if not country:
            return 55.0, "The startup hasn't said where it's based."
        where = f"{city}, {country}" if city else country
        if city and city.lower() in {c.lower() for c in geo["cities"]}:
            return 98.0, f"Based in {where}, a city {firm} focuses on."
        if country.lower() in {c.lower() for c in geo["countries"]}:
            return 95.0, f"Based in {where}, a country {firm} invests in."
        shared = set(regions_for_country(country)) & set(geo["regions"])
        if shared:
            return 90.0, f"Based in {where}, inside {firm}'s {sorted(shared)[0]} focus."
        return 35.0, f"Based in {where}, outside {firm}'s geographic focus."

    @staticmethod
    def _team_fit(project: Dict[str, Any], team: Dict[str, Any], additional: Dict[str, Any]):
        """Average of the team / IP checks the investor cares about; 'excluded' on an unmet requirement.
        A fact the founder hasn't reported scores in the middle rather than excluding the startup."""
        parts: List[float] = []
        notes: List[str] = []
        checks = (
            (team.get("technical_founder"), "technical_founder", "a technical founder", "no technical founder"),
            (team.get("repeat_founder"), "repeat_founder", "a repeat founder", "first-time founders"),
            (team.get("domain_expertise"), "domain_expertise", "industry experience", "no industry experience"),
            (team.get("full_time_team"), "full_time_team", "a full-time team", "not yet full-time"),
            (additional.get("ip_protection"), "ip_protected", "protected IP", "no protected IP"),
        )
        for level, key, yes, no in checks:
            if not level or level == "not_relevant":
                continue
            value = project.get(key)
            if value is None:
                parts.append(50.0)
                notes.append(f"{yes.replace('a ', '')} not reported")
            elif value:
                parts.append(95.0)
                notes.append(yes)
            elif level == "required":
                return "excluded"
            else:
                parts.append(40.0)
                notes.append(no)
        min_size = team.get("min_team_size")
        if min_size:
            size = project.get("team_size")
            if size is None:
                parts.append(50.0)
                notes.append("team size not reported")
            elif size >= min_size:
                parts.append(95.0)
                notes.append(f"team of {size}")
            else:
                parts.append(40.0)
                notes.append(f"team of {size}, below {min_size}")
        if not parts:
            return None
        return sum(parts) / len(parts), "Team: " + "; ".join(notes) + " (as reported by the founder)."

    @staticmethod
    def _traction_fit(project: Dict[str, Any], t: Dict[str, Any]):
        """Average of the traction checks the investor cares about; 'excluded' on an unmet requirement."""
        parts: List[float] = []
        notes: List[str] = []

        def check(level, value, threshold, label, fmt):
            if level == "not_relevant":
                return None
            if value is None:
                parts.append(50.0)
                notes.append(f"{label} not reported")
                return None
            ok = value >= threshold if threshold else value > 0
            if ok:
                parts.append(95.0)
                notes.append(f"{label} {fmt(value)}")
                return None
            if level == "required":
                return "excluded"
            parts.append(40.0)
            notes.append(f"{label} {fmt(value)}, below the preferred level")
            return None

        rev = project.get("monthly_revenue")
        min_rev = float(t["min_monthly_revenue"]) if t.get("min_monthly_revenue") is not None else 0
        if check(t["revenue"], float(rev) if rev is not None else None, min_rev, "monthly revenue", _usd) == "excluded":
            return "excluded"
        cust = project.get("customer_count")
        if check(t["customers"], cust, t.get("min_customers") or 0, "customers", lambda v: f"{int(v):,}") == "excluded":
            return "excluded"
        if t["live_product"] != "not_relevant":
            status = (project.get("product_status") or "").lower()
            if not status:
                parts.append(50.0)
                notes.append("product status not reported")
            elif status in ("launched", "scaling"):
                parts.append(95.0)
                notes.append("product is live")
            elif t["live_product"] == "required":
                return "excluded"
            else:
                parts.append(45.0)
                notes.append("product isn't live yet")
        if not parts:
            return None
        return sum(parts) / len(parts), "Traction: " + "; ".join(notes) + " (as reported by the founder)."

    @staticmethod
    async def _alert_founder_of_strong_fit(project: Dict[str, Any], investor: Dict[str, Any], match: Dict[str, Any]) -> None:
        """In-app notice to the founder about a strong investor fit (once per investor and project),
        plus an email when the founder has "Email me about strong matches" on."""
        founder_id = project.get("founder_id")
        if not founder_id:
            return
        try:
            from app.services.notification_service import NotificationService
            label = investor.get("firm") or investor.get("name") or "An investor"
            p_title = project.get("title", "your project")
            title = f"Strong investor fit: {label} for {p_title}"
            already = await pg.fetch_val(
                "SELECT EXISTS (SELECT 1 FROM notifications WHERE user_id = %s AND title = %s) AS e",
                [founder_id, title],
            )
            if already:
                return
            score = float(match.get("match_score") or 0)
            await NotificationService.create_notification(
                target_role="FOUNDER",
                user_id=founder_id,
                title=title,
                desc=f"{label}'s criteria closely fit {p_title} ({round(score)}% fit).",
                badge="Match",
                badge_variant="success",
                link="/founder/dashboard?tab=investors",
            )
            row = await pg.fetch_one(
                "SELECT u.email, u.name, fp.settings FROM app_users u "
                "LEFT JOIN founder_profiles fp ON fp.user_id = u.id WHERE u.id = %s",
                [founder_id],
            )
            if row and row.get("email") and (row.get("settings") or {}).get("email_alerts", True):
                from app.services.email_service import EmailService
                EmailService.send_strong_match_email(
                    founder_email=row["email"],
                    founder_name=row.get("name") or "there",
                    investor_label=label,
                    project_title=p_title,
                    score=score,
                )
        except Exception as e:
            logger.warning("Could not alert founder %s of a strong fit: %s", founder_id, e)

    @classmethod
    async def compute_matches_for_project(cls, project_id: Union[int, str]) -> List[Dict[str, Any]]:
        """Recalculate dynamic matches for a specific project across all investors."""
        await cls.ensure_investors_initialized()

        from app.services.project_service import ProjectService
        project = await ProjectService.get_by_id(project_id)
        if not project:
            logger.warning("Project %s not found for match computation", project_id)
            return []

        # Private drafts are never matched or announced to investors. Unpublishing a project
        # also withdraws any matches it had.
        if not project.get("is_published"):
            await pg.execute("DELETE FROM matches WHERE project_id = %s", [project["id"]])
            return []

        # Load all investor profiles with their preferences in one query
        investors = await pg.fetch_all(
            """
            SELECT to_jsonb(ip) AS profile, to_jsonb(pr) AS preference
            FROM investor_profiles ip
            LEFT JOIN investor_preferences pr ON pr.investor_id = ip.user_id
            ORDER BY ip.created_at
            LIMIT 100
            """
        )

        results = []
        for row in investors:
            inv = row["profile"]
            user_id = inv.get("user_id")
            pref = row["preference"]
            if not pref:
                # Fallback to default preference from demo list
                demo_match = next((d["preferences"] for d in DEMO_INVESTORS if d["user_id"] == user_id), None)
                pref = demo_match or {}

            match_data = cls.calculate_match(project, inv, pref)
            if match_data:
                await cls._store_match(match_data)
                results.append(match_data)

                # Strong fits: tell the founder, and the investor if they want these alerts.
                if match_data.get("match_score", 0) >= 90.0:
                    await cls._alert_founder_of_strong_fit(project, inv, match_data)
                if match_data.get("match_score", 0) >= 90.0 and _wants_fit_alerts(inv):
                    try:
                        from app.services.notification_service import NotificationService
                        p_title = project.get("title", "Startup")
                        p_ind = project.get("industry", "DeepTech")
                        score = match_data["match_score"]
                        existing = await pg.fetch_val(
                            "SELECT EXISTS (SELECT 1 FROM notifications WHERE user_id = %s AND title LIKE %s) AS e",
                            [user_id, f"%{pg.escape_like(p_title)}%"],
                        )
                        if not existing:
                            await NotificationService.create_notification(
                                target_role="INVESTOR",
                                user_id=user_id,
                                title=f"Strong fit: {p_title} ({score}%)",
                                desc=f"{p_title} ({p_ind}) closely fits your investment criteria.",
                                badge="Match",
                                badge_variant="success",
                                link="/investor/discover",
                            )
                    except Exception as e:
                        logger.warning("Failed to emit high-match notification: %s", e)

        # Investors whose criteria no longer fit (or now exclude it) lose the match.
        keep = [str(m["investor_id"]) for m in results]
        await pg.execute(
            "DELETE FROM matches WHERE project_id = %s AND NOT (investor_id = ANY(%s::text[]))",
            [project["id"], "{" + ",".join('"' + k.replace('"', '') + '"' for k in keep) + "}"],
        )
        logger.info("Computed and stored %d dynamic matches for project %s", len(results), project_id)
        return results

    @classmethod
    async def compute_matches_for_investor(cls, investor_id: str) -> List[Dict[str, Any]]:
        """Recalculate dynamic matches for an investor across all startup projects."""
        await cls.ensure_investors_initialized()

        investor = await pg.fetch_one("SELECT * FROM investor_profiles WHERE user_id = %s", [investor_id])
        if not investor:
            investor = next((d for d in DEMO_INVESTORS if d["user_id"] == investor_id), None)
            if not investor:
                logger.warning("Investor %s not found for match calculation", investor_id)
                return []

        pref = await pg.fetch_one("SELECT * FROM investor_preferences WHERE investor_id = %s", [investor_id])
        if not pref:
            pref = investor.get("preferences") or {}

        # Only published projects can be matched (drafts are private to their founder).
        projects = await pg.fetch_all("SELECT * FROM projects WHERE is_published ORDER BY created_at LIMIT 200")

        results = []
        for project in projects:
            match_data = cls.calculate_match(project, investor, pref)
            if match_data:
                await cls._store_match(match_data)
                results.append(match_data)

                # Strong fits: tell the founder, and the investor if they want these alerts.
                if match_data.get("match_score", 0) >= 90.0:
                    await cls._alert_founder_of_strong_fit(project, investor, match_data)
                if match_data.get("match_score", 0) >= 90.0 and _wants_fit_alerts(investor):
                    try:
                        from app.services.notification_service import NotificationService
                        p_title = project.get("title", "Startup")
                        p_ind = project.get("industry", "DeepTech")
                        score = match_data["match_score"]
                        existing = await pg.fetch_val(
                            "SELECT EXISTS (SELECT 1 FROM notifications WHERE user_id = %s AND title LIKE %s) AS e",
                            [investor_id, f"%{pg.escape_like(p_title)}%"],
                        )
                        if not existing:
                            await NotificationService.create_notification(
                                target_role="INVESTOR",
                                user_id=investor_id,
                                title=f"Strong fit: {p_title} ({score}%)",
                                desc=f"{p_title} ({p_ind}) closely fits your investment criteria.",
                                badge="Match",
                                badge_variant="success",
                                link="/investor/discover",
                            )
                    except Exception as e:
                        logger.warning("Failed to emit high-match notification: %s", e)

        keep_ids = [int(m["project_id"]) for m in results]
        await pg.execute(
            "DELETE FROM matches WHERE investor_id = %s AND NOT (project_id = ANY(%s::bigint[]))",
            [investor_id, "{" + ",".join(str(i) for i in keep_ids) + "}"],
        )
        logger.info("Computed and stored %d dynamic matches for investor %s", len(results), investor_id)
        return results

    @classmethod
    async def recompute_all_matches(cls) -> int:
        """Full recomputation of matches across all projects and registered investors."""
        await cls.ensure_investors_initialized()

        projects = await pg.fetch_all("SELECT id FROM projects ORDER BY created_at LIMIT 200")

        total = 0
        for p in projects:
            p_id = p.get("id")
            if p_id is not None:
                matches = await cls.compute_matches_for_project(p_id)
                total += len(matches)

        logger.info("Successfully refreshed total of %d dynamic matches in Postgres.", total)
        return total

    @classmethod
    async def list_matches(
        cls,
        search: Optional[str] = None,
        project_id: Optional[str] = None,
        limit: int = 50,
        investor_id: Optional[str] = None,
        founder_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve matches with explainable reasoning, ensuring calculations are up to date."""
        # If the table is empty, auto-compute
        if not await pg.fetch_val("SELECT EXISTS (SELECT 1 FROM matches) AS present"):
            logger.info("No matches stored yet; running initial dynamic match synthesis...")
            await cls.recompute_all_matches()

        # Matches are only ever shown for published projects.
        where: List[str] = ["project_id IN (SELECT id FROM projects WHERE is_published)"]
        params: List[Any] = []
        if project_id:
            try:
                params.append(int(project_id))
            except ValueError:
                return []
            where.append("project_id = %s")

        if investor_id:
            where.append("investor_id = %s")
            params.append(investor_id)
        if founder_id:
            where.append("project_id IN (SELECT id FROM projects WHERE founder_id = %s)")
            params.append(founder_id)

        if search and search.strip():
            pattern = f"%{pg.escape_like(search.strip())}%"
            where.append("(investor_name ILIKE %s OR investor_firm ILIKE %s OR project_title ILIKE %s)")
            params.extend([pattern] * 3)

        sql = "SELECT * FROM matches"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY match_score DESC, id LIMIT %s"
        return await pg.fetch_all(sql, [*params, limit])

    @staticmethod
    async def _store_match(match_data: Dict[str, Any]) -> None:
        """Upsert by (project_id, investor_id), keeping the row's original id and created_at."""
        row = {**match_data, "investor_id": str(match_data["investor_id"])}
        await pg.upsert(
            "matches",
            row,
            ["project_id", "investor_id"],
            update=[c for c in row if c not in ("project_id", "investor_id", "id", "created_at")],
        )
