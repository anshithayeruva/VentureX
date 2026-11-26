# AI Implementation Analysis

**Bottom line:** VentureX has **one genuine AI feature**: the **investment-readiness analysis** of a founder's project. It runs on Google Gemini (working, verified live) or Anthropic Claude (implemented, not yet tested live). **Matching between startups and investors is not AI.** It is a transparent, weighted rule engine that also writes the explanation for each match. Three files under `backend/app/services/ai/` mention embeddings, pgvector and LLM matching, but they are **unused placeholders** that return zero vectors or mock data.

| Capability | Technique | Real or mocked | Evidence |
| --- | --- | --- | --- |
| Readiness analysis (score, 5 dimensions, strengths, gaps, suggestions, industry insights) | LLM (Gemini or Claude) with schema-constrained JSON | **Real** (Gemini verified; Claude untested) | `backend/app/services/analysis_service.py` |
| Baseline readiness (on project creation, or with no AI key) | Deterministic keyword/coverage rules | **Real, rule-based**, labelled as such in the UI | `_analyze_with_rules` |
| Startup ↔ investor matching with reasons | Weighted rules + templated sentences | **Real, rule-based** (not AI) | `backend/app/services/match_service.py::calculate_match` |
| GitHub repository understanding | REST metadata + README + file tree heuristics (tests? CI? docs?) | **Real**, no AI on its own; its summary is given to the LLM | `backend/app/services/github_service.py` |
| Document understanding | PDFs/images sent natively to the LLM; DOCX/PPTX/TXT as extracted text | **Real** | `document_service.py`, `_claude_content`, `_gemini_contents` |
| Embeddings / vector similarity / pgvector | — | **Placeholder, unused** | `backend/app/services/ai/embeddings.py` (returns `[0.0] * 384`), `ai/matching.py`, `ai/project_analysis.py` — nothing imports them |

---

## 1. Which provider and how the engine is chosen

`settings.analysis_engine` (`backend/app/core/config.py`):

1. `AI_PROVIDER=none|rules|off` → **rules**
2. `AI_PROVIDER=anthropic|claude` → **claude**
3. `AI_PROVIDER=gemini|google` → **gemini**
4. `AI_PROVIDER=auto` (default): Claude if an Anthropic key is present, else Gemini if a Gemini key is present, else rules.

| Engine | SDK | Model (default) | Notes |
| --- | --- | --- | --- |
| Gemini | `google-genai` 3.6.1 | `gemini-3.8-flash`, then fallback `gemini-3.5-flash-lite` | Per-request timeout `GEMINI_TIMEOUT_SECONDS` (150 s). On 429 (quota) / 503 (overloaded) / timeout, the next model in the list is tried. |
| Claude | `anthropic` 2.11.0 (beta Messages API) | `claude-opus-5-5`, effort `high` | `output_config.format = json_schema`; server-side fallback model on policy declines (`betas=["server-side-fallback-2026-07-01"]`). |
| Rules | none | — | Always available, no cost, deterministic. |

The current local configuration uses **Gemini** (free tier). The UI shows a notice that Gemini's free tier may use submitted materials to improve Google's products, so founders should avoid uploading confidential decks on that tier.

## 2. Which code invokes the AI

* `POST /api/projects/{id}/analyze` → `AnalysisService.analyze(project)` (also `POST /re-evaluate`).
* `ProjectService.create` calls `AnalysisService.analyze(created, engine="rules")` on purpose: an instant, free baseline, never the paid or slow model.
* Nothing else calls an LLM.

## 3. What is sent to the model (step by step)

`_gather(project)` collects:

1. **Project profile:** title, tagline, industry, stage, raise, business model, target market, description, problem, solution, website, demo link, GitHub URL, deck link (`_project_profile`).
2. **Uploaded documents** (`DocumentService.load_for_analysis`):
   * PDFs and images (PNG/JPG) are sent **as files** (Claude `document`/`image` blocks; Gemini `Part.from_bytes`), so the model sees slides and charts, not just text.
   * DOCX, PPTX, TXT, MD and CSV are sent as **extracted text**, labelled with the file name and category.
   * Limits: 30 MB per Claude request, 20 MB inline for Gemini, at most 600 PDF pages. Over the limit, the founder gets a clear 422 error and nothing is truncated silently.
