# VentureX — Frontend Requirements Inventory & Database/API Mapping

This document provides a complete reverse-engineered specification of the existing VentureX Next.js frontend, its data fields, interactive workflows, privacy boundaries, inferred MongoDB collections, and API endpoints.

---

## 1. Frontend Requirements Inventory by Page

### 1.1 Landing / Home Page
- **Route**: `/`
- **File**: `frontend/app/page.tsx`
- **Component**: `HomePage` (and shared components `Navbar`, `ProjectCard`, `StatCard`, `Footer`)
- **Purpose**: Public showcase of VentureX platform value proposition, live platform statistics, sample startup dealflow, and live backend connectivity status.
- **Displayed Data Fields**:
  - Hero headline, value proposition narrative (`frontend/app/page.tsx:59-70`)
  - Live backend health status pill: Status indicator (`Live Connection` vs `Mock Fallback`), API URL (`process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`) (`frontend/app/page.tsx:106-114`)
  - Platform metric counters: Active Startups, Verified Capital Mandates, Median Match Score (`frontend/app/page.tsx:156-175`)
  - Featured Projects Showcase: Renders list of `Project` objects using `ProjectCard` (`frontend/app/page.tsx:28`, `frontend/app/page.tsx:210-218`)
- **Inputs & Filters**:
  - Search query / sector exploration triggers (`frontend/app/page.tsx:200`)
- **Buttons & Actions**:
  - `I'm a Founder` -> links to `/founder/dashboard` (`frontend/app/page.tsx:75-81`)
  - `I'm an Investor` -> links to `/investor/dashboard` (`frontend/app/page.tsx:83-90`)
  - `Sign In` -> links to `/login` (`frontend/app/page.tsx:96`)
  - `Create Free Account` -> links to `/register` (`frontend/app/page.tsx:100`)
- **Data Privacy & Visibility**:
  - Publicly accessible.
  - Projects displayed on public landing page only show public summary data (`title`, `tagline`, `description`, `industry`, `stage`, `funding_required`).
  - Private readiness scores are masked or replaced with verified mandate badges when viewed in public/investor mode (`frontend/components/ProjectCard.tsx:40-56`).
- **Data Source**: Calls `api.checkHealth()` and `api.getProjects()`.

---

### 1.2 Authentication: Sign In
- **Route**: `/login`
- **File**: `frontend/app/login/page.tsx`
- **Component**: `LoginPage`
- **Purpose**: Authenticates registered founders and accredited investors into their respective portals.
- **Input Fields**:
  - `role`: Role selector toggle (`"FOUNDER" | "INVESTOR"`) (`frontend/app/login/page.tsx:81-106`) — Required
  - `email`: Text input (`type="email"`, required, placeholder: `you@domain.com`) (`frontend/app/login/page.tsx:109-118`) — Required
  - `password`: Password input (`type="password"`, required) (`frontend/app/login/page.tsx:131-138`) — Required
- **Interactive Triggers & Actions**:
  - Quick Demo Access Buttons (`Demo Founder`, `Demo Investor`): Bypasses credentials and routes directly to `/founder/dashboard` or `/investor/dashboard` (`frontend/app/login/page.tsx:53-67`)
  - `handleLogin`: Form submission -> routes to `/founder/dashboard` if role is `FOUNDER`, or `/investor/dashboard` if role is `INVESTOR` (`frontend/app/login/page.tsx:15-22`)
  - Link to `Forgot password?` -> routes to `/forgot-password` (`frontend/app/login/page.tsx:123-128`)
  - Link to `Sign up now` -> routes to `/register` (`frontend/app/login/page.tsx:150-152`)
- **Access Rules**: Public.

---

### 1.3 Authentication: Registration
- **Route**: `/register`
- **File**: `frontend/app/register/page.tsx`
- **Component**: `RegisterPage`
- **Purpose**: Registers a new founder or investor user and initial organization profile.
- **Input Fields**:
  - `role`: Workspace selector toggle (`"FOUNDER" | "INVESTOR"`) (`frontend/app/register/page.tsx:43-71`) — Required
  - `fullName`: Text input (`type="text"`, required, placeholder: `e.g. Jordan Vance`) (`frontend/app/register/page.tsx:74-83`) — Required
  - `organization`: Text input (`type="text"`, placeholder changes dynamically: `e.g. Synthetix Labs` for Founder, `e.g. Horizon Seed Capital` for Investor) (`frontend/app/register/page.tsx:86-96`) — Optional in UI
  - `email`: Work email (`type="email"`, required, placeholder: `jordan@venture.com`) (`frontend/app/register/page.tsx:99-108`) — Required
  - `password`: Password input (`type="password"`, required, placeholder: `Minimum 6 characters`) (`frontend/app/register/page.tsx:111-120`) — Required
- **Buttons & Actions**:
  - `handleRegister`: Form submission -> routes to respective dashboard (`frontend/app/register/page.tsx:17-24`)
  - Link to `Sign in` -> `/login` (`frontend/app/register/page.tsx:132-134`)
- **Access Rules**: Public.

---

### 1.4 Authentication: Forgot Password
- **Route**: `/forgot-password`
- **File**: `frontend/app/forgot-password/page.tsx`
- **Component**: `ForgotPasswordPage`
- **Purpose**: Account recovery request.
- **Input Fields**:
  - `email`: Account email address (`type="email"`, required) (`frontend/app/forgot-password/page.tsx:60-69`) — Required
- **Actions**:
  - `handleSubmit`: Displays confirmation banner `"Password Reset Link Dispatched"` (`frontend/app/forgot-password/page.tsx:39-56`).
- **Access Rules**: Public. `NEEDS CONFIRMATION`: Whether real email dispatch (SendGrid/Resend) is required in Phase 3 or a stub endpoint suffices.

