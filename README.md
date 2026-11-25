# VentureX

**Get investor-ready. Meet investors who fit.**

VentureX is an AI-powered startup readiness and investor matching platform for early-stage founders and investors in India. Founders find out how investor-ready their startup is and which investors actually fit them. Investors see startups that match their own investment thesis, with a plain-language reason for every match. When both sides agree, a private deal room opens.

Built as a capstone project by **Anshitha Yeruva** and **Nitya Nara**.

---

## What it does

### For founders
- **Startup profile:** problem, solution, market, business model, traction, team and the funding being raised.
- **Materials:** upload a pitch deck and supporting documents (PDF, PPTX, DOCX, images) and link a public GitHub repository and demo.
- **AI readiness report** (private to the founder): an overall score and five scored areas (problem/solution fit, market sizing and competition, business model clarity, traction and validation, product and technology), with strengths, gaps by severity, prioritised fixes and industry insights.
- **Find investors:** investors ranked by how well the startup meets each investor's own criteria, with the reasons.
- **Intro requests:** unlocked once a published project reaches readiness 50. Investors answer *Interested* or *Pass* with a reason; unanswered requests expire after 14 days.
- **Company verification:** by a code sent to a company email address, or a registration number (GSTIN or CIN) reviewed by an admin.
- **Funding rounds:** track committed and received capital per investor, with agreed or indicative ownership.
- **Investor updates and team accounts** (invite co-founders).

### For investors
- **Investment criteria:** sectors, stages, cheque size, geography, traction, team and more, plus how much each criterion matters (High, Medium, Low or Ignore).
- **Discover:** startups ranked by fit, starting from the saved criteria, with filters for sector, stage, round status and ticket size.
- **Fit with reasons:** every match explains itself criterion by criterion.
- **Verification:** investors submit their LinkedIn and firm website (past investments are optional); an admin approves them before they can contact founders.
- **Deal flow, portfolio and finances** (with CSV import and export), **company updates** and **firm (team) accounts**.

### Shared
- **Private deal rooms:** real-time chat, NDA signing, shared documents, deal stage, funding round and an audit log. They open only when the founder accepts an intro.
- **Notifications** in the app and by email, respecting each user's settings.
- **Profiles and settings:** privacy, notification preferences, display preferences, password and active sessions.
- **Admin review** at `/admin` for investor and company verification.

---

## How matching works

Matching uses transparent, weighted rules, not a black box. Each criterion is scored from 0 to 100, then weighted by the investor's own priorities (High = 3, Medium = 2, Low = 1, Ignore = 0). The fit score is the weighted average, and every criterion returns a plain-language reason. Hard exclusions (an excluded industry or country, or unmet required traction) remove a startup entirely, and fits below 45% aren't recommended. The logic is in `backend/app/services/match_service.py`.

## How the readiness report works

The report uses **Anthropic Claude** if `ANTHROPIC_API_KEY` is set, otherwise **Google Gemini** if `GEMINI_API_KEY` is set (with fallback models when one is busy), otherwise a transparent **rule-based check**. AI output must match a fixed schema or it's rejected. A quick rule-based check runs when a project is created; founders click **Re-analyze** for the AI report. The logic is in `backend/app/services/analysis_service.py`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript |
| Backend | Python, FastAPI, Pydantic v2 |
| Database | Neon PostgreSQL (29 tables), reached over Neon's HTTPS SQL endpoint by default (psycopg over TCP also supported) |
| Authentication | Neon Auth (Better Auth); the API verifies signed JWTs against Neon Auth's published keys |
| AI | Anthropic Claude or Google Gemini, with a rule-based fallback |
| Integrations | GitHub API (repository intake), SMTP email (written to `backend/logs/emails.log` until configured) |
| Testing | pytest (backend), Playwright (browser end-to-end) |
| Deployment | Docker, Render blueprint (`render.yaml`), GitHub Actions CI |

## Project structure

