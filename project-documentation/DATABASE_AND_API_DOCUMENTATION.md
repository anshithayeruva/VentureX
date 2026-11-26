# Database and API Documentation

## Part 1 — Database

**Engine:** Neon Lakebase Postgres (serverless PostgreSQL), branch `production`, AWS us-west-2.
**Schema source:** `backend/app/database/schema.sql`. It is applied idempotently on every backend start (`postgres.apply_schema()` in the `main.py` lifespan).
**Access layer:** `backend/app/database/postgres.py`. By default (`NEON_DB_TRANSPORT=https`), every query is an HTTPS POST to Neon's SQL endpoint; results are decoded by Postgres type id. `tcp` mode uses a psycopg connection pool. All queries use parameter placeholders (no string-built SQL with user input); `escape_like()` protects `LIKE` searches.
**Identity data:** users, sessions and verification codes live in Neon's managed `neon_auth` schema, not in our tables. Our `app_users.id` is the Neon Auth user id (the JWT `sub`).

### Tables (13)

| Table | Purpose | Key columns | Written by |
| --- | --- | --- | --- |
| `app_users` | App-side account record and role | `id` (Neon Auth id, PK), `email`, `name`, `role` CHECK ∈ {FOUNDER, INVESTOR}, `organization` | `core/auth.py::user_from_token` (auto-create), `routes/auth.py` (onboarding) |
| `projects` | Startup profiles | `id` BIGINT identity from 1000, `founder_id`, title/tagline/description/problem/solution, industry, stage, `funding_required`, business_model, target_market, website, pitch_deck_url, `github_url`, `demo_url`, `is_published`, `readiness_score`, `ai_readiness_breakdown` JSONB, `ai_feedback_summary`, `strengths`/`recommendations` JSONB | `ProjectService`, `AnalysisService` |
| `founder_profiles` | Founder public profile + settings | `user_id` PK, name, company, bio, location, linkedin, website, `settings` JSONB | `FounderService` |
| `investor_profiles` | Investor profile + settings | `user_id` PK, name, firm, title, bio, location, thesis, min/max check (text), `settings` JSONB | `InvestorService` |
| `investor_preferences` | Matching criteria | `investor_id` PK, preferred_industries / preferred_stages / preferred_business_models / tech_preferences (JSONB arrays), min/max_investment, geography | `InvestorService.update_preferences` |
| `matches` | Explainable project↔investor fit | `id`, `project_id`, `investor_id`, names, `founder_id`, `match_score`, `reasons` JSONB, `status`; UNIQUE (project_id, investor_id) | `MatchService` |
| `project_interests` | Intro requests | `id` (`intro-{project}-{investor}`), project/investor/founder ids, names and **real emails**, `status` (pending/accepted/declined), `message`, `response_note`, `deal_room` JSONB; UNIQUE (project_id, investor_id) | `InterestService` |
| `notifications` | In-app alerts | identity `id`, `user_id` (NULL = role broadcast), `target_role`, title, `"desc"`, badge, link, `read` | `NotificationService` |
| `deal_rooms` | Founder–investor private room | `id` (`room-…`), `interest_id`, project, both parties' names/emails/orgs, `stage`, NDA fields, `shared_documents` JSONB, last-message fields, `messages_count`, `audit_trail_hash` | `DealRoomService` |
| `deal_room_messages` | Chat messages | `room_id` FK (cascade), sender, `content`, `attachments` JSONB, `sequence` (UNIQUE per room), `previous_hash`, `integrity_hash` | `DealRoomService.send_message` (hash computed inside the INSERT statement) |
| `deal_room_audit_logs` | Room activity record | `room_id` FK (cascade), `event_type`, actor, `details` JSONB, `tamper_hash`, `timestamp` | `DealRoomService` |
| `project_documents` | Uploaded materials | `project_id` FK (cascade), `category`, `original_name`, `storage_path` (private disk), `content_type`, `size_bytes`, `page_count`, `extracted_text`, `extraction_note` | `DocumentService` |
| `project_analyses` | Every readiness run | `project_id` FK (cascade), `engine` (claude/gemini/rules), `model`, `overall_score`, `status_label`, `summary`, `dimensions`/`strengths`/`gaps`/`suggestions`/`industry_insights`/`inputs` JSONB | `AnalysisService.analyze` |