---

### 1.5 Founder Portal: Dashboard & Tabs
- **Route**: `/founder/dashboard` (with query parameter `?tab=overview|projects|readiness|investors|notifications|profile|settings`)
- **File**: `frontend/app/founder/dashboard/page.tsx`
- **Component**: `FounderDashboardContent` / `FounderDashboardPage` inside `PortalLayout`
- **Purpose**: Central operational hub for startup founders to manage confidential project drafts, review AI readiness diagnostics, browse matched investors, and configure privacy settings.
- **Tabs Discovered**:

#### Tab A: `overview` (`frontend/app/founder/dashboard/page.tsx:185-291`)
- **Displayed Data**:
  - Top Statistics (`StatCard`): Active Projects count, AI Readiness Score (`92.4`), Matched Theses count, Intro Requests count (`frontend/app/founder/dashboard/page.tsx:189-217`).
  - Privacy status indicator: "Founder Confidentiality Guaranteed - Projects are private by default" (`frontend/app/founder/dashboard/page.tsx:220-239`).
  - Projects summary preview: Shows first 3 projects via `ProjectCard` (`frontend/app/founder/dashboard/page.tsx:257-260`).
  - Recommended investors summary preview: Shows first 3 matches via `InvestorCard` (`frontend/app/founder/dashboard/page.tsx:279-287`).
- **Actions**:
  - `Submit New Project` button -> routes to `/founder/projects/new`.
  - `View all (n) →` for projects -> switches tab to `projects`.
  - `View all matches (n) →` for investors -> switches tab to `investors`.
  - `Privacy Settings` button -> switches tab to `settings`.
  - `onExpressInterest` on `InvestorCard` -> alerts introduction request submitted (`frontend/app/founder/dashboard/page.tsx:283-285`).

#### Tab B: `projects` (`frontend/app/founder/dashboard/page.tsx:294-399`)
- **Displayed Data**:
  - Projects Inventory Table (`frontend/app/founder/dashboard/page.tsx:313-390`):
    - `Startup Name` (`proj.title`, `proj.tagline || proj.description`)
    - `Industry / Stage` badges (`proj.industry`, `proj.stage`)
    - `Target Raise` (`$${proj.funding_required / 1000}k`)
    - `Readiness Score` badge (`proj.readiness_score`)
    - `Investor Visibility` status badge (`Published` vs `Private (Draft)`)
    - Actions: `Report` button (switches to `readiness` tab), `Overview` link (routes to `/founder/projects/${proj.id}`)
  - Projects Grid: Cards rendering all founder's projects via `ProjectCard`.
- **Actions**:
  - `Add Another Project` button -> routes to `/founder/projects/new`.
  - `togglePublish(proj.id)`: Toggles publication status between Private Draft and Published to Syndicate (`frontend/app/founder/dashboard/page.tsx:102-107`, `frontend/app/founder/dashboard/page.tsx:350-370`).

#### Tab C: `readiness` (`frontend/app/founder/dashboard/page.tsx:402-535`)
- **Displayed Data**:
  - Diagnostic Report Title & Model indicator: `Model: Readiness Engine v2.4` (`frontend/app/founder/dashboard/page.tsx:408`).
  - Overall Composite Score: Large circular score dial (`92.4 out of 100`) + Status badge (`Ready for Investor Presentation`) (`frontend/app/founder/dashboard/page.tsx:449-474`).
  - 4 Dimension Progress Bars:
    1. Problem / Solution Fit (`score: 94%`, description)
    2. Traction & Feasibility (`score: 95%`, description)
    3. Business Model Clarity (`score: 92%`, description)
    4. Market Sizing & ICP (`score: 88%`, description) (`frontend/app/founder/dashboard/page.tsx:485-505`)
  - Key Pitch Strengths list (`frontend/app/founder/dashboard/page.tsx:509-519`): e.g. Proprietary neural IP, clinical verification, 10x speed.
  - AI Action Recommendations list (`frontend/app/founder/dashboard/page.tsx:521-530`): e.g. FDA 510(k) pathway milestones, sensor BOM costs.
  - Confidentiality Callout: Explicit reminder that readiness scores and weaknesses are never shared with investors (`frontend/app/founder/dashboard/page.tsx:437-444`).
- **Actions**:
  - `Re-evaluate` button (`handleReanalyze`): Triggers recalculation spinner (`frontend/app/founder/dashboard/page.tsx:420-426`).
  - `Export Report` button: Generates PDF summary (`frontend/app/founder/dashboard/page.tsx:428-433`).

#### Tab D: `investors` (`frontend/app/founder/dashboard/page.tsx:538-572`)
- **Displayed Data**:
  - Search input: `Search investor, fund or thesis...` (`frontend/app/founder/dashboard/page.tsx:549-556`).
  - Grid of `InvestorCard` components showing match percentage, firm name, explainable match reasons (`category`, `explanation`, `weight`), and target project title (`frontend/app/founder/dashboard/page.tsx:561-570`).
- **Actions**:
  - `Request Introduction` on card: Sends introduction request to investor (`frontend/app/founder/dashboard/page.tsx:565-567`).

#### Tab E: `notifications` (`frontend/app/founder/dashboard/page.tsx:575-617`)
- **Displayed Data**:
  - List of notifications with `title`, `desc`, `time`, `badge`, and `badgeVariant` (e.g. Mandate matches, AI readiness updates, confidentiality checks).

#### Tab F: `profile` (`frontend/app/founder/dashboard/page.tsx:620-710`)
- **Input Fields & Form**:
  - `name`: Full Name (`type="text"`, default: `"Alex Rivers"`)
  - `company`: Primary Company Name (`type="text"`, default: `"NeuroPulse AI"`)
  - `bio`: Founder Bio / Background (`textarea`, 3 rows)
  - `location`: Location (`type="text"`, default: `"San Francisco, CA"`)
  - `linkedin`: LinkedIn Profile (`type="url"`)
  - `website`: Company Website (`type="url"`)
