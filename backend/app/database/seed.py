"""Demo data for an empty VentureX database.

Ported from the original MongoDB seeders so the UI works immediately after
`neon deploy` on a fresh branch. Each group is only inserted when its table is
empty, so restarting the API never duplicates rows.
"""
import hashlib
import logging
import uuid
from datetime import datetime, timezone

from app.database.postgres import fetch_val, insert, upsert

logger = logging.getLogger(__name__)


def _compute_sha256(data_str: str) -> str:
    return hashlib.sha256(data_str.encode("utf-8")).hexdigest()


async def _is_empty(table: str) -> bool:
    return not await fetch_val(f"SELECT EXISTS (SELECT 1 FROM {table}) AS present")


async def seed_core_data() -> None:
    """Projects, demo founder/investor profiles, matches and notifications."""
    if not await _is_empty("projects"):
        return
    logger.info("Seeding initial VentureX demo data into Postgres...")
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
    for project in initial_projects:
        await insert("projects", project, returning=False)

    # Seed Founder Profile
    await upsert("founder_profiles", {
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
        }, ["user_id"])

    # Seed Investor Profile
    await upsert("investor_profiles", {
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
        }, ["user_id"])

    # Seed Investor Preferences
    await upsert("investor_preferences", {
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
        }, ["investor_id"])

    # Seed Matches
    initial_matches = [
        {
            "id": "match-001",
            "project_id": 1,
            "project_title": "NeuroPulse AI",
            "investor_id": "investor-001",
            "founder_id": "founder-001",
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
            "updated_at": now,
        },
        {
            "id": "match-002",
            "project_id": 1,
            "project_title": "NeuroPulse AI",
            "investor_id": "investor-002",
            "founder_id": "founder-001",
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
            "updated_at": now,
        },
        {
            "id": "match-003",
            "project_id": 2,
            "project_title": "Verdant Chain",
            "investor_id": "investor-003",
            "founder_id": "founder-001",
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
            "updated_at": now,
        },
        {
            "id": "match-004",
            "project_id": 3,
            "project_title": "CyberSentinel Edge",
            "investor_id": "investor-004",
            "founder_id": "founder-001",
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
            "updated_at": now,
        },
    ]
    for match in initial_matches:
        await upsert("matches", match, ["project_id", "investor_id"])

    # Seed Notifications
    initial_notifications = [
        {
            "user_id": "founder-001",
            "target_role": "FOUNDER",
            "title": "New 96.4% Mandate Match",
            "desc": "Dr. Sarah Lin (Apex Horizon Ventures) matches your $750k Seed ask for Healthcare AI.",
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
            "badge": "Match",
            "badge_variant": "primary",
            "read": False,
            "created_at": now,
        },
    ]
    for notification in initial_notifications:
        await insert("notifications", notification, returning=False)


async def seed_interests() -> None:
    """Initial introduction requests so the deal-room workflow is interactive."""
    if not await _is_empty("project_interests"):
        return
    now = datetime.now(timezone.utc)
    initial_interests = [
        {
            "id": "intro-001",
            "project_id": 1,
            "project_title": "NeuroPulse AI",
            "project_industry": "Healthcare & AI",
            "investor_id": "investor-001",
            "investor_name": "Dr. Sarah Lin",
            "investor_firm": "Apex Horizon Ventures",
            "investor_email": "sarah.lin@apexhorizon.vc",
            "founder_id": "founder-001",
            "founder_name": "Alex Rivers",
            "founder_email": "alex@neuropulse.demo",
            "status": "pending",
            "message": (
                "We've tracked your clinical ICU telemetry validation and would love to review your "
                "confidential regulatory roadmap and discuss participating as lead in your $750k Seed round."
            ),
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "intro-002",
            "project_id": 1,
            "project_title": "NeuroPulse AI",
            "project_industry": "Healthcare & AI",
            "investor_id": "investor-002",
            "investor_name": "Marcus Sterling",
            "investor_firm": "BlueShift Capital",
            "investor_email": "m.sterling@blueshiftcap.com",
            "founder_id": "founder-001",
            "founder_name": "Alex Rivers",
            "founder_email": "alex@neuropulse.demo",
            "status": "accepted",
            "message": "Highly interested in your edge neural processor architecture. Requesting deal room dialogue.",
            "response_note": "Welcome Marcus. Excited to connect and share our pilot hospital data room.",
            "deal_room": {
                "unlocked": True,
                "unlocked_at": now.isoformat(),
                "founder_name": "Alex Rivers",
                "founder_email": "alex@neuropulse.demo",
                "founder_phone": "+1 (415) 890-2341",
                "founder_linkedin": "https://linkedin.com/in/alexrivers",
                "direct_messaging_channel": "channel-dealroom-intro-002",
                "meeting_scheduler_url": "https://cal.com/alexrivers/seed-intro-30min",
                "data_room_url": "https://dataroom.venturex.io/room/1?access=verified_partner",
                "pitch_deck_url": "https://neuropulse.demo/deck.pdf",
                "financial_model_url": "https://dataroom.venturex.io/models/neuropulse_financial_model.xlsx",
                "cap_table_verified": True,
            },
            "created_at": now,
            "updated_at": now,
        },
    ]
    for interest in initial_interests:
        await insert("project_interests", interest, returning=False)