**Indexes:** founder/published/created on `projects`; score and investor on `matches`; founder+status and investor on `project_interests`; user and role on `notifications`; founder/investor/interest on `deal_rooms`; room+time on audit logs; project+time on documents and analyses.

### Relationships and integrity

* **Enforced by foreign keys (with ON DELETE CASCADE):** `project_documents → projects`, `project_analyses → projects`, `deal_room_messages → deal_rooms`, `deal_room_audit_logs → deal_rooms`.
* **Enforced in application code only:** project ownership (`projects.founder_id`), matches, interests, deal rooms and notifications referencing users/projects. Names and emails are **denormalized** (copied) into matches, interests and deal rooms for fast reads; they are refreshed at key moments (e.g. emails on intro accept) but can drift if a profile changes later.
* **Uniqueness:** one match and one intro per (project, investor); message sequence per room.

### Data lifecycle notes

* Demo data (`seed.py`) is inserted at startup into empty tables (projects owned by `founder-001`, demo investors, intros, rooms). It lives alongside real data.
* There is no project delete endpoint; documents can be deleted (`DELETE /projects/{id}/documents/{doc_id}`), interests can be withdrawn.

---

## Part 2 — API reference

Base URL (local): `http://localhost:8000/api`. Interactive OpenAPI docs: `/docs` (Swagger) and `/redoc`.

**Auth column legend:**
* **Public** — no token needed.
* **Optional** — works anonymously, but returns scoped data when a token is sent (`get_current_user`).
* **User** — any signed-in user (`require_user`).
* **Founder** / **Investor** — signed in with that role (`require_founder` / `require_investor`).
* **Owner** — must own the project.
* **Participant** — must be one of the deal room's two parties.

### Health and account

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | DB connectivity, auth configured, environment |
| GET | `/me` | User | Current account (id, email, name, role) |
| POST | `/me` | User | Onboarding: set role/name/organization (409 if changing an existing role) |

### Projects, materials and readiness (`routes/projects.py`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/projects` | Founder | Create project (+ baseline rules analysis + matching) |
| GET | `/projects` | Optional | List published projects; `founder_only=true` → the founder's own incl. drafts; `industry`, `search`, `skip`, `limit` |
| GET | `/projects/{id}` | Optional | Published project, or the owner's draft |
| PUT | `/projects/{id}` | Founder + Owner | Update project |
| PATCH | `/projects/{id}/publish` | Founder + Owner | Publish / unpublish |
| GET | `/projects/{id}/readiness` | Optional → Owner | Private readiness report (404 for anyone else; demo projects readable) |
| POST | `/projects/{id}/re-evaluate` | Founder + Owner | Re-run analysis (legacy alias of analyze) |
| GET | `/projects/{id}/export-report` | Optional → Owner | Readiness report as PDF |
| POST | `/projects/{id}/documents` | Founder + Owner | Upload a material (multipart: `file`, `category`) |
| GET | `/projects/{id}/documents` | Optional → owner, or **anyone** if published | List materials |
| GET | `/projects/{id}/documents/{doc_id}/file` | Optional → owner, or **anyone** if published | Download a material (no sign-in needed once published) |
| DELETE | `/projects/{id}/documents/{doc_id}` | Founder + Owner | Remove a material |
| POST | `/projects/{id}/analyze` | Founder + Owner | Run the AI (or rules) readiness analysis |
| GET | `/projects/{id}/analyses` | Optional → Owner | Analysis history |

### Profiles, criteria and settings

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET / PUT | `/founders/profile` | Optional / Founder | Founder profile (anonymous GET returns the demo founder) |
| GET / PUT | `/founders/settings` | Optional / Founder | Founder settings (stored only) |
| GET / PUT | `/investors/profile` | Optional / Investor | Investor profile |
| GET / PUT | `/investors/preferences` | Optional / Investor | Matching criteria (PUT recomputes matches) |
| GET / PUT | `/investors/settings` | Optional / Investor | Investor settings (stored only) |
| GET | `/investors` | **Public** | List investor profiles (see gap analysis) |