- **Actions**:
  - `Save Profile` (`handleProfileSave`): Submits founder profile updates (`frontend/app/founder/dashboard/page.tsx:90-94`).

#### Tab G: `settings` (`frontend/app/founder/dashboard/page.tsx:713-811`)
- **Input Fields & Controls**:
  - `defaultPrivate`: Checkbox (`"Private by Default"`) — Editable
  - `hideGapsFromInvestors`: Checkbox (`"Confidential AI Readiness Rule"`) — Read-only/Disabled (locked to `true`)
  - `emailAlerts`: Checkbox (`"Email Notifications for High-Score Matches (>90%)"`) — Editable
  - `weeklyDigest`: Checkbox (`"Weekly Dealflow Digest"`) — Editable
- **Actions**:
  - `Save Preferences` (`handleSettingsSave`): Updates workspace preferences (`frontend/app/founder/dashboard/page.tsx:96-100`).

---

### 1.6 Founder Portal: Create Project
- **Route**: `/founder/projects/new`
- **File**: `frontend/app/founder/projects/new/page.tsx`
- **Component**: `NewProjectPage` inside `PortalLayout`
- **Purpose**: Confidential intake wizard for founders to document technology mechanics and trigger AI readiness evaluation.
- **Input Fields & Validation Rules**:
  1. *Section 1: Startup Identity*
     - `title`: Startup Name (`type="text"`, required, placeholder: `e.g., OmniFlow AI`) (`frontend/app/founder/projects/new/page.tsx:188-198`) — Required
     - `tagline`: One-Line Elevator Tagline (`type="text"`, optional) (`frontend/app/founder/projects/new/page.tsx:201-211`) — Optional
     - `description`: Executive Project Summary (`textarea`, required, 3 rows) (`frontend/app/founder/projects/new/page.tsx:214-225`) — Required
  2. *Section 2: Problem & Solution Mechanics*
     - `problem`: Critical Market Problem (`textarea`, required, 3 rows) (`frontend/app/founder/projects/new/page.tsx:236-247`) — Required
     - `solution`: Proprietary Solution (`textarea`, required, 3 rows) (`frontend/app/founder/projects/new/page.tsx:250-261`) — Required
  3. *Section 3: Sector, Stage & Capital Target*
     - `industry`: Select dropdown (`frontend/app/founder/projects/new/page.tsx:273-286`) — Required. Options: `AI/ML`, `Healthcare & AI`, `ClimateTech`, `Cybersecurity`, `Fintech`, `Developer Tools`, `BioTech`, `Robotics`, `B2B SaaS`, `Web3 & Infrastructure`.
     - `stage`: Select dropdown (`frontend/app/founder/projects/new/page.tsx:290-304`) — Required. Options: `Idea Phase`, `Prototype`, `MVP / Private Beta`, `Early Traction`, `Pre-seed`, `Seed`, `Series A`.
     - `funding_required`: Number input with `$` prefix (`min=10000`, `step=25000`, required) (`frontend/app/founder/projects/new/page.tsx:307-324`) — Required.
     - `business_model`: Select dropdown (`frontend/app/founder/projects/new/page.tsx:329-342`) — Required. Options: `B2B SaaS`, `Enterprise Licensing`, `Marketplace / Commission`, `Usage-Based API`, `Hardware + Recurring Software`, `D2C Subscription`.
     - `target_market`: Customer & Market ICP (`type="text"`, required) (`frontend/app/founder/projects/new/page.tsx:346-357`) — Required.
  4. *Section 4: Pitch Deck & Links*
     - `website`: Product Website URL (`type="url"`, optional) (`frontend/app/founder/projects/new/page.tsx:370-380`) — Optional.
     - `pitch_deck_url`: Pitch Deck URL (`type="url"`, optional) (`frontend/app/founder/projects/new/page.tsx:383-393`) — Optional.
  5. *Section 5: Publication Setting*
     - `makePublicNow`: Checkbox (`"Publish immediately to verified syndicate investors"`) (`frontend/app/founder/projects/new/page.tsx:399-412`). Defaults to unchecked (`false`).
- **Actions**:
  - `handleSubmit`: Calls `api.createProject(formData)`. Displays success modal with preliminary readiness score and AI feedback summary (`frontend/app/founder/projects/new/page.tsx:77-90`, `frontend/app/founder/projects/new/page.tsx:122-167`).
  - `Cancel` -> `/founder/dashboard`.

---

### 1.7 Founder Portal: Project Overview
- **Route**: `/founder/projects/[id]`
- **File**: `frontend/app/founder/projects/[id]/page.tsx`
- **Component**: `ProjectOverviewPage` inside `PortalLayout`
- **Purpose**: Detailed private inspection view of a single project for its owner founder.
- **Displayed Data**:
  - Title, Tagline, Industry, Stage, Business Model (`frontend/app/founder/projects/[id]/page.tsx:68-97`).
  - Visibility status pill: `Published to Investors` vs `Private Draft` (`frontend/app/founder/projects/[id]/page.tsx:73-88`).
  - Metrics: Target Raise (`formattedFunding`), Private Readiness Score (`readiness_score`), Syndicate Matches counter (`frontend/app/founder/projects/[id]/page.tsx:121-165`).
  - Full Narrative: Project Description, Market Problem, Proprietary Solution (`frontend/app/founder/projects/[id]/page.tsx:171-198`).
  - Venture Metadata: Target Market / ICP, Website link, Created date (`frontend/app/founder/projects/[id]/page.tsx:203-236`).
  - Link to AI Diagnostic Report -> `/founder/dashboard?tab=readiness` (`frontend/app/founder/projects/[id]/page.tsx:239-253`).
