import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from pymongo import AsyncMongoClient, IndexModel, ASCENDING, DESCENDING, TEXT
from pymongo.asynchronous.database import AsyncDatabase
from app.core.config import settings

logger = logging.getLogger(__name__)

_mongo_client: Optional[AsyncMongoClient] = None


def get_mongodb_client() -> Optional[AsyncMongoClient]:
    """Retrieve or initialize the singleton AsyncMongoClient.
    
    Adheres to safety checks: does not attempt to connect if MONGODB_URI is not set.
    """
    global _mongo_client
    if not settings.is_mongodb_configured:
        logger.warning(
            "MongoDB URI is not configured in environment (.env). "
            "Database connection will not be established."
        )
        return None

    if _mongo_client is None:
        try:
            logger.info("Initializing PyMongo AsyncMongoClient...")
            _mongo_client = AsyncMongoClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000,
            )
        except Exception as e:
            logger.error("Failed to initialize AsyncMongoClient: %s", e)
            return None

    return _mongo_client


def get_database() -> Optional[AsyncDatabase]:
    """Retrieve the configured MongoDB AsyncDatabase instance."""
    client = get_mongodb_client()
    if client is not None:
        return client[settings.MONGODB_DATABASE]
    return None


async def close_mongodb_connection():
    """Close the AsyncMongoClient connection pool upon application shutdown."""
    global _mongo_client
    if _mongo_client is not None:
        logger.info("Closing MongoDB connection...")
        await _mongo_client.close()
        _mongo_client = None


async def init_db_indexes(db: AsyncDatabase):
    """Safely and idempotently create required indexes on collections."""
    logger.info("Initializing MongoDB indexes on database: %s", db.name)

    # 1. projects collection indexes
    try:
        await db.projects.create_indexes([
            IndexModel([("founder_id", ASCENDING)]),
            IndexModel([("is_published", ASCENDING)]),
            IndexModel([("industry", ASCENDING)]),
            IndexModel([("stage", ASCENDING)]),
            IndexModel([("is_published", ASCENDING), ("industry", ASCENDING), ("stage", ASCENDING)]),
            IndexModel([("title", TEXT), ("description", TEXT), ("target_market", TEXT)]),
        ])
    except Exception as e:
        logger.warning("Notice on projects indexing: %s", e)

    # 2. founder_profiles collection indexes
    try:
        await db.founder_profiles.create_indexes([
            IndexModel([("user_id", ASCENDING)], unique=True, sparse=True),
        ])
    except Exception as e:
        logger.warning("Notice on founder_profiles indexing: %s", e)

    # 3. investor_profiles collection indexes
    try:
        await db.investor_profiles.create_indexes([
            IndexModel([("user_id", ASCENDING)], unique=True, sparse=True),
            IndexModel([("firm_name", ASCENDING)]),
        ])
    except Exception as e:
        logger.warning("Notice on investor_profiles indexing: %s", e)

    # 4. investor_preferences collection indexes
    try:
        await db.investor_preferences.create_indexes([
            IndexModel([("investor_id", ASCENDING)], unique=True, sparse=True),
        ])
    except Exception as e:
        logger.warning("Notice on investor_preferences indexing: %s", e)

    # 5. matches collection indexes
    try:
        await db.matches.create_indexes([
            IndexModel([("project_id", ASCENDING), ("investor_id", ASCENDING)], unique=True, sparse=True),
            IndexModel([("founder_id", ASCENDING), ("match_score", DESCENDING)]),
            IndexModel([("investor_id", ASCENDING), ("match_score", DESCENDING)]),
        ])
    except Exception as e:
        logger.warning("Notice on matches indexing: %s", e)

    # 6. project_interests collection indexes
    try:
        await db.project_interests.create_indexes([
            IndexModel([("project_id", ASCENDING), ("investor_id", ASCENDING)], unique=True, sparse=True),
            IndexModel([("founder_id", ASCENDING), ("status", ASCENDING)]),
            IndexModel([("investor_id", ASCENDING)]),
        ])
    except Exception as e:
        logger.warning("Notice on project_interests indexing: %s", e)

    # 7. notifications collection indexes
    try:
        await db.notifications.create_indexes([
            IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("target_role", ASCENDING)]),
        ])
    except Exception as e:
        logger.warning("Notice on notifications indexing: %s", e)

    logger.info("MongoDB index initialization complete.")


