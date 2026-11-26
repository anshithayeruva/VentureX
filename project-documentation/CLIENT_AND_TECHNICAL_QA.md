# Client and Technical Q&A

36 questions with answers grounded in the code. File paths are given where an evaluator may ask "show me".

## Business

**1. What problem does VentureX solve?**
Founders often pitch before they're ready and rarely get specific feedback; investors filter many mismatched pitches by hand; early diligence is scattered across email and links. VentureX gives founders a private readiness report, matches them with investors on explicit criteria with stated reasons, and opens a private deal room once both sides agree.

**2. Who are the target users?**
Pre-seed to Series A founders, and angels or early-stage funds. Accelerators and university programs are a natural next audience, though cohort/admin features aren't built yet.

**3. What makes this different from a startup database or a pitch-deck review service?**
It connects the steps: feedback before visibility, fit-based discovery with explanations, and a diligence space, in one flow where the founder controls visibility and contact details. The feedback reads the founder's actual deck, documents and GitHub repository.

**4. What's the business model?**
Not decided or validated. Options: freemium for founders (a free rules-based check plus limited AI runs), investor subscriptions, and program licences for accelerators.

**5. Do you have traction or usage metrics?**
No. The product hasn't launched or been deployed; nothing has been measured. We don't claim performance or adoption figures.

**6. What are the current limitations?**
Not deployed; no project delete; emails aren't sent (no SMTP); file storage is local; matching is rule-based (not semantic); Claude support is untested live; some medium-severity access issues remain (see Q32). Full list in `IMPLEMENTATION_STATUS_AND_GAP_ANALYSIS.md`.

**7. What would you improve before production?**
In order: merge the access fixes already made (notifications, drafts, deal-room files) and close the remaining medium gaps; fix the WebSocket URL bug; add rate limiting; move files to object storage; configure SMTP; turn off demo seeding; add CI; deploy behind HTTPS; run AI analysis as a background job.

## Technical evaluators

**8. Why this technology stack?**
Next.js/React for a modern, typed UI with routing and middleware; FastAPI because Python has the best AI SDKs and document-parsing libraries (pypdf, python-docx, python-pptx), and FastAPI gives typed validation and OpenAPI docs for free; Neon for managed Postgres and managed authentication in one place, so we don't operate a database or an auth server ourselves.

**9. Why Postgres (Neon) instead of MongoDB or Firebase?**
The data is relational: users own projects, projects have analyses and documents, matches and intros link projects to investors, and rooms have messages. Postgres gives constraints, transactions, indexes and SQL, while JSONB still handles flexible nested data (scores, reasons, documents). Neon adds serverless scaling and branching (a separate copy of the database for testing) without operating servers.

**10. How does the frontend talk to the backend?**
Through one typed client (`frontend/lib/api.ts`). It gets a short-lived JWT from Neon Auth (`getApiToken`, cached until a minute before expiry), sends it as `Authorization: Bearer`, and retries once on a 401. Deal-room chat also opens a WebSocket (`/api/dealrooms/ws/{room}?token=`), with 5-second polling as a fallback.

**11. Why is the database accessed over HTTPS instead of a normal connection?**
Outbound port 5432 is blocked on the development machine, so `backend/app/database/postgres.py` uses Neon's SQL-over-HTTPS endpoint by default. A pooled TCP mode (`NEON_DB_TRANSPORT=tcp`, psycopg) exists and is the recommended setting in production, because HTTPS adds a round trip per query (e.g. a deal-room stage change takes ~3 s today).

**12. How is the API documented?**
FastAPI generates OpenAPI docs at `/docs` and `/redoc`. `DATABASE_AND_API_DOCUMENTATION.md` lists all 52 endpoints and the WebSocket, with their access rules.

**13. How is it tested?**
17 backend pytest tests (`backend/tests/`) cover health, project CRUD, publishing, data scoping, identity spoofing and the access-gap fixes, and clean up after themselves. An 86-check end-to-end script (real sign-ins for both roles, uploads, a live AI analysis, intro → deal room → WebSocket) passes, but it lives outside the repo for now. UI actions were click-tested with Playwright. There are no frontend unit tests or load tests yet.