- **Actions**:
  - `Publish to Syndicate` / `Set to Private Draft`: Toggles publication status (`frontend/app/founder/projects/[id]/page.tsx:100-109`).
  - `Edit Profile` button -> links to `/founder/projects/${project.id}/edit` (`frontend/app/founder/projects/[id]/page.tsx:110-116`).
  - `Back to Projects Inventory` -> `/founder/dashboard?tab=projects` (`frontend/app/founder/projects/[id]/page.tsx:58-63`).

---

### 1.8 Founder Portal: Edit Project
- **Route**: `/founder/projects/[id]/edit`
- **File**: `frontend/app/founder/projects/[id]/edit/page.tsx`
- **Component**: `EditProjectPage` inside `PortalLayout`
- **Purpose**: Modifies existing project parameters.
- **Input Fields**:
  - `title`: Startup Name (`type="text"`, required)
  - `tagline`: Tagline (`type="text"`, optional)
  - `description`: Description (`textarea`, 3 rows)
  - `industry`: Select dropdown (10 industries)
  - `stage`: Select dropdown (7 stages)
  - `funding_required`: Target Raise (USD)
- **Actions**:
  - `Save Changes`: Submits updates and redirects back to `/founder/projects/${projectId}` (`frontend/app/founder/projects/[id]/edit/page.tsx:95-105`).
  - `Cancel` -> `/founder/projects/${projectId}`.

---

### 1.9 Investor Portal: Dashboard & Tabs
- **Route**: `/investor/dashboard` (with query parameter `?tab=overview|recommended|browse|interests|notifications|profile|settings`)
- **File**: `frontend/app/investor/dashboard/page.tsx`
- **Component**: `InvestorDashboardContent` / `InvestorDashboardPage` inside `PortalLayout`
- **Purpose**: Dealflow screening, recommendation pipeline, sector browsing, founder introduction tracking, and mandate configuration for accredited investors.
- **Tabs Discovered**:

#### Tab A: `overview` (`frontend/app/investor/dashboard/page.tsx:165-251`)
- **Displayed Data**:
  - Top Metrics: Recommended Deals count, Pipeline Startups count, Expressed Interests count, Target Allocation bracket (`$500K - $1.5M Seed Mandate`) (`frontend/app/investor/dashboard/page.tsx:168-197`).
  - Active Fund Target Criteria Card: Sector list and check size summary (`frontend/app/investor/dashboard/page.tsx:199-219`).
  - High-Conviction Thesis Matches: Renders top projects using `ProjectCard` with `isInvestorView={true}` (`frontend/app/investor/dashboard/page.tsx:222-250`).
- **Actions**:
  - `Adjust Match Preferences` / `Edit Investment Criteria` -> links to `/investor/preferences` (`frontend/app/investor/dashboard/page.tsx:154-160`, `frontend/app/investor/dashboard/page.tsx:213-218`).
  - `onConnect` (`toggleInterest`): Expresses introduction interest in a project (`frontend/app/investor/dashboard/page.tsx:82-88`, `frontend/app/investor/dashboard/page.tsx:245`).

#### Tab B: `recommended` (`frontend/app/investor/dashboard/page.tsx:254-274`)
- **Displayed Data**:
  - Grid of projects ranked by semantic vector cosine similarity.
  - Cards rendered with `isInvestorView={true}` (hides private readiness score, displays verified mandate badge).

#### Tab C: `browse` (`frontend/app/investor/dashboard/page.tsx:277-324`)
- **Interactive Filters & Inputs**:
  - Sector filter buttons: `All`, `Healthcare`, `ClimateTech`, `Cybersecurity`, `Fintech` (`frontend/app/investor/dashboard/page.tsx:285-297`).
  - Search input: `Search startups or tech...` (`frontend/app/investor/dashboard/page.tsx:302-310`).
- **Displayed Data**: Filtered grid of `ProjectCard` components.

#### Tab D: `interests` (`frontend/app/investor/dashboard/page.tsx:327-360`)
- **Displayed Data**:
  - Startups flagged for introduction requests.
  - Empty state with CTA button `Browse Startups Pipeline` when no interests exist (`frontend/app/investor/dashboard/page.tsx:336-346`).

#### Tab E: `notifications` (`frontend/app/investor/dashboard/page.tsx:363-396`)
- **Displayed Data**: Dealflow availability alerts, high-cosine mandate match notifications.

#### Tab F: `profile` (`frontend/app/investor/dashboard/page.tsx:399-498`)
- **Input Fields & Form**:
  - `name`: Partner Full Name (`type="text"`, default: `"Dr. Sarah Lin"`)
  - `firm`: Firm / Fund Name (`type="text"`, default: `"Apex Horizon Ventures"`)
  - `title`: Partner Title (`type="text"`, default: `"General Partner"`)
  - `thesis`: Fund Investment Thesis (`textarea`, 3 rows)
  - `minCheck`: Minimum Check Size (`type="text"`, default: `"$500,000"`)
  - `maxCheck`: Maximum Check Size (`type="text"`, default: `"$1,500,000"`)
- **Actions**:
  - `Save Investor Profile`: Submits investor profile updates (`frontend/app/investor/dashboard/page.tsx:416-422`).

#### Tab G: `settings` (`frontend/app/investor/dashboard/page.tsx:501-566`)
- **Input Fields & Controls**:
  - `autoNotifyHighConviction`: Checkbox (`"Real-time Notifications for >90% Matches"`)
  - `weeklyDealflowSummary`: Checkbox (`"Weekly Curated Dealflow Digest"`)
