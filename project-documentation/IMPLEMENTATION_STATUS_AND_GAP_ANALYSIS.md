# Implementation Status and Gap Analysis

Status key: **Complete** (works end to end, verified) · **Partial** (works with known limits) · **Placeholder** (code exists but returns mock data / has no effect) · **Not implemented**.

## 1. Feature status

| Feature | Status | Evidence | Missing | Next step |
| --- | --- | --- | --- | --- |
| Sign-up / sign-in / sign-out | Complete | `frontend/app/{register,login}/page.tsx`, `core/auth.py` | Email verification, social login, MFA | Enable email verification; add Google sign-in (supported by Neon Auth) |
| Role onboarding, role lock | Complete | `routes/auth.py` (409 on change) | — | — |
| Password reset (emailed code) | Complete | `frontend/app/forgot-password/page.tsx` | Custom sender domain | Custom SMTP in Neon Auth |
| Founder/investor profiles | Complete | `routes/founders.py`, `routes/investors.py` | — | — |
| User settings (toggles) | Placeholder | saved in `settings` JSONB; nothing reads them | Behaviour behind each toggle | Wire up or remove |
| Create / edit project | Complete | `ProjectForm.tsx`, `POST/PUT /projects` | — | — |
| Publish / unpublish | Complete | `PATCH /projects/{id}/publish` | — | — |
| **Delete project** | Not implemented | no `DELETE /projects/{id}` | Endpoint + UI | Add with cascade (documents and analyses cascade already) |
| Document upload + extraction | Complete | `document_service.py` | Cloud storage, OCR for scanned PDFs | Move to object storage |
| AI readiness (Gemini) | Complete | `analysis_service.py`; verified live (3 docs + repo, ~158 s) | Background processing | Run as a background job |
| AI readiness (Claude) | Partial | implemented, never run live | A live test | Add a key and run the E2E suite |
| Rule-based readiness | Complete | `_analyze_with_rules` | Quality judgement (it scores coverage only) | Keep as the free baseline |
| Readiness history + PDF | Complete | `GET /analyses`, `GET /export-report` | Visual comparison between runs | "What changed" view |
| GitHub analysis | Partial | `github_service.py` | Reading source code, commit history | Fetch key files and commit stats |
| Demo-link analysis | Not implemented | `_brief` says the link is not opened | Fetch/screenshot the demo | Safe fetch + summary |
| Investor criteria | Complete | `investor/preferences/page.tsx` | Geography used in scoring | Add a geography factor |
| Matching (rule-based) | Complete | `match_service.py` (published projects only, S2 fixed) | Semantic similarity, geography | Consider embeddings |
| Embeddings / vector search | Placeholder | `services/ai/embeddings.py` returns zeros; unused | Everything | Implement with pgvector, or delete the placeholders |
| Intro requests + accept/decline | Complete | `routes/interests.py` | — | — |
| Deal rooms (chat, NDA, stages, documents, activity, exports) | Complete | `routes/dealrooms.py`, `services/dealroom_files.py`, `dealroom/[id]/page.tsx`; clicked through; files private to participants (S3 fixed) | Legal e-signature | — |
| Real-time chat | Partial | WebSocket + polling | Multi-instance broker; URL bug B1 | Fix B1; Redis pub/sub when scaling |
| In-app notifications | Complete | `routes/notifications.py` (sign-in required, S1 fixed), top-bar bell | Live push | — |
| Email notifications | Partial | `email_service.py` writes to a log | SMTP configuration | Configure SMTP |
| Landing page | Complete | `frontend/app/page.tsx` | — | — |
| Workspace UI redesign | Complete (signed-in pages) | `components/ui.tsx`, `PortalLayout.tsx` | Sign in / sign up / reset pages still in the old style | Restyle the 3 auth pages |
| Admin / moderation | Not implemented | — | Everything | Needed for production |
| Analytics / reporting | Not implemented | — | — | Later |
| Deployment | Not implemented | `backend/Dockerfile` only | Hosting, CI/CD, storage | See the security and deployment doc |

## 2. Known bugs

| ID | Bug | Evidence | Impact |
| --- | --- | --- | --- |
| B1 | The WebSocket URL doubles `/api` when `NEXT_PUBLIC_API_URL` is set (it includes `/api`, and the code appends `/api/dealrooms/ws`). | `frontend/app/dealroom/[id]/page.tsx` + `lib/api.ts::API_BASE_URL` | In any deployment, live chat silently degrades to 5 s polling |
| B2 | **Fixed.** Private drafts were matched, and investors notified with the draft title (S2). | `match_service.py::compute_matches_for_project` | — |
| B3 | **Fixed.** The high-fit notification linked to a tab that doesn't exist; it now opens Recommended. | `match_service.py` | — |
| B4 | The baseline report on a new project says "Rule-based check · AI analysis not configured" even when AI *is* configured (the baseline deliberately uses rules). | `ProjectIntelligence.tsx`, `ProjectService.create` | Confuses founders and demo audiences |
| B5 | The frontend falls back to built-in sample data on some API errors. | `frontend/lib/api.ts` (`MOCK_MATCHES`, `localProjects`, `localPreferences`, `localNotifications`) | Can show fake data during an outage |
| B6 | Investor check size is stored twice: profile `min_check`/`max_check` (text) and criteria `min_investment`/`max_investment` (numbers); only the criteria are used for matching. | schema | Values can disagree |
| B7 | Deal-room stage change takes ~3 s (several sequential HTTPS SQL calls). | measured during UI testing | Feels slow; mitigated by a "Saving…" state |

