"""AI project intelligence: investment-readiness analysis.

Combines everything a founder has provided - the project profile, uploaded
materials (pitch deck, business plan, research, ...), the GitHub repository
and demo link - into one private readiness assessment: an overall score,
five scored dimensions with rationale, strengths, missing/weak areas,
prioritized improvement suggestions and industry-specific insights.

Engines (settings.analysis_engine):
* "claude" - Claude reads all materials (PDF decks and images natively,
  other documents as extracted text) and returns schema-constrained JSON.
* "gemini" - Google Gemini, same inputs and the same JSON contract (free
  tier available; free-tier inputs may be used by Google to improve products).
* "rules"  - a transparent completeness/coverage checker used when no
  AI key is configured. Results are labelled as rule-based.

Every run is stored in project_analyses; the latest one is mirrored onto the
project row (readiness_score, ai_readiness_breakdown, ...).
"""
import base64
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings
from app.database import postgres as pg
from app.utils.money import inr
from app.services import github_service
from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)

# Dimension keys are shared by both engines, the API and the UI.
DIMENSIONS: List[Tuple[str, str, str]] = [
    ("problem_solution_fit", "Problem / Solution Fit",
     "How clearly the pain point is evidenced and how convincingly the product solves it"),
    ("market_sizing", "Market Sizing & Competition",
     "Quantified, sourced market size (TAM/SAM/SOM), target customer and competitive positioning"),
    ("business_model_clarity", "Business Model Clarity",
     "How the company makes money: pricing, revenue model, unit economics, go-to-market"),
    ("traction_feasibility", "Traction & Validation",
     "Evidence of demand: users, pilots, LOIs, revenue, growth, and a credible execution plan"),
    ("product_technology", "Product & Technology",
     "Maturity and defensibility of the product: demo, codebase quality, technical moat"),
]
DIMENSION_KEYS = [d[0] for d in DIMENSIONS]

MAX_REQUEST_BYTES = 30 * 1024 * 1024  # stay under Claude's 32 MB request limit
MAX_PDF_PAGES = 600
# Gemini inline data: keep the whole request comfortably small; larger sets would need
# the Files API (which keeps uploads on Google's side for 48 hours).
GEMINI_MAX_INLINE_BYTES = 20 * 1024 * 1024

AI_ENGINES = ("claude", "gemini")


class AnalysisError(RuntimeError):
    """Analysis could not be completed. `status` is the HTTP status the API should return."""

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


# ---------------------------------------------------------------------------
# Output contract (Claude structured output + validation)
# ---------------------------------------------------------------------------

class DimensionScore(BaseModel):
    key: Literal[
        "problem_solution_fit", "market_sizing", "business_model_clarity",
        "traction_feasibility", "product_technology",
    ]
    score: float
    rationale: str


class Gap(BaseModel):
    area: str
    issue: str
    severity: Literal["high", "medium", "low"]


class Suggestion(BaseModel):
    title: str
    detail: str
    priority: Literal["high", "medium", "low"]


class AnalysisOutput(BaseModel):
    summary: str
    overall_score: float
    dimensions: List[DimensionScore]
    strengths: List[str]
    gaps: List[Gap]
    suggestions: List[Suggestion]
    industry_insights: List[str]


def _strict_schema() -> Dict[str, Any]:
    """JSON schema for output_config.format (every object closed, every field required)."""
    def obj(props: Dict[str, Any]) -> Dict[str, Any]:
        return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}

    severity = {"type": "string", "enum": ["high", "medium", "low"]}
    return obj({
        "summary": {"type": "string"},
        "overall_score": {"type": "number"},
        "dimensions": {"type": "array", "items": obj({
            "key": {"type": "string", "enum": DIMENSION_KEYS},
            "score": {"type": "number"},
            "rationale": {"type": "string"},
        })},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "gaps": {"type": "array", "items": obj({
            "area": {"type": "string"}, "issue": {"type": "string"}, "severity": severity,
        })},
        "suggestions": {"type": "array", "items": obj({
            "title": {"type": "string"}, "detail": {"type": "string"}, "priority": severity,
        })},
        "industry_insights": {"type": "array", "items": {"type": "string"}},
    })


