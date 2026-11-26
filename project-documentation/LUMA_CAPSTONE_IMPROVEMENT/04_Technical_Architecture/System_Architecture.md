# System architecture

> Shared plan step 4: "Draw one architecture diagram of the product: screens, backend, database and any AI or outside services. Walk through it together."
>
> Everything here was checked against the repository on 27 Nov 2026. The report names the venture "Luma (V-02)". The code in this repo is **VentureX**, so this document describes VentureX. Confirm the venture name with the coordinator (Carry-forward register, item O-01).

The diagrams are written in Mermaid. They render on GitHub and in VS Code (with the Markdown Preview Mermaid Support extension), or you can paste them into https://mermaid.live. A rendered PNG of the overview is in `diagrams/1_architecture.png`.

## 1. The whole system on one page

```mermaid
flowchart LR
    subgraph Users["People (web browser)"]
        F[Founder]
        I[Investor]
        A[Admin]
    end

    subgraph FE["Frontend: Next.js 16 + React 19 + Tailwind 4 (frontend/)"]
        PX["proxy.ts<br/>sign-in redirect + security headers"]
        PG["Pages in app/<br/>founder/*, investor/*, dealroom/*, admin"]
        LIB["lib/api.ts<br/>every call to the backend"]
        AH["app/api/auth/*<br/>Neon Auth handler + /api/auth/token"]
    end

    subgraph BE["Backend: FastAPI + Pydantic v2 (backend/app/)"]
        RT["routes/<br/>15 modules, 143 endpoints under /api"]
        AU["core/auth.py<br/>verifies JWT, loads role"]
        SV["services/<br/>readiness, matching, intros,<br/>deal rooms, verification, notifications"]
        DB["database/postgres.py<br/>queries, retries, DNS fallback"]
    end

    subgraph Data["Storage"]
        PGDB[("Neon PostgreSQL<br/>29 tables (schema.sql)")]
        DISK[("private_uploads/<br/>decks, deal-room files, photos")]
    end

    subgraph Ext["Outside services"]
        NA["Neon Auth<br/>(Better Auth)"]
        AI["Claude → Gemini<br/>(readiness AI)"]
        GH["GitHub API<br/>(reads public repo)"]
        SM["SMTP email<br/>(not set up: writes to logs/emails.log)"]
    end

    F & I & A --> PX --> PG --> LIB
    PG --> AH --> NA
    LIB -- "HTTPS + Bearer JWT (JSON)" --> RT
    LIB -. "WebSocket (deal-room chat)" .-> RT
    RT --> AU
    AU -. "public keys (JWKS)" .-> NA
    RT --> SV --> DB -- "HTTPS SQL endpoint" --> PGDB
    SV --> DISK
    SV --> AI
    SV --> GH
    SV --> SM
```

## 2. What each box is responsible for

| Box | Responsibility | Where it lives |
|---|---|---|
| Founder / Investor / Admin | People using a browser. They never touch the database directly. | n/a |
| `proxy.ts` | Runs before every page. Sends signed-out users to `/login` and sets the Content Security Policy. | `frontend/proxy.ts` |
| Pages | One folder per web address, e.g. `/investor/discover` is `app/investor/discover/page.tsx`. | `frontend/app/` |
| `lib/api.ts` | The single place that calls the backend. Adds the token, turns errors into messages. | `frontend/lib/api.ts` |
| Neon Auth handler | Sign-up, sign-in, sessions. Passwords are checked by Neon Auth, never by our code. `/api/auth/token` gives the browser a short-lived JWT. | `frontend/app/api/auth/` |
| Routes | Receive requests, validate input with Pydantic (bad input returns 422), call a service. | `backend/app/routes/` |
| `core/auth.py` | Verifies the JWT signature with Neon's public keys, loads `role` and `is_admin` from `app_users`, provides `require_founder`, `require_investor`, `require_admin`. | `backend/app/core/auth.py` |
| Services | The business rules. Readiness (`analysis_service.py`), matching (`match_service.py`), intro gate (`founder_outreach_service.py`), deal rooms (`deal_room_service.py`), verification, notifications. | `backend/app/services/` |
| `postgres.py` | Sends SQL to Neon over HTTPS (port 5432 is blocked on our network), retries short connection failures. | `backend/app/database/postgres.py` |
| Neon PostgreSQL | All data: 29 tables. The schema is applied when the API starts. | `backend/app/database/schema.sql` |
| Private disk | Uploaded files. Never served publicly; downloads go through the API with an access check. | `backend/private_uploads/` |
| Claude / Gemini | Readiness reports only. Claude if `ANTHROPIC_API_KEY` is set, else Gemini if `GEMINI_API_KEY` is set, else a rule-based check. Matching never uses AI. | `backend/app/services/ai/` |
| GitHub API | Reads a startup's public repository as extra input to readiness. | `backend/app/services/github_service.py` |
| SMTP | Notification emails. **Not configured yet**: emails are written to `backend/logs/emails.log`. In-app notifications work. | `backend/app/services/email_service.py` |