## 3. Incomplete workflows

* **Project lifecycle:** create → edit → publish exists; **archive/delete** doesn't.
* **Notifications by email:** the event fires, but the email is only logged.
* **Settings:** toggles save but don't change behaviour.
* **Deal closing:** the stage can be set to "Closed", but nothing happens after (no term-sheet or e-signature integration).
* **Admin:** no way to moderate users or content, remove demo data, or view platform metrics.

## 4. Technical debt

| Item | Where |
| --- | --- |
| Unused AI placeholder modules (mock embeddings, mock matches) | `backend/app/services/ai/*.py` |
| Unused UI components after the redesign | `frontend/components/Badge.tsx`, `StatCard.tsx` |
| Large mock datasets in the API client | `frontend/lib/api.ts` (`MOCK_PROJECTS`, `MOCK_MATCHES`, …) |
| 19 lint errors (mostly `any` types, `prefer-const`) | `frontend/lib/api.ts` |
| Demo seed runs at every startup into the real database; access rules have demo exceptions | `seed.py`, `main.py`, `routes/projects.py` |
| Denormalized names/emails (matches, interests, rooms) can drift | `schema.sql` |
| Few foreign keys (only documents, analyses, messages, audit) | `schema.sql` |
| Dockerfile uses Python 3.11; development uses 3.13 | `backend/Dockerfile` |
| The end-to-end test script (86 checks) lives outside the repository | not committed |
| `docs/frontend-backend-mapping.md` predates recent changes | `docs/` |

## 5. Scalability concerns

| Concern | Why | Mitigation |
| --- | --- | --- |
| SQL over HTTPS per query | One network round trip per statement | Use the pooled TCP transport in production |
| Matching recomputes per project across up to 100 investors (`LIMIT 100`) in Python | O(projects × investors); the hard 100 cap silently ignores more investors | Batch in SQL or a background queue; remove the cap |
| AI analysis runs inside the HTTP request (1–3 min) | Hosting proxies may time out; ties up workers | Background job + polling or webhooks |
| WebSocket connections held in process memory | Doesn't work across several backend instances | Redis pub/sub or a managed realtime service |
| Local-disk file storage | Lost on redeploy; not shared | Object storage |
| No caching | Every page re-queries | Add caching where reads dominate |

## 6. Security gaps

See `SECURITY_AND_DEPLOYMENT.md` §3. The three high-severity gaps, **S1** (anonymous notification reads), **S2** (draft leakage) and **S3** (public deal-room uploads), are fixed on branch `fix/access-gaps` (commit 4376956). Still open: S4–S8 (medium) and S9–S12 (low).

## 7. Test coverage

| Layer | What exists | Result |
| --- | --- | --- |
| Backend API tests | `backend/tests/` (17 pytest tests: health, project CRUD, publish, scoping, spoofing, and 6 access-gap regression tests) | 17/17 pass; tests clean up their own data |
| End-to-end (real Neon Auth sign-ins, both roles) | Script outside the repo | 86/86 pass, including private deal-room files and signed-out notification checks (AI step skipped in the last run; Gemini passed live in earlier runs) |
| UI click-through (Playwright, ad hoc) | Deal room actions, new-project form, top bar | All pass |
| Frontend unit tests | None | — |
| Load/performance tests | None | — |

## 8. Test before any client demo

1. **Start both servers** and open the site at `http://localhost:3000` (not the LAN IP, or sign-in won't persist).
2. **Demo data:** decide whether demo projects (e.g. "NeuroPulse AI") and demo investors ("Dr. Sarah Lin") should appear; they show up in browse and matching.
3. **AI analysis:** run one live analysis beforehand (Gemini free tier can hit rate limits; allow 1–3 minutes). Have a pre-analysed project ready.
4. **Merge `fix/access-gaps` first** so the demo runs with the three access fixes. Files shared in deal rooms before that fix were stored publicly and now show as "no longer available".
5. **Password reset:** the email comes from `auth@mail.myneon.app` and may land in spam.
6. **Live chat:** works locally; it would degrade to polling if `NEXT_PUBLIC_API_URL` were set (B1).
7. **Have two browsers** (founder and investor) to show intro → accept → deal room live.

## 9. Recommended next steps (priority order)

1. ~~Fix S1, S2, S3~~: done (fixed on branch `fix/access-gaps` (commit 4376956)); merge it, then fix S4–S8.
2. Fix **B1** and **B4**; remove the frontend sample-data fallbacks (B5).
3. Add **project delete**; restyle the three auth pages.
4. Commit the E2E suite to the repo; add CI (lint, type-check, build, pytest).
5. Move files to object storage; configure SMTP; turn off demo seeding in production.
6. Deploy (Vercel + container host); then run AI analysis as a background job.
7. Product depth: deeper GitHub analysis, demo-link review, geography in matching, embeddings if desired.