- **Actions**:
  - `Save Settings`: Submits notification preferences.

---

### 1.10 Investor Portal: Investment Criteria / Preferences
- **Route**: `/investor/preferences`
- **File**: `frontend/app/investor/preferences/page.tsx`
- **Component**: `InvestorPreferencesPage` inside `PortalLayout`
- **Purpose**: High-precision thesis configuration to calibrate vector matching and hard filter screening.
- **Input Fields & Controls**:
  1. *Target Industry Sectors* (Multi-select pill buttons) (`frontend/app/investor/preferences/page.tsx:147-179`):
     - `AI/ML`, `Healthcare & AI`, `ClimateTech`, `Cybersecurity`, `Fintech`, `Developer Tools`, `BioTech`, `Robotics`, `B2B SaaS`, `Web3 & Infrastructure`.
  2. *Target Stages* (Multi-select pill buttons) (`frontend/app/investor/preferences/page.tsx:189-208`):
     - `Idea Phase`, `Prototype`, `MVP / Beta`, `Pre-seed`, `Seed`, `Series A`, `Series B`.
  3. *Ticket Bracket*:
     - `min_investment`: Minimum Check Size in USD (`type="number"`, step: 25000) (`frontend/app/investor/preferences/page.tsx:217-226`).
     - `max_investment`: Maximum Check Size in USD (`type="number"`, step: 50000) (`frontend/app/investor/preferences/page.tsx:234-243`).
  4. *Business Models* (Multi-select pill buttons) (`frontend/app/investor/preferences/page.tsx:257-275`):
     - `B2B SaaS`, `Enterprise Infrastructure`, `Marketplace / Commission`, `Usage-Based API`, `DeepTech IP Licensing`, `Hardware + Software`.
  5. *Core Tech Paradigms* (Multi-select pill buttons) (`frontend/app/investor/preferences/page.tsx:280-299`):
     - `Generative AI & LLMs`, `Edge Machine Learning`, `Post-Quantum Cryptography`, `Computer Vision`, `Bioinformatics`, `Autonomous Robotics`.
  6. *Geographic Scope*:
     - `geography`: Text input (`type="text"`, placeholder: `e.g., North America, Europe, or Global Remote`) (`frontend/app/investor/preferences/page.tsx:307-314`).
- **Actions**:
  - `Save Mandate Preferences` (`handleSave`): Calls `api.updateInvestorPreferences(preferences)` (`frontend/app/investor/preferences/page.tsx:87-99`).
  - `Back to Dealflow Dashboard` -> `/investor/dashboard`.

---

### 1.11 Investor Portal: Project Details
- **Route**: `/investor/projects/[id]`
- **File**: `frontend/app/investor/projects/[id]/page.tsx`
- **Component**: `InvestorProjectDetailsPage` inside `PortalLayout`
- **Purpose**: Investor due-diligence view of a founder-published startup.
- **Displayed Data**:
  - Startup Title, Tagline, Industry, Stage, Business Model (`frontend/app/investor/projects/[id]/page.tsx:71-86`).
  - Founder-approved mandate badge (`frontend/app/investor/projects/[id]/page.tsx:75-77`).
  - Semantic Thesis Alignment Card: Match score percentage (`matchItem.match_score.toFixed(1)}% Match`) and categorized explainable reasons (`r.category: r.explanation`) (`frontend/app/investor/projects/[id]/page.tsx:105-129`).
  - Deal Metrics: Target Raise Ask, Round Structure (`project.stage / Equity`) (`frontend/app/investor/projects/[id]/page.tsx:132-160`).
  - Executive Summary, Market Pain Point, Proprietary Solution (`frontend/app/investor/projects/[id]/page.tsx:165-192`).
  - Founder-Approved Metadata: Target ICP, Product URL (`frontend/app/investor/projects/[id]/page.tsx:197-223`).
  - Deal Room Access card (`frontend/app/investor/projects/[id]/page.tsx:225-237`).
- **Actions**:
  - `Request Introduction` (`handleRequestIntro`): Changes state to `"Intro Requested ✓"` / `"Intro Pending"` (`frontend/app/investor/projects/[id]/page.tsx:89-101`, `frontend/app/investor/projects/[id]/page.tsx:231-236`).
  - `Back to Dealflow Pipeline` -> `/investor/dashboard?tab=browse`.
- **Privacy Enforcement**:
  - `readiness_score`, `ai_readiness_breakdown`, `ai_feedback_summary`, strengths, and improvement recommendations are **NOT rendered** on this page.

---

## 2. Inferred MongoDB Database Schema

The database design uses document embedding where data is tightly coupled to an entity's lifecycle (e.g. settings, readiness breakdowns), and separate collections for independent querying, relationship joins, and secure access boundaries.

Database Name: `VentureX`

### Collection 1: `users`
- **Purpose**: Central authentication and role identity for founders, investors, and administrators.
- **Used by**: `/login`, `/register`, Navbar, Auth middleware.
- **Fields & BSON Types**:
  - `_id`: `ObjectId` — Unique user identifier.
  - `email`: `String` (Required, unique, lowercase, trimmed) — User work email.
  - `hashed_password`: `String` (Required) — bcrypt-hashed password (never returned in responses).
  - `role`: `String` (Required, enum: `"FOUNDER"`, `"INVESTOR"`, `"ADMIN"`).
  - `full_name`: `String` (Required, captured during registration).
  - `organization`: `String` (Optional, company/firm name captured during registration).
  - `is_active`: `Boolean` (Default: `true`) — Operational account status.
  - `created_at`: `Date` (Required) — Timestamp.
  - `updated_at`: `Date` (Required) — Timestamp.
- **Indexes**:
  - `email`: Unique index `{ "email": 1 }` (sparse: false).

---

