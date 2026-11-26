# Feature-by-Feature Analysis

Each feature is traced through the frontend page/component, the API endpoint, the backend service and the database tables it touches. "Status" uses: **Complete**, **Partial**, **Placeholder** (code exists but does nothing real), **Not implemented**.

Conventions: API paths are shown without the `/api` prefix only when obvious; "JWT" means the Neon Auth bearer token that the frontend attaches automatically (`frontend/lib/api.ts::apiFetch`, which retries once on a 401).

---

## 1. Account sign-up and role onboarding

| | |
| --- | --- |
| **Purpose** | Create an account and choose to be a founder or an investor. |
| **Problem solved** | One platform, two very different workspaces; the role decides what a person can see and do. |
| **Users** | Everyone. |
| **User journey** | Landing page → "I'm a founder" / "I'm an investor" → `/register` (role pre-selected via `?role=investor`) → name, startup or firm, email, password (≥ 8 chars) → Create account → lands in their workspace. |
| **Frontend** | `frontend/app/register/page.tsx`: `authClient.signUp.email(...)`, then `sessionWasKept()` checks the browser kept the cookie, then `api.completeOnboarding({ role, name, organization })`. |
| **Backend** | `POST /api/me` (`backend/app/routes/auth.py`): stores role/name/organization; **409** if the account already has a different role. `user_from_token()` in `core/auth.py` auto-creates the `app_users` row on the first authenticated request. Founder/investor profiles are seeded from the account (`account_defaults()` in `investor_service.py` / `founder_service.py`). |
| **Database** | `neon_auth.*` (Neon-managed users/sessions), `app_users`, `founder_profiles` / `investor_profiles`. |
| **Input → output** | Email, password, role, name, organization → session cookie + `app_users` row with role. |
| **Business value** | Instant, self-serve onboarding into the right experience. |
| **Status** | **Complete.** |
| **Limitations** | No email verification step; no social login configured (Neon Auth supports Google/GitHub, not enabled); sign-in only persists on `https://` or `http://localhost` (cookies are `__Secure-` prefixed). |

## 2. Sign-in, sessions and sign-out

| | |
| --- | --- |
| **Journey** | `/login` → choose Founder/Investor tab (only used if onboarding was skipped) → email + password → redirected to the role's dashboard (or a safe `?redirectTo`). Sign-out is in the avatar menu (top bar). |
| **Frontend** | `frontend/app/login/page.tsx` (`authClient.signIn.email`, `clearApiToken()`), `frontend/lib/auth/client.ts::getApiToken` (fetches `/api/auth/token` with a 10 s timeout, caches the JWT until 60 s before expiry, shares one in-flight request), `frontend/proxy.ts` (redirects signed-out visitors of `/founder/*`, `/investor/*`, `/dealroom/*` to `/login`). |
| **Backend** | Every protected endpoint uses `require_user` / `require_founder` / `require_investor`, which verify the JWT (EdDSA, JWKS, issuer, audience). |
| **Status** | **Complete.** Wrong password → "Incorrect email or password."; a dropped cookie on a non-secure origin produces a clear message (`insecureOriginWarning`). |
| **Limitations** | No MFA (not available on Managed Neon Auth yet), no account lockout beyond what Neon Auth provides. |

## 3. Password reset (emailed one-time code)

| | |
| --- | --- |
| **Journey** | `/login` → "Forgot password?" → enter email → Neon Auth emails a 6-digit code → enter code + new password twice → redirected to `/login?reset=1` ("Your password was updated"). |
| **Frontend** | `frontend/app/forgot-password/page.tsx`: `authClient.emailOtp.sendVerificationOtp({ type: "forget-password" })`, then `authClient.emailOtp.resetPassword({ email, otp, password })`. Same confirmation whether or not the account exists (no email probing); friendly errors for wrong/expired/over-used codes; resend. |
| **Backend** | None of ours. Handled entirely by Neon Auth; codes are stored hashed in `neon_auth.verification`. |
| **Why codes, not links** | Neon's shared mail sender delivers codes; reset **links** require custom SMTP. |
| **Status** | **Complete** (verified: correct code resets, reused code rejected, sign-in works after). |
| **Limitations** | Emails come from Neon's shared sender (`auth@mail.myneon.app`) and may land in spam; production needs custom SMTP. |

## 4. Founder and investor profiles and settings