SYSTEM_PROMPT = """You are VentureX's investment-readiness analyst. Early-stage founders give you everything they have about their project - the profile they filled in, their pitch deck and other documents, their GitHub repository and demo link - and you assess how ready the project is to be shown to investors.

Your assessment is private to the founder. It is shown to them before they choose whether to make the project visible to investors, so its job is to help them improve: be candid and specific, and ground every point in the materials (name the document, slide or section you are drawing on). Never invent facts, metrics or customers that the materials do not contain; when something an investor would expect is absent, treat it as a gap rather than guessing.

Score each of the five dimensions from 0 to 100, where 85+ means an investor would find it compelling as-is, 70-84 means solid with clear gaps, 50-69 means present but thin or unsubstantiated, and below 50 means largely missing. The overall score is your holistic judgement of investment readiness on the same scale, not necessarily the average.

Dimensions:
- problem_solution_fit: how clearly the pain point is evidenced and how convincingly the product solves it.
- market_sizing: quantified and sourced market size (TAM/SAM/SOM), a specific target customer, and competitive positioning.
- business_model_clarity: pricing, revenue model, unit economics and go-to-market.
- traction_feasibility: evidence of demand (users, pilots, LOIs, revenue, growth) and a credible execution plan for the raise.
- product_technology: product maturity and defensibility, using the demo, the repository (code structure, tests, CI, documentation, activity) and any technical claims.

Return exactly one entry per dimension. Strengths are what investors will find compelling. Gaps are missing or weak areas, each with a severity. Suggestions are concrete next steps the founder can act on before publishing, ordered by impact. Industry insights are specific to the project's domain - for example regulatory pathways, procurement cycles, typical metrics investors in that sector expect, or comparable companies - not generic startup advice. Write in plain, direct language addressed to the founder."""


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------

def _project_profile(project: Dict[str, Any]) -> str:
    funding = project.get("funding_required") or 0
    fields = [
        ("Project", project.get("title")),
        ("Tagline", project.get("tagline")),
        ("Domain / industry", project.get("industry")),
        ("Stage", project.get("stage")),
        ("Raising", f"{inr(funding, compact=False)} (Indian rupees)"),
        ("Business model", project.get("business_model")),
        ("Target market", project.get("target_market")),
        ("Description", project.get("description")),
        ("Problem", project.get("problem")),
        ("Solution", project.get("solution")),
        ("Website", project.get("website")),
        ("Demo / product link", project.get("demo_url")),
        ("GitHub repository", project.get("github_url")),
        ("Pitch deck link", project.get("pitch_deck_url")),
    ]
    return "\n".join(f"{label}: {value}" for label, value in fields if value)


async def _gather(project: Dict[str, Any]) -> Dict[str, Any]:
    documents = await DocumentService.load_for_analysis(project["id"])
    github = None
    if project.get("github_url"):
        github = await github_service.fetch_repository(project["github_url"])
    return {"documents": documents, "github": github}


def _inputs_summary(project: Dict[str, Any], gathered: Dict[str, Any]) -> Dict[str, Any]:
    github = gathered["github"]
    return {
        "documents": [
            {"id": d["id"], "name": d["original_name"], "category": d["category"],
             "pages": d["page_count"], "text_chars": len(d["extracted_text"] or "")}
            for d in gathered["documents"]
        ],
        "github": None if not github else {
            "url": github.get("url"), "ok": github.get("ok"), "error": github.get("error"),
            "full_name": github.get("full_name"),
        },
        "demo_url": project.get("demo_url") or None,
        "website": project.get("website") or None,
    }