async def seed_deal_rooms() -> None:
    """Initial deal rooms with a sealed message hash chain and audit trail."""
    if not await _is_empty("deal_rooms"):
        return
    now = datetime.now(timezone.utc)
    room_id = "room-neuropulse-blueshift"
    genesis_hash = _compute_sha256(f"GENESIS|{room_id}|{now.isoformat()}")

    # 1. Initial messages with cryptographic hash chain
    msg1_hash = _compute_sha256(f"{genesis_hash}|1|{now.isoformat()}|investor-002|Hi Alex, Marcus here from BlueShift.")
    msg2_hash = _compute_sha256(f"{msg1_hash}|2|{now.isoformat()}|founder-001|Great to connect, Marcus!")
    msg3_hash = _compute_sha256(f"{msg2_hash}|3|{now.isoformat()}|SYSTEM|Mutual NDA signed by Dr. Sarah Lin & Alex Rivers")
    msg4_hash = _compute_sha256(f"{msg3_hash}|4|{now.isoformat()}|founder-001|Attached our confidential pilot ICU hospital clinical data.")

    initial_messages = [
        {
            "id": "msg-001",
            "room_id": room_id,
            "sender_id": "investor-002",
            "sender_role": "INVESTOR",
            "sender_name": "Marcus Sterling",
            "content": "Hi Alex, Marcus here from BlueShift Capital. We reviewed your pitch teaser and want to deep dive into your edge neural processor benchmarks.",
            "attachments": [],
            "sequence": 1,
            "previous_hash": genesis_hash,
            "integrity_hash": msg1_hash,
            "created_at": now,
            "is_read": True,
        },
        {
            "id": "msg-002",
            "room_id": room_id,
            "sender_id": "founder-001",
            "sender_role": "FOUNDER",
            "sender_name": "Alex Rivers",
            "content": "Great to connect, Marcus! We're excited about BlueShift's deeptech portfolio. We just completed our 2nd hospital ICU deployment with zero telemetry latency.",
            "attachments": [],
            "sequence": 2,
            "previous_hash": msg1_hash,
            "integrity_hash": msg2_hash,
            "created_at": now,
            "is_read": True,
        },
        {
            "id": "msg-003",
            "room_id": room_id,
            "sender_id": "SYSTEM",
            "sender_role": "SYSTEM",
            "sender_name": "VentureX Security Escrow",
            "content": "Mutual Non-Disclosure Agreement (NDA v2.4) digitally executed by both parties. Confidential data room documents unlocked.",
            "attachments": [],
            "sequence": 3,
            "previous_hash": msg2_hash,
            "integrity_hash": msg3_hash,
            "created_at": now,
            "is_read": True,
        },
        {
            "id": "msg-004",
            "room_id": room_id,
            "sender_id": "founder-001",
            "sender_role": "FOUNDER",
            "sender_name": "Alex Rivers",
            "content": "Here is our verified cap table and audited clinical validation study from Johns Hopkins pilot.",
            "attachments": [
                {
                    "name": "NeuroPulse_Clinical_Validation_2026.pdf",
                    "url": "https://neuropulse.demo/clinical_study.pdf",
                    "type": "clinical_data",
                    "size_kb": 2480,
                },
                {
                    "name": "NeuroPulse_CapTable_Series_Seed.xlsx",
                    "url": "https://neuropulse.demo/captable.xlsx",
                    "type": "cap_table",
                    "size_kb": 640,
                },
            ],
            "sequence": 4,
            "previous_hash": msg3_hash,
            "integrity_hash": msg4_hash,
            "created_at": now,
            "is_read": False,
        },
    ]
    pending_messages = list(initial_messages)

    # 2. Initial Room 1
    initial_room_1 = {
        "id": room_id,
        "interest_id": "intro-002",
        "project_id": 1,
        "project_title": "NeuroPulse AI",
        "project_industry": "Healthcare & AI",
        "founder_id": "founder-001",
        "founder_name": "Alex Rivers",
        "founder_email": "alex@neuropulse.demo",
        "founder_company": "NeuroPulse AI",
        "investor_id": "investor-002",
        "investor_name": "Marcus Sterling",
        "investor_firm": "BlueShift Capital",
        "investor_email": "m.sterling@blueshiftcap.com",
        "stage": "DUE_DILIGENCE",
        "nda_signed": True,
        "nda_signed_at": now,
        "nda_signer_name": "Marcus Sterling & Alex Rivers",
        "shared_documents": [
            {
                "name": "NeuroPulse_Full_PitchDeck_v3.pdf",
                "url": "https://neuropulse.demo/deck.pdf",
                "type": "pitch_deck",
                "size_kb": 4120,
            },
            {
                "name": "NeuroPulse_Clinical_Validation_2026.pdf",
                "url": "https://neuropulse.demo/clinical_study.pdf",
                "type": "clinical_data",
                "size_kb": 2480,
            },
            {
                "name": "NeuroPulse_CapTable_Series_Seed.xlsx",
                "url": "https://neuropulse.demo/captable.xlsx",
                "type": "cap_table",
                "size_kb": 640,
            },
        ],
        "created_at": now,
        "updated_at": now,
        "last_message": "Here is our verified cap table and audited clinical validation study from Johns Hopkins pilot.",
        "last_message_at": now,
        "last_message_sender": "Alex Rivers",
        "messages_count": 4,
        "audit_trail_hash": msg4_hash,
        "is_secure_recording_active": True,
    }

    # 3. Initial Room 2 with Dr. Sarah Lin (Apex Horizon)
    room_id_2 = "room-neuropulse-apex"
    g2_hash = _compute_sha256(f"GENESIS|{room_id_2}|{now.isoformat()}")
    m2_1_hash = _compute_sha256(f"{g2_hash}|1|{now.isoformat()}|investor-001|Hello Alex, Sarah Lin here.")

    initial_messages_2 = [
        {
            "id": "msg-101",
            "room_id": room_id_2,
            "sender_id": "investor-001",
            "sender_role": "INVESTOR",
            "sender_name": "Dr. Sarah Lin",
            "content": "Hello Alex, Dr. Sarah Lin here from Apex Horizon. Your ICU telemetry fits squarely into our $50M MedTech thesis. When are you free for an initial partner screening?",
            "attachments": [],
            "sequence": 1,
            "previous_hash": g2_hash,
            "integrity_hash": m2_1_hash,
            "created_at": now,
            "is_read": False,
        }
    ]
    pending_messages += initial_messages_2

    initial_room_2 = {
        "id": room_id_2,
        "interest_id": "intro-001",
        "project_id": 1,
        "project_title": "NeuroPulse AI",
        "project_industry": "Healthcare & AI",
        "founder_id": "founder-001",
        "founder_name": "Alex Rivers",
        "founder_email": "alex@neuropulse.demo",
        "founder_company": "NeuroPulse AI",
        "investor_id": "investor-001",
        "investor_name": "Dr. Sarah Lin",
        "investor_firm": "Apex Horizon Ventures",
        "investor_email": "sarah.lin@apexhorizon.vc",
        "stage": "INTRO_ACCEPTED",
        "nda_signed": False,
        "nda_signed_at": None,
        "nda_signer_name": None,
        "shared_documents": [
            {
                "name": "NeuroPulse_Executive_Summary.pdf",
                "url": "https://neuropulse.demo/exec_summary.pdf",
                "type": "pitch_deck",
                "size_kb": 1200,
            }
        ],
        "created_at": now,
        "updated_at": now,
        "last_message": "Hello Alex, Dr. Sarah Lin here from Apex Horizon. Your ICU telemetry fits squarely into our $50M MedTech thesis.",
        "last_message_at": now,
        "last_message_sender": "Dr. Sarah Lin",
        "messages_count": 1,
        "audit_trail_hash": m2_1_hash,
        "is_secure_recording_active": True,
    }

    for room in (initial_room_1, initial_room_2):
        await insert("deal_rooms", room, returning=False)
    for msg in pending_messages:
        await insert("deal_room_messages", msg, returning=False)

    # 4. Audit Log Entries
    audit_entries = [
        {
            "id": str(uuid.uuid4()),
            "room_id": room_id,
            "event_type": "ROOM_CREATED",
            "actor_id": "SYSTEM",
            "actor_role": "SYSTEM",
            "actor_name": "VentureX Deal Engine",
            "details": {"interest_id": "intro-002", "parties": ["founder-001", "investor-002"]},
            "tamper_hash": genesis_hash,
            "timestamp": now,
        },
        {
            "id": str(uuid.uuid4()),
            "room_id": room_id,
            "event_type": "NDA_EXECUTED",
            "actor_id": "investor-002",
            "actor_role": "INVESTOR",
            "actor_name": "Marcus Sterling",
            "details": {"nda_version": "2.4", "signer": "Marcus Sterling"},
            "tamper_hash": msg3_hash,
            "timestamp": now,
        },
        {
            "id": str(uuid.uuid4()),
            "room_id": room_id,
            "event_type": "STAGE_ADVANCED",
            "actor_id": "investor-002",
            "actor_role": "INVESTOR",
            "actor_name": "Marcus Sterling",
            "details": {"from_stage": "INTRO_ACCEPTED", "to_stage": "DUE_DILIGENCE"},
            "tamper_hash": msg4_hash,
            "timestamp": now,
        },
    ]
    for entry in audit_entries:
        await insert("deal_room_audit_logs", entry, returning=False)
    logger.info("Seeded initial deal rooms, messages and audit records.")


async def seed_all() -> None:
    await seed_core_data()
    await seed_interests()
    await seed_deal_rooms()