| | |
| --- | --- |
| **Journey** | Avatar menu → Profile / Settings (top bar). |
| **Frontend** | Founder: `frontend/app/founder/dashboard/page.tsx` (`?tab=profile`, `?tab=settings`). Investor: `frontend/app/investor/dashboard/page.tsx` (same tabs). |
| **Backend** | `GET/PUT /founders/profile`, `GET/PUT /founders/settings`, `GET/PUT /investors/profile`, `GET/PUT /investors/settings`. |
| **Database** | `founder_profiles` (name, company, bio, location, linkedin, website, settings JSONB), `investor_profiles` (name, firm, title, bio, location, thesis, min/max check, settings JSONB). |
| **Business value** | Founders' LinkedIn/website are shared with an investor once an intro is accepted. |
| **Status** | Profiles **Complete**. Settings **Partial**: saved and reloaded, but **no code reads them** to change behaviour (e.g. "Keep new projects private", "Email me about strong matches", "Weekly summary" have no effect yet). |

## 5. Create a project (with an instant baseline score)

| | |
| --- | --- |
| **Purpose** | Capture the startup's story and raise in a structured way. |
| **Journey** | Sidebar "New project" → form sections: Basics (name, one-line pitch, summary), Problem and solution, The raise (industry, stage, amount, business model, target customer), Pitch deck and links (deck file, website, deck link, GitHub, demo) → optional "Publish to investors now" → Create project → success card with the first readiness score. |
| **Frontend** | `frontend/app/founder/projects/new/page.tsx` + shared `frontend/components/ProjectForm.tsx`. The deck file is uploaded **after** the project exists, privately (`api.uploadProjectDocument(..., "pitch_deck")`). |
| **Backend** | `POST /projects` (`require_founder`) → `ProjectService.create` → inserts the row, runs `AnalysisService.analyze(created, engine="rules")` for an instant, free baseline, then `MatchService.compute_matches_for_project`. |
| **Database** | `projects`, `project_analyses`, `matches`, `notifications` (high-fit alerts). |
| **Output** | Project row (id starts at 1000), baseline readiness score. |
| **Status** | **Complete.** |
| **Limitations** | Founders **cannot delete** a project (no `DELETE /projects/{id}` endpoint). |

## 6. Edit and publish a project

| | |
| --- | --- |
| **Journey** | Projects tab → Open / Edit; publish toggle on the project page or in the projects table. |
| **Frontend** | `frontend/app/founder/projects/[id]/edit/page.tsx` (same `ProjectForm`), `frontend/app/founder/projects/[id]/page.tsx` (publish button, stats incl. real investor-match count). |
| **Backend** | `PUT /projects/{id}`, `PATCH /projects/{id}/publish` — both owner-only (`_owned_project`); matches are recomputed after edits/publish. |
| **Visibility rule** | Investors only see published projects (`ProjectService.list_all`, `_readable_project` in `routes/projects.py`). Readiness data is **never** returned to anyone but the owner (`_private_report_project` returns 404). |
| **Status** | **Complete.** |

## 7. Upload project materials (with text extraction)

| | |
| --- | --- |
| **Purpose** | Let the AI read the founder's real materials, not just the form. |
| **Journey** | Project page or Readiness tab → "Project materials" → choose a type (pitch deck, business plan, market research, financial model, product/demo, supporting) → Upload files → list with size, pages, characters of text; download or remove. |
| **Frontend** | `frontend/components/ProjectIntelligence.tsx`. |
| **Backend** | `POST /projects/{id}/documents` (owner), `GET /projects/{id}/documents`, `GET …/documents/{doc_id}/file`, `DELETE …/documents/{doc_id}`; `DocumentService.save` validates type (PDF, PPTX, DOCX, TXT, MD, CSV, PNG, JPG), 25 MB per file, max 20 per project, sanitizes names, stores under `backend/private_uploads/` (not web-served) and extracts text (`pypdf`, `python-docx`, `python-pptx`). |
| **Database** | `project_documents` (metadata + `extracted_text`). |
| **Status** | **Complete.** Investors cannot download drafts' files (404). |
| **Limitations** | Files on local disk (not cloud storage); scanned PDFs without a text layer yield little text (images are passed to the AI natively, see AI doc). |

## 8. AI readiness analysis, history and PDF export

