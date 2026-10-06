"""AI/ML Services Subpackage (Modular Placeholders).

This module contains future integrations for:
- Project analysis & pitch deck readiness (LLM / NLP)
- Vector embedding generation (Hugging Face / Sentence Transformers)
- Founder-Investor matching algorithm (Vector similarity + Rule-based scoring)
"""
from app.services.ai.project_analysis import ProjectAnalysisService
from app.services.ai.embeddings import EmbeddingService
from app.services.ai.matching import MatchingEngineService

__all__ = [
    "ProjectAnalysisService",
    "EmbeddingService",
    "MatchingEngineService",
]