## Software architects

**14. Describe the architecture.**
Three tiers: a Next.js client; a stateless FastAPI service with thin routes over a service layer (`backend/app/services/*`); Neon Postgres. Identity is external (Neon Auth). AI providers and GitHub are called from services. See `SYSTEM_ARCHITECTURE.md` for the diagrams.

**15. How does the application scale with more users?**
The backend is stateless except for WebSocket connections and local files. To scale out: pooled TCP database access, object storage for files, a shared message broker (e.g. Redis pub/sub) for live chat across instances, and AI analysis moved to a background queue. Neon scales the database compute automatically. Matching currently loops over up to 100 investors per project in Python, so it should move to batched SQL or a queue, and the 100 cap should go.

**16. What happens if an external API becomes unavailable?**
* **AI:** Gemini falls back to a second model on 429/503/timeout; otherwise the founder gets a clear error and keeps their previous report. There's no automatic switch to the rules engine on failure.
* **GitHub:** the analysis continues and notes that the repo couldn't be read.
* **Database:** the API returns 503 with a clear message. (The frontend sometimes shows built-in sample data on failures, a known issue to remove.)
* **Neon Auth:** no one can sign in, and existing tokens expire within ~15 minutes.
* **SMTP:** the email is written to a log instead of sent.

**17. How do real-time updates work?**
FastAPI WebSocket per room (token-verified, participants only) broadcasts new messages, typing and presence; the client also polls every 5 seconds. Bug to fix before deployment: when `NEXT_PUBLIC_API_URL` is set, the WebSocket URL gets a doubled `/api`, so it falls back to polling.

**18. Why is matching rule-based instead of ML?**
Explainability and predictability: every match states why on four factors (industry 40 %, stage 30 %, check size 20 %, business model 10 %), and both sides can trust and act on that. Embedding-based similarity is a possible enhancement; the placeholder modules in `services/ai/` show the intended direction but are not used.

**19. Why put the auth proxy on the Next.js server instead of calling Neon Auth directly from the browser?**
It keeps the session cookies first-party on our own domain (`frontend/app/api/auth/[...path]/route.ts`). That works with browsers' third-party-cookie restrictions and lets the middleware (`proxy.ts`) see the session to protect pages.

## Database engineers

**20. What does the schema look like?**
13 tables: `app_users`, `projects`, `founder_profiles`, `investor_profiles`, `investor_preferences`, `matches`, `project_interests`, `notifications`, `deal_rooms`, `deal_room_messages`, `deal_room_audit_logs`, `project_documents`, `project_analyses` (`backend/app/database/schema.sql`).

**21. How is referential integrity handled?**
Foreign keys with cascade on documents, analyses, messages and audit logs. Other links (ownership, matches, interests, rooms) are enforced in code, and some names and emails are copied for fast reads. We'd add more foreign keys and reduce the copying as the product matures.

