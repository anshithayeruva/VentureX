# Complete Technology Stack

Versions come from `frontend/package.json`, `backend/requirements.txt`, `package.json` (root) and the installed backend environment. "Installed" means the version actually running in the local virtual environment.

## The architecture in plain language

* **For a non-technical client:** VentureX has a website (what people click), a server (the rules and the brain), a database (the memory), a sign-in service (the front door), and an AI reviewer (the analyst). The website never talks to the database directly. It asks the server, the server checks who is asking, and only then reads or writes data.
* **For a technical evaluator:** a Next.js 16 / React 19 client app talks to a FastAPI service over JSON with bearer JWTs issued by Neon Auth (managed Better Auth, EdDSA). FastAPI is stateless and talks to Neon Lakebase Postgres through Neon's SQL-over-HTTPS endpoint, with an optional psycopg TCP pool. Readiness analysis calls Gemini or Claude with schema-constrained JSON output, and falls back to deterministic rules. Real-time deal-room chat uses a FastAPI WebSocket, with 5-second polling as a fallback.

## 1. Frontend technologies

| Technology | Version | Where | Why / responsibility |
| --- | --- | --- | --- |
| **Next.js** (App Router) | 16.3.8 | `frontend/app/**` | Routing, page rendering, the `/api/auth/*` proxy route, and middleware (`frontend/proxy.ts`) that protects the workspaces. |
| **React** | 19.2.8 | all pages/components | UI components and state (`useState`, `useEffect`, `useSearchParams`). |
| **Tailwind CSS** | 4.x (`@tailwindcss/postcss`) | `frontend/app/globals.css` | Styling. Design tokens (`--color-ink`, `--color-accent`, …) are declared once in `@theme` and used as utilities (`text-ink`, `bg-accent`). |
| **lucide-react** | ^1.52.0 | icons everywhere | Consistent line icons. |
| **Inter** (Google Fonts) | — | `frontend/app/layout.tsx` | The single typeface. |
| **Custom design system** | — | `frontend/components/ui.tsx` | `PageHeader`, `Card`, `Section`, `Stat`, `EmptyState`, `Button`, `Tag`, `Field`, `ScoreBar`, `Segmented`, `Toggle`, `Avatar`, `LoadingRows`. |
| **Brand mark** | — | `frontend/components/BrandMark.tsx`, `frontend/app/icon.svg` | SVG logo, also the favicon. |

## 2. Backend technologies

| Technology | Version (installed) | Where | Why / responsibility |
| --- | --- | --- | --- |
| **FastAPI** | 0.162.0 | `backend/app/main.py`, `backend/app/routes/*` | HTTP API, request validation, OpenAPI docs at `/docs`, WebSocket endpoint. |
| **Uvicorn** | 0.54.0 | run command | ASGI server. On Windows it must run with `--loop asyncio:SelectorEventLoop` (root `package.json` scripts). |
| **Pydantic** / **pydantic-settings** | 2.14.2 | `backend/app/schemas/*`, `backend/app/core/config.py` | Request/response models and typed settings from `.env.local` + `backend/.env`. |
| **psycopg** (binary, pool) | 3.3.8 | `backend/app/database/postgres.py` | Optional TCP transport to Postgres (`NEON_DB_TRANSPORT=tcp`). |
| **httpx** | ≥0.27 | `postgres.py`, `github_service.py` | Neon SQL-over-HTTPS calls (default transport) and GitHub API calls. |
| **PyJWT[crypto]** | 2.15.1 | `backend/app/core/auth.py` | Verifies Neon Auth EdDSA JWTs against the JWKS endpoint (`PyJWKClient`). |
| **python-multipart** | ≥0.0.9 | upload routes | Multipart file uploads. |
| **email-validator** | ≥2.0 | schemas | Email field validation. |
| **pypdf / python-docx / python-pptx** | 7.1.1 / ≥1.1 / ≥1.0 | `backend/app/services/document_service.py` | Extract text from uploaded PDFs, Word and PowerPoint files for the AI. |
| **Zero-dependency PDF writer** | in-house | `backend/app/utils/pdf_generator.py` (`SimplePDFCanvas`) | Generates the readiness report PDF and the deal-room PDF without third-party libraries. |
| **smtplib** (stdlib) | — | `backend/app/services/email_service.py` | Sends email **if** `SMTP_HOST`/`SMTP_USER` are set; otherwise writes to `backend/logs/emails.log`. |

## 3. Programming languages

| Language | Where |
| --- | --- |
| TypeScript 5 / TSX | Frontend |
| Python 3.13 (local); Dockerfile targets 3.11 | Backend |
| SQL (PostgreSQL dialect) | `backend/app/database/schema.sql`, inline queries in services |
| CSS (Tailwind v4) | `frontend/app/globals.css` |

## 4. Database and data storage

| Technology | Where | Responsibility |
| --- | --- | --- |
| **Neon Lakebase Postgres** (serverless Postgres, AWS us-west-2, branch `production`) | `DATABASE_URL` in `.env.local` | All application data: 13 tables (see `DATABASE_AND_API_DOCUMENTATION.md`). |
| **Neon SQL-over-HTTPS** (default transport) | `postgres.py` (`_http_post`, `_rows_from`, `_decode`) | Every query is an HTTPS POST to Neon's `/sql` endpoint. This was chosen because outbound TCP port 5432 is blocked on the development machine (antivirus). |
| **Local filesystem** | `backend/private_uploads/` (project documents and deal-room files; private, served only through authorized endpoints) | File storage. Not suitable for multi-server or ephemeral hosting yet. |
| **JSONB columns** | scores, reasons, documents, settings | Flexible nested data without extra tables. |