3. **GitHub summary** (`github_service.fetch_repository` → `describe_for_prompt`): repository metadata (description, topics, primary language, stars, forks, open issues, license, archived flag, created and last-push dates, default branch), language mix, README text, and file-tree signals (`has_tests`, `has_ci`, `has_docs`). It is read through the GitHub REST API (never by fetching an arbitrary URL); it is public repositories only unless `GITHUB_TOKEN` is set, and it hits the 60 requests/hour limit when unauthenticated. **Source files themselves are not read.**
4. **The demo link is not opened.** The brief tells the model so explicitly.

The message ends with `_brief()`: "Assess this project's investment readiness", followed by the `<project_profile>` and `<github>` blocks and the list of uploaded materials.

## 4. The instructions (system prompt)

`SYSTEM_PROMPT` in `analysis_service.py` (summarised; the exact wording is in the file):

* Role: "VentureX's investment-readiness analyst" for early-stage founders.
* The assessment is **private to the founder** and exists to help them improve: be candid and specific, and **ground every point in the materials** (name the document, slide or section).
* **Never invent** facts, metrics or customers; treat anything missing as a gap.
* Score 5 dimensions from 0 to 100 on a defined rubric: 85+ compelling as-is; 70–84 solid with clear gaps; 50–69 thin; below 50 largely missing. The overall score is a holistic judgement, not necessarily the average.
* Dimensions: problem/solution fit, market sizing and competition, business model clarity, traction and validation, product and technology (using the repo: structure, tests, CI, docs, activity).
* Strengths; gaps with severity; suggestions ordered by impact; **domain-specific** industry insights (e.g. regulatory pathways), not generic advice.

## 5. Expected response format

A strict JSON schema (`_strict_schema()`, every object closed and every field required), used as Claude's `output_config.format` and Gemini's `response_json_schema`:

```json
{
  "overall_score": 0-100,
  "summary": "string",
  "dimensions": [{"key": "problem_solution_fit|market_sizing|business_model_clarity|traction_feasibility|product_technology",
                  "score": 0-100, "rationale": "string"}],
  "strengths": ["string"],
  "gaps": [{"area": "string", "issue": "string", "severity": "high|medium|low"}],
  "suggestions": [{"title": "string", "detail": "string", "priority": "high|medium|low"}],
  "industry_insights": ["string"]
}
```

## 6. How the response is processed

1. The JSON text is parsed and validated with the Pydantic model `AnalysisOutput` (`_parse_output`). Invalid output raises `AnalysisError`, so the founder sees an error instead of a half-broken report.
2. Claude: `stop_reason == "max_tokens"` is treated as an error (a truncated report is never shown).
3. Exactly one entry per dimension, in canonical order; a missing dimension becomes "Not assessed."
4. Scores are clamped to 0–100 and rounded to one decimal (`_clamp`).
5. A status label comes from the overall score (`_status_label`): ≥ 85 "Ready for Investor Presentation"; ≥ 70 "Nearly Ready: Address Key Gaps"; ≥ 50 "Needs Refinement"; otherwise "Early: Build Out Core Materials".

## 7. Storage and display

* **Every run** is inserted into `project_analyses` (engine, model, overall score, label, summary, dimensions, strengths, gaps, suggestions, insights, and `inputs`, i.e. what was analysed).
* The latest run is **mirrored onto `projects`** (`readiness_score`, `ai_readiness_breakdown`, `ai_feedback_summary`, `strengths`, `recommendations`) so dashboards can show scores cheaply.
* The frontend (`frontend/components/ProjectIntelligence.tsx`) shows the score, label, engine/model tag, summary, one bar per dimension with its rationale, strengths, severity-tagged gaps, numbered suggestions, industry insights, "Analyzed: …" and a progress history. A PDF export exists (`GET /projects/{id}/export-report`).
* **Privacy:** readiness data is returned only to the project's owner (`_private_report_project` returns 404 to everyone else; demo projects are the one exception). Investors never see scores, gaps or suggestions.