### Collection 2: `founder_profiles`
- **Purpose**: Stores the public/matched identity of founders and their primary venture information.
- **Used by**: `/founder/dashboard` (Profile tab), Investor view of founders.
- **Fields & BSON Types**:
  - `_id`: `ObjectId`.
  - `user_id`: `ObjectId` (Required, unique reference to `users._id`).
  - `full_name`: `String` (Optional/Editable).
  - `company_name`: `String` (Optional/Editable).
  - `bio`: `String` (Optional/Editable, founder background narrative).
  - `location`: `String` (Optional/Editable, e.g. "San Francisco, CA").
  - `linkedin_url`: `String` (Optional/Editable).
  - `website`: `String` (Optional/Editable).
  - `settings`: `Object` (Embedded subdocument):
    - `default_private`: `Boolean` (Default: `true`).
    - `hide_gaps_from_investors`: `Boolean` (Enforced: `true`).
    - `email_alerts`: `Boolean` (Default: `true`).
    - `weekly_digest`: `Boolean` (Default: `false`).
  - `created_at`: `Date`.
  - `updated_at`: `Date`.
- **Indexes**:
  - `user_id`: Unique index `{ "user_id": 1 }`.

---

### Collection 3: `investor_profiles`
- **Purpose**: Stores accredited investor identity, fund credentials, check size limits, and investment thesis.
- **Used by**: `/investor/dashboard` (Profile tab), Founder discovery view.
- **Fields & BSON Types**:
  - `_id`: `ObjectId`.
  - `user_id`: `ObjectId` (Required, unique reference to `users._id`).
  - `full_name`: `String` (Optional/Editable).
  - `firm_name`: `String` (Optional/Editable).
  - `title`: `String` (Optional/Editable, e.g. "General Partner").
  - `bio`: `String` (Optional/Editable).
  - `location`: `String` (Optional/Editable).
  - `investment_thesis`: `String` (Optional/Editable).
  - `min_check`: `Double` (Optional/Editable, numeric check size, e.g. 500000.0).
  - `max_check`: `Double` (Optional/Editable, numeric check size, e.g. 1500000.0).
  - `settings`: `Object` (Embedded subdocument):
    - `auto_notify_high_conviction`: `Boolean` (Default: `true`).
    - `weekly_dealflow_summary`: `Boolean` (Default: `true`).
    - `direct_founder_messaging`: `Boolean` (Default: `true`).
  - `created_at`: `Date`.
  - `updated_at`: `Date`.
- **Indexes**:
  - `user_id`: Unique index `{ "user_id": 1 }`.
  - `firm_name`: Index `{ "firm_name": 1 }`.

---

### Collection 4: `investor_preferences`
- **Purpose**: Stores explicit matching criteria for vector cosine similarity and sector filtering.
- **Used by**: `/investor/preferences`, Matching Engine.
- **Fields & BSON Types**:
  - `_id`: `ObjectId`.
  - `investor_id`: `ObjectId` (Required, unique reference to `investor_profiles._id` or `users._id`).
  - `preferred_industries`: `Array[String]` (e.g. `["Healthcare & AI", "AI/ML"]`).
  - `preferred_stages`: `Array[String]` (e.g. `["Seed", "Series A"]`).
  - `min_investment`: `Double` (Default: `100000.0`).
  - `max_investment`: `Double` (Default: `1500000.0`).
  - `preferred_business_models`: `Array[String]` (e.g. `["B2B SaaS"]`).
  - `tech_preferences`: `Array[String]` (e.g. `["Edge Machine Learning"]`).
  - `geography`: `String` (Default: `"Global"`).
  - `thesis_embedding`: `Array[Double]` (Optional, vector representation for future semantic search).
  - `created_at`: `Date`.
  - `updated_at`: `Date`.
- **Indexes**:
  - `investor_id`: Unique index `{ "investor_id": 1 }`.

---

### Collection 5: `projects`
- **Purpose**: Central repository of startup pitches, market problems, target funding, publication state, and confidential AI diagnostic evaluations.
- **Used by**: `/founder/projects/new`, `/founder/projects/[id]`, `/founder/projects/[id]/edit`, `/founder/dashboard` (Projects tab), `/investor/dashboard` (Browse & Recommended tabs), `/investor/projects/[id]`.
- **Fields & BSON Types**:
  - `_id`: `ObjectId`.
  - `founder_id`: `ObjectId` (Required, reference to `users._id` / `founder_profiles._id`).
  - `title`: `String` (Required, min 2 chars).
  - `tagline`: `String` (Optional).
  - `description`: `String` (Required, executive project summary).
  - `problem`: `String` (Required, critical market problem).
  - `solution`: `String` (Required, proprietary breakthrough solution).
  - `industry`: `String` (Required, validated against the 10 UI sectors).
  - `stage`: `String` (Required, validated against the 7 UI stages).
  - `funding_required`: `Double` (Required, positive number).
  - `business_model`: `String` (Required, validated against UI business models).
  - `target_market`: `String` (Required, ICP description).
  - `website`: `String` (Optional URL).
  - `pitch_deck_url`: `String` (Optional URL).
  - `is_published`: `Boolean` (Default: `false`) — **Crucial Privacy Boundary**: Only published projects are discoverable by investors.
  - `readiness_score`: `Double` (Optional, 0-100 float) — **CONFIDENTIAL TO FOUNDER**.
  - `ai_readiness_breakdown`: `Object` (Optional) — **CONFIDENTIAL TO FOUNDER**:
    - `problem_solution_fit`: `Double`.
    - `market_sizing`: `Double`.
    - `business_model_clarity`: `Double`.
    - `traction_feasibility`: `Double`.
  - `ai_feedback_summary`: `String` (Optional) — **CONFIDENTIAL TO FOUNDER**.
  - `strengths`: `Array[String]` (Optional) — **CONFIDENTIAL TO FOUNDER**.
  - `recommendations`: `Array[String]` (Optional) — **CONFIDENTIAL TO FOUNDER**.
  - `project_embedding`: `Array[Double]` (Optional, for vector matching).
  - `created_at`: `Date`.
  - `updated_at`: `Date`.