```
VentureX/
├── backend/            FastAPI API
│   ├── app/
│   │   ├── routes/     API endpoints (projects, investors, founders, interests, dealrooms, funding, verification, ...)
│   │   ├── services/   Business logic (matching, readiness analysis, deal rooms, funding, notifications, ...)
│   │   ├── schemas/    Request and response models
│   │   ├── core/       Settings and authentication
│   │   └── database/   Postgres access and schema.sql (applied automatically at startup)
│   └── tests/          pytest suite
├── frontend/           Next.js web app
│   ├── app/            Pages: founder/, investor/, dealroom/, admin/, login, register, ...
│   ├── components/     Shared UI
│   └── lib/            API client and helpers
├── e2e/                End-to-end API flow and Playwright browser suites
├── documentation/      Problem statement, limitations and future scope, interview notes, final deck
├── docs/               Frontend-to-backend API mapping
├── render.yaml         Render deployment blueprint
└── .github/workflows/  CI (type check, build, backend tests, Docker images)
```

---

## Running it locally

### 1. Requirements
- **Python 3.12+**
- **Node.js 20+**
- A **Neon** project with Neon Auth enabled (database and sign-in)

### 2. Settings files

These hold secrets and are **not in git**. Create them from the examples, or get them privately from a teammate. Never share them on GitHub or in public chats.

| File | What it holds |
|---|---|
| `.env.local` (repo root) | `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` (written by `neon env pull`) |
| `backend/.env` | App settings: AI keys, `ADMIN_EMAILS`, optional SMTP. See `backend/.env.example` |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`. See `frontend/.env.example` |

### 3. Install (once)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
cd ..\frontend
npm install
cd ..
```

On macOS or Linux, use `.venv/bin/pip` instead.

### 4. Start

```powershell
npm run dev:all
```

This starts the API on **http://localhost:8000** (health check: `/api/health`) and the web app on **http://localhost:3000**. Open the site at exactly `http://localhost:3000`, since Neon Auth only accepts trusted addresses.

To start them separately: `npm run backend` and `npm run dev`.

### 5. Admin access

Admins review investor and company verification at **http://localhost:3000/admin**, or from the profile menu under **Admin review**. To make someone an admin, add their email to `ADMIN_EMAILS` in `backend/.env` (comma-separated; the email must be verified in Neon Auth) and restart the API, or set `is_admin = true` for their row in the `app_users` table.

---

## Tests

| Suite | Command | Needs |
|---|---|---|
| Backend (120 tests) | `cd backend; .venv\Scripts\python -m pytest -q` | Database settings |
| Full API flow (89 checks) | `backend\.venv\Scripts\python e2e\api_flow.py` | API and web app running |
| Browser suites (7) | `python e2e\<suite>_ui.py` (e.g. `founder_outreach_ui.py`) | API and web app running, Playwright installed (`pip install -r e2e/requirements.txt`, then `playwright install chromium`) |
| Frontend type check | `cd frontend; npx tsc --noEmit` | none |

The end-to-end suites sign in with **throwaway test accounts** set as `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_INVESTOR_EMAIL` and `E2E_INVESTOR_PASSWORD` in `backend/.env`. They clean up the data they create.

The browser suites are: founder outreach, investor portal, verification, investor updates, teams, profiles and funding, and portfolio CSV.

---

## Deployment

`render.yaml` deploys the API and web app as two Docker services on Render, with a persistent disk for uploaded decks and deal-room files. Secrets are entered in Render, never committed. After the first deploy, add the web app's URL to the API's `CORS_ORIGINS` and `PUBLIC_APP_URL`, set the web app's `NEXT_PUBLIC_API_URL`, and add both URLs as trusted domains in Neon Auth.

CI (GitHub Actions) type-checks and builds the frontend, runs the backend tests when a `CI_DATABASE_URL` secret is set, and builds both Docker images.

---

## Status

The product is working end to end and covered by automated tests. It is not yet deployed publicly. What we haven't built yet, and where we're taking it next, is in `documentation/Current Limitations and Future Scope.docx`.

## Documentation

The `documentation/` folder holds:
- `Problem Statement.docx`
- `Current Limitations and Future Scope.docx`
- `Interview Notes.xlsx`: our field interviews with founders, an incubator coordinator and an investor
- `VentureX_Capstone_Deck_final.pdf`: the capstone presentation

## Team

- **Anshitha Yeruva**
- **Nitya Nara**
