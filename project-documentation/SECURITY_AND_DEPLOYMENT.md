# Security, Reliability and Deployment

This document separates **implemented**, **partially implemented** and **missing** controls, with code evidence. It does not claim the system is secure; several gaps must be fixed before real users rely on it (section 3).

## 1. Security controls that are implemented

| Area | What exists | Evidence |
| --- | --- | --- |
| **Authentication** | Neon Auth (managed Better Auth): email + password sign-up and sign-in, sessions, password reset with an emailed 6-digit code (codes stored hashed by Neon). Our backend never receives or stores passwords. | `frontend/lib/auth/*`, `frontend/app/api/auth/[...path]/route.ts`, `neon.ts` |
| **Session cookies** | `__Secure-neon-auth.*` HTTP-only cookies, kept only on `https://` or `http://localhost`. The app detects and explains a dropped cookie. | `frontend/lib/auth/client.ts::insecureOriginWarning`, `sessionWasKept` |
| **Token management** | Short-lived EdDSA JWTs (~15 min). The frontend caches the token until 60 s before expiry, clears it on sign-in/sign-out/401, and retries once on 401. | `frontend/lib/auth/client.ts::getApiToken`, `lib/api.ts::apiFetch` |
| **Token verification** | Signature checked against Neon Auth's JWKS (cached 1 h), algorithm pinned to EdDSA, issuer and audience verified, 10 s clock leeway. Tampered tokens → 401 (covered by tests). | `backend/app/core/auth.py::_decode`, `verify_token` |
| **Authorization (roles)** | `require_user`, `require_founder`, `require_investor` dependencies; the role is fixed after onboarding (409 on change). | `core/auth.py`, `routes/auth.py` |
| **Authorization (ownership)** | Founders can only edit, publish, analyze or upload to their own projects (`_owned_project`). Readiness reports are private (`_private_report_project` → 404). Intro accept/decline only by the project's founder. Deal rooms only for their two participants (`_require_participant`, including the WebSocket). Notifications can only be marked read by their owner. | `routes/projects.py`, `routes/interests.py`, `routes/dealrooms.py`, `routes/notifications.py` |
| **Identity spoofing prevention** | The sender, signer and investor ids sent by the client are ignored and replaced with the token's identity. | `routes/dealrooms.py::_as_sender`, `routes/interests.py` (tests: "spoofed id ignored") |
| **Contact privacy** | A founder's email is hidden from the investor until the intro is accepted; only real details are shared on acceptance. | `routes/interests.py::list_interests`, `services/interest_service.py` |
| **SQL injection** | All queries are parameterized; `LIKE` input is escaped. | `database/postgres.py` (`%s` placeholders, `escape_like`) |
| **Input validation** | Pydantic models on every request body; query-parameter bounds (e.g. `limit ≤ 100`). | `backend/app/schemas/*`, route signatures |
| **File upload validation (project materials and deal-room files)** | Extension allow-list, 25 MB per file, 20 files per project, sanitized names, stored **outside** the web root (`private_uploads/`), downloads go through authorized endpoints (project owner / published; deal-room files: the room's two participants only). | `services/document_service.py`, `services/dealroom_files.py` |
| **Message integrity** | SHA-256 hash chain over deal-room messages, computed inside the INSERT statement, plus an audit log of room events; transcripts can be exported. | `services/deal_room_service.py` |
| **SSRF avoidance** | GitHub repos are read through the GitHub API (owner/repo parsed by regex), never by fetching a user-supplied URL; demo links are not opened. | `services/github_service.py`, `analysis_service.py::_brief` |
| **Secrets handling** | Keys live in `.env.local` / `backend/.env`, which git ignores; `backend/.env.example` documents the variable names. | `.gitignore`, `backend/.gitignore`, `core/config.py` |
| **Error handling** | Database outage → 503 with a clear message (`DatabaseUnavailable` handler); AI errors are mapped to specific messages; the UI shows errors instead of blank screens. | `main.py`, `analysis_service.py` |
| **CORS** | Allow-list from `CORS_ORIGINS` (default `http://localhost:3000`). | `main.py`, `core/config.py` |
| **Route protection (UI)** | Signed-out visitors to `/founder`, `/investor` and `/dealroom` are redirected to `/login`. | `frontend/proxy.ts` |

## 2. Partially implemented

| Area | State |
| --- | --- |
| **Email** | SMTP sending is coded, but no SMTP server is configured, so emails are written to `backend/logs/emails.log` instead of being sent. Auth emails (reset codes) use Neon's shared sender, which the Neon docs say is not for production. |
| **NDA** | A click-to-sign record with timestamp and name; not a legally executed e-signature. |
| **Audit integrity** | Hashes detect accidental or naive edits, but anyone with database write access could recompute the chain. There's no external anchoring or signing key. |
| **User settings** | Saved, but not enforced (e.g. "Keep new projects private", email toggles). |
| **Data validation of AI output** | Schema-validated, but there's no automated evaluation of content quality. |

## 3. Gaps found during this review

**Update:** the three high-severity gaps (S1–S3) are fixed on branch `fix/access-gaps` (commit 4376956), with regression tests in `backend/tests/test_access_gaps.py`. They are kept below, marked Fixed, for the record. S4–S12 remain open.

Severity is our judgement for a production launch.

| # | Severity | Gap | Evidence | Fix |
| --- | --- | --- | --- | --- |
| S1 | **High → Fixed** | **Was:** anyone could read any user's notifications. The read endpoints worked without a token and trusted `?user_id=` / `?role=`, and notifications contain names, project titles and the first 80 characters of deal-room messages. **Now:** both endpoints require sign-in and only ever return the caller's own notifications; those query parameters are ignored. | Before: `routes/notifications.py::_scope`. Fix: `routes/notifications.py` | Done (commit 4376956); tests in `backend/tests/test_access_gaps.py` |
| S2 | **High → Fixed** | **Was:** private drafts were matched, a fit of 90%+ notified the investor with the draft's title, and draft matches appeared in `GET /matches`. **Now:** unpublished projects are never matched (unpublishing withdraws matches); investor recomputation and `GET /matches` only include published projects. | Before: `match_service.py::compute_matches_for_project` had no `is_published` check. Fix: same file | Done (commit 4376956); tests in `backend/tests/test_access_gaps.py` |
| S3 | **High → Fixed** | **Was:** deal-room uploads went through `POST /api/upload` into `backend/uploads/`, which was served publicly at `/uploads/...`, so anyone with the link could download them. **Now:** files go through `POST /api/dealrooms/{room}/files`, are stored in `private_uploads/dealrooms/`, and download only for the room's two participants; the public folder and `/api/upload` were removed; shared links must be http(s). | Before: `main.py` static mount, `storage_service.py` (deleted). Fix: `services/dealroom_files.py`, `routes/dealrooms.py` | Done (commit 4376956); tests in `backend/tests/test_access_gaps.py` |
| S4 | Medium | **Anonymous `GET /api/matches` returns every match for published projects** (investor names, firms, project titles, scores). | `routes/matches.py` ("anonymous demo browsing sees all") | Require sign-in. |
| S5 | Medium | **`GET /api/investors` is public** and lists every investor profile (name, firm, thesis, check sizes). | `routes/investors.py::list_investors` | Require sign-in or remove the endpoint. |
| S6 | Medium | **Published projects' materials are downloadable without signing in.** Probably intended for investors, but they are effectively public on the internet. | `routes/projects.py::_readable_project` | Require a signed-in investor (or the owner). |
| S7 | Medium | **No rate limiting** anywhere (sign-in is protected by Neon Auth, but our API isn't). `POST /matches/recalculate` lets any signed-in user trigger a full recomputation, and `/analyze` can be called repeatedly (AI cost). | no limiter in the codebase | Add per-user limits (e.g. middleware or an edge/gateway layer); restrict `recalculate` to admins. |
| S8 | Medium | **Demo-data exceptions in access rules.** Projects owned by `founder-001` have public drafts and public readiness reports, and demo data is seeded into the production database at every start. | `routes/projects.py` (`DEMO_FOUNDER_ID`), `seed.py`, `main.py` lifespan | Turn off seeding in production; remove the exceptions. |
| S9 | Low | **Silent sample-data fallback in the frontend.** Several API helpers return built-in sample data (`MOCK_MATCHES`, `localProjects`, …) when a request fails, which can hide outages and show fake content. | `frontend/lib/api.ts` | Show an error state instead. |
| S10 | Low | **Error details leak** in some 500 responses (`detail=f"... {str(e)}"`). | `routes/dealrooms.py` | Log details, return a generic message. |
| S11 | Low | **WebSocket token in the query string** (a browser limitation). It may appear in server logs. | `routes/dealrooms.py` | Keep tokens short-lived (they are); avoid logging query strings, or use a one-time ticket. |
| S12 | Low | **No security headers** configured (CSP, HSTS, frame options). | `frontend/next.config.ts`, `main.py` | Add them at the host or in middleware. |

Not found: password storage in our code (delegated to Neon Auth, good); string-built SQL (good).

## 4. Data privacy summary

| Data | Who can see it today |
| --- | --- |
| Readiness scores, gaps, suggestions | Only the owning founder (correct). |
| Draft (unpublished) project | Only the owner (S2 fixed: drafts are no longer matched or announced). |
| Published project + materials | Any investor, and **anyone with the API URL (S6)**. |
| Founder email | The investor, only after the intro is accepted (correct). |
| Deal-room messages | The two participants (S1 fixed: notifications are private to their owner). |
| Deal-room uploaded files | Only the room's two participants (S3 fixed). |
| Investor profiles | **Anyone (S5).** |

---

## 5. Deployment and infrastructure

### Current state (what actually runs)

| Piece | Where it runs | Status |
| --- | --- | --- |
| Frontend (Next.js) | Developer machine, `npm run dev` → `localhost:3000` | **Local only** |
| Backend (FastAPI) | Developer machine, `uvicorn app.main:app --port 8000 --loop asyncio:SelectorEventLoop` | **Local only** |
| Database | Neon Lakebase Postgres, branch `production`, AWS us-west-2 | **Hosted** |
| Auth | Neon Auth on the same Neon project and branch | **Hosted** |
| AI | Google Gemini API (free tier); Anthropic API if a key is added | **Hosted (third party)** |
| Files | Backend local disk (`private_uploads/`) | **Local only** |
| Email | Not sending (log file) | **Not configured** |
| CI/CD | None | **Not set up** |

### Environment configuration

The backend reads `../.env.local` (Neon values written by the Neon tooling) and then `backend/.env` (`core/config.py`). Variable **names** (never commit values):

* Database: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_DB_TRANSPORT` (`https` default, or `tcp`), `NEON_BRANCH`
* Auth: `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` (backend); `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (frontend, `frontend/lib/auth/server.ts`)
* AI: `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `GEMINI_TIMEOUT_SECONDS`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`
* Integrations: `GITHUB_TOKEN` (optional), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
* Web: `CORS_ORIGINS`; frontend `NEXT_PUBLIC_API_URL` (backend base URL **including** `/api`, default `http://localhost:8000/api`). **Known bug:** the deal-room WebSocket URL is built as `{NEXT_PUBLIC_API_URL without scheme}/api/dealrooms/ws/...`, so setting this variable produces `/api/api/...` and live chat silently falls back to 5-second polling. Fix before deploying (`frontend/app/dealroom/[id]/page.tsx`).

### Build process

* Frontend: `npm --prefix frontend run build` (Next.js production build; currently passes).
* Backend: no build step; `pip install -r backend/requirements.txt`; schema applied automatically at startup.
* Container: `backend/Dockerfile` (Python 3.11-slim, installs requirements, runs uvicorn on port 8000). Written, **never used for a deployment**; note that it targets Python 3.11 while development uses 3.13.

### Moving to production (recommended path, not yet done)

1. **S1–S3 are fixed** (fixed on branch `fix/access-gaps` (commit 4376956)); fix S4–S8 next.
2. **Files → object storage** (S3 / Cloudflare R2); Neon Object Storage isn't available in us-west-2. Local disk is lost on container restarts and can't be shared between instances.
3. **Backend** → a container host (Render, Railway, Fly.io, AWS) from `backend/Dockerfile`; set environment variables; restrict `CORS_ORIGINS`.
4. **Frontend** → Vercel (or similar); set `NEXT_PUBLIC_API_URL`; HTTPS is required for the secure cookies.
5. **Neon Auth:** add the production domain to trusted domains; configure **custom SMTP** for auth emails.
6. **Neon:** create a separate development branch for tests and demos; disable demo seeding in production.
7. **CI:** run lint, type-check, build and pytest on every push; add the end-to-end suite (it currently lives outside the repo).
8. **Observability:** structured logs, error tracking, uptime checks.

### Reliability notes

* **Database transport:** SQL-over-HTTPS adds one network round trip per query. Simple pages are fine, but multi-step writes (e.g. a deal-room stage change: update, system message, audit, notification) take about 3 s. Production on a normal network should use the pooled TCP transport (`NEON_DB_TRANSPORT=tcp`).
* **Real-time chat:** a WebSocket with a 5 s polling fallback. Connections are held in the memory of one backend process, so several instances would need a shared broker (e.g. Redis pub/sub) to deliver live messages across them.
* **AI calls:** synchronous within the HTTP request (1–3 minutes). Behind a hosting proxy with a short timeout, these should move to a background job with polling.