# ---------------------------------------------------------------------------
# Shared AI request pieces
# ---------------------------------------------------------------------------

def _doc_label(doc: Dict[str, Any]) -> str:
    return f"{doc['original_name']} ({doc['category'].replace('_', ' ')})"


def _check_pdf_pages(doc: Dict[str, Any]) -> None:
    if (doc["page_count"] or 0) > MAX_PDF_PAGES:
        raise AnalysisError(
            f"'{doc['original_name']}' has {doc['page_count']} pages; the analysis can read at most "
            f"{MAX_PDF_PAGES}. Upload a shorter version or split it.", status=422,
        )


def _too_large(total_bytes: int, limit: int) -> AnalysisError:
    return AnalysisError(
        f"The uploaded materials total about {total_bytes // (1024 * 1024)} MB, above the "
        f"{limit // (1024 * 1024)} MB the analysis can send in one request. "
        "Remove or compress some documents and try again.", status=422,
    )


def _brief(project: Dict[str, Any], gathered: Dict[str, Any]) -> str:
    """The closing instruction with the project profile and repository summary."""
    github_text = (
        github_service.describe_for_prompt(gathered["github"]) if gathered["github"]
        else "No GitHub repository was provided."
    )
    materials = [d["original_name"] for d in gathered["documents"]] or ["(none uploaded)"]
    return (
        "Assess this project's investment readiness.\n\n"
        f"<project_profile>\n{_project_profile(project)}\n</project_profile>\n\n"
        f"<github>\n{github_text}\n</github>\n\n"
        f"Uploaded materials: {', '.join(materials)}.\n"
        "The demo link, if any, was not opened; judge the product from the materials and repository."
    )


def _parse_output(text: Optional[str], request_ref: str) -> AnalysisOutput:
    if not text:
        raise AnalysisError("The AI returned no analysis.", status=502)
    try:
        return AnalysisOutput.model_validate(json.loads(text))
    except (json.JSONDecodeError, ValidationError) as e:
        logger.error("Unparseable analysis (%s): %s", request_ref, e)
        raise AnalysisError("The AI returned an analysis in an unexpected format. Try again.", status=502)


# ---------------------------------------------------------------------------
# Claude engine
# ---------------------------------------------------------------------------