Not used: pgvector, Redis, object storage. The `pgvector` mentions in `backend/app/services/ai/embeddings.py` are placeholder comments only.

## 5. AI / ML technologies and models

| Technology | Version / model | Where | Status |
| --- | --- | --- | --- |
| **Google Gemini** via `google-genai` | SDK 3.6.1; default model `gemini-3.8-flash`, fallback `gemini-3.5-flash-lite` | `analysis_service.py::_analyze_with_gemini` | **Working, verified live.** Engine used when a Gemini key is set and no Claude key. |
| **Anthropic Claude** via `anthropic` | SDK 2.11.0; model `claude-opus-5-5` | `analysis_service.py::_analyze_with_claude` | **Implemented, not tested live** (no Anthropic key configured). |
| **Rule-based readiness engine** | in-house | `analysis_service.py::_analyze_with_rules` | Working. Used for the instant baseline on project creation and whenever no AI key is set. |
| **Rule-based matching engine** | in-house | `match_service.py::calculate_match` | Working. Weighted scoring with written reasons. **No ML.** |
| Embeddings / vector search | — | `backend/app/services/ai/*.py` | **Placeholder only, unused** (returns zero vectors / mock data). |

## 6. Authentication and authorization

| Technology | Where | Responsibility |
| --- | --- | --- |
| **Neon Auth** (managed Better Auth) | `neon.ts` (`auth: true`); users live in the `neon_auth` schema | Sign-up, sign-in, sessions, password reset by emailed one-time code, JWT issuing. |
| **@neon/auth** | ^0.8.2 | `frontend/lib/auth/{client,server}.ts`, `frontend/app/api/auth/[...path]/route.ts`, `frontend/proxy.ts` | Client methods (`signIn.email`, `signUp.email`, `emailOtp.*`), the same-origin auth proxy and the middleware. |
| **JWT (EdDSA / Ed25519) + JWKS** | `backend/app/core/auth.py` | Backend verifies signature, issuer and audience; 15-minute token lifetime (Neon Auth default). |
| **App roles** | `app_users.role` + `require_founder` / `require_investor` dependencies | Authorization per endpoint. |

## 7. APIs and integrations

| Integration | How | Where |
| --- | --- | --- |
| VentureX REST API | 52 endpoints under `/api` (see the API document) | `backend/app/routes/*` |
| VentureX WebSocket | `/api/dealrooms/ws/{room_id}?token=…` | `backend/app/routes/dealrooms.py` |
| GitHub REST API | metadata, languages, README, recursive file tree (public repos; optional `GITHUB_TOKEN`) | `backend/app/services/github_service.py` |
| Gemini API / Anthropic API | readiness analysis | `analysis_service.py` |
| Neon Auth API | via the Next.js proxy `/api/auth/*` | frontend |
| Neon SQL API | database queries | `postgres.py` |
| SMTP (optional) | transactional emails | `email_service.py` |

## 8. Cloud infrastructure and deployment

| Piece | Current reality |
| --- | --- |
| Database | **Hosted** on Neon (AWS us-west-2). |
| Auth | **Hosted** on Neon Auth (same project/branch). |
| AI | **Hosted** by Google (Gemini API) / Anthropic. |
| Frontend | **Runs locally** (`next dev`). No hosting config in the repo. |
| Backend | **Runs locally** (`uvicorn`). `backend/Dockerfile` exists but has not been used for a deployment. |
| CI/CD | **None** in the repo (no `.github/workflows`). |

## 9. Security technologies

| Mechanism | Where |
| --- | --- |
| EdDSA JWT verification with JWKS caching (1 h), issuer/audience checks, 10 s leeway | `backend/app/core/auth.py` |
| `__Secure-` HTTP-only session cookies (Neon Auth) | browser ↔ Next.js proxy |
| Route protection middleware | `frontend/proxy.ts` |
| Role guards and ownership checks | `require_founder`, `require_investor`, `_owned_project`, `_require_participant` |
| Parameterized SQL everywhere | `postgres.py` (placeholders, `escape_like`) |
| Upload validation (extension allow-list, 25 MB cap, 20 docs/project, filename sanitizing) and private storage | `document_service.py`, `dealroom_files.py` |
| SHA-256 hash chain on deal-room messages, audit log | `deal_room_service.py` |
| CORS allow-list from settings | `main.py`, `config.py` |

## 10. Development tools and libraries

| Tool | Use |
| --- | --- |
| ESLint 9 + `eslint-config-next` | Linting (`npm run lint`). |
| TypeScript compiler | Type-checking (`tsc --noEmit`). |
| pytest (+ FastAPI TestClient) | `backend/tests/` (17 tests; they clean up their own data). |
| `@neon/config` | `neon.ts` service declaration (`neon deploy`). |
| Neon CLI | Auth status, branch management. |
| Root `package.json` scripts | `dev`, `dev:all`, `backend`, `build:frontend`. |
