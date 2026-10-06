"""Matching Engine Service Placeholder.

FUTURE IMPLEMENTATION:
- Cosine similarity calculation between pgvector embeddings
- Weighted scoring combining vector similarity + hard rule filters (ticket size, geography, stage)
- Explainable AI match reasoning engine (why this investor is a good match for this founder)
"""
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class MatchingEngineService:
    """Placeholder service for matching projects to investors with explainable reasoning."""

    @staticmethod
    def get_matches_for_user(user_id: int, role: str) -> List[Dict[str, Any]]:
        """Placeholder matching pipeline.

        Returns mock matches demonstrating explainable reasoning structure.
        """
        logger.info("[AI PLACEHOLDER] Finding matches for user_id=%s role=%s", user_id, role)

        # MOCK RECOMMENDATIONS
        return [
            {
                "id": "match-001",
                "project_id": 1,
                "project_title": "NeuroPulse AI",
                "investor_id": 101,
                "investor_name": "Sarah Lin",
                "investor_firm": "Apex Horizon Ventures",
                "match_score": 96.4,
                "reasons": [
                    {
                        "category": "Industry Focus",
                        "explanation": "Apex Horizon prioritizes Healthcare AI and DeepTech startups.",
                        "weight": 0.45,
                    },
                    {
                        "category": "Stage Alignment",
                        "explanation": "Founder is raising Seed round ($750K), matching investor's sweet spot of $500K-$1.5M.",
                        "weight": 0.35,
                    },
                    {
                        "category": "Business Model",
                        "explanation": "B2B enterprise model matches investor's historical portfolio synergy.",
                        "weight": 0.20,
                    },
                ],
                "status": "recommended",
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
                        "explanation": "Actively deploying capital into edge machine learning and diagnostics.",
                        "weight": 0.50,
                    },
                    {
                        "category": "Geographic Preference",
                        "explanation": "Global mandate with strong North American network.",
                        "weight": 0.30,
                    },
                    {
                        "category": "Syndicate Lead",
                        "explanation": "Frequently leads seed rounds for technical founders.",
                        "weight": 0.20,
                    },
                ],
                "status": "recommended",
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
                        "explanation": "100% focused on ESG, carbon credit verification, and supply chain visibility.",
                        "weight": 0.60,
                    },
                    {
                        "category": "Target Ticket Size",
                        "explanation": "Founder seeking $1.2M matches fund typical co-investment check.",
                        "weight": 0.40,
                    },
                ],
                "status": "recommended",
            },
        ]