| | |
| --- | --- |
| **Purpose** | Tell founders, privately and specifically, how ready they are to pitch and what to fix. |
| **Journey** | Readiness tab (or project page) → "Re-analyze" → 1–3 minutes → overall score /100, label (e.g. "Nearly Ready: Address Key Gaps"), five dimension scores with rationale, strengths, gaps with severity, ordered suggestions, industry insights, what was analysed (documents, repo) → "Export PDF". History of runs is shown as "Progress". |
| **Frontend** | `ProjectIntelligence.tsx` (`api.analyzeProject`, `api.getReadinessReport`, `api.getProjectAnalyses`), founder dashboard Readiness tab (project picker + Export PDF). |
| **Backend** | `POST /projects/{id}/analyze` (owner) → `AnalysisService.analyze` → Claude, Gemini or rules (see `AI_IMPLEMENTATION_ANALYSIS.md`); `GET /projects/{id}/readiness`; `GET /projects/{id}/analyses`; `GET /projects/{id}/export-report` (PDF via `utils/pdf_generator.py`). |
| **Database** | `project_analyses` (every run), mirrored onto `projects.readiness_score`, `ai_readiness_breakdown`, `ai_feedback_summary`, `strengths`, `recommendations`. |
| **Business value** | Founders fix gaps before investors see them; investors receive better-prepared pitches. |
| **Status** | **Complete** with Gemini (verified live: read 3 documents + a GitHub repo in ~158 s); Claude path implemented, untested live; rules engine complete. |
| **Limitations** | No automatic switch to rules if the AI call fails (an error is shown and the previous report stays); the baseline card shows "Rule-based check · AI analysis not configured" even when an AI key exists, which can confuse; the GitHub reader sees README/tree/languages, not code contents. |

## 9. Investor criteria

| | |
| --- | --- |
| **Journey** | Investor sidebar → Criteria → pick industries, stages (chips), smallest/largest check, optional business models, technologies, geography → Save criteria ("Saved. Your matches are updated."). |
| **Frontend** | `frontend/app/investor/preferences/page.tsx`. Option lists are **shared with the founder form** (`INDUSTRIES`, `STAGES`, `BUSINESS_MODELS` in `ProjectForm.tsx`) so values can match exactly. |
| **Backend** | `GET/PUT /investors/preferences` → `InvestorService.update_preferences` → `MatchService.compute_matches_for_investor`. |
| **Database** | `investor_preferences`. |
| **Status** | **Complete.** |
| **Limitations** | Geography is stored but **not used** in scoring; technologies only matter as a fallback in the industry score. |

## 10. Explainable matching

| | |
| --- | --- |
| **Purpose** | Rank published startups for each investor and say *why*. |
| **How it works** | `MatchService.calculate_match` scores 4 factors with fixed tiers and weights: industry 40 %, stage 30 %, check size 20 %, business model 10 %. Composite clamped to 40–98.8; below 45 is not recommended. Each factor writes a sentence (e.g. "Target raise ($600,000) fits squarely inside fund's check bracket ($500,000 – $1,500,000)"). Matches ≥ 90 % notify the investor. |
| **When it runs** | On project create/update/publish, on investor criteria save, and on `POST /matches/recalculate`. **Only published projects are matched**; unpublishing a project withdraws its matches. |
| **Frontend** | Investor: Overview "Best fits", Recommended tab, Browse (fit tag), project page "Why it fits your criteria". Founder: Investors tab ("Top investor matches"). |
| **Backend** | `GET /matches` (scoped: investors see their own, founders see matches for their projects). |
| **Database** | `matches` (score, reasons JSONB, unique per project+investor). |
| **Status** | **Complete (rule-based).** Not AI/ML. |

## 11. Investor discovery: overview, recommended, browse, startup page

| | |
| --- | --- |
| **Journey** | Overview (stats, criteria summary, best fits) → Recommended (all fits with reasons) → Browse (search + industry filter over published startups) → startup page (stats, why it fits, summary/problem/solution, links, "Connect with the founder"). |
| **Frontend** | `frontend/app/investor/dashboard/page.tsx`, `frontend/app/investor/projects/[id]/page.tsx`. |
| **Backend** | `GET /projects` (published only for investors), `GET /projects/{id}`, `GET /matches`, `GET /interests`. |
| **Status** | **Complete.** |
| **Note** | Demo projects (e.g. "NeuroPulse AI", owner `founder-001`) are seeded into the same database and appear alongside real ones. |

## 12. Intro requests and the founder's response

| | |
| --- | --- |
| **Journey (investor)** | Startup page → optional personal note → Request intro → status "Intro requested" → My interests (withdraw while pending). |
| **Journey (founder)** | Notification + Overview "Needs your reply" / Intro requests tab → optional note → Accept or Decline. |
| **Frontend** | Investor project page and dashboard; founder dashboard (`introRow`). |
| **Backend** | `POST /interests` (`require_investor`; the investor id comes from the token, a spoofed id is ignored) → `InterestService.express_interest` stores **real account emails** from `app_users`, notifies the founder. `PATCH /interests/{id}/status` (`require_founder`, must own the project) → on accept, builds `deal_room` details from real data only (founder email, profile LinkedIn/website, project deck) and opens a deal room (`_open_deal_room`). `DELETE /interests/{id}` (investor withdraws). `GET /interests` is scoped; the founder's email is **hidden from the investor until accepted**. |
| **Database** | `project_interests`, `deal_rooms`, `notifications`. |
| **Status** | **Complete.** |