## 8. Error handling and fallbacks

| Situation | Behaviour |
| --- | --- |
| No API key for the chosen engine | 503 with setup instructions (or `auto` silently uses rules). |
| Gemini 429 / 503 / timeout | Tries the next model in `GEMINI_FALLBACK_MODELS`; if all fail, a clear message (e.g. "free-tier rate limit reached"). |
| Claude auth / permission / rate limit / bad request / API or connection error | Each is mapped to a specific `AnalysisError` with a clear message (503 for auth or permission problems, 429 for rate limits, 422 for bad requests, 502/503 for API or connection failures). |
| Invalid or truncated model output | Error; nothing is stored. |
| Materials too large / too many pages | 422 with guidance. |
| GitHub unreachable or rate-limited | Analysis continues; the repo is reported as "could not be read: …". |
| **AI fails entirely** | **No automatic fallback to the rules engine.** The previous report stays and the founder can retry. |

## 9. How the rule-based engine scores (non-AI)

`_analyze_with_rules`:

* Builds a lowercase corpus from the project text, the extracted text of every document, and the GitHub README.
* For each of four dimensions, counts **regex "signals"**: market (`TAM`, `SAM`, `SOM`, "market size", dollar amounts, `CAGR`, "competitor"), business model ("pricing", "subscription", "revenue", "margin", `CAC`, `LTV`, `ARR`, "go-to-market"), traction ("customers", "pilot", `LOI`, "waitlist", "growth", "retention"), problem ("pain", "survey", "interview", percentages, "cost").
* Problem/solution also rewards length of the problem and solution text; product/technology rewards a readable repository (README, tests, CI, recent activity), a demo link and documents.
* Each dimension is clamped to 20–95; **overall = average** of the five.
* Gaps and suggestions are templated (e.g. "Quantify your market and competition"); industry insights come from a small keyword table (health, fintech, edtech, climate, cyber, AI, robotics).
* The report is labelled "Rule-based check" in the UI. It measures **coverage of investor-relevant topics, not quality**.

## 10. How matching is scored (rule-based, not AI)

`MatchService.calculate_match(project, investor_profile, preference)`:

| Factor | Weight | Tiers |
| --- | --- | --- |
| Industry | 40 % | exact match 98 · word overlap 88 · technology overlap 83 · none 42 |
| Stage | 30 % | exact 96 · word overlap 86 · early-stage keyword 78 · none 48 |
| Check size | 20 % | inside min–max 96 · within 70 %–135 % of the range 82 · outside 45 |
| Business model | 10 % | exact/contains 95 · word overlap 85 · none 60 |

* Composite = weighted sum, clamped to **40–98.8**; matches **below 45 are dropped**.
* Each factor contributes a sentence to `reasons`, shown to investors as "Why it fits your criteria".
* Matches ≥ 90 % create a notification for the investor.
* Recomputed when a project is created, updated or published, when criteria are saved, or via `POST /matches/recalculate`. Only **published** projects are ever matched; drafts have no matches and trigger no notifications.
* **Geography is stored but not scored.** Investors without saved criteria fall back to built-in demo defaults (`DEMO_INVESTORS` in `match_service.py`).

## 11. How AI results are validated (and what isn't)

* **Structurally:** strict JSON schema plus Pydantic validation; scores clamped; truncation rejected.
* **Factually:** the prompt forbids invented facts and requires citing the source material; the UI shows which documents and repository were analysed.
* **Not yet:** there is no automated evaluation set, no human review loop, and no score-consistency test across runs. Scores from Gemini and Claude are not calibrated against each other, and the rules engine scores coverage, not quality. Treat scores as guidance, not a verdict.

## 12. Summary table for presenters

| Say this | Not this |
| --- | --- |
| "An AI reads your deck, documents and GitHub repo and writes a private readiness report." | "Our proprietary AI model…" (we use Gemini/Claude via their APIs) |
| "Matching is explainable: every match lists the reasons." | "AI vector matching / semantic embeddings" (not implemented) |
| "If no AI is configured, a transparent rule-based check still gives founders a baseline." | "The AI never fails" |