- **Indexes**:
  - `founder_id`: Index `{ "founder_id": 1 }`.
  - `is_published`: Index `{ "is_published": 1 }` (for investor filtering).
  - Compound filter index: `{ "is_published": 1, "industry": 1, "stage": 1 }`.
  - Text search index: `{ "title": "text", "description": "text", "target_market": "text" }`.

---

### Collection 6: `matches`
- **Purpose**: Stores synthesized AI recommendations connecting projects with investors with explainable reasoning categories.
- **Used by**: `/founder/dashboard` (Investors tab), `/investor/dashboard` (Recommended tab), `/investor/projects/[id]`.
- **Fields & BSON Types**:
  - `_id`: `ObjectId`.
  - `project_id`: `ObjectId` (Required, reference to `projects._id`).
  - `investor_id`: `ObjectId` (Required, reference to `users._id` / `investor_profiles._id`).
  - `founder_id`: `ObjectId` (Required, for fast founder lookup).
  - `match_score`: `Double` (Required, percentage e.g. 96.4).
  - `reasons`: `Array[Object]` (Required, explainable reasons):
    - `category`: `String` (e.g. "Industry Focus", "Stage Alignment").
    - `explanation`: `String`.
    - `weight`: `Double` (e.g. 0.45).
  - `status`: `String` (Enum: `"recommended"`, `"interested"`, `"connected"`, `"dismissed"`).
  - `created_at`: `Date`.
  - `updated_at`: `Date`.
- **Indexes**:
  - Compound unique: `{ "project_id": 1, "investor_id": 1 }` (unique: true).
  - `founder_id`: Index `{ "founder_id": 1, "match_score": -1 }`.
  - `investor_id`: Index `{ "investor_id": 1, "match_score": -1 }`.

---

### Collection 7: `project_interests`
- **Purpose**: Tracks expressed introduction requests and deal room connection dialogues between investors and founders.
- **Used by**: `/investor/dashboard` (My Interests tab), `/investor/projects/[id]` ("Request Introduction"), `/founder/dashboard` ("Intro Requests").
- **Fields & BSON Types**:
  - `_id`: `ObjectId`.
  - `project_id`: `ObjectId` (Required, reference to `projects._id`).
  - `investor_id`: `ObjectId` (Required, reference to `users._id`).
  - `founder_id`: `ObjectId` (Required, owner of the project).
  - `status`: `String` (Enum: `"pending"`, `"accepted"`, `"declined"`, Default: `"pending"`).
  - `message`: `String` (Optional introductory note).
  - `created_at`: `Date`.
  - `updated_at`: `Date`.
- **Indexes**:
  - Compound unique: `{ "project_id": 1, "investor_id": 1 }` (unique: true).
  - `founder_id`: Index `{ "founder_id": 1, "status": 1 }`.
  - `investor_id`: Index `{ "investor_id": 1 }`.

---

### Collection 8: `notifications`
- **Purpose**: System and workflow notifications for both founders and investors.
- **Used by**: `/founder/dashboard` (Notifications tab), `/investor/dashboard` (Notifications tab).
- **Fields & BSON Types**:
  - `_id`: `ObjectId`.
  - `user_id`: `ObjectId` (Required, target user).
  - `title`: `String` (Required).
  - `desc`: `String` (Required).
  - `badge`: `String` (e.g. "Match", "Analysis", "Dealflow", "Security").
  - `badge_variant`: `String` (e.g. "primary", "secondary", "success").
  - `read`: `Boolean` (Default: `false`).
  - `created_at`: `Date`.
- **Indexes**:
  - `user_id`: Index `{ "user_id": 1, "created_at": -1 }`.

---

## 3. Page-to-Database-to-API Mapping Table