### Matching

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/matches` | Optional | Published projects only. Investor → own matches; founder → matches for own projects; **anonymous → all matches for published projects** (S4, still open) |
| POST | `/matches/recalculate` | User | Recompute every match (any signed-in user can trigger) |

### Intro requests (`routes/interests.py`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/interests` | Investor | Request an intro (`project_id`, `message`); investor id taken from the token |
| GET | `/interests` | Optional | Founder → requests for own projects; investor → own requests (founder email hidden until accepted) |
| GET | `/interests/{id}` | User | One request |
| PATCH | `/interests/{id}/status` | Founder + Owner | `accepted` / `declined` (+ `response_note`); accept opens a deal room |
| DELETE | `/interests/{id}` | Investor | Withdraw |

### Notifications

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/notifications` | User | Your own notifications plus broadcasts to your role (query `role`/`user_id` are ignored) |
| GET | `/notifications/unread-count` | User | Your unread count |
| PATCH | `/notifications/{id}/read` | User | Mark one read (own only, else 404) |
| POST | `/notifications/mark-all-read` | User | Mark all read |

### Deal rooms (`routes/dealrooms.py`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/dealrooms` | User | Rooms you belong to |
| POST | `/dealrooms` | User (must be a party) | Create or get a room for an interest |
| GET | `/dealrooms/{room_id}` | Participant | Room details |
| GET | `/dealrooms/{room_id}/messages` | Participant | Messages (ordered by sequence) |
| POST | `/dealrooms/{room_id}/messages` | Participant | Send (sender identity forced from the token) |
| PATCH | `/dealrooms/{room_id}/stage` | Participant | Change stage (+ note → system message) |
| POST | `/dealrooms/{room_id}/nda` | Participant | Sign the mutual NDA |
| POST | `/dealrooms/{room_id}/documents` | Participant | Share a link (must be http/https) |
| POST | `/dealrooms/{room_id}/files` | Participant | Upload a file (multipart: `file`, `type`, `name`); stored privately |
| GET | `/dealrooms/{room_id}/files/{file_id}` | Participant | Download a room file |
| GET | `/dealrooms/{room_id}/transcript` | Participant | Full JSON transcript (with hashes) |
| GET | `/dealrooms/{room_id}/export-pdf` | Participant | Conversation PDF |
| GET | `/dealrooms/{room_id}/audit-logs` | Participant | Activity log |
| WS | `/dealrooms/ws/{room_id}?token=JWT` | Participant | Live messages, typing, presence |

### Uploads

The generic `POST /upload` endpoint and the public `/uploads/...` static folder were **removed** (S3 fix). Files are uploaded either as project materials (`/projects/{id}/documents`) or into a deal room (`/dealrooms/{room_id}/files`), and both are stored privately.

### Example request/response flows

**Run a readiness analysis**
```http
POST /api/projects/1062/analyze
Authorization: Bearer <JWT>

200 OK
{
  "project_id": 1062, "readiness_score": 72.0, "status_label": "Nearly Ready: Address Key Gaps",
  "dimensions": [{"key": "market_sizing", "name": "Market Sizing & Competition", "score": 58, "rationale": "..."}, ...],
  "strengths": ["..."], "gaps": [{"area": "Traction", "issue": "...", "severity": "high"}],
  "suggestions": [{"title": "...", "detail": "...", "priority": "high"}],
  "industry_insights": ["..."], "engine": "gemini", "model_version": "Gemini (gemini-3.5-flash-lite)",
  "inputs": {"documents": [...], "github": {"ok": true, "full_name": "owner/repo"}}
}
```
Errors: `401` no/invalid token, `403` not the owner, `429` AI rate limit, `502/503/504` AI provider unavailable/timeout (message explains), `422` materials too large for one request.

**Request an intro**
```http
POST /api/interests
Authorization: Bearer <investor JWT>
{"project_id": 1062, "message": "Would love to see your pilot numbers."}

201 Created
{"id": "intro-1062-<investor id>", "status": "pending", "investor_email": "<real>", "founder_email": "<real>", ...}
```

**Accept it**
```http
PATCH /api/interests/intro-1062-<investor id>/status
Authorization: Bearer <founder JWT>
{"status": "accepted", "response_note": "Happy to share."}

200 OK  → "deal_room": {"unlocked": true, "founder_email": "...", "founder_linkedin": null,
                         "founder_website": null, "pitch_deck_url": null, "room_id": "room-..."}
```