def _claude_content(project: Dict[str, Any], gathered: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Message content: PDFs and images natively, other documents as text, then the brief."""
    blocks: List[Dict[str, Any]] = []
    total_bytes = 0
    for doc in gathered["documents"]:
        label = _doc_label(doc)
        content = doc.get("content")
        if doc["content_type"] == "application/pdf" and content:
            _check_pdf_pages(doc)
            data = base64.standard_b64encode(content).decode("ascii")
            total_bytes += len(data)
            blocks.append({
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": data},
                "title": label,
            })
        elif doc["content_type"].startswith("image/") and content:
            data = base64.standard_b64encode(content).decode("ascii")
            total_bytes += len(data)
            blocks.append({"type": "text", "text": f"Image: {label}"})
            blocks.append({"type": "image", "source": {"type": "base64", "media_type": doc["content_type"], "data": data}})
        elif doc["extracted_text"]:
            total_bytes += len(doc["extracted_text"].encode("utf-8"))
            blocks.append({"type": "text", "text": f"<document name=\"{label}\">\n{doc['extracted_text']}\n</document>"})
        else:
            blocks.append({"type": "text", "text": f"Document {label}: no readable content ({doc.get('extraction_note') or 'empty'})."})

    if total_bytes > MAX_REQUEST_BYTES:
        raise _too_large(total_bytes, MAX_REQUEST_BYTES)

    blocks.append({"type": "text", "text": _brief(project, gathered)})
    return blocks


async def _analyze_with_claude(project: Dict[str, Any], gathered: Dict[str, Any]) -> Tuple[AnalysisOutput, str]:
    import anthropic

    content = _claude_content(project, gathered)
    client = None
    try:
        # Explicit key from settings (.env files) if given; otherwise the SDK resolves
        # ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / an `ant auth login` profile itself.
        client = (anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY) if settings.ANTHROPIC_API_KEY
                  else anthropic.AsyncAnthropic())
        response = await client.beta.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
            output_config={
                "effort": settings.ANTHROPIC_EFFORT,
                "format": {"type": "json_schema", "schema": _strict_schema()},
            },
            # On a policy decline, the API retries the same request on a fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError:
        raise AnalysisError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.", status=503)
    except anthropic.PermissionDeniedError as e:
        raise AnalysisError(f"The Anthropic API key cannot use this model: {e.message}", status=503)
    except anthropic.RateLimitError:
        raise AnalysisError("The AI service is rate limited right now. Try again in a minute.", status=429)
    except anthropic.BadRequestError as e:
        logger.error("Claude rejected the analysis request: %s", e.message)
        raise AnalysisError(f"The AI service rejected the request: {e.message}", status=422)
    except anthropic.APIStatusError as e:
        raise AnalysisError(f"The AI service returned an error ({e.status_code}). Try again shortly.", status=502)
    except anthropic.APIConnectionError:
        raise AnalysisError("Could not reach the AI service. Check the network and try again.", status=503)
    except anthropic.AnthropicError as e:
        raise AnalysisError(f"AI analysis failed: {e}", status=502)
    except TypeError as e:
        # The SDK raises TypeError when no credential (API key, token, profile) can be resolved.
        logger.error("Claude client not usable: %s", e)
        raise AnalysisError(
            "AI analysis is not configured: set ANTHROPIC_API_KEY (or set AI_PROVIDER=none for the rule-based check).",
            status=503,
        )
    finally:
        if client is not None:
            await client.close()

    if response.stop_reason == "refusal":
        raise AnalysisError("The AI declined to analyze these materials.", status=422)
    if response.stop_reason == "max_tokens":
        raise AnalysisError("The analysis was cut off before it finished. Try again.", status=502)

    text = next((b.text for b in response.content if b.type == "text"), None)
    output = _parse_output(text, f"Claude request {getattr(response, '_request_id', '?')}")
    return output, response.model


# ---------------------------------------------------------------------------
# Gemini engine
# ---------------------------------------------------------------------------

def _gemini_contents(project: Dict[str, Any], gathered: Dict[str, Any]) -> List[Any]:
    """Gemini parts: PDFs and images inline as bytes, other documents as text, then the brief."""
    from google.genai import types

    parts: List[Any] = []
    total_bytes = 0
    for doc in gathered["documents"]:
        label = _doc_label(doc)
        content = doc.get("content")
        if content and (doc["content_type"] == "application/pdf" or doc["content_type"].startswith("image/")):
            if doc["content_type"] == "application/pdf":
                _check_pdf_pages(doc)
            total_bytes += len(content)
            parts.append(f"Document: {label}")
            parts.append(types.Part.from_bytes(data=content, mime_type=doc["content_type"]))
        elif doc["extracted_text"]:
            total_bytes += len(doc["extracted_text"].encode("utf-8"))
            parts.append(f"<document name=\"{label}\">\n{doc['extracted_text']}\n</document>")
        else:
            parts.append(f"Document {label}: no readable content ({doc.get('extraction_note') or 'empty'}).")

    if total_bytes > GEMINI_MAX_INLINE_BYTES:
        raise _too_large(total_bytes, GEMINI_MAX_INLINE_BYTES)

    parts.append(_brief(project, gathered))
    return parts


async def _analyze_with_gemini(project: Dict[str, Any], gathered: Dict[str, Any]) -> Tuple[AnalysisOutput, str]:
    from google import genai
    from google.genai import errors, types

    api_key = settings.gemini_api_key
    if not api_key:
        raise AnalysisError(
            "Gemini is not configured: set GEMINI_API_KEY (free at aistudio.google.com), "
            "or set AI_PROVIDER=none for the rule-based check.",
            status=503,
        )

    contents = _gemini_contents(project, gathered)
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_json_schema=_strict_schema(),
        max_output_tokens=16000,
        http_options=types.HttpOptions(timeout=settings.GEMINI_TIMEOUT_SECONDS * 1000),
    )
    # Free-tier capacity varies by model: when one is overloaded (503) or out of quota
    # (429), try the next configured model instead of failing the founder's request.
    models = [settings.GEMINI_MODEL] + [m for m in settings.gemini_fallback_models if m != settings.GEMINI_MODEL]
    client = genai.Client(api_key=api_key)
    response = None
    model_used = None
    try:
        for index, model in enumerate(models):
            last = index == len(models) - 1
            try:
                response = await client.aio.models.generate_content(model=model, contents=contents, config=config)
                model_used = model
                break
            except errors.ClientError as e:  # 4xx
                if e.code in (401, 403):
                    raise AnalysisError("The Gemini API key was rejected. Check GEMINI_API_KEY.", status=503)
                if e.code == 429:
                    if not last:
                        logger.warning("Gemini %s is out of quota; trying %s", model, models[index + 1])
                        continue
                    raise AnalysisError(
                        "Gemini's free-tier rate limit was reached. Wait a minute (or until tomorrow for the "
                        "daily limit) and try again.", status=429,
                    )
                if e.code == 404:
                    if not last:
                        logger.warning("Gemini model %s not found; trying %s", model, models[index + 1])
                        continue
                    raise AnalysisError(f"Gemini model '{model}' was not found. Check GEMINI_MODEL.", status=503)
                logger.error("Gemini rejected the analysis request: %s", e.message)
                raise AnalysisError(f"Gemini rejected the request: {e.message}", status=422)
            except errors.ServerError as e:  # 5xx, e.g. 503 "experiencing high demand"
                if not last:
                    logger.warning("Gemini %s unavailable (%s); trying %s", model, e.code, models[index + 1])
                    continue
                raise AnalysisError(
                    "Gemini is overloaded right now (all configured models are busy). Try again in a few minutes.",
                    status=503,
                )
            except errors.APIError:
                raise
            except Exception as e:  # timeouts and network errors from the HTTP layer
                if not last:
                    logger.warning("Gemini %s failed (%s); trying %s", model, type(e).__name__, models[index + 1])
                    continue
                logger.error("Gemini request failed: %s", e)
                raise AnalysisError(
                    f"Gemini did not respond within {settings.GEMINI_TIMEOUT_SECONDS} seconds or could not be "
                    "reached. Try again in a few minutes.", status=503,
                )
    except AnalysisError:
        raise
    except errors.APIError as e:
        raise AnalysisError(f"Gemini request failed: {e.message}", status=502)
    except Exception as e:  # network failures surface as transport exceptions
        logger.error("Gemini request failed: %s", e)
        raise AnalysisError("Could not reach Gemini. Check the network and try again.", status=503)
    finally:
        await client.aio.aclose()

    feedback = getattr(response, "prompt_feedback", None)
    if feedback is not None and getattr(feedback, "block_reason", None):
        raise AnalysisError(f"Gemini declined to analyze these materials ({feedback.block_reason}).", status=422)
    candidate = (response.candidates or [None])[0]
    finish = getattr(candidate, "finish_reason", None)
    finish_name = getattr(finish, "name", str(finish)) if finish is not None else None
    if finish_name == "MAX_TOKENS":
        raise AnalysisError("The analysis was cut off before it finished. Try again.", status=502)
    if finish_name and finish_name not in ("STOP", "FINISH_REASON_UNSPECIFIED"):
        raise AnalysisError(f"Gemini stopped without finishing the analysis ({finish_name}).", status=422)

    output = _parse_output(response.text, f"Gemini {model_used}")
    return output, getattr(response, "model_version", None) or model_used


# ---------------------------------------------------------------------------
# Rule-based engine (no API key)
# ---------------------------------------------------------------------------

_SIGNALS = {
    "market_sizing": [r"\btam\b", r"\bsam\b", r"\bsom\b", r"market size", r"\$\s?\d+(\.\d+)?\s?(b|bn|billion|m|million)\b",
                      r"\bcagr\b", r"compet(itor|ition|itive)"],
    "business_model_clarity": [r"pricing", r"\bprice\b", r"subscription", r"revenue", r"margin", r"unit economics",
                               r"\bcac\b", r"\bltv\b", r"\barr\b", r"\bmrr\b", r"go[- ]to[- ]market", r"sales"],
    "traction_feasibility": [r"customers?", r"\busers?\b", r"pilot", r"\bloi\b", r"letters? of intent", r"waitlist",
                             r"growth", r"retention", r"partnership", r"revenue of", r"signed", r"milestone"],
    "problem_solution_fit": [r"pain", r"problem", r"survey", r"interview", r"evidence", r"\d+\s?%", r"cost(s|ly)?"],
}

_INDUSTRY_NOTES = {
    "health": ["Investors will ask about the regulatory pathway (e.g. FDA 510(k)/De Novo or CE marking) and its timeline.",
               "Clinical validation and reimbursement (who pays) usually matter as much as the technology."],
    "fintech": ["Expect questions on licensing, compliance (KYC/AML) and banking partners.",
                "Unit economics such as CAC payback and take rate are the core metrics for fintech investors."],
    "edtech": ["Separate the buyer (school, employer, parent) from the user and show sales-cycle length.",
               "Learning outcomes and retention/engagement data are the strongest proof points."],
    "climate": ["Show the emissions impact methodology and how it is verified.",
                "Hardware-heavy climate plays should explain capital intensity and project financing."],
    "cyber": ["Enterprise security buyers need certifications (SOC 2, ISO 27001) and reference customers.",
              "Show how the product fits existing security stacks and compliance requirements."],
    "ai": ["Explain what is defensible beyond the underlying models: proprietary data, workflow, distribution.",
           "Investors will probe inference cost, accuracy evaluation and data rights."],
    "robot": ["Hardware margins, bill of materials and manufacturing partners are key diligence areas.",
              "Pilot deployments with measured productivity gains are the strongest evidence."],
}


def _analyze_with_rules(project: Dict[str, Any], gathered: Dict[str, Any]) -> AnalysisOutput:
    docs = gathered["documents"]
    github = gathered["github"] or {}
    corpus = " ".join(
        str(project.get(k) or "") for k in ("description", "problem", "solution", "target_market", "business_model", "tagline")
    )
    corpus += " " + " ".join(d["extracted_text"] or "" for d in docs)
    corpus += " " + (github.get("readme") or "")
    corpus = corpus.lower()

    def coverage(key: str) -> Tuple[int, List[str]]:
        hits = [p for p in _SIGNALS[key] if re.search(p, corpus)]
        return len(hits), hits

    gaps: List[Gap] = []
    suggestions: List[Suggestion] = []
    strengths: List[str] = []
    dims: List[DimensionScore] = []

    def add_dim(key: str, score: float, rationale: str):
        dims.append(DimensionScore(key=key, score=round(max(20.0, min(95.0, score)), 1), rationale=rationale))

    # Problem / solution
    hits, _ = coverage("problem_solution_fit")
    detail = len(project.get("problem") or "") + len(project.get("solution") or "")
    score = 45 + min(25, detail / 20) + 5 * min(hits, 5)
    add_dim("problem_solution_fit", score,
            f"Problem and solution descriptions total {detail} characters; {hits} evidence signals found.")
    if detail > 300:
        strengths.append("The problem and solution are described in useful detail.")
    if hits < 3:
        gaps.append(Gap(area="Problem evidence", issue="Little evidence that the pain point is real (data, interviews, costs).", severity="medium"))
        suggestions.append(Suggestion(title="Back the problem with evidence",
                                      detail="Add numbers, customer interview findings or cost data that show how painful the problem is.",
                                      priority="medium"))

    # Market
    hits, _ = coverage("market_sizing")
    add_dim("market_sizing", 40 + 9 * min(hits, 6), f"{hits} market-sizing or competition signals found in the materials.")
    if hits < 3:
        gaps.append(Gap(area="Market sizing", issue="No quantified market size (TAM/SAM/SOM) or competitor analysis found.", severity="high"))
        suggestions.append(Suggestion(title="Quantify your market and competition",
                                      detail="Add TAM/SAM/SOM with sources and a competitor comparison showing your differentiation.",
                                      priority="high"))

    # Business model
    hits, _ = coverage("business_model_clarity")
    add_dim("business_model_clarity", 40 + 7 * min(hits, 8), f"{hits} business-model signals (pricing, revenue, unit economics) found.")
    if hits < 3:
        gaps.append(Gap(area="Business model", issue="Pricing, revenue model or unit economics are not explained.", severity="high"))
        suggestions.append(Suggestion(title="Explain how you make money",
                                      detail="State pricing, who pays, expected margins and how you will acquire customers.",
                                      priority="high"))

    # Traction
    hits, _ = coverage("traction_feasibility")
    add_dim("traction_feasibility", 35 + 8 * min(hits, 7), f"{hits} traction signals (users, pilots, LOIs, revenue) found.")
    if hits < 3:
        gaps.append(Gap(area="Traction", issue="No evidence of demand such as users, pilots, LOIs or revenue.", severity="high"))
        suggestions.append(Suggestion(title="Show early traction",
                                      detail="Add pilot results, waitlist numbers, LOIs or early revenue, even if small.",
                                      priority="high"))
    else:
        strengths.append("The materials mention concrete traction or validation.")

    # Product & technology
    signals = github.get("signals") or {}
    tech = 35.0
    notes = []
    if github.get("ok"):
        tech += 15
        notes.append("public repository found")
        tech += 6 * sum(bool(signals.get(k)) for k in ("has_tests", "has_ci", "has_docs", "has_docker"))
        if len(github.get("readme") or "") > 1500:
            tech += 6
            notes.append("substantial README")
        strengths.append(f"Public code repository ({github.get('full_name')}) lets investors verify the build.")
        if not signals.get("has_tests"):
            suggestions.append(Suggestion(title="Add automated tests to the repository",
                                          detail="Tests and CI signal engineering maturity during technical diligence.", priority="low"))
    elif project.get("github_url"):
        notes.append(f"repository could not be read ({github.get('error')})")
        gaps.append(Gap(area="Repository", issue=f"The GitHub link could not be read: {github.get('error')}", severity="low"))
    if project.get("demo_url"):
        tech += 12
        notes.append("demo link provided")
    else:
        gaps.append(Gap(area="Product demo", issue="No demo or product link provided.", severity="medium"))
        suggestions.append(Suggestion(title="Add a demo link",
                                      detail="A short video or live demo lets investors see the product working.", priority="medium"))
    add_dim("product_technology", tech, "; ".join(notes) or "No repository or demo provided.")

    # Materials
    categories = {d["category"] for d in docs}
    if "pitch_deck" not in categories and not project.get("pitch_deck_url"):
        gaps.append(Gap(area="Pitch deck", issue="No pitch deck uploaded.", severity="high"))
        suggestions.insert(0, Suggestion(title="Upload your pitch deck",
                                         detail="The deck is the first thing investors review; upload it as a PDF or PPTX.",
                                         priority="high"))
    elif docs:
        strengths.append(f"{len(docs)} supporting document(s) uploaded for review.")

    industry = (project.get("industry") or "").lower()
    insights = next((tips for key, tips in _INDUSTRY_NOTES.items() if key in industry), [
        "Investors in this space will look for a clear wedge customer and a credible path to repeatable sales.",
    ])

    overall = round(sum(d.score for d in dims) / len(dims), 1)
    order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda s: order[s.priority])
    return AnalysisOutput(
        summary=(
            "Rule-based readiness check (AI analysis is not configured): scores reflect which investor-relevant "
            f"topics your profile, {len(docs)} document(s) and repository cover, not their quality."
        ),
        overall_score=overall,
        dimensions=dims,
        strengths=strengths or ["The project profile is complete enough to analyze."],
        gaps=gaps,
        suggestions=suggestions,
        industry_insights=insights,
    )


# ---------------------------------------------------------------------------
# Orchestration and persistence
# ---------------------------------------------------------------------------

def _status_label(score: float) -> str:
    if score >= 85:
        return "Ready for Investor Presentation"
    if score >= 70:
        return "Nearly Ready: Address Key Gaps"
    if score >= 50:
        return "Needs Refinement"
    return "Early: Build Out Core Materials"


def _clamp(value: float) -> float:
    return round(max(0.0, min(100.0, float(value))), 1)


class AnalysisService:
    @classmethod
    async def analyze(cls, project: Dict[str, Any], engine: Optional[str] = None) -> Dict[str, Any]:
        """Run an analysis for a project row, store it, mirror it onto the project, return it."""
        engine = engine or settings.analysis_engine
        gathered = await _gather(project)

        model = None
        if engine == "claude":
            output, model = await _analyze_with_claude(project, gathered)
        elif engine == "gemini":
            output, model = await _analyze_with_gemini(project, gathered)
        else:
            output = _analyze_with_rules(project, gathered)

        # Exactly one entry per dimension, in canonical order.
        by_key = {d.key: d for d in output.dimensions}
        dimensions = [
            {"key": key, "name": name, "description": desc,
             "score": _clamp(by_key[key].score) if key in by_key else None,
             "rationale": by_key[key].rationale if key in by_key else "Not assessed."}
            for key, name, desc in DIMENSIONS
        ]
        overall = _clamp(output.overall_score)
        row = await pg.insert("project_analyses", {
            "project_id": project["id"],
            "engine": engine,
            "model": model,
            "overall_score": overall,
            "status_label": _status_label(overall),
            "summary": output.summary,
            "dimensions": dimensions,
            "strengths": output.strengths,
            "gaps": [g.model_dump() for g in output.gaps],
            "suggestions": [s.model_dump() for s in output.suggestions],
            "industry_insights": output.industry_insights,
            "inputs": _inputs_summary(project, gathered),
        })
        await pg.update_where("projects", {
            "readiness_score": overall,
            "ai_readiness_breakdown": {d["key"]: d["score"] for d in dimensions if d["score"] is not None},
            "ai_feedback_summary": output.summary,
            "strengths": output.strengths,
            "recommendations": [f"{s.title}: {s.detail}" for s in output.suggestions],
            "updated_at": datetime.now(timezone.utc),
        }, "id = %s", [project["id"]])
        logger.info("Analysis %s for project %s: %s (%s)", row["id"], project["id"], overall, engine)
        return row

    @classmethod
    async def latest(cls, project_id: int) -> Optional[Dict[str, Any]]:
        return await pg.fetch_one(
            "SELECT * FROM project_analyses WHERE project_id = %s ORDER BY created_at DESC, id DESC LIMIT 1",
            [project_id],
        )

    @classmethod
    async def history(cls, project_id: int, limit: int = 20) -> List[Dict[str, Any]]:
        return await pg.fetch_all(
            "SELECT id, engine, model, overall_score, status_label, dimensions, created_at "
            "FROM project_analyses WHERE project_id = %s ORDER BY created_at DESC, id DESC LIMIT %s",
            [project_id, limit],
        )
