# System Architecture

All diagrams are Mermaid (they render on GitHub and in most Markdown viewers). Each is followed by a plain-language explanation.

## 1. High-level architecture

```mermaid
flowchart LR
    U[Founder / Investor<br/>in a browser]
    subgraph FE[Next.js 16 frontend]
        P[Pages & components<br/>React 19 + Tailwind]
        MW[proxy.ts middleware<br/>protects /founder /investor /dealroom]
        AP[/api/auth/* proxy route/]
    end
    subgraph BE[FastAPI backend]
        R[Routes /api/*<br/>+ WebSocket]
        S[Services<br/>business logic]
        DB[(postgres.py<br/>SQL over HTTPS)]
        FS[(Local disk<br/>private_uploads)]
    end
    NA[Neon Auth<br/>managed Better Auth]
    PG[(Neon Lakebase Postgres<br/>AWS us-west-2)]
    AI[Gemini API / Claude API]
    GH[GitHub REST API]
    SMTP[SMTP server<br/>optional, not configured]

    U --> P
    U -. cookies .-> MW
    P --> AP --> NA
    P -- JSON + Bearer JWT --> R
    P -- WebSocket ?token= --> R
    R --> S --> DB --> PG
    S --> FS
    S --> AI
    S --> GH
    S -.-> SMTP
    R -- verifies JWT via JWKS --> NA
```

**In plain terms:** people use the website. Signing in is handled by Neon Auth through a small proxy route on the website, so the session cookie stays on our own domain. Every data request goes to the FastAPI server with a short-lived token. The server checks the token with Neon Auth's public keys, applies the business rules, and reads or writes the Neon Postgres database. For readiness reports, it also calls an AI model and GitHub. Uploaded files sit on the server's disk.

## 2. Component interaction (frontend ↔ backend)

```mermaid
flowchart TB
    subgraph Frontend
        Shell[PortalLayout<br/>sidebar + top bar]
        FD[founder/dashboard<br/>overview, projects, readiness,<br/>investors, intros, notifications, profile, settings]
        ID[investor/dashboard<br/>overview, recommended, browse,<br/>interests, notifications, profile, settings]
        PF[ProjectForm<br/>new / edit]
        PI[ProjectIntelligence<br/>materials + readiness]
        PREF[investor/preferences]
        IP[investor/projects/id]
        DR[dealroom list + room]
        API[lib/api.ts<br/>typed client, token, 401 retry]
    end
    subgraph Backend routes
        ME[/me/]
        PROJ[/projects/]
        INV[/investors/]
        FOU[/founders/]
        MAT[/matches/]
        INT[/interests/]
        NOT[/notifications/]
        DRR[/dealrooms + ws/]
    end
    subgraph Services
        PS[ProjectService]
        AS[AnalysisService]
        DS[DocumentService]
        GS[github_service]
        MS[MatchService]
        IS[InterestService]
        DRS[DealRoomService]
        NS[NotificationService]
        ES[EmailService]
        DRF[dealroom_files]
    end
    FD & ID & PF & PI & PREF & IP & DR & Shell --> API
    API --> ME & PROJ & INV & FOU & MAT & INT & NOT & DRR
    PROJ --> PS & AS & DS
    AS --> GS & DS
    PS --> MS
    INV --> MS
    INT --> IS --> DRS
    IS --> NS & ES
    DRR --> DRS --> NS
    MS --> NS
    DRS --> DRF
```

**In plain terms:** every page goes through one API client (`lib/api.ts`). Each backend route is thin and hands off to a service. Services call each other where the business logic connects: creating a project triggers an analysis and a matching pass; accepting an intro opens a deal room and sends notifications.

## 3. Database architecture (logical)

```mermaid
erDiagram
    APP_USERS ||--o{ PROJECTS : "founder_id"
    APP_USERS ||--o| FOUNDER_PROFILES : "user_id"
    APP_USERS ||--o| INVESTOR_PROFILES : "user_id"
    APP_USERS ||--o| INVESTOR_PREFERENCES : "investor_id"
    PROJECTS ||--o{ PROJECT_DOCUMENTS : "FK, cascade"
    PROJECTS ||--o{ PROJECT_ANALYSES : "FK, cascade"
    PROJECTS ||--o{ MATCHES : "project_id"
    APP_USERS ||--o{ MATCHES : "investor_id"
    PROJECTS ||--o{ PROJECT_INTERESTS : "project_id"
    APP_USERS ||--o{ PROJECT_INTERESTS : "investor_id"
    PROJECT_INTERESTS ||--o| DEAL_ROOMS : "interest_id"
    DEAL_ROOMS ||--o{ DEAL_ROOM_MESSAGES : "FK, cascade"
    DEAL_ROOMS ||--o{ DEAL_ROOM_AUDIT_LOGS : "FK, cascade"
    APP_USERS ||--o{ NOTIFICATIONS : "user_id (or role broadcast)"
```

**In plain terms:** a user is a founder or an investor. Founders own projects, and projects own their documents and analysis history. Investors have criteria. Matches and intro requests connect a project to an investor. An accepted intro opens one deal room, which holds the messages and the activity log. Only the arrows marked "FK, cascade" are enforced by the database; the rest are enforced by the application code. Table details are in `DATABASE_AND_API_DOCUMENTATION.md`.

