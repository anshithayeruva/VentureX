# VentureX — Project Overview

> Part of the `project-documentation/` set. Every statement here was checked against the source code on branch `feat/real-user-data` (November 2026). File paths are given as evidence. Nothing in this folder changes the application.

## 1. What VentureX is, in one paragraph

VentureX is a web platform for **early-stage startup founders** and **investors**. Founders describe their startup, upload their pitch deck and other materials, link their GitHub repository, and receive a **private, AI-generated investment-readiness report**: a score, per-area scores, strengths, gaps and concrete suggestions. When they choose to, founders **publish** the project. Investors set their **investment criteria** (industries, stages, check size, business models) and see published startups **ranked by fit, with the reasons spelled out**. An investor can **request an intro**. If the founder accepts, a **private deal room** opens for the two of them, with real-time chat, a mutual NDA step, document sharing, deal-stage tracking and a downloadable record.

## 2. Who it is for

| User | What they get |
| --- | --- |
| **Founder** | Honest, private feedback before pitching; control over when investors see the project; inbound intro requests only from investors whose criteria fit; a private room to run diligence. |
| **Investor** | A shortlist of published startups that fit their criteria, with an explanation per match; one-click intro requests; a private room per startup once the founder accepts. |

There are exactly two roles (`FOUNDER`, `INVESTOR`). A role is chosen at sign-up and cannot be changed afterwards (`backend/app/routes/auth.py`, `POST /api/me` returns 409 on a role change).

## 3. How it is built (short version)

```
Browser ──► Next.js 16 frontend (React 19, Tailwind 4)
               │  sign-in / sessions ──► Neon Auth (managed Better Auth)
               │  JSON + JWT ──────────► FastAPI backend (Python 3.13)
                                            │──► Neon Lakebase Postgres (SQL over HTTPS)
                                            │──► Google Gemini or Anthropic Claude (readiness analysis)
                                            │──► GitHub REST API (public repo facts)
                                            └──► Local disk (uploaded documents)
```

* **Frontend:** `frontend/` — Next.js App Router pages, one shared design system (`frontend/components/ui.tsx`).
* **Backend:** `backend/app/` — FastAPI routes → services → Postgres helper (`backend/app/database/postgres.py`).
* **Identity:** Neon Auth issues sessions (browser cookies) and short-lived EdDSA JWTs that the backend verifies (`backend/app/core/auth.py`).
* **AI:** one readiness-analysis service with three interchangeable engines: Claude, Gemini, or a transparent rule-based fallback (`backend/app/services/analysis_service.py`).
* **Matching:** a weighted, explainable **rule-based** scorer (`backend/app/services/match_service.py`). It does **not** use embeddings or vector search (see the AI document).

## 4. Current status at a glance

| Area | Status |
| --- | --- |
| Sign-up, sign-in, sign-out, password reset (emailed code) | Working (Neon Auth) |
| Role onboarding and role-based access | Working |
| Project create / edit / publish | Working (no delete yet) |
| Document upload and text extraction (PDF, DOCX, PPTX, TXT, MD, CSV, images) | Working |
| AI readiness analysis (Gemini) | Working, verified live |
| AI readiness analysis (Claude) | Implemented, **not yet tested live** (no API key configured) |
| Rule-based readiness baseline | Working (runs on every new project) |
| Investor criteria and explainable matching | Working (rule-based) |
| Intro requests, accept / decline | Working |
| Deal rooms: chat (WebSocket + polling), NDA, stages, documents, activity, PDF / JSON export | Working |
| In-app notifications | Working |
| Transactional email (intro / deal-room alerts) | Code present; **not sending** (no SMTP configured; writes to a local log) |
| Deployment | **Not deployed.** Runs locally; database and auth are hosted on Neon. |

The full status table, with evidence, is in `IMPLEMENTATION_STATUS_AND_GAP_ANALYSIS.md`.

## 5. Repository map

| Path | What lives there |
| --- | --- |
| `frontend/app/` | Pages: landing `/`, `/login`, `/register`, `/forgot-password`, `/founder/*`, `/investor/*`, `/dealroom/*`, and the auth proxy route `api/auth/[...path]` |
| `frontend/components/` | Shared UI: `ui.tsx` (design system), `PortalLayout.tsx` (workspace shell), `ProjectForm.tsx`, `ProjectIntelligence.tsx` (materials + readiness), `Navbar`, `Footer`, `BrandMark` |
| `frontend/lib/` | `api.ts` (typed API client), `auth/` (Neon Auth client/server), `format.ts`, `dealroom.ts` |
| `frontend/proxy.ts` | Middleware that sends signed-out visitors of `/founder`, `/investor`, `/dealroom` to `/login` |
| `backend/app/main.py` | FastAPI app, CORS, startup (schema + demo seed) |
| `backend/app/routes/` | 9 routers, 52 HTTP endpoints under `/api` + 1 WebSocket |
| `backend/app/services/` | Business logic: projects, analysis, documents, GitHub, matching, interests, deal rooms, notifications, email, storage |
| `backend/app/services/ai/` | **Unused placeholder modules** (embeddings / matching / analysis stubs that return mock data; nothing imports them) |
| `backend/app/database/` | `schema.sql` (13 tables), `postgres.py` (HTTPS/TCP driver), `seed.py` (demo data) |
| `backend/tests/` | 17 pytest API tests (incl. access-gap regression tests) |
| `neon.ts` | Neon service config (`auth: true`) |
| `backend/Dockerfile` | Container recipe for the backend (not yet used for a deployment) |
| `docs/frontend-backend-mapping.md` | Earlier mapping notes |

## 6. How to read this documentation set

| File | Read it when you need… |
| --- | --- |
| `COMPLETE_TECH_STACK.md` | every technology, version, and why it's there |
| `FEATURE_BY_FEATURE_ANALYSIS.md` | how each feature works end to end |
| `SYSTEM_ARCHITECTURE.md` | diagrams of components, data flow and auth |
| `DATABASE_AND_API_DOCUMENTATION.md` | tables, relationships and every endpoint |
| `AI_IMPLEMENTATION_ANALYSIS.md` | exactly what the AI does, and what is rule-based |
| `SECURITY_AND_DEPLOYMENT.md` | what is protected, what isn't, and how it would ship |
| `BUSINESS_VALUE_AND_USE_CASES.md` | the pitch: problem, solution, value |
| `IMPLEMENTATION_STATUS_AND_GAP_ANALYSIS.md` | honest status, bugs, debt, next steps |
| `CLIENT_PRESENTATION_GUIDE.md` | slide-by-slide script |
| `CLIENT_AND_TECHNICAL_QA.md` | 36 likely questions with answers |