| Frontend Page / User Action | Required Data / Payload | MongoDB Collection(s) | API Endpoint | HTTP Method | Access Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Landing Page** (`/`) | Public project listings | `projects` | `/api/projects` | `GET` | Public (Only `is_published: true`; private scores masked) |
| **Landing Page** (`/`) | Health / readiness check | N/A | `/api/health` | `GET` | Public |
| **Register** (`/register`) | `fullName`, `organization`, `email`, `password`, `role` | `users`, `founder_profiles` or `investor_profiles` | `/api/auth/register` | `POST` | Public |
| **Login** (`/login`) | `email`, `password`, `role` | `users` | `/api/auth/login` | `POST` | Public (Returns JWT token) |
| **Forgot Password** (`/forgot-password`) | `email` | `users` | `/api/auth/forgot-password` | `POST` | Public (`NEEDS CONFIRMATION` for email dispatch) |
| **Founder Dashboard** — Overview tab | Founder projects, top matches, summary counts | `projects`, `matches`, `project_interests` | `/api/projects?founder_only=true`, `/api/matches` | `GET` | Authenticated (Founder only) |
| **Founder Dashboard** — Projects tab | All founder projects with publication status | `projects` | `/api/projects?founder_only=true` | `GET` | Authenticated (Founder only) |
| **Founder Dashboard** — Toggle Publish | `is_published: boolean` | `projects` | `/api/projects/{id}/publish` | `PATCH` | Authenticated (Founder owner only) |
| **Founder Dashboard** — Readiness tab | Diagnostic breakdown, strengths, action items | `projects` | `/api/projects/{id}/readiness` | `GET` | Authenticated (Founder owner only, strictly confidential) |
| **Founder Dashboard** — Re-evaluate pitch | Trigger new AI diagnostic run | `projects` | `/api/projects/{id}/re-evaluate` | `POST` | Authenticated (Founder owner only) |
| **Founder Dashboard** — Export PDF | Diagnostic report summary | `projects` | `/api/projects/{id}/export-report` | `GET` | Authenticated (Founder owner only) |
| **Founder Dashboard** — Investor Directory | Matches list filtered by search keyword | `matches`, `investor_profiles` | `/api/matches?search=...` | `GET` | Authenticated (Founder only) |
| **Founder Dashboard** — Request Intro | `match_id` or `investor_id`, `project_id` | `project_interests` | `/api/interests` | `POST` | Authenticated (Founder or Investor) |
| **Founder Dashboard** — Profile tab | `full_name`, `company`, `bio`, `location`, `linkedin`, `website` | `founder_profiles` | `/api/founders/profile` | `GET`, `PUT` | Authenticated (Founder only) |
| **Founder Dashboard** — Settings tab | `defaultPrivate`, `emailAlerts`, `weeklyDigest` | `founder_profiles` | `/api/founders/settings` | `GET`, `PUT` | Authenticated (Founder only) |
| **Create Project** (`/founder/projects/new`) | `title`, `tagline`, `description`, `problem`, `solution`, `industry`, `stage`, `funding_required`, `business_model`, `target_market`, `website`, `pitch_deck_url`, `is_published` | `projects` | `/api/projects` | `POST` | Authenticated (Founder only; triggers preliminary scoring) |
| **Project Overview** (`/founder/projects/[id]`) | Detailed project document | `projects` | `/api/projects/{id}` | `GET` | Authenticated (Founder owner only) |
| **Edit Project** (`/founder/projects/[id]/edit`) | Updated project fields | `projects` | `/api/projects/{id}` | `PUT` | Authenticated (Founder owner only) |
| **Investor Dashboard** — Overview tab | Pipeline projects, thesis matches, target metrics | `projects`, `matches`, `investor_preferences` | `/api/projects`, `/api/matches`, `/api/investors/preferences` | `GET` | Authenticated (Investor only; only published projects) |
| **Investor Dashboard** — Browse tab | Published projects filtered by sector and search | `projects` | `/api/projects?industry=...&search=...` | `GET` | Authenticated (Investor only; only published projects) |
| **Investor Dashboard** — Recommended tab | Semantic vector matches | `matches`, `projects` | `/api/matches` | `GET` | Authenticated (Investor only) |
| **Investor Dashboard** — Express Interest | `project_id` | `project_interests` | `/api/interests` | `POST` | Authenticated (Investor only) |
| **Investor Dashboard** — My Interests tab | List of projects with expressed interest | `project_interests`, `projects` | `/api/interests` | `GET` | Authenticated (Investor only) |
| **Investor Dashboard** — Profile tab | `name`, `firm`, `title`, `thesis`, `minCheck`, `maxCheck` | `investor_profiles` | `/api/investors/profile` | `GET`, `PUT` | Authenticated (Investor only) |
| **Investor Dashboard** — Settings tab | `autoNotifyHighConviction`, `weeklyDealflowSummary` | `investor_profiles` | `/api/investors/settings` | `GET`, `PUT` | Authenticated (Investor only) |
| **Investment Criteria** (`/investor/preferences`) | `preferred_industries`, `preferred_stages`, `min_investment`, `max_investment`, `preferred_business_models`, `tech_preferences`, `geography` | `investor_preferences` | `/api/investors/preferences` | `GET`, `PUT` | Authenticated (Investor only) |
| **Investor Project Details** (`/investor/projects/[id]`) | Published project details + match alignment | `projects`, `matches` | `/api/projects/{id}` | `GET` | Authenticated (Investor only; hides private founder scores) |
| **Notifications** (Both portals) | Notification items for current user | `notifications` | `/api/notifications` | `GET` | Authenticated (User only) |

---

## 4. Privacy Boundaries & Data Confidentiality Rules

1. **Private by Default**:
   - Every startup project submitted via `/founder/projects/new` has `is_published = false` unless the founder explicitly checks the publish box or clicks `"Publish to Syndicate"`.
   - Projects with `is_published = false` are **NEVER returned** to investor queries (`/api/projects` in investor view) or unauthenticated public visitors.
2. **Confidential AI Readiness Diagnostics**:
   - `readiness_score`, `ai_readiness_breakdown`, `ai_feedback_summary`, internal pitch weaknesses, and improvement recommendation lists are **FOUNDER-ONLY fields**.
   - These fields must be omitted or stripped in the Pydantic response models whenever the requester is an investor or an anonymous user.
3. **Role Enforcement**:
   - Tokens carry the user's role (`"FOUNDER"` or `"INVESTOR"`).
   - Only users with role `"FOUNDER"` can create/edit projects or update founder profiles.
   - Only users with role `"INVESTOR"` can update investment criteria (`/api/investors/preferences`).
4. **Ownership Verification**:
   - Founders can only view, edit, or toggle publication on projects where `project.founder_id == current_user.id`.

---

## 5. Items Marked as `NEEDS CONFIRMATION`

1. **Password Reset Dispatch**: The UI demonstrates a client confirmation message upon submitting an email. Does the user want real transactional email integration (e.g. SMTP / Resend), or should `/api/auth/forgot-password` return a simulated success payload?
2. **Export Report (PDF)**: The UI features a button for `Export Report` which shows an alert. Should this return a JSON summary or a generated PDF file in Phase 3?
3. **AI Evaluation Trigger**: Does the user prefer the preliminary readiness score to be generated rule-based/heuristically when `AI_PROVIDER=none`, or mock-simulated with explainable score breakdowns?