**22. How are migrations handled?**
`schema.sql` is idempotent (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and is applied at every backend start. That's fine at this stage; production should use versioned migrations (e.g. Alembic) applied in CI, tested on a Neon branch first.

**23. How is SQL injection prevented?**
Every query uses parameter placeholders through `postgres.py`; `LIKE` searches are escaped with `escape_like`. There's no string-built SQL with user input.

**24. What indexes exist?**
Projects by founder and by published/created; matches by score and by investor; interests by founder+status and by investor; notifications by user and by role; rooms by founder, investor and interest; audit logs by room+time; documents and analyses by project+time.

## AI / ML evaluators

**25. How does the AI functionality actually work?**
`AnalysisService.analyze` gathers the project profile, uploaded documents (PDFs and images sent as files; DOCX/PPTX/TXT as extracted text) and a GitHub summary, then sends them to Gemini or Claude with a fixed system prompt and a strict JSON schema. The response is validated with Pydantic, scores are clamped and labelled, and the result is stored in `project_analyses` and mirrored onto the project (`backend/app/services/analysis_service.py`).

**26. Which models, and why?**
Gemini (`gemini-3.8-flash`, falling back to `gemini-3.5-flash-lite`) because it has a free tier; it's working today. Claude (`claude-opus-5-5`) is supported behind the same contract for higher-quality analysis; it's implemented but not yet tested live. The engine is chosen by configuration (`AI_PROVIDER`).

**27. How do you validate AI-generated results?**
Structurally: schema-constrained output, Pydantic validation, rejecting truncated answers, clamping scores. Content: the prompt requires citing materials and forbids invented facts, and the UI shows exactly which documents and repository were analysed. Not yet in place: an evaluation dataset, human review, or calibration between models. Scores are guidance, not a verdict.

**28. What prompt is used?**
A system prompt defining the analyst role, privacy and candour, a 0–100 rubric with bands (85+, 70–84, 50–69, <50), five dimensions, and the required strengths, gaps (with severity), ordered suggestions and domain-specific insights. Then a brief containing the project profile and GitHub summary. The full text is in `SYSTEM_PROMPT` and `_brief()`.

**29. What happens without an AI key?**
A rule-based engine scores topic coverage (e.g. TAM/SAM/SOM, pricing, CAC/LTV, pilots, LOIs, tests/CI in the repo) and produces the same report shape, clearly labelled "Rule-based check". New projects always get this instant baseline at no cost.

**30. Is founder data sent to third parties?**
Yes, to the configured AI provider when the founder runs an analysis. On Gemini's free tier, Google may use the inputs to improve its products; the UI warns founders about this. Paid tiers and Claude's API have different data terms, which should be reviewed before launch.

## Security reviewers

**31. How is user information protected?**
Passwords are handled only by Neon Auth; we never see them. API calls carry short-lived EdDSA JWTs verified against Neon's public keys (issuer, audience, algorithm pinned). Endpoints enforce roles and ownership; readiness reports are owner-only; a founder's email is shared only after they accept an intro; project materials are stored outside the web root and served through authorized endpoints.

**32. What security gaps exist today?**
From our own review (`SECURITY_AND_DEPLOYMENT.md` §3):
* **High (all three fixed, with regression tests):**
  * Notifications could be read without signing in. Now sign-in is required and you only see your own.
  * Private drafts were matched and announced to investors. Now only published projects are matched.
  * Deal-room uploads were downloadable by anyone with the link. Now they're stored privately and only the room's two members can download them.
* **Medium (still open):**
  * Anyone can list all matches and all investor profiles.
  * Published materials are downloadable without signing in.
  * There's no rate limiting, and any signed-in user can trigger a full match recomputation.
  * Demo-data exceptions remain in the access rules.

**33. How are tokens managed?**
Neon Auth sets HTTP-only `__Secure-` cookies. The frontend exchanges the cookie for a ~15-minute JWT, caches it until a minute before expiry, and clears it on sign-in, sign-out or a 401. The backend caches the signing keys (JWKS) for an hour. The WebSocket passes the token in the query string (a browser limitation), so query strings shouldn't be logged.

**34. Is there rate limiting or abuse protection?**
Neon Auth protects sign-in; our API has none. That's a must-add before launch, especially on `/analyze` (AI cost) and `/matches/recalculate`.

**35. How are secrets handled?**
In `.env.local` and `backend/.env`, both git-ignored; `backend/.env.example` lists the names. No secrets are in the repository or in this documentation. In production, they'd live in the host's secret store.

**36. Are the deal-room records tamper-proof?**
Tamper-evident, not tamper-proof. Each message stores a SHA-256 hash of the previous hash, sequence number, time, sender and content, computed inside the database insert, and every action is logged. That detects naive edits and makes exported transcripts verifiable. Someone with database write access could recompute the chain, though; stronger guarantees would need external anchoring or signing keys.