## 3. Frontend structure

```mermaid
flowchart TB
    L["app/layout.tsx (root)"] --> P["/ (landing)"]
    L --> LG["/login, /register, /forgot-password"]
    L --> FO["/founder/*<br/>dashboard, projects, investors,<br/>profile, settings, updates"]
    L --> IN["/investor/*<br/>dashboard, discover, deal-flow, preferences,<br/>portfolio, allocations, projects, verification,<br/>profile, settings"]
    L --> DR["/dealroom/[id]"]
    L --> AD["/admin"]
    FO & IN --> PL["components/PortalLayout.tsx<br/>sidebar + role check"]
    FO & IN & DR & AD --> API["lib/api.ts"]
    DR --> WS["WebSocket client inside<br/>app/dealroom/[id]/page.tsx"]
```

The investor Firm and Company updates pages were removed in Nov 2026; `/investor/firm` and `/investor/updates` redirect to the dashboard (`next.config.ts`).

## 4. Backend layers

```mermaid
flowchart LR
    REQ[HTTP request] --> MW["main.py<br/>CORS, security headers,<br/>error handlers"]
    MW --> R["routes/*.py<br/>Pydantic models (schemas/)"]
    R --> DEP["Depends(require_*)<br/>core/auth.py"]
    DEP --> S["services/*.py<br/>business rules + ownership checks"]
    S --> Q["database/postgres.py<br/>parameterised SQL (%s)"]
    Q --> N[(Neon)]
    S --> RESP[JSON response]
```

Rule of thumb when reading the code: the route says **who** may call it and **what shape** the data has; the service says **what happens**.

## 5. AI integration

```mermaid
flowchart TD
    BTN["Founder clicks Re-analyze<br/>POST /api/projects/{id}/analyze"] --> COL["Collect inputs: profile, documents,<br/>GitHub repo, demo link"]
    COL --> K1{ANTHROPIC_API_KEY set?}
    K1 -- yes --> CL[Claude]
    K1 -- no --> K2{GEMINI_API_KEY set?}
    K2 -- yes --> GE["Gemini (our current setup,<br/>free tier)"]
    K2 -- no --> RB[Rule-based check]
    CL & GE --> VAL{"Output matches the<br/>fixed Pydantic schema?"}
    VAL -- no --> ERR[Clear error; last report kept]
    VAL -- yes --> SAVE[(project_analyses<br/>+ projects.readiness_score)]
    RB --> SAVE
```

When a project is first saved, only the free rule-based check runs (no AI call). The AI path for Claude has not been tested with a real key (Carry-forward register, O-09).

## 6. Implemented vs planned

| Implemented and tested | Planned / not built |
|---|---|
| Sign-up and sign-in (Neon Auth), roles, admin | Real email sending (SMTP) |
| Startup profiles, documents, publish | Public deployment (Render blueprint exists, not live) |
| Readiness report (rules + Gemini) | Payments / pricing |
| Rule-based matching with reasons | NDA as a legal e-signature (today: a recorded click) |
| Intro requests with readiness ≥ 50 gate and daily limit | Live chat across several servers (needs Redis) |
| Deal rooms: chat (WebSocket), NDA click, files, audit log | Automated first check for investor verification |
| Investor verification by an admin | |
| 120 backend tests, 89 API flow checks, 7 browser suites | |

## Walk-through checklist (both founders)

- [ ] Nitya draws section 1 from memory and explains every box to Anshitha.
- [ ] Anshitha explains the same diagram back, without notes.
- [ ] Any box either of us can't explain is circled and studied before the next feature is added.