async def seed_initial_data_if_empty(db: AsyncDatabase):
    """Seed initial sample data if collections are empty so UI works immediately."""
    project_count = await db.projects.count_documents({})
    if project_count > 0:
        logger.info("MongoDB already contains %d projects; skipping initial seed.", project_count)
        return

    logger.info("Seeding initial VentureX demo data into MongoDB Atlas...")
    now = datetime.now(timezone.utc)

    # Seed Projects
    initial_projects = [
        {
            "id": 1,
            "founder_id": "founder-001",
            "title": "NeuroPulse AI",
            "tagline": "Ultra-low latency AI diagnostic platform for cardiovascular anomaly detection.",
            "description": "NeuroPulse AI combines edge neuromorphic algorithms with ultra-compact hospital monitors to detect ventricular arrhythmia 4 minutes earlier than current standard ICU telemetry.",
            "problem": "ICU staff suffer from alarm fatigue with over 85% false alarms, while critical sudden decompensations still slip through delayed algorithmic detection windows.",
            "solution": "A real-time edge neural processor that decodes continuous 12-lead waveforms directly at bedside without cloud roundtrip latency, delivering 99.4% precision.",
            "industry": "Healthcare & AI",
            "stage": "Seed",
            "funding_required": 750000.0,
            "business_model": "B2B SaaS",
            "target_market": "Tier-1 Academic Medical Centers & Regional ICU Networks ($14B TAM)",
            "website": "https://neuropulse.demo",
            "pitch_deck_url": "https://neuropulse.demo/deck.pdf",
            "is_published": True,
            "readiness_score": 94.0,
            "ai_readiness_breakdown": {
                "problem_solution_fit": 96.0,
                "market_sizing": 91.0,
                "business_model_clarity": 93.0,
                "traction_feasibility": 95.0,
            },
            "ai_feedback_summary": "Strong clinical defensibility with clear regulatory roadmap. Pilot data from 2 hospital trials validates low false-positive rate. Pitch deck excels in unit economics.",
            "strengths": [
                "Proprietary on-chip quantized neural network IP",
                "Clinical verification by Board-certified cardiologists",
                "Clear 10x speed improvement over hospital lab loops"
            ],
            "recommendations": [
                "Specify FDA 510(k) pathway milestones in regulatory deck",
                "Clarify sensor hardware bill of materials vs software margins"
            ],
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": 2,
            "founder_id": "founder-001",
            "title": "Verdant Chain",
            "tagline": "Satellite-verified automated carbon mitigation & supply-chain ledger.",
            "description": "Verdant Chain utilizes multispectral satellite imagery coupled with IoT soil telemetry to instantly audit and tokenize enterprise carbon offsets with zero greenwashing.",
            "problem": "Enterprise ESG compliance is hindered by fraudulent voluntary carbon credits, opaque measurement methodologies, and slow manual field auditing.",
            "solution": "Automated verification pipeline combining orbital synthetic aperture radar (SAR) with cryptographically sealed soil probes, giving continuous verified proof of sequestration.",
            "industry": "ClimateTech",
            "stage": "MVP / Private Beta",
            "funding_required": 1200000.0,
            "business_model": "Usage-Based API",
            "target_market": "Global Fortune 500 Manufacturing and Agriculture conglomerates ($22B TAM)",
            "website": "https://verdantchain.demo",
            "pitch_deck_url": "https://verdantchain.demo/deck.pdf",
            "is_published": False,
            "readiness_score": 88.0,
            "ai_readiness_breakdown": {
                "problem_solution_fit": 89.0,
                "market_sizing": 92.0,
                "business_model_clarity": 84.0,
                "traction_feasibility": 87.0,
            },
            "ai_feedback_summary": "Huge market tailwind driven by EU CSRD regulations. Recommend clarifying enterprise sales cycle duration and onboarding velocity in commercial expansion slide.",
            "strengths": [
                "Direct API hooks into major enterprise ERP platforms",
                "Hardware-tamper-evident soil sensor telemetry"
            ],
            "recommendations": [
                "Add 24-month cash flow and orbital data licensing burn rates"
            ],
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": 3,
            "founder_id": "founder-001",
            "title": "CyberSentinel Edge",
            "tagline": "Autonomous post-quantum cryptographic defenses for industrial IoT.",
            "description": "Lightweight microkernel architecture protecting SCADA pipelines and power grids from impending harvest-now-decrypt-later quantum compute vector attacks.",
            "problem": "Legacy critical infrastructure relies on RSA/ECC encryption that will be rendered obsolete by emerging quantum algorithms, with zero zero-downtime upgrade path.",
            "solution": "Drop-in hardware-accelerated lattice cryptography module deployed as a transparent bump-in-the-wire for substation controllers.",
            "industry": "Cybersecurity",
            "stage": "Seed",
            "funding_required": 1500000.0,
            "business_model": "Enterprise Licensing",
            "target_market": "National Energy Grids, Municipal Water Systems, Aerospace ($18B TAM)",
            "website": "https://cybersentinel.demo",
            "pitch_deck_url": "https://cybersentinel.demo/deck.pdf",
            "is_published": False,
            "readiness_score": 91.0,
            "ai_readiness_breakdown": {
                "problem_solution_fit": 94.0,
                "market_sizing": 88.0,
                "business_model_clarity": 90.0,
                "traction_feasibility": 92.0,
            },
            "ai_feedback_summary": "Exceptional technical depth from founders with DARPA research pedigree. Defense procurement certification in progress.",
            "strengths": [
                "NIST Post-Quantum Cryptography compliance",
                "Sub-millisecond verification overhead"
            ],
            "recommendations": [
                "Map out utility pilot sales cycle timelines"
            ],
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": 4,
            "founder_id": "founder-001",
            "title": "OmniFlow Robotics",
            "tagline": "Adaptive vision-guided warehouse micro-fulfillment robots.",
            "description": "Vision-language-action (VLA) foundation model running on low-power mobile manipulators for high-mix palletizing and rapid cold-storage parcel sorting.",
            "problem": "E-commerce fulfillment centers face severe labor shortages and 40% annual turnover in refrigerated sorting environments.",
            "solution": "Autonomous mobile manipulators that learn new SKU geometries in under 30 seconds without manual retraining or CAD models.",
            "industry": "Robotics",
            "stage": "Prototype",
            "funding_required": 2000000.0,
            "business_model": "Hardware + Recurring Software",
            "target_market": "3PL Logistics and Grocery Fulfillment Providers ($30B TAM)",
            "website": "https://omniflow.demo",
            "pitch_deck_url": "https://omniflow.demo/deck.pdf",
            "is_published": False,
            "readiness_score": 85.0,
            "ai_readiness_breakdown": {
                "problem_solution_fit": 88.0,
                "market_sizing": 86.0,
                "business_model_clarity": 82.0,
                "traction_feasibility": 84.0,
            },
            "ai_feedback_summary": "Compelling unit economics on RaaS model. Focus on reducing hardware BOM costs before full manufacturing scale-out.",
            "strengths": [
                "Zero-shot item grasp adaptation",
                "Proven operation in -20C sub-zero environments"
            ],
            "recommendations": [
                "Provide detailed pilot partner LOIs in data room"
            ],
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db.projects.insert_many(initial_projects)

    # Seed Founder Profile
    await db.founder_profiles.update_one(
        {"user_id": "founder-001"},
        {
            "$set": {
                "user_id": "founder-001",
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
        },
        upsert=True
    )

    # Seed Investor Profile
    await db.investor_profiles.update_one(
        {"user_id": "investor-001"},
        {
            "$set": {
                "user_id": "investor-001",
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
        },
        upsert=True
    )

    # Seed Investor Preferences
    await db.investor_preferences.update_one(
        {"investor_id": "investor-001"},
        {
            "$set": {
                "investor_id": "investor-001",
                "preferred_industries": ["Healthcare & AI", "AI/ML", "BioTech", "Cybersecurity"],
                "preferred_stages": ["Seed", "Pre-seed", "Series A"],
                "min_investment": 500000.0,
                "max_investment": 1500000.0,
                "preferred_business_models": ["B2B SaaS", "Enterprise Licensing", "DeepTech IP Licensing"],
                "geography": "North America & Europe",
                "tech_preferences": ["Edge Machine Learning", "Bioinformatics", "Generative AI & LLMs"],
                "created_at": now,
                "updated_at": now,
            }
        },
        upsert=True
    )

    # Seed Matches
    initial_matches = [
        {
            "id": "match-001",
            "project_id": 1,
            "project_title": "NeuroPulse AI",
            "investor_id": 101,
            "investor_name": "Dr. Sarah Lin",
            "investor_firm": "Apex Horizon Ventures",
            "match_score": 96.4,
            "reasons": [
                {
                    "category": "Industry Focus",
                    "explanation": "Apex Horizon thesis specifically prioritizes Healthcare AI and DeepTech diagnostics.",
                    "weight": 0.45,
                },
                {
                    "category": "Stage Alignment",
                    "explanation": "Founder is raising Seed round ($750K), matching fund's target check sweet spot ($500K-$1.5M).",
                    "weight": 0.35,
                },
                {
                    "category": "Business Model",
                    "explanation": "Enterprise hospital SaaS model synergizes directly with existing portfolio health system network.",
                    "weight": 0.20,
                },
            ],
            "status": "recommended",
            "created_at": now,
        },
        {
            "id": "match-002",
            "project_id": 1,
            "project_title": "NeuroPulse AI",
            "investor_id": 102,
            "investor_name": "Marcus Sterling",
            "investor_firm": "BlueShift Capital",
            "match_score": 89.2,
            "reasons": [
                {
                    "category": "Technology Match",
                    "explanation": "Fund is actively deploying into edge machine learning and specialized neural hardware.",
                    "weight": 0.50,
                },
                {
                    "category": "Geographic Preference",
                    "explanation": "Global mandate with strong North American co-investment syndicates.",
                    "weight": 0.30,
                },
                {
                    "category": "Lead Syndicate",
                    "explanation": "Frequently acts as lead institutional investor for deep technical founders.",
                    "weight": 0.20,
                },
            ],
            "status": "recommended",
            "created_at": now,
        },
        {
            "id": "match-003",
            "project_id": 2,
            "project_title": "Verdant Chain",
            "investor_id": 103,
            "investor_name": "Elena Rostova",
            "investor_firm": "TerraNext Climate Fund",
            "match_score": 93.8,
            "reasons": [
                {
                    "category": "Sector Specialty",
                    "explanation": "Dedicated fund for carbon verification, satellite tracking, and decarbonization supply chains.",
                    "weight": 0.60,
                },
                {
                    "category": "Target Check Size",
                    "explanation": "Seeking $1.2M matches TerraNext's typical co-investment initial participation range.",
                    "weight": 0.40,
                },
            ],
            "status": "recommended",
            "created_at": now,
        },
        {
            "id": "match-004",
            "project_id": 3,
            "project_title": "CyberSentinel Edge",
            "investor_id": 104,
            "investor_name": "David Vance",
            "investor_firm": "Aegis Defense Partners",
            "match_score": 92.1,
            "reasons": [
                {
                    "category": "Dual-Use Tech Focus",
                    "explanation": "Exclusively funds critical infrastructure security and post-quantum defense algorithms.",
                    "weight": 0.55,
                },
                {
                    "category": "Government Network",
                    "explanation": "Provides direct advisory access to DoD and commercial energy procurement teams.",
                    "weight": 0.45,
                },
            ],
            "status": "recommended",
            "created_at": now,
        },
    ]
    await db.matches.insert_many(initial_matches)

    # Seed Notifications
    initial_notifications = [
        {
            "user_id": "founder-001",
            "target_role": "FOUNDER",
            "title": "New 96.4% Mandate Match",
            "desc": "Dr. Sarah Lin (Apex Horizon Ventures) matches your $750k Seed ask for Healthcare AI.",
            "time": "20 minutes ago",
            "badge": "Match",
            "badge_variant": "success",
            "read": False,
            "created_at": now,
        },
        {
            "user_id": "founder-001",
            "target_role": "FOUNDER",
            "title": "AI Readiness Re-evaluation Complete",
            "desc": "Your readiness score improved from 88.0 to 92.4 following clinical pilot data upload.",
            "time": "2 hours ago",
            "badge": "Analysis",
            "badge_variant": "primary",
            "read": False,
            "created_at": now,
        },
        {
            "user_id": "founder-001",
            "target_role": "FOUNDER",
            "title": "Confidentiality Check: Private Status Active",
            "desc": "Your project 'QuantaShield' remains in private draft mode. Only you can view this report.",
            "time": "1 day ago",
            "badge": "Security",
            "badge_variant": "secondary",
            "read": True,
            "created_at": now,
        },
        {
            "user_id": "investor-001",
            "target_role": "INVESTOR",
            "title": "Founder Approved Dealflow Available",
            "desc": "NeuroPulse AI has made verified deck materials accessible to Apex Horizon Ventures.",
            "time": "1 hour ago",
            "badge": "Dealflow",
            "badge_variant": "success",
            "read": False,
            "created_at": now,
        },
        {
            "user_id": "investor-001",
            "target_role": "INVESTOR",
            "title": "New High-Cosine Match: Verdant Chain",
            "desc": "ClimateTech startup raising $1.2M matches your ESG infrastructure mandate at 93.8%.",
            "time": "4 hours ago",
            "badge": "Match",
            "badge_variant": "primary",
            "read": False,
            "created_at": now,
        },
    ]
    await db.notifications.insert_many(initial_notifications)

    logger.info("MongoDB Atlas initial seed completed successfully.")