## 4. Key request flows

### 4a. Founder creates a project

```mermaid
sequenceDiagram
    participant B as Browser
    participant F as Next.js
    participant A as FastAPI
    participant P as Postgres
    B->>F: Submit ProjectForm
    F->>A: POST /api/projects (Bearer JWT)
    A->>A: require_founder (verify JWT, role)
    A->>P: INSERT projects
    A->>A: AnalysisService.analyze(engine="rules")
    A->>P: INSERT project_analyses, UPDATE projects scores
    A->>A: MatchService.compute_matches_for_project
    A->>P: UPSERT matches, INSERT notifications (fit ≥ 90%)
    A-->>F: 201 project (with baseline score)
    opt deck attached
        F->>A: POST /api/projects/{id}/documents (file)
        A->>A: validate, save to private_uploads, extract text
        A->>P: INSERT project_documents
    end
```

### 4b. Investor requests an intro, founder accepts, room opens

```mermaid
sequenceDiagram
    participant I as Investor
    participant A as FastAPI
    participant P as Postgres
    participant Fd as Founder
    I->>A: POST /api/interests {project_id, message}
    A->>P: read emails from app_users, UPSERT project_interests (pending)
    A->>P: INSERT notification → founder
    Fd->>A: PATCH /api/interests/{id}/status {accepted, note}
    A->>A: require_founder + owns project
    A->>P: UPDATE interest (accepted, deal_room details from real data)
    A->>P: INSERT deal_rooms (+ genesis audit), link room_id
    A->>P: INSERT notification → investor
    I->>A: GET /api/interests → founder email now visible
```

### 4c. Deal-room message in real time

```mermaid
sequenceDiagram
    participant X as Sender
    participant A as FastAPI
    participant P as Postgres
    participant Y as Other party
    X->>A: POST /api/dealrooms/{id}/messages (JWT)
    A->>A: _require_participant
    A->>P: INSERT message with hash = sha256(prev|seq|time|sender|content) (single SQL statement)
    A->>P: INSERT audit log, notification → Y
    A-->>Y: WebSocket broadcast {type: "message"}
    Note over Y: If the socket dropped,<br/>5-second polling picks it up
```

## 5. AI processing workflow

```mermaid
flowchart TD
    T[Founder clicks Re-analyze] --> R[POST /projects/id/analyze]
    R --> G[_gather: project profile + documents + GitHub summary]
    G --> E{settings.analysis_engine}
    E -- claude --> C[Claude: PDFs/images native, other docs as text,<br/>strict JSON schema output]
    E -- gemini --> M[Gemini: PDFs/images inline, JSON response schema,<br/>timeout + fallback model on 429/503]
    E -- rules --> RU[Rule engine: topic coverage per dimension]
    C & M --> V[Validate with Pydantic AnalysisOutput]
    V --> S[Clamp scores 0-100, status label]
    RU --> S
    S --> DBW[INSERT project_analyses + mirror onto projects]
    DBW --> UI[ProjectIntelligence renders report]
```

**In plain terms:** the server collects everything the founder has provided and sends it to the configured AI with a fixed set of instructions, asking for a reply in a strict structure. It checks that the reply matches that structure, then saves it. Without an AI key, a transparent rule-based checker produces the same kind of report and labels it as rule-based. Details are in `AI_IMPLEMENTATION_ANALYSIS.md`.

## 6. Authentication workflow

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as Next.js (/api/auth proxy)
    participant NA as Neon Auth
    participant A as FastAPI
    B->>N: signIn.email(email, password)
    N->>NA: forward
    NA-->>N: session
    N-->>B: Set-Cookie __Secure-neon-auth.* (HttpOnly)
    B->>N: GET /api/auth/token (cookie)
    N->>NA: forward
    NA-->>B: JWT (EdDSA, ~15 min)
    B->>A: API call, Authorization: Bearer JWT
    A->>NA: JWKS (cached 1 h)
    A->>A: verify signature, iss, aud → user id
    A->>A: load role from app_users (create row on first visit)
```

**In plain terms:** the password goes only to Neon Auth. The browser keeps a secure session cookie and exchanges it for a short-lived token, which the frontend caches until about a minute before it expires. The backend never sees passwords. It only checks that each token was signed by Neon Auth, then looks up the user's role.

## 7. Hosting and deployment (current vs planned)

```mermaid
flowchart LR
    subgraph Today[Today]
        L1[Next.js dev server<br/>localhost:3000]
        L2[Uvicorn<br/>localhost:8000]
        N1[(Neon Postgres - hosted)]
        N2[Neon Auth - hosted]
        G1[Gemini API - hosted]
        L1 --> L2 --> N1
        L1 --> N2
        L2 --> G1
    end
    subgraph Planned[Planned, not built]
        V[Frontend host<br/>e.g. Vercel]
        C[Backend container<br/>backend/Dockerfile]
        O[(Object storage<br/>for files)]
        SM[Custom SMTP]
        V --> C --> O
        C --> SM
    end
```

**In plain terms:** the database, sign-in and AI already run in the cloud. The website and the server still run on a developer's machine. A Dockerfile for the server exists, but nothing has been deployed yet. See `SECURITY_AND_DEPLOYMENT.md`.