## 13. Deal rooms

| | |
| --- | --- |
| **Purpose** | A private space per founder–investor pair to talk, share documents and track the deal. |
| **Journey** | Sidebar → Deal rooms (search, stage filter) → open a room → stage progress bar; chat (Enter to send, typing indicator, online dot); NDA card (Sign NDA); Documents (upload a file or paste a link, choose type); contact card (email); "Update stage" (Intro accepted → Due diligence → Partner meeting → Term sheet → Closed, or Passed, with an optional note); "Activity" drawer; "Download PDF"; "Download full history" (JSON). |
| **Frontend** | `frontend/app/dealroom/page.tsx`, `frontend/app/dealroom/[id]/page.tsx`, `frontend/lib/dealroom.ts`. |
| **Backend** | `deal_room_service.py` + `routes/dealrooms.py`: list/get (participants only, `_require_participant`), messages (GET/POST), `PATCH /stage`, `POST /nda`, `POST /documents`, `GET /transcript`, `GET /export-pdf`, `GET /audit-logs`, WebSocket `/ws/{room_id}?token=` (token verified, participants only; broadcasts messages/typing/presence). |
| **Integrity** | Each message stores `previous_hash` and `integrity_hash = sha256(previous_hash|sequence|created_at|sender_id|content)`, computed in SQL at insert time; every action writes `deal_room_audit_logs`. |
| **Database** | `deal_rooms`, `deal_room_messages`, `deal_room_audit_logs`, `notifications`. |
| **Status** | **Complete.** Verified by clicking through: send, NDA, stage, share, activity. |
| **Files** | Uploaded files are stored privately (`private_uploads/dealrooms/<room>/`, `services/dealroom_files.py`) and download only for the room's two participants (`POST/GET /dealrooms/{room}/files`). Links must be http(s). |
| **Limitations** | The NDA is a click-to-sign record, not a legally executed document; stage changes take ~3 s (several sequential HTTPS SQL calls). |

## 14. In-app notifications

| | |
| --- | --- |
| **Triggers (code)** | Intro requested (→ founder), accepted / declined (→ investor), new deal-room message (→ other party), high-fit match ≥ 90 % (→ investor). |
| **Frontend** | Bell in the top bar with unread count (`PortalLayout.tsx`), Notifications tab (mark one / all read). |
| **Backend** | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/{id}/read`, `POST /notifications/mark-all-read` — scoped to the user (or role-wide broadcasts). |
| **Database** | `notifications`. |
| **Status** | **Complete.** No real-time push for notifications (refreshed on navigation). |

## 15. Transactional email

| | |
| --- | --- |
| **Code** | `EmailService.send_intro_request_email`, `send_dealroom_unlocked_email`, message alerts (`send_dealroom_message_alert`, all in `email_service.py`). |
| **Behaviour** | Sends via SMTP only if `SMTP_HOST` and `SMTP_USER` are set; otherwise appends the email to `backend/logs/emails.log`. |
| **Status** | **Partial** — no SMTP configured, so **no emails are delivered** today. |

## 16. Workspaces (founder and investor dashboards)

| | |
| --- | --- |
| **Shell** | `PortalLayout.tsx`: light sidebar (founder: Overview, Projects, Readiness, Investors, Intro requests, Deal rooms + "New project"; investor: Overview, Recommended, Browse, My interests, Deal rooms, Criteria), top bar with notifications bell and account menu (Profile, Settings, Sign out). Tabs are driven by the URL (`?tab=`), so links and back/forward work. |
| **Status** | **Complete.** Empty states explain the next step; loading skeletons; no sample data shown to real users. |

## 17. Public landing page

| | |
| --- | --- |
| **Content** | `frontend/app/page.tsx`: hero, an *example* readiness card (labelled "Example report"), How it works (3 steps), For founders / For investors, "Startups raising now" (real published projects only), call to action. `Navbar.tsx` / `Footer.tsx`. |
| **Status** | **Complete.** |

## 18. Demo data seeding

| | |
| --- | --- |
| **Code** | `backend/app/database/seed.py::seed_all` runs at every startup (`main.py` lifespan) and inserts demo projects (owner `founder-001`), demo investors (e.g. "Dr. Sarah Lin"), demo intros and deal rooms **into empty tables**. |
| **Status** | Works, but demo records live in the same database as real users and appear in browse/matching. Should be disabled or separated before production. |
