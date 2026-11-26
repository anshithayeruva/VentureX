# VentureX — Competitor Intelligence & Product Strategy Report

*Researched and written 2026-11-23. Covers OpenVC, Wellfound, Gust, F6S, Visible, Crunchbase, AngelList, Dealroom and Carta, compared against the VentureX codebase on branch `chore/prod-readiness` (commit `e618555`). Per-platform research notes with full source lists: `project-documentation/competitor-research/01-…09-*.md`.*

## How to read this report

**Evidence levels** used throughout:

| Tag | Meaning |
|---|---|
| **[Observed]** | Seen directly on a public page in a browser during this research |
| **[Docs]** | Stated in the platform's official help centre / product documentation |
| **[Product page]** | Stated on the platform's official marketing/product page (includes their own UI mock-ups) |
| **[3rd-party]** | From third-party reviews, comparisons, case studies or search summaries |
| **[Unverified]** | Mentioned but not confirmed |

**What was not done:** no accounts were created on any platform (account creation needs your explicit permission), no paywalls or bot checks were bypassed, no demos were booked, no videos were watched. **No signed-in dashboard was directly inspected** on any platform; every dashboard description below comes from official documentation or the vendor's own product-page UI mock-ups, and is labelled as such. Where a platform blocked automated reading (OpenVC help centre via fetch, Crunchbase in-page requests), pages were read normally in a browser instead.

### Access report — all nine platforms

| Platform | Public website | Registration flow | Founder dashboard | Investor dashboard | Documentation | Pricing |
|---|---|---|---|---|---|---|
| OpenVC | Accessible | Indirect (docs) | Indirect (docs) | Indirect (docs) | Inspected (~20 articles) | Verified |
| Wellfound | Accessible | Not inspected | Indirect (docs, company side) | N/A (no investor product) | Inspected (company profile) | Verified (recruiting) |
| Gust | Accessible | Not inspected | Indirect (docs) | Indirect (docs) | Inspected (12 articles) | Verified founder (Launch); investor platform unpublished |
| F6S | Accessible (after bot check) | Partially observed | Indirect (docs) | Indirect (docs, Pipeline CRM) | Inspected (~10 articles) | Unverified (founder free; org pricing unpublished) |
| Visible | Accessible | Not inspected | Indirect (product-page UI mocks) | Indirect (product pages) | Partially (product pages) | Verified founder; investor "custom" |
| Crunchbase | Accessible | Not inspected | Indirect (support snippets) | Indirect (pricing matrix) | Partially | Verified |
| AngelList | Accessible | Not inspected | Indirect (RUV pages/blog) | Indirect (product pages) | Partially | Partially verified |
| Dealroom | Accessible | Not inspected | Indirect (knowledge base) | Indirect (illustrative tour) | Partially | Verified |
| Carta | Accessible (APAC site) | Not inspected | Indirect (product pages) | Indirect (product pages) | Not inspected in depth | Partially verified |

---

## 1. Executive summary

**The nine "competitors" are not one category.** Only two of them — **OpenVC** and **Gust** — actually run the founder ↔ investor matching-and-intro workflow VentureX runs. **Visible** owns founder ↔ investor *relationship management* (pipelines, deck tracking, data rooms, investor updates) plus VC portfolio monitoring. **F6S** is a programme-application marketplace with a deal-flow CRM for organisations. **Crunchbase** and **Dealroom** are data/intelligence products. **AngelList** and **Carta** are capital-and-equity infrastructure (SPVs, fund admin, cap tables). **Wellfound** is now a hiring platform with no fundraising product at all.

**Where VentureX is genuinely strong today (verified in code):**
1. **Private AI readiness analysis** that reads the founder's deck/documents (PDF/PPTX/DOCX) and public GitHub repo, scores five dimensions, lists gaps and suggestions, keeps a history and exports a PDF. Only OpenVC has anything comparable (deck score 0–5 + 30-question "Fundability test"); nobody else analyses code.
2. **Explainable, structured investor-fit matching** — a 10-section thesis (sectors, stages, cheque size vs total allocation, geography, traction, structure, team, IP, priorities) with per-criterion met/not-met reasons, hard exclusions and investor-set weights. Deeper and more transparent than OpenVC's "ranked by fit", Gust's keyword filters or Crunchbase's black-box predictions.
3. **Founder-controlled privacy**: drafts never matched; readiness scores never shown to investors; intros only on founder acceptance.
4. **Secure deal room** with live chat, NDA signing, stage tracking, private files, hash-chained audit trail and transcript export — matches or exceeds what Gust (data rooms, discussions) and Visible (data rooms) offer at early stage.
5. **Investor portfolio ledger** with exact rupee maths, valuations, transactions, CSV import/export.

**Where VentureX is clearly behind:**
1. **Founders cannot initiate anything.** They see matched investors but cannot open an investor profile, search investors, shortlist, or reach out. OpenVC, Visible Connect, Gust and F6S all let founders find and approach investors — this is the core job founders come for.
2. **No fundraising workspace for founders**: no round target, no investor pipeline/CRM, no follow-up tracking, no deck analytics. (OpenVC CRM is free; Visible Pipelines free tier.)
3. **No team accounts on either side**: one founder per startup, one person per investor account; no co-founder invites, no investment-team collaboration (Gust, F6S, OpenVC, Visible, Carta all have this).
4. **No trust/verification layer**: no investor vetting (OpenVC manually reviews every investor), no company-domain verification (Crunchbase, Dealroom), no screening of inbound pitches (OpenVC AI-screens every submission).
5. **No post-deal founder ↔ investor loop**: no investor updates/KPI sharing (Visible's core), so VentureX portfolio values are investor self-reported only.
6. **Engagement analytics**: no profile/deck view tracking for founders, no response-rate signals.

**Strategy in one line:** don't try to out-data Crunchbase/Dealroom or out-administer AngelList/Carta. Win as **the AI-native, explainable, India-first fundraising workspace**: OpenVC's two-sided intro loop + Visible's founder fundraising CRM, wrapped around VentureX's unique strengths (readiness AI over decks *and code*, explainable structured matching, privacy-first deal rooms, rupee-native portfolio). The top three builds are (P0) founder-side investor discovery + outreach, (P0) a founder fundraising pipeline with round target, and (P0) investor verification + pitch screening; then team accounts, deck analytics, and investor updates that feed the portfolio.

---

## 2. Overview of the nine competitors

| # | Platform | What it actually is (2026) | Primary users | Business model | Closest overlap with VentureX |
|---|---|---|---|---|---|
| 1 | **OpenVC** | Free-first fundraising platform: investor DB (16–20k), AI-screened deck outreach, CRM, deck tracking, anonymised startup feed for investors | Founders (65k+), investors (16k) | Founder subscriptions $299/yr (Premium), $899/yr (Ultra); investors free | **Very high** — same two-sided loop |
| 2 | **Wellfound** | Startup hiring + AI recruiting (ex-AngelList Talent) | Job seekers, startup recruiters | Free job posts; Reach $135–199/seat/mo; Autopilot $500/role/mo + 10% | **Low** — no fundraising |
| 3 | **Gust** | Founder company profile + incorporation/legal (Gust Launch); SaaS deal-flow platform for angel groups & accelerators | Founders (850k+), 350+ investor groups | Launch $450–3,500/yr; investor platform via sales | **High** on investor-group workflow |
| 4 | **F6S** | Programme/open-call marketplace (16k accelerators, grants, funds) + perks + jobs; F6S Pipeline CRM for organisations | Founders (6.7M members), programmes, funds, corporates, governments | Founder free; organisation CRM via sales | **Medium** — application model, team evaluation |
| 5 | **Visible** | Founder IR & fundraising tools (pipelines, decks, data rooms, updates, KPIs) + VC portfolio monitoring | Founders (7k+), VCs (950+ firms) | Founder $0/59/129/199 per mo; VC custom | **High** on founder workspace + portfolio data |
| 6 | **Crunchbase** | Private-company data + predictive intelligence, AI search, MCP | Investors, sales, analysts | Pro $49–99/mo; Business from $199/mo | **Medium** — discovery/intelligence |
| 7 | **AngelList** | Fund admin, SPVs, Rolling/Scout funds, RUVs for founders, Meridian (accredited-investor deal access), Link (MCP for GPs) | GPs, LPs, accredited investors, founders (RUVs) | Fees on vehicles/admin | **Low–medium** — closing & money movement |
| 8 | **Dealroom** | Ecosystem data platform (3M+ companies), signals, investor rankings, ecosystem dashboards | VCs, corporates, governments | €250–325/seat/mo (min 3 seats) | **Medium** — intelligence, signals |
| 9 | **Carta** | Cap table/equity (free Launch), SAFEs, fund ERP, Deal CRM, valuations, law | Startups (50k), funds | Launch free; tiers via sales | **Low** — post-term-sheet stack |

---

## 3. Founder portal analysis (per applicable platform)

### 3.1 OpenVC — the most complete founder fundraising loop *[Docs unless noted]*
- **Registration:** "Join for free" → "I'm a founder" → email+password or **Google/LinkedIn/X** → email verification. Basic account can browse; full features require setup by **uploading the pitch deck (auto-extracts startup info)** or filling manually. "We ask a lot of information at signup so we can create a custom list of investors." *(docs.openvc.app/en/articles/13205582)*
- **Dashboard (first screen after login):** CRM overview, recent investor requests (inbound), daily outreach count & time until next pitch, **fundraising checklist**, announcements, resources, editable "amount raised", "Your decks". *(13228487)*
- **Fundability Test:** 30 questions → 12 red flags, percentile score (top 50/10/1%), **valuation range from Carta & AngelList data**, refines investor targeting; confidential, retakeable; auto-lists the startup (anonymised) for inbound. *(13227886)*
- **Deck upload & AI review:** AI scores deck 0–5 with feedback; **outreach locked until score ≥ 3/5**; deck content auto-writes the cold-email template. Free basic review; Premium slide-by-slide; Ultra one-time human video review. *(13227759, pricing [Observed])*
- **Investor discovery → shortlist:** "Search investors"; results **ranked by fit**; free filters Verticals / Geography / Stage (idea→pre-IPO) / Round size; Premium adds **Solicitation** (investors with few decks this week), Outreach type, Investor type, HQ, Verified, Check size, Lead. Swipe triage **"Add to CRM" / "Skip"**. Verified investors (blue check) self-registered; others assembled from public data. *(13228069, 13228089, 13228104)*
- **Outreach:** three channels set by investor preference — **"Submit deck"** (in-platform, **AI-screened** for quality; email sent from OpenVC with deck link; replies go straight to founder's inbox), "Send email" (own Gmail/Outlook), "Fill form"; intro-only investors show **"Find intro"** (Premium Intro Finder scans Gmail + LinkedIn). Limits: Free 1/day, Premium 300/mo, Ultra 1,000/mo. *(13228251, 13228311, 13228360)*
- **CRM & follow-up:** free Kanban; each outreach auto-creates a card with deck analytics; statuses *To be contacted → Rejected by OpenVC / Sent via OpenVC → Email opened → Investor interested / Investor declined (with reason) / Ignored (15 days) / Not happening*; notes for co-founders; add external investors; export. **Auto follow-up twice over two weeks.** *(13228450, 13228468, 13228470)*
- **Deck links:** unique tracked link per investor (who opened, when). No data room ("use Google Drive or DocSend"). No API. *(15068911, 17779973, 17779974)*
- **Team:** invite co-founders free; all can edit, use CRM, pitch.
- **Inbound:** anonymised listing on OpenVC Flow; investor "Request deck" → appears on founder dashboard → **founder accepts (reveals) or ignores (stays anonymous)**. *(13228447)*

### 3.2 Gust — profile once, apply many times *[Docs/Observed]*
- Free **Gust Company Profile** (Overview · Executive Summary · Financials tabs; stage, industry, location, currency, founded, employees, incorporation type, website, summary, team). *[Observed: gust.com/companies/helloflorence]*
- **Publishing** gives a **limited public view**; contact info, executive summary, documents, financials and deck stay private; only licensed investor groups can **request full access**. *(help 211)*
- **Find investors:** search icon → Location / Industry / Keyword filters; read the group's profile; **apply re-using the profile**; track all applications; re-apply. *(210, 213, 216, 225)*
- **After applying:** status notifications; "Inactive/Declined" = pass; **founder can withdraw the profile** from that group; founder notified when a member sets an interest level. *(222, 223)*
- **Paid founder tools (Gust Launch):** Delaware incorporation, cap table, SAFEs/notes with e-signatures and board consents, options/409A, legal agreements, co-founder equity-split tool, "Benchmark your venture", Corporate Diligence Report. *[Observed pricing $450 / $1,250 / $3,500 per year]*

### 3.3 Visible — the founder fundraising & IR workspace *[Product page incl. UI mocks]*
- App navigation (from UI mock): Home · Favorites · Fundraising · Update · Data Room · Reporting · Investor Updates · Dashboards · Fundraising Pipelines · Decks · Data Rooms.
- **Fundraising pipeline per round** with **target raise** and progress ("$1,875,000 (82%)"); stages Research · Contacted · Meeting · Light Diligence · Partner meeting · Term sheet · Keep in touch · Closed · Passed with summed amounts; per-investor deck link column.
- **Decks:** versioning, per-investor links, **per-slide analytics**; **Data rooms** with permissions & analytics; **Investor updates** editor (content → recipients → preview & send) with live KPI charts, personalisation, own-domain sending, streaks; **KPI dashboards** fed by integrations; **Visible Connect** free investor DB (stage/sector/cheque; 800+ verified, 19k records) → add to pipeline; **MCP server** to draft updates from AI tools.
- Pricing [Observed]: Starter free (100 update recipients, 2 decks, 2 pipelines); Base $59/mo; Core $129/mo (per-slide analytics, 3 data rooms); Growth $199/mo.

### 3.4 F6S — apply to open calls *[Docs/Observed]*
- Directory of funds/accelerators/grants with filters Type, Location, Markets, Investment, Invest-in-country; cards show **cheque per team and equity** and a **"Pitch"** button. *[Observed: f6s.com/investment-funds, 193 funds]*
- Each programme hosts a **custom application form**; any co-founder applies with the reusable startup profile (markets, location, team/product video, team confirmation); edit after submission; post **"Updates"** to the programme; request third-party **recommendations**. *(help 62–73, 237)*

### 3.5 Crunchbase, Dealroom (profile owners), AngelList, Carta, Wellfound
- **Crunchbase:** no claim button; any user edits; **verified employees** (company-domain email) get exclusive edit of Overview; founders add closed rounds and founders. *[3rd-party/Docs snippets]*
- **Dealroom:** free claim via **company-domain email**; edit financials, rounds, team, revenue; **submissions manually verified** before publishing. *[Docs snippets]*
- **AngelList:** founders use **Roll Up Vehicles** — one invite link, up to 250 accredited angels, one cap-table line; AngelList handles KYC, signatures, capital. *[Product page/3rd-party]*
- **Carta Launch (free):** cap table, share issuance, **fundraising scenario modelling**, SAFE templates, **SAFE insights (market terms)**, equity split tool, burn calculator. *[Product page]*
- **Wellfound:** startups appear as employers (company page with funding summary, team, culture); no fundraising. *[Observed]*

---

## 4. Investor portal analysis (per applicable platform)

### 4.1 OpenVC *[Docs/Observed]*
- **Onboarding:** "I'm a VC, scout, angel, accelerator" → investor type → angels fill personal form; firms select/create firm → **every profile manually reviewed** (may ask for evidence of activity; scouts must link to a firm). *(13228649)*
- **Profile fields:** investor type, first cheque min/max, Lead (always/sometimes/never), Themes (auto from requirements), stages, countries, "Who we are", **Funding requirements (thesis)**, **Value add**, 8 standard FAQs, office locations (map), YouTube video; accelerators add fee, deal terms, application period; **Team**, **Portfolio** showcase, **Founder reviews** (investor approves/hides), deal-flow channel (email / online form / intros only), CRM used. Seen by ~3,000 founders/month. *(14779652)*
- **Sourcing:** passive (screened decks by email, ~2/week) or active via **OpenVC Flow** — anonymised feed filterable by stage, HQ country, round size, chips "Exited founder", "Funding secured", "Supergrowth"; card = sector · traction headline · country · stage · "Sourced today"; **"Request deck"**. *[Observed on openvc.app/invest]* Triage buttons **"I'm interested" / "Pass for now" + reason**.
- **LP Navigator** for GPs raising funds (10k LPs, events). Free for investors.

### 4.2 Gust Group Investor Platform *[Docs]*
- Gust approves the group → admin "Welcome to Your New Investor Workspace" → configure, **import members**, **Application Editor** on/off, optional private application link, invite founders.
- **Pipeline stages** in three buckets: Active (default New → e.g. Screened → Considering → Pitching → Due Diligence), Completed (Invested), Inactive (Declined, junk, duplicate, on hold); drag to reorder; bulk move.
- **Member interest levels**: Observing / Considering / Funds Committed / Invested (+ amount), Not Interested; private option; setting interest subscribes to **Daily Activity Summary**; separate **ratings & reviews**.
- **Discussions** (deal, group, announcements) with email integration; **data rooms**; **events**; **co-investment/syndication** to other groups with aggregate interest; commitments tracking; Zapier.

### 4.3 F6S Pipeline *[Docs]*
- Pipelines fed from **application forms, email (Gmail extension), web, spreadsheets, F6S scouting analysts**; spreadsheet-style table with custom columns (tags, files, notes, founded, incorporated, investors & affiliated, source), full-text search, saved & shared views; **evaluation detail page with scores and notes**; **roles** Owner / Evaluator / Specific Evaluator / Viewer; "find applications not yet scored".

### 4.4 Visible (VC side) *[Product page]*
- Recurring/one-time **data requests** to portfolio companies; AI structures replies (spreadsheets, PDFs, emails); **every number linked to its source document/page/line**; audit log, change log, metric alerts, approval workflows; portfolio & fund dashboards, LP reports, variance and benchmark dashboards; AI Inbox; API + MCP.

### 4.5 Crunchbase *[Product page/Observed]*
- Advanced + **AI search**, **Scout** natural-language questions ("which fintech companies may raise soon?"), predictions (funding, growth, M&A, IPO, closure, layoffs), heat/growth scores, **likely investors**, valuation estimates, saved lists/searches (100 on Pro), **lists with stages, notes, tags**, market maps, alerts, Chrome extension, CRM sync (Business), MCP.

### 4.6 Dealroom *[Product page/Observed]*
- Search/Companies/Sector/Locations/Investors/Deals/**Signals**/Newsfeed; **signal score 0–100** with team & funding growth; **investors ranked by match score**; **investor comparison** (exits, unicorns, follow-on, AI focus); sector deep-dives, market maps, rankings, founder alerts; CRM, MCP, API.

### 4.7 AngelList / Meridian *[Product page/Observed]*
- GPs: SPVs (private/public), syndicates, branded **data room with page-by-page analytics** (free), digital subscriptions with KYC/accreditation, valuation tracking, distributions; fund admin; **Link MCP** with source-verifiable answers.
- Accredited investors (Meridian): apply + verify accreditation → **matched opportunities** by background/interests → close in minutes → manage holdings.

### 4.8 Carta *[Product page]*
- **Deal CRM**: email/calendar auto-capture, notes/stakeholders/history, mobile, AI research + context-aware assistant, **relationship maps**, custom pipelines in a spreadsheet workspace, real-time reports. Portfolio valuations (IPEV/IFRS 13, comps/DCF), fund admin, LP CRM, Claude plugins.

---

## 5. Registration & onboarding comparison

| Platform | Founder sign-up | Investor sign-up | Social login | Verification / review | Onboarding shortcut |
|---|---|---|---|---|---|
| **VentureX** | Email + password (Neon Auth) → role choice → name | Same + firm/fund | **No** | **None** (any user can pick "Investor") | — |
| OpenVC | Email or Google/LinkedIn/X; email verify | Investor type → firm → **manual review** | Yes | Investors reviewed; verified badge | **Deck upload auto-fills profile**; Fundability test |
| Gust | Free profile | Group approved by Gust; admin invites members | — | Groups vetted | Profile reused for every application |
| F6S | Email / other providers | Org creates pages & Pipeline | Yes ("Continue another way") | — | Reusable startup profile |
| Visible | Free account | Demo-led (VC) | — | — | Connect → add to pipeline |
| Crunchbase | Account; company-domain email → verified employee | Trial | — | Domain-verified editing | Team creates profile via form |
| Dealroom | Company-domain email claim | Trial (3 days) | — | **Manual verification of submissions** | — |
| AngelList/Meridian | RUV setup | Accreditation application | — | KYC/AML, accreditation | Existing AngelList login |
| Carta | Launch free | Demo-led | — | — | — |

**Takeaways for VentureX:** (1) add Google/LinkedIn sign-in; (2) **deck-upload auto-fill** of the project form — VentureX already parses decks for readiness, so this is cheap; (3) an **investor verification step** before an investor can see published startups or send intro requests.

---

## 6. Founder dashboard comparison

| Element | VentureX (verified) | OpenVC | Visible | Gust | F6S |
|---|---|---|---|---|---|
| First screen | Overview: Projects, Best readiness, Investor matches, Pending intros | CRM overview, investor requests, outreach quota, checklist, decks, amount raised | Home + favourites | Applications | Applications/feed |
| Investor discovery | Matched investors list only (no profile, no search) | Full DB + filters, ranked | Connect DB | Directory search | Funds directory |
| Fundraising pipeline | **None** (intro requests only) | Free CRM Kanban | Round pipeline with target | Application statuses | Application statuses |
| Deck tracking | **None** | Per-investor tracked links | Per-slide analytics | — | — |
| Readiness / scoring | **AI readiness (5 dimensions, gaps, history, PDF)** | Deck score + Fundability | — | Benchmark tool | — |
| Investor updates | **None** | — | Core feature | — | Updates to programme |
| Team | **Single founder** | Free team invites | Team | — | Co-founders |
| Notifications | In-app bell + email (SMTP) | Email + dashboard | Email | Activity summary | Email |

## 7. Investor dashboard comparison

| Element | VentureX (verified) | OpenVC | Gust | F6S Pipeline | Crunchbase | Dealroom | Carta Deal CRM |
|---|---|---|---|---|---|---|---|
| Overview | Matches, pipeline, active deals, portfolio value, thesis, best fits, recent activity, portfolio snapshot | Flow + inbound decks | Deal list by stage | Pipeline table | Lists, alerts | Signals feed | Pipeline/reporting |
| Discovery | Search, 11 filters, sort, pagination, fit score + reasons | Anonymised Flow | Applications | Applications + scouts | AI search + predictions | Signals + match score | AI research |
| Pipeline | Deal Flow (Saved/Requested/Active/Closed/Declined) — **fixed stages, no notes** | Interested/Pass | **Custom stages** | Custom pipelines/columns | Lists w/ stages/notes/tags | — | Custom pipelines |
| Notes / ratings | **None on deals** | — | Ratings, reviews, interest levels | Scores + notes | Notes/tags | — | Notes, history |
| Team collaboration | **None** | Team on profile | Members, discussions, syndication | Roles, evaluators | Team (Business) | Seats | Assignments |
| Portfolio | **Ledger: investments, transactions, valuations, charts, CSV** | — | Commitments | — | — | — | Valuations, fund ERP |
| Thesis matching | **10-section thesis with priorities** | Profile criteria | Preferences | — | — | Match score | — |

---

## 8. Complete feature inventory by competitor

Format: **Feature** — user — how it works / where — free/paid — evidence — relevance to VentureX (H/M/L).

### OpenVC
1. **Investor database & fit ranking** — Founder — "Search investors", 16–20k investors, ranked by fit, 4 free / 10 paid filters — Free (limited) / Premium — [Docs] — **H**
2. **Swipe shortlist (Add to CRM / Skip)** — Founder — investor-by-investor triage into CRM "To be contacted" — Free — [Docs] — **H**
3. **AI-screened in-platform pitch ("Submit deck")** — Both — AI checks subject, body, deck before sending; rejections with feedback — Free 1/day, Premium 300/mo — [Docs] — **H**
4. **Investor outreach-channel preference** (email/form/intro-only) — Investor — set in profile; founders see matching action — Free — [Docs] — **M**
5. **Solicitation filter** (investors with few decks this week) — Founder — Premium filter — [Docs] — **M**
6. **Fundraising CRM (auto-populated)** — Founder — Kanban with auto statuses, notes, amounts, export — Free — [Docs] — **H**
7. **Auto follow-ups (×2 over 2 weeks), auto "Ignored" after 15 days** — Founder — Free — [Docs] — **H**
8. **Per-investor tracked deck links** — Founder — who opened, when — Free — [Docs] — **H**
9. **AI deck score 0–5 + gate ≥3 before outreach** — Founder — Free basic / Premium slide-by-slide / Ultra human — [Docs/Observed] — **H**
10. **AI cold-email writer from deck** — Founder — Premium — [Observed pricing] — **M**
11. **Fundability test (30 Qs, red flags, percentile, valuation range)** — Founder — Free — [Docs] — **H**
12. **Warm Intro Finder (Gmail + LinkedIn graph)** — Founder — Premium — [Docs] — **M**
13. **Anonymised startup feed (Flow) + "Request deck" + founder reveal** — Both — Free — [Docs/Observed] — **H**
14. **Investor "I'm interested" / "Pass for now" + reason** — Investor — Free — [Docs] — **H**
15. **Investor profile: thesis, value-add, FAQs, video, portfolio, team** — Investor — Free — [Docs] — **H**
16. **Founder reviews of investors (investor-moderated)** — Both — Free — [Docs] — **M**
17. **Investor manual review/verification badge** — Investor — Free — [Docs] — **H**
18. **Team invites (co-founders)** — Founder — Free — [Docs] — **H**
19. **Masterclass, deck template, perks ($2M), advisor marketplace, 400+ SEO investor lists, use in ChatGPT/Claude** — Founder — mixed — [Observed] — **M** (growth levers)
20. **LP Navigator** — GPs — Free — [Observed] — **L**

### Gust
1. **Reusable company profile with limited public view + request-full-access** — Both — Free — [Docs] — **H**
2. **Apply to investor group with one click (no re-entry)** — Founder — Free — [Docs] — **H**
3. **Founder withdraw profile after decline** — Founder — [Docs] — **M**
4. **Investor-defined application form / private application link** — Investor — [Docs] — **M**
5. **Custom deal stages (Active/Completed/Inactive)** — Investor — [Docs] — **H**
6. **Member interest levels with committed amounts; ratings & reviews** — Investor team — [Docs] — **H**
7. **Deal/group discussions, announcements, email integration** — Investor team — [Docs] — **M**
8. **Data rooms with access control** — Both — [Product page] — **M** (VentureX has deal-room files)
9. **Co-investment/syndication between groups** — Investor — [Docs] — **M**
10. **Events with calendar invites** — Investor — [Product page] — **L**
11. **Incorporation, cap table, SAFEs, options/409A, legal docs (Launch)** — Founder — $450–3,500/yr — [Observed] — **L** (US-specific)
12. **Co-founder equity split tool; Corporate Diligence Report; Benchmark tool** — Founder — Free — [Observed] — **M**
13. **Accelerator platform (cohorts, evaluators)** — Accelerators — [Docs] — **M**

### F6S
1. **Funds/accelerator/grant directory with cheque & equity on cards** — Founder — Free — [Observed] — **M**
2. **Programme open calls with custom application forms** — Both — Free/org — [Docs] — **M**
3. **Post-submission "Updates" to programme** — Founder — [Docs] — **M**
4. **Third-party recommendations on startup profile** — Founder — [Docs] — **M**
5. **Pipeline CRM: multi-source capture (forms, Gmail, spreadsheets, scouts)** — Investor — [Docs] — **M**
6. **Evaluation scoring, assigned evaluators, roles** — Investor team — [Docs] — **H**
7. **Saved/shared table views, full-text search** — Investor — [Docs] — **M**
8. **Perks marketplace, jobs** — Founder — [Observed] — **L**

### Visible
1. **Round pipeline with target & progress** — Founder — Free (2 pipelines) — [Product page] — **H**
2. **Per-investor deck links + per-slide analytics** — Founder — Core $129/mo — [Observed pricing] — **H**
3. **Data rooms with permissions & analytics** — Founder — Base+ — [Observed] — **M**
4. **Investor updates with live KPI charts** — Founder — Free (100 recipients) — [Observed] — **H**
5. **KPI dashboards with integrations** — Founder — Free/Core — [Observed] — **M**
6. **Visible Connect investor DB → add to pipeline** — Founder — Free — [Observed] — **H**
7. **Portfolio data requests + AI structuring** — Investor — custom — [Product page] — **H** (feeds portfolio)
8. **Source-linked verification of every number** — Investor — custom — [Product page] — **H** (AI trust)
9. **MCP server / AI-assistant distribution** — Both — [Observed] — **M**

### Crunchbase
1. **AI search & Scout natural-language queries** — Investor — Pro — [Observed] — **H**
2. **Predictions (funding, growth, M&A, IPO, closure)** — Investor — Pro — [Observed] — **M**
3. **Heat/growth scores, likely investors, valuation estimates** — Both — Pro — [Observed] — **M**
4. **Lists, saved searches, alerts; stages/notes/tags** — Investor — Pro — [Observed] — **H**
5. **Verified-employee editing** — Founder — Free — [Docs snippet] — **M**
6. **CRM integrations, Chrome extension, MCP, API** — Investor — Business — [Observed] — **L–M**

### AngelList
1. **SPVs/syndicates, Rolling/Scout funds, fund admin** — GPs — fees — [Observed] — **L**
2. **Roll Up Vehicles (one link, one cap-table line)** — Founder — ~$8k per RUV [3rd-party] — **L** (regulatory)
3. **Free branded data room with page-level analytics** — GPs — Free — [Observed] — **M**
4. **Meridian matched opportunities for accredited investors** — Investor — Free browsing — [Observed] — **M**
5. **Link MCP with verifiable answers** — GPs — [Observed] — **M**

### Dealroom
1. **Signal score & momentum (team/funding growth)** — Investor — €250+/seat — [Observed tour] — **H**
2. **Investor match score & investor comparison** — Both — [Observed tour] — **H**
3. **Sector deep-dives, market maps, rankings** — Investor — [Observed] — **M**
4. **Domain-verified claim + manually verified submissions** — Founder — Free — [Docs] — **M**
5. **Ecosystem dashboards for governments/accelerators** — Public sector — [Observed] — **M** (India B2B angle)

### Carta
1. **Cap table, share issuance, SAFEs with e-sign** — Founder — Launch free — [Observed] — **L**
2. **Fundraising scenario modelling & SAFE market-terms insights** — Founder — Free — [Observed] — **H** (cheap to build)
3. **Deal CRM with email/calendar capture, relationship maps, AI assistant** — Investor — sales — [Observed] — **M**
4. **Portfolio valuations (comps/DCF, IFRS 13)** — Investor — sales — [Observed] — **M**
5. **Claude plugins (cap table, investors, CRM)** — Both — [Observed] — **M**

### Wellfound
1. Company page with funding summary, team, culture, **responsiveness badges**; AI recruiting agents; jobs — [Observed] — **L** (borrow: responsiveness badge)

---

## 9. User journeys

### 9.1 Founder journeys

```
OpenVC (best-in-class founder loop)
Sign up (email/Google/LinkedIn/X) → upload deck (auto-fills profile) → AI deck score (must reach 3/5)
→ Fundability test (red flags, percentile, valuation range) → Search investors (ranked by fit, filters)
→ Add to CRM / Skip → Submit deck (AI-screened) or email/form/intro → tracked deck link
→ auto follow-ups ×2 → statuses (opened / interested / declined+reason / ignored)
→ reply lands in founder's inbox → meetings → amount raised on dashboard

Visible
Create account → Visible Connect (filter investors) → add to round pipeline (target raise)
→ share per-investor deck link → per-slide analytics → move through stages (Contacted … Term sheet → Closed)
→ data room for diligence → after close: monthly investor updates with KPI charts

Gust
Create company profile → publish (limited view) → search investor groups (location/industry/keyword)
→ apply with profile → wait (weeks–months, group cycles) → notifications (interest level, status)
→ group requests full access / data room → decision → (Gust Launch: SAFE/cap table)

VentureX today (verified)
Sign up (email) → choose Founder → create project (form; optional deck/doc upload)
→ AI readiness review (deck + docs + GitHub; 5 dimensions; gaps; history; PDF)
→ publish → [wait] investors whose thesis fits see it → intro request arrives (bell/email)
→ accept/decline with note → deal room (chat, NDA, stage, files, audit) → closed
  ✗ cannot search/view/contact investors   ✗ no round/pipeline   ✗ no deck analytics   ✗ no team
```

### 9.2 Investor journeys

```
OpenVC
Sign up → investor type/firm → manual review → profile (thesis, cheque, stages, countries, value-add, FAQs, portfolio)
→ passive: screened decks by email (~2/week) → Interested / Pass + reason
→ active: OpenVC Flow (anonymised, filter) → Request deck → founder reveals → email thread

Gust (angel group)
Group approved → admin config (application form, stages) → members invited
→ founders apply → New → Screened → Considering → Pitching → Due diligence
→ members set interest (Observing … Funds committed + amount), rate & review, discuss
→ data room diligence → Invested / Declined → co-invest with other groups

VentureX today (verified)
Sign up → choose Investor (no vetting) → Criteria (10 sections, priorities; starts empty)
→ Discover (search, 11 filters, sort, fit % + met/not-met reasons) → Save / Request intro
→ Deal Flow (Saved / Requested / Active / Closed / Declined) → founder accepts → deal room
→ Closed → "Record your investment" → Portfolio (transactions, valuations, charts, CSV)
  ✗ no notes/ratings on deals   ✗ no custom stages   ✗ no team   ✗ no company-reported portfolio data
```

---

## 10. Free vs paid comparison

| Platform | Free for founders | Paid founder tier(s) | Free for investors | Paid investor tier(s) |
|---|---|---|---|---|
| **VentureX** | Everything (no monetisation yet) | — | Everything | — |
| OpenVC | DB (4 filters), 1 pitch/day, CRM, deck hosting/analytics, basic AI review, Fundability | Premium $299/yr; Ultra $899/yr; deck design $999 | All | — |
| Gust | Profile, applications | Launch $450 / $1,250 / $3,500 per yr | — | Group platform (sales) |
| F6S | Profile, applications, perks | — | Listings | Pipeline (sales) |
| Visible | 2 decks, 2 pipelines, updates to 100, Connect | $59 / $129 / $199 per mo | — | Essential/Premium/Enterprise (custom) |
| Crunchbase | Limited browsing; profile editing | Pro $49–99/mo | — | Pro / Business $199+/mo |
| AngelList | — | RUV ~$8k [3rd-party] | Data room free; Meridian browsing free | Fund admin/SPV fees |
| Dealroom | Claim/edit profile | — | 3-day trial | €250–325/seat/mo |
| Carta | Launch (≤25 stakeholders, ≤$1M raised) | Core→Scale (sales) | — | Fund ERP (sales) |

**Monetisation pattern:** founders pay for **reach** (more pitches, more filters, warm intros) and **polish** (deck reviews, analytics, own domain); investors pay for **data, collaboration and admin**. Freemium with a generous free CRM/database is the norm in founder tools.

---

## 11. Competitor strengths & weaknesses

| Platform | Strengths | Weaknesses / gaps VentureX can exploit |
|---|---|---|
| OpenVC | Complete founder loop, free CRM, AI screening, anonymised inbound, investor trust via review | Cold-outreach volume game; thin investor-side tooling; no data room, no API; deck score is a gate, not deep diligence; US/EU-centric investor base |
| Gust | Profile reuse, mature group workflow (interest levels, syndication) | Dated UX, slow group cycles, no AI, US-centric legal stack |
| F6S | Huge reach, programme forms, team evaluation | Noisy marketplace, low signal, little AI |
| Visible | Best founder IR workspace; portfolio data verification; MCP | Not a matchmaker; investor DB is a list, not explained fit; paid analytics |
| Crunchbase | Data scale, predictions, AI search | Expensive, black-box, no two-sided workflow, weak on early Indian startups |
| AngelList | Money movement, compliance, fund infra | Not for discovery/matching; US-regulated |
| Dealroom | Signals, rankings, ecosystem dashboards | Expensive per seat, analyst-oriented |
| Carta | Cap table & SAFE standard, fund ERP | Post-deal only; US/APAC instruments |
| Wellfound | Hiring network | No fundraising |

**Unoccupied space:** none of them combines (a) explainable thesis-based matching, (b) deep AI readiness/diligence on the actual materials (deck, documents, **code**), (c) privacy-first two-sided intros, and (d) post-deal portfolio — **for Indian founders and investors in rupees**.

---

## 12. VentureX existing feature inventory (verified in code)

Verified on branch `chore/prod-readiness` (commit `e618555`): 58 API routes across 10 routers (`backend/app/routes/*`), 17 frontend pages (`frontend/app/**/page.tsx`), Neon Postgres schema (`backend/app/database/schema.sql`), 60 backend tests (`backend/tests/*`), 3 end-to-end suites (`e2e/*`).

**Accounts & platform**
- Email/password sign-up and sign-in (Neon Auth), role onboarding (Founder/Investor + name, firm for investors), emailed-OTP password reset (`/register`, `/login`, `/forgot-password`; `routes/auth.py` `GET/POST /me`).
- Role-based access on every endpoint; per-user data scoping; rate limiting (shared via Upstash when configured); nonce-based CSP; security headers; CI; Dockerfiles; Render blueprint.
- Notifications: in-app bell with unread count, list, mark read/all (`routes/notifications.py`); transactional emails (intro request, deal room unlocked, deal-room message, strong investor fit) sent via SMTP when configured, logged otherwise (`services/email_service.py`).
- Settings: founder (keep new projects private, email me about strong matches), investor (notify me about strong fits, allow founders to message me) — all enforced.

**Founder side**
- Multiple projects per founder (`/founder/projects`, `POST /projects`), project form: basics, problem/solution, raise (industry, stage, amount ₹, business model, target customer), location & traction (country, city, monthly revenue, customers, product status), team (size, technical/repeat founder, industry experience, full-time, IP), deck/doc upload, links (website, deck, GitHub, demo), publish switch.
- Publish/unpublish; drafts private and never matched.
- **AI readiness**: Claude or Gemini (or rule-based fallback) analysis over form + uploaded documents (PDF/PPTX/DOCX text extraction) + public GitHub repo; 5 dimensions (problem/solution, market & competition, business model, traction & validation, product & technology), gaps with severity, suggestions with priority, industry insights, strengths; analysis history; PDF export (`routes/projects.py` analyze, readiness, analyses, export-report; `services/analysis_service.py`, `github_service.py`, `document_service.py`).
- Investor matches per project with explainable reasons (met/not-met) (`GET /matches`; founder Investors tab).
- Intro requests: accept/decline with note (`PATCH /interests/{id}/status`), opens a deal room.
- Founder profile (name, company, bio, location, LinkedIn, website).

**Investor side**
- Criteria: structured thesis A–J (sectors incl. excluded, stages, min/preferred/max cheque + total allocation, geography incl. excluded countries, traction requirements, structure/instruments/role/ownership/board seat, team & IP, additional preferences, match priorities incl. Team and IP) with live summary (`/investor/preferences`; `schemas/thesis.py`).
- Matching engine: weighted factors (industry, stage, cheque, business model, geography, traction, team/IP), hard exclusions, unreported facts scored lower not excluded, per-reason scores, stale matches removed, strong-fit alerts (`services/match_service.py`).
- Discover: search, filters (industry, stage, raise range, region, country, business model, min revenue, min customers, live product, matches only, saved only), sort, pagination, fit % + reasons, save, request intro; public facts only (`/investor/discover`; `services/discover_service.py`).
- Deal Flow: one list with Saved / Requested / Active / Closed / Declined-passed, withdraw, open deal room, record investment (`/investor/deal-flow`).
- Startup page: facts, team/IP, how it matches, save, request intro with note.
- **Portfolio & Finances**: investments, transactions (investment, follow-on, distribution, dividend, exit proceeds, interest, fee; pending), valuations with source, exact decimal maths in ₹, totals (invested, current value, cash returned, realised/unrealised, net gain, ROI, multiple), charts (value over time, invested vs value by company, realised vs unrealised, allocation by industry), holdings table, ledger, detail page, CSV export (holdings, ledger) and validated all-or-nothing CSV import (`routes/portfolio.py`, `services/portfolio_service.py`, `services/portfolio_csv.py`).
- Investor profile (name, firm, title, bio, location, thesis text, cheque range) shown to founders on intro.

**Shared: deal room** (`routes/dealrooms.py`, `services/deal_room_service.py`, `services/dealroom_files.py`)
- Created when a founder accepts; live chat over WebSocket + REST; NDA signing; stage tracking (Intro accepted → Due diligence → Partner meeting → Term sheet → Closed / Passed); share document links; private file uploads/downloads (participants only); hash-chained message/audit trail; transcript JSON + PDF export; audit-log view; founder messaging can be closed by the investor.

**Public**
- Landing page with founder and investor sections, "Startups raising now" from real published projects.

## 13. VentureX implementation-status audit

Status codes: **1** Fully implemented & working · **2** Implemented but incomplete · **3** UI without backend · **4** Backend without UI · **5** Mock/demo · **6** Not implemented.

| Area | Feature | Status | Evidence / note |
|---|---|---|---|
| Auth | Email/password, roles, OTP reset | **1** | Neon Auth; tests + E2E |
| Auth | Social sign-in (Google/LinkedIn) | **6** | No OAuth in `frontend/app/login`, `register` |
| Auth | Investor verification / vetting | **6** | Anyone can register as investor |
| Auth | Company/domain verification | **6** | — |
| Founder | Multiple projects, rich form, publish/private | **1** | |
| Founder | Deck upload auto-fills project form | **6** | Text extracted only for readiness |
| Founder | AI readiness (docs + GitHub, history, PDF) | **1** | Claude path untested until an API key is set (Gemini/rules verified) |
| Founder | Readiness benchmarking vs peers | **6** | No percentile/cohort |
| Founder | See matched investors with reasons | **1** | |
| Founder | Open investor profile / search investors | **6** | Matches list only |
| Founder | Initiate outreach to investors | **6** | Only investors can request intros |
| Founder | Fundraising round (target, committed, close date) | **6** | |
| Founder | Founder-side investor pipeline/CRM | **6** | |
| Founder | Deck/profile view analytics | **6** | No view tracking anywhere |
| Founder | Team members / co-founder invites | **6** | `projects.founder_id` single owner |
| Founder | Investor updates / KPI sharing | **6** | |
| Founder | Accept/decline intros with note | **1** | |
| Investor | Structured thesis + priorities | **1** | |
| Investor | Team & additional criteria scored | **2** | Team/IP scored; differentiation, scalability, horizon, risk, exit paths stored but not scored (UI says so) |
| Investor | Discover search/filters/sort/save | **1** | |
| Investor | Natural-language/AI search | **6** | Keyword + filters only |
| Investor | Saved searches & alerts | **6** | Strong-fit alerts only (≥90%) |
| Investor | Deal Flow pipeline | **2** | Fixed derived stages; no notes, ratings, tags, custom stages, reminders |
| Investor | Startup comparison | **6** | |
| Investor | Team collaboration / shared pipeline | **6** | Single-user investor accounts |
| Investor | Portfolio ledger, maths, charts, CSV | **1** | Self-reported |
| Investor | Company-reported portfolio data | **6** | |
| Investor | Public investor profile page (thesis, portfolio, value-add) | **2** | Profile exists; founders only see name/firm/email on intro; no page |
| Shared | Deal room (chat, NDA, stage, files, audit, export) | **1** | Live WebSocket fixed in `e618555` |
| Shared | Meeting scheduling / calendar | **6** | |
| Shared | Due-diligence checklist / request list | **6** | Files + stages only |
| Shared | Notifications in-app + email | **2** | Email needs SMTP config; no digest |
| Shared | Weekly summary emails | **6** | Toggle removed until built |
| Platform | Admin console / moderation | **6** | No admin role |
| Platform | Analytics/metrics for the business | **6** | |
| Platform | Public API / MCP | **6** | |
| Code | `backend/app/services/ai/` (embeddings, vector matching, project analysis) | **5** | Placeholder classes, **not imported by any route**; contains hard-coded USD sample text — candidate for deletion |
| Data | Development demo seed (investors, projects, deal room) | **5** | Only when `APP_ENV=development` / `SEED_DEMO_DATA` |
| Founder | Founder profile visible to investors | **2** | Shown in deal room context; no public founder page |

**No "UI without backend" (3) items were found** — earlier mock data was removed in the hardening work, and every page calls real endpoints.

## 14. Competitor-versus-VentureX comparison matrix

✓ = has it · ◐ = partial · — = no · **VX** column from code audit.

| Capability | VX | OpenVC | Gust | F6S | Visible | Crunchbase | AngelList | Dealroom | Carta |
|---|---|---|---|---|---|---|---|---|---|
| Founder ↔ investor matching | **✓ explainable** | ✓ ranked | ◐ filters | ◐ | ◐ DB | ◐ likely investors | ◐ Meridian | ◐ match score | — |
| Structured investor thesis | **✓ 10 sections** | ✓ | ◐ | — | ◐ | — | ◐ | — | — |
| Founder searches investors | — | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| Investor searches startups | ✓ | ✓ anonymised | ✓ applications | ✓ | — | ✓ | ✓ (deals) | ✓ | ◐ |
| Founder-initiated outreach | — | ✓ screened | ✓ apply | ✓ apply | ◐ links | — | — | — | — |
| Investor-initiated intro | ✓ | ✓ request deck | ◐ | ◐ | — | — | — | — | — |
| AI pitch/deck analysis | **✓ deep** | ✓ score | — | — | — | — | — | — | — |
| Code/repo analysis | **✓** | — | — | — | — | — | — | — | — |
| Readiness/fundability score | **✓** | ✓ | ◐ benchmark | — | — | ◐ heat | — | ◐ signal | — |
| Founder fundraising CRM | — | ✓ | ◐ | ◐ | ✓ | — | — | — | — |
| Deck tracking/analytics | — | ✓ | — | — | ✓ per-slide | — | ✓ data room | — | — |
| Data room | ◐ deal-room files | — | ✓ | — | ✓ | — | ✓ | — | ✓ |
| Messaging | **✓ live** | email | ✓ discussions | ✓ | — | — | — | — | — |
| NDA + audit trail | **✓** | — | — | — | ◐ | — | ✓ KYC | — | ✓ |
| Investor deal pipeline | ◐ | ◐ | ✓ custom | ✓ custom | — | ◐ lists | — | — | ✓ |
| Notes/ratings on deals | — | — | ✓ | ✓ | — | ✓ | — | — | ✓ |
| Team collaboration | — | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Investor verification | — | ✓ manual | ✓ | — | — | — | ✓ KYC | — | ✓ |
| Startup/company verification | — | — | — | — | — | ✓ domain | ✓ | ✓ domain + manual | ✓ |
| Portfolio management | **✓ ledger** | — | ◐ | — | ✓ | — | ✓ | — | ✓ |
| Company-reported KPIs/updates | — | — | — | ◐ updates | ✓ | — | — | — | ◐ |
| AI natural-language search | — | ◐ ChatGPT app | — | — | ◐ MCP | ✓ Scout | ✓ Link | ✓ MCP | ✓ plugins |
| Benchmarks/market data | — | ◐ valuation range | ◐ | — | ✓ | ✓ | — | ✓ | ✓ SAFE terms |
| Social sign-in | — | ✓ | — | ✓ | — | — | — | — | — |
| Rupee-native / India focus | **✓** | — | — | ◐ global | — | ◐ | ◐ India RUV | ◐ | ◐ APAC |
| API / MCP | — | — | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |

## 15. Missing features in VentureX (meaningful only)

Grouped by who benefits; each traced to the competitor that shows it working. Generic or low-value items (perks marketplaces, jobs, SPV/fund admin, cap tables) are deliberately excluded here and discussed in §18.

**Founder-side gaps**
1. Investor directory & investor profile pages for founders (OpenVC, Visible Connect, Gust).
2. Founder-initiated, screened outreach / "apply" to investors (OpenVC Submit deck, Gust apply, F6S Pitch).
3. Fundraising round + founder CRM pipeline with target and committed amounts (Visible, OpenVC).
4. Tracked deck links with view analytics (OpenVC, Visible, AngelList data room).
5. Automated follow-ups and response statuses incl. "no reply" (OpenVC).
6. Co-founder/team access to a startup (OpenVC, F6S, Visible).
7. Deck-upload auto-fill of the project form (OpenVC).
8. Readiness benchmarking against peers and a valuation/round-size guide (OpenVC Fundability, Carta SAFE insights, Gust benchmark).
9. Investor updates with KPIs to existing/prospective investors (Visible).
10. Round modelling / dilution calculator (Carta Launch).

**Investor-side gaps**
11. Investor verification + startup verification (OpenVC review, Dealroom/Crunchbase domain checks).
12. Notes, tags, ratings, custom stages, reminders in Deal Flow (Gust, F6S, Crunchbase lists, Carta).
13. Investment-team workspaces: shared pipeline, interest levels with amounts, assignments, comments (Gust, F6S).
14. Saved searches with alerts and a weekly digest (Crunchbase, Dealroom).
15. AI natural-language discovery ("show me pre-seed agritech in Maharashtra with paying customers") (Crunchbase Scout).
16. Startup comparison side by side (Dealroom investor comparison as the pattern).
17. Company-reported portfolio KPIs via data requests (Visible).
18. Interested / Pass-with-reason responses that feed back to founders (OpenVC).

**Cross-platform / platform gaps**
19. Meeting scheduling inside the deal room (Gust events; OpenVC scheduling link).
20. Due-diligence request checklist in the deal room (Gust/Visible data rooms).
21. Public profiles with responsiveness signals (Wellfound responder badges; OpenVC investor reviews).
22. Admin/moderation console (needed for verification and screening).
23. Social sign-in.
24. API/MCP access to a user's own VentureX data (Visible, Crunchbase, Dealroom, AngelList, Carta all ship MCP now).

---

## 16. Top 20 recommended features (with implementation specifications)

Priority groups: **P0** essential for a credible product · **P1** needed to compete · **P2** differentiation · **P3** future. Complexity: **S** ≤ 3 days · **M** 1–2 weeks · **L** 3–5 weeks · **XL** 6+ weeks (one full-stack developer). "Standard" = table-stakes copied from competitors; "Edge" = builds a competitive advantage.

### P0 — Essential

**F1. Investor directory and investor profile pages for founders** — Standard · M
- *Inspired by:* OpenVC investor DB (ranked by fit, filters, verified badge), Visible Connect, Gust directory.
- *Problem:* founders see a list of matched investors but can't learn who they are or decide whom to approach; the founder half of the marketplace is passive.
- *Workflow:* founder sidebar "Investors" becomes **Find investors**: search + filters (stage, sector, cheque size in ₹, geography, lead/co-invest, instrument), sorted by the existing fit score *per project* (project selector at top), each card shows thesis one-liner, cheque range, stages, fit % with met/not-met reasons, verified badge. Card → **investor profile page**: thesis summary (already generated in `lib/thesis.ts`), cheque range, stages, geography, value-add, portfolio (public subset), response stats (F21).
- *Backend:* `GET /founders/investors` (search over `investor_profiles` + `investor_preferences.thesis`, scoring with existing `MatchService.calculate_match` per project), `GET /founders/investors/{id}` (public projection only — never email until intro accepted).
- *DB:* `investor_profiles.is_public BOOL DEFAULT TRUE`, `value_add TEXT`, `public_portfolio JSONB`; index on `investor_preferences` thesis stages (GIN on JSONB).
- *AI:* none new (reuses explainable scoring).
- *Dependencies:* F3 (verification) for the badge. *Impact:* very high — the core founder job.

**F2. Founder-initiated intro requests ("Request intro" from founder), screened** — Standard→Edge · M
- *Inspired by:* OpenVC "Submit deck" with AI screening and daily limits; Gust/F6S "apply".
- *Problem:* only investors can start contact today.
- *Workflow:* on the investor profile, **Request intro** opens a composer pre-filled from the project (one-liner, raise, traction) + a short note; the project must be published and have readiness ≥ a threshold (e.g. 50/100) — VentureX's equivalent of OpenVC's "deck ≥ 3/5" gate. An AI screen checks the note and the project against the investor's hard exclusions and minimum quality, returning instant feedback if rejected. Limits: e.g. 5/day, 50/month on free. Investor receives it in a new **Inbound** tab with **Interested** / **Pass + reason** (F18).
- *Backend:* extend `project_interests` with `initiated_by ('founder'|'investor')`, `screen_result JSONB`, `pass_reason TEXT`; `POST /interests` accepts founder initiation; screening function in `analysis_service` (cheap model call or rules); rate limit via existing `rate_limit`.
- *DB:* columns above + `UNIQUE(project_id, investor_id)` already exists.
- *AI:* lightweight LLM screen ("is this a coherent, relevant pitch for this thesis?") with rules fallback.
- *Dependencies:* F1, F3, F18. *Impact:* very high; closes the two-sided loop.

**F3. Trust layer: investor verification + founder company-domain verification + admin review queue** — Standard · M
- *Inspired by:* OpenVC manual review of every investor; Dealroom/Crunchbase company-domain email verification; Dealroom manual verification of submitted funding data.
- *Problem:* anyone can register as an investor and see every published startup and request intros; founders can't tell real investors from scrapers.
- *Workflow:* investor onboarding adds LinkedIn URL, firm website, one past investment; status **Pending review** (can browse Discover with anonymised cards only) → admin approves → **Verified** badge. Founders get a "Verify your company" action: confirm an email on the website's domain → badge on the startup.
- *Backend:* `users.verification_status`, `verification_evidence JSONB`; admin role + `/admin/verifications` endpoints; email-domain check with OTP (Neon Auth already sends OTPs).
- *DB:* `app_users.verification_status TEXT CHECK (...)`, `verified_at`, `company_domain_verified_at` on projects.
- *Dependencies:* F22 admin console (minimal version ships with this). *Impact:* high — prerequisite for F2 and for any paid tier.

**F4. Fundraising round + founder pipeline ("Raise" workspace)** — Standard · L
- *Inspired by:* Visible Fundraising Pipelines (round, target raise, stages with amounts, % progress), OpenVC CRM (auto-created cards, statuses, notes, export).
- *Problem:* founders have no place to run the raise; deal rooms are disconnected per investor.
- *Workflow:* project → **Raise** tab: create a round (instrument, target ₹, pre-money or cap, close date); Kanban stages Shortlisted · Contacted · Intro accepted · Meeting · Diligence · Term sheet · Committed (₹) · Closed · Passed; cards auto-created from VentureX intros/deal rooms (stage synced from deal-room stage) plus manually added off-platform investors; notes, next follow-up date, committed amount; header shows **committed / target** progress; CSV export (reuse `portfolio_csv` patterns).
- *Backend:* `fundraising_rounds`, `round_investors` tables; endpoints `/projects/{id}/rounds`, `/rounds/{id}/investors`; sync hook in `deal_room_service.update_stage`.
- *DB:* `fundraising_rounds(id, project_id, instrument, target NUMERIC, pre_money NUMERIC, close_date, status)`, `round_investors(id, round_id, investor_id NULL, name, firm, email, stage, committed NUMERIC, next_follow_up DATE, notes, source)`.
- *Dependencies:* none hard; better with F5. *Impact:* very high retention driver.

**F5. Tracked share links for decks and project materials** — Standard · M
- *Inspired by:* OpenVC per-investor deck links (who opened, when), Visible per-slide analytics, AngelList data room page analytics.
- *Problem:* founders send decks blind.
- *Workflow:* in the Raise pipeline card or deal room, **Create link** for a specific investor; viewer page renders the PDF (pdf.js) with page-level time tracking; founder sees opens, total time, pages viewed, last opened; optional email-gate and expiry; disable link.
- *Backend:* `share_links(id, project_id, document_id, investor_ref, token, expires_at, disabled)`, `link_views(id, link_id, started_at, page, seconds, ip_hash)`; public `GET /l/{token}` (rate-limited) and `POST /l/{token}/events`; aggregate endpoint for founder.
- *Privacy:* hash IPs; no third-party trackers; clear notice to viewer.
- *Dependencies:* existing private document storage. *Impact:* high; strong upgrade lever.

### P1 — Competitive

**F6. Team accounts (co-founders) and investor firm teams** — Standard · L
- *Inspired by:* OpenVC free team invites; Gust group members; F6S roles (Owner/Evaluator/Viewer); Visible/Carta seats.
- *Workflow:* founder invites co-founders by email to a project (roles: Owner, Editor, Viewer); investor creates a **Firm workspace** and invites partners/analysts (Owner, Partner, Analyst); Deal Flow, Criteria and Portfolio become firm-scoped with "assigned to" and activity log.
- *Backend:* `project_members(project_id, user_id, role)`, `firms(id, name)`, `firm_members(firm_id, user_id, role)`; replace `founder_id`/`investor_id` ownership checks with membership checks (central helper); invitations table with expiry.
- *Dependencies:* touches every scoped query — do after F1–F5 stabilise; strong test coverage exists (60 tests) to lean on. *Impact:* high for real VC usage.

**F7. Deal Flow upgrades: notes, tags, ratings, custom stages, reminders** — Standard · M
- *Inspired by:* Gust stages (Active/Completed/Inactive), interest levels and ratings; F6S scores/notes; Crunchbase lists with stages/notes/tags; Carta pipelines.
- *Workflow:* each Deal Flow row gets a side panel: private notes (timestamped), tags, 1–5 rating per rubric item (team, market, product, traction), next-action date with reminder notification; investor can rename/add stages within Active/Closed/Passed buckets.
- *Backend/DB:* `deal_notes`, `deal_tags`, `deal_ratings`, `deal_stage_overrides(investor_id, project_id, custom_stage)`, `reminders` processed by a scheduled job (also used by F14/F16).
- *Impact:* high; moves VentureX from list to CRM.

**F8. Investor responses with reasons: Interested / Pass + reason, auto-expire** — Standard · S
- *Inspired by:* OpenVC "I'm interested" / "Pass for now" with reason; "Ignored" after 15 days.
- *Workflow:* inbound founder requests (F2) and saved deals get one-click responses; pass reasons from a short list (stage too early, outside thesis, market size, team, other) + optional text; founder sees the reason; no reply in 14 days → "No response" (founder can re-request after 90 days).
- *Backend:* status values on `project_interests`, scheduled expiry job. *AI:* aggregate anonymised pass reasons into readiness suggestions (feeds F12). *Impact:* high founder goodwill.

**F9. Saved searches, alerts and a weekly digest** — Standard · M
- *Inspired by:* Crunchbase saved searches/alerts, Dealroom founder alerts, Gust daily activity summary.
- *Workflow:* in Discover, **Save this search** with alert frequency (instant/daily/weekly); weekly email: new matches above X%, startups that updated traction, deal-flow reminders. Founders: weekly "investor activity" digest (who viewed via F5, new matching investors, pending follow-ups).
- *Backend:* `saved_searches(user_id, query JSONB, frequency, last_run_at)`; scheduled worker (Render cron / Neon-adjacent function) + `email_service` digest templates. *Dependency:* SMTP (your planned email setup). *Impact:* high re-engagement.

**F10. Deck-upload auto-fill of the project form** — Standard · S–M
- *Inspired by:* OpenVC (deck upload pre-fills startup info).
- *Workflow:* on New project, "Start from your deck": upload → extract text (existing `document_service`) → LLM maps to form fields (title, one-liner, problem, solution, industry, stage, raise, target customer, traction, team) → founder reviews highlighted pre-filled fields → saves.
- *AI:* structured extraction with field-level confidence; never auto-publish. *Impact:* big drop in onboarding friction.

**F11. Social sign-in (Google, LinkedIn)** — Standard · S
- *Inspired by:* OpenVC, F6S. *Backend:* Neon Auth (Better Auth) supports OAuth providers; add buttons on login/register and role step. LinkedIn also gives verification evidence for F3. *Impact:* conversion.

**F12. Readiness benchmarking + raise guidance** — Edge · M
- *Inspired by:* OpenVC Fundability (percentile, red flags, valuation range), Carta SAFE insights, Gust benchmark.
- *Workflow:* readiness report adds **"How you compare"**: percentile vs published VentureX startups of the same stage and industry (per dimension), typical raise sizes on VentureX for that stage (₹ ranges), most common investor pass reasons for similar startups (from F8), and a red-flag checklist. Clear labels when the cohort is small (n < 20 → "not enough data").
- *Backend:* nightly aggregates table `benchmarks(stage, industry, dimension, p25, p50, p75, n)`; no individual data exposed. *Impact:* differentiation that compounds with data.

**F13. Meeting scheduling + diligence checklist in the deal room** — Standard · M
- *Inspired by:* Gust events with calendar integration; OpenVC scheduling links; Visible/Gust data rooms with diligence requests.
- *Workflow:* deal room **Schedule** (propose 3 slots or paste a Cal.com/Calendly link; .ics invites; meeting appears in timeline) and **Diligence** tab: investor picks a checklist template (financials, cap table, incorporation, IP, customer references — India-specific: MCA filings, GST registration, DPIIT recognition), founder uploads against each item, status per item.
- *DB:* `deal_meetings`, `diligence_items(room_id, label, status, file_id)`. *Impact:* turns the deal room into the place deals actually progress.

### P2 — Differentiation

**F14. AI natural-language discovery ("Ask VentureX")** — Edge · M
- *Inspired by:* Crunchbase Scout, Dealroom/Visible/AngelList MCP.
- *Workflow:* Discover search box accepts plain language; the model converts it to the existing structured filters + thesis (shown as editable chips — explainable, no black box), then results use the existing scoring. Same for founders in F1 ("seed investors in Bengaluru who lead and write ₹1–3 Cr cheques").
- *AI:* function-calling to a fixed filter schema; no free-form SQL. *Impact:* high wow factor at low risk.

**F15. Startup comparison** — Edge · M
- *Inspired by:* Dealroom investor comparison (the pattern), investor shortlisting practice.
- *Workflow:* select 2–4 startups in Discover/Deal Flow → **Compare**: side-by-side facts, fit breakdown per criterion, traction, team/IP, raise, and (only if the founder opted in to share readiness with investors who requested an intro) readiness dimensions.
- *Impact:* differentiates the investor workspace; reuses existing data.

**F16. Investor updates & company-reported KPIs that feed the portfolio** — Edge · L
- *Inspired by:* Visible investor updates (live KPI charts, streaks) and portfolio data requests with source-linked verification.
- *Workflow:* founder (post-close) sends monthly updates to their VentureX investors (template: highlights, asks, KPIs: revenue, burn, runway, customers) → investors see them in the portfolio company detail; investors can **request a valuation/KPI update**; a founder-reported valuation becomes a valuation entry marked "company report" (source already supported: `company_report`) instead of investor self-reported.
- *DB:* `company_updates(project_id, period, body, metrics JSONB)`, `update_recipients`, link `investments.project_id` → updates. *AI:* summarise updates; flag runway < 6 months to investors.
- *Impact:* makes the portfolio module trustworthy and sticky for both sides.

**F17. AI due-diligence assistant in the deal room** — Edge · L
- *Inspired by:* nobody does this at early stage (Carta/AngelList/Visible apply AI to fund data, not to startup diligence).
- *Workflow:* investor clicks **Diligence brief** in a deal room: the model reads the project, uploaded files, GitHub analysis and chat (with founder consent) and produces: claims vs evidence table (each claim linked to page/line — Visible/AngelList "verifiable answers" pattern), open questions, red flags, suggested diligence items (feeds F13 checklist). Founder sees the questions list, not the private notes.
- *AI:* retrieval over document text with citations; strict "cite or say unknown". *Impact:* signature feature; justifies a paid investor tier.

**F18. Investor responsiveness & reputation signals** — Edge · S–M
- *Inspired by:* Wellfound "top 10% of responders"; OpenVC founder reviews of investors (investor-moderated).
- *Workflow:* investor profile shows median response time and response rate (from F2/F8 data) and, later, founder ratings after a deal room closes (moderated). Founders can filter by "responds within a week".
- *Impact:* rewards good investor behaviour; founders love it; needs data volume.

### P3 — Future

**F19. Round modelling & dilution calculator (India instruments)** — Edge · M
- *Inspired by:* Carta Launch scenario modelling, Gust cap-table modelling.
- *Workflow:* in Raise, model a round: pre-money, amount, ESOP top-up, convertibles (CCPS/CCD/iSAFE with cap/discount) → post-money ownership table and founder dilution; export. No legal execution.
- *Impact:* useful, cheap, India-specific where Carta/Gust are US-centric.

**F20. API + MCP server for a user's own VentureX data** — Edge · M
- *Inspired by:* Visible MCP server, Crunchbase/Dealroom MCP, AngelList Link, Carta plugins.
- *Workflow:* per-user OAuth scopes; tools: list matches, draft intro note, summarise deal room, portfolio totals (exact rupee strings), "why does this startup fit me?". Read-only first.
- *Impact:* distribution inside Claude/ChatGPT where users increasingly work; low maintenance once the API is stable.

**Also considered for P3:** ecosystem dashboards for Indian incubators/state startup missions (Dealroom Ecosystem Platform pattern; B2B revenue), programme/open-call applications for accelerators (F6S/Gust), anonymised inbound listing for founders (OpenVC Flow) — partially overlapping with VentureX's published-project model.

### Priority summary

| # | Feature | Priority | Type | Complexity | Depends on |
|---|---|---|---|---|---|
| F1 | Investor directory + profiles for founders | P0 | Standard | M | F3 (badge) |
| F2 | Founder-initiated screened intro requests | P0 | Standard→Edge | M | F1, F3, F8 |
| F3 | Investor & company verification + admin queue | P0 | Standard | M | — |
| F4 | Fundraising round + founder pipeline | P0 | Standard | L | — |
| F5 | Tracked share links + view analytics | P0 | Standard | M | — |
| F6 | Team accounts (founders & investor firms) | P1 | Standard | L | F1–F5 stable |
| F7 | Deal Flow notes/tags/ratings/stages/reminders | P1 | Standard | M | scheduler |
| F8 | Interested / Pass + reason, auto-expire | P1 | Standard | S | F2 |
| F9 | Saved searches, alerts, weekly digest | P1 | Standard | M | SMTP, scheduler |
| F10 | Deck-upload auto-fill | P1 | Standard | S–M | — |
| F11 | Social sign-in | P1 | Standard | S | — |
| F12 | Readiness benchmarking + raise guidance | P1 | Edge | M | data volume |
| F13 | Scheduling + diligence checklist in deal room | P1 | Standard | M | — |
| F14 | AI natural-language discovery | P2 | Edge | M | — |
| F15 | Startup comparison | P2 | Edge | M | — |
| F16 | Investor updates + company-reported KPIs | P2 | Edge | L | F6 helpful |
| F17 | AI due-diligence assistant | P2 | Edge | L | F13 |
| F18 | Responsiveness & reputation signals | P2 | Edge | S–M | F2, F8 |
| F19 | Round modelling (CCPS/CCD/iSAFE) | P3 | Edge | M | F4 |
| F20 | API + MCP server | P3 | Edge | M | stable API |

---

## 17. AI-powered differentiation opportunities

Assessment of the ten candidate ideas, plus additional ones. "VX today" from the code audit.

| # | Idea | VX today | Competitor reference | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | Explainable AI investor-fit score | **Built** (structured, met/not-met reasons, priorities) | OpenVC ranks without reasons; Dealroom match score; Meridian "matched" | **Keep investing** — make it two-sided (F1) and add natural-language "why" summaries | Biggest existing moat; keep it deterministic + explainable, use LLM only to phrase |
| 2 | AI startup readiness score | **Built** (5 dimensions, docs + GitHub) | OpenVC Fundability (questionnaire), deck score | **Extend** with benchmarking (F12) and red-flag checklist | Only VX reads code |
| 3 | AI pitch-deck evaluation | **Partly built** inside readiness | OpenVC slide-by-slide (paid), human review (Ultra) | **Add slide-by-slide view** in the readiness report (per-page comments) | Cheap: page texts already extracted |
| 4 | AI investor-outreach generator | — | OpenVC AI cold-email writer | **Build inside F2** (draft the intro note from project + investor thesis) | Must stay founder-edited; no bulk sending |
| 5 | AI fundraising-strategy assistant | — | none directly | **P2 later**: "Raise plan" from readiness + matches + round target (who to approach first, sequencing) | Depends on F1/F4 data |
| 6 | AI startup benchmarking | — | Dealroom signals, OpenVC percentile | **F12** (aggregate, privacy-safe) | Needs volume; label small cohorts |
| 7 | AI deal discovery & prioritisation | Partly (fit sort) | Crunchbase predictions, Dealroom signal score | **F14 + momentum signal** (traction updates over time) | Track traction history to compute momentum |
| 8 | AI investor-portfolio analysis | — (charts only) | Visible reporting, Carta valuations | **P2/P3**: concentration risk, runway risk from F16 data, follow-on candidates | Needs company-reported data |
| 9 | AI due-diligence assistant | — | none at early stage | **F17 — signature feature** | Cite-or-unknown discipline |
| 10 | AI startup improvement roadmap | Partly (suggestions list) | — | **Extend readiness** into a tracked checklist with "re-run analysis" and score delta | Gamifies improvement |

**Beyond the list**
- **Thesis builder from text**: investor pastes their thesis paragraph or website → AI fills the 10-section criteria for review (removes the biggest investor-onboarding chore).
- **Portfolio-conflict detection**: warn an investor when a startup competes with a portfolio company (embedding similarity of descriptions; the unused `services/ai/embeddings.py` placeholder is the natural home — implement properly or delete).
- **Pass-reason intelligence**: cluster anonymised pass reasons (F8) into "what investors say about startups like yours".
- **Deal-room summariser**: weekly recap of a long deal-room thread for both sides.
- **Verifiable numbers everywhere**: any AI-extracted figure (deck auto-fill, diligence brief, updates) links back to the page it came from — the Visible/AngelList principle, applied to founders' materials.

---

## 18. Features not worth implementing (now)

| Feature | Seen at | Why not |
|---|---|---|
| SPVs, roll-up vehicles, fund administration, money movement | AngelList, Carta | Heavily regulated (SEBI AIF/angel fund rules in India); needs licences and custody. Integrate or link out instead. |
| Cap table management, SAFE/CCPS issuance, 409A | Carta, Gust Launch | Mature specialist tools exist (incl. India-specific ones); low differentiation; legal liability. Offer a modelling calculator only (F19). |
| Mass cold-email outreach volume tiers (300–1,000/month) | OpenVC | Erodes investor trust — the opposite of VentureX's curated, explainable positioning. Keep outreach screened and rate-limited (F2). |
| Scraped investor database of non-members | OpenVC non-verified, Visible Connect, Crunchbase | Data accuracy and consent issues; VentureX's value is verified, opted-in investors with real theses. |
| Predictive "will raise / will exit" models | Crunchbase, Dealroom | Needs years of market-wide data VentureX doesn't have; wrong predictions damage credibility. |
| Jobs board / recruiting / perks marketplace | Wellfound, F6S, OpenVC | Off-strategy; perks can be a later growth tactic, not product. |
| Corporate innovation / government programme marketplaces | F6S, Dealroom | Different buyer; revisit only as B2B ecosystem dashboards (P3 note). |
| Chrome extension / Gmail CRM capture | F6S, Crunchbase, Carta | Valuable for VC power users, but maintenance-heavy; after team workspaces prove demand. |

---

## 19. Technical feasibility assessment

Current architecture (verified): Next.js 16 App Router frontend, FastAPI backend, Neon Postgres (HTTPS SQL transport), Neon Auth JWT, Claude/Gemini for analysis, local private file storage, Upstash-ready rate limits, CI and Docker.

| Area | Readiness | What's needed |
|---|---|---|
| Search & filtering (F1, F9, F14) | **Good** — `discover_service` patterns (parameterised SQL, facets, pagination) reuse directly | GIN indexes on JSONB thesis; tsvector full-text column for projects/investors |
| Scheduled jobs (F7 reminders, F8 expiry, F9 digests, F12 aggregates) | **Missing** | A cron runner: Render cron job hitting an authenticated internal endpoint, or a Neon Function trigger; idempotent jobs table |
| Email (F9, F16, verification) | **Ready once SMTP set** | Templates; unsubscribe links; bounce handling |
| File analytics (F5) | **Partial** | Private storage exists (`dealroom_files`, `document_service`); add a PDF viewer (pdf.js, already a common dependency) and an events endpoint. Move files to object storage (Neon Object Storage / S3) before scaling — local disk won't survive multi-instance deploys |
| Team/role model (F6) | **Biggest refactor** | Ownership checks are spread across services (`founder_id`, `investor_id`); introduce a single `authorize(user, resource, action)` helper first, then migrate; 60 tests + 3 E2E suites give a safety net |
| AI (F10, F14, F17) | **Good** | Analysis pipeline, document text and GitHub extraction already exist; add citation-aware retrieval (page-level chunks with page numbers) and a cost guard per user (rate limits exist) |
| Verification/admin (F3) | **Missing role** | Add `ADMIN` role to `app_users`, admin routes behind `require_admin`, simple admin pages |
| Realtime | **Good** | Deal-room WebSocket fixed; reuse for live notifications later |
| Data privacy | **Good foundations** | Readiness never public, drafts private, CSP, scoped queries; add consent flags for sharing readiness with investors (F15/F17) and a data-export/delete flow (DPDP Act 2023 compliance for Indian users) |

Overall: **all P0–P1 features are feasible on the current stack**; the two structural investments are a **job scheduler** and the **membership/authorization model**.

---

## 20. Recommended product roadmap

Assumes one full-stack developer plus AI-assisted development; adjust proportionally.

**Phase 0 — finish what's started (1–2 weeks)**
- Set up SMTP (Gmail per plan), merge the stacked branches, deploy (render.yaml), add `CI_DATABASE_URL`.
- Delete or implement the placeholder `backend/app/services/ai/` module.
- Add a job scheduler (needed by many later features).

**Phase 1 — make the founder side active (P0; ~6–8 weeks)**
1. F3 Trust layer (investor verification, company domain check, admin queue) — *first, because F1/F2 expose investors to founders.*
2. F1 Investor directory + profiles.
3. F8 Interested / Pass + reason (small; unlocks F2).
4. F2 Founder-initiated screened intro requests with readiness gate.
5. F4 Fundraising round + pipeline.
6. F5 Tracked share links.
*Exit criterion:* a founder can sign up, get a readiness score, find verified investors, request intros, track the round and see deck engagement — parity with OpenVC's core loop, with better explanations and privacy.

**Phase 2 — compete on workflow (P1; ~8–10 weeks)**
7. F11 Social sign-in, F10 deck auto-fill (onboarding conversion).
8. F7 Deal Flow notes/tags/ratings/stages/reminders.
9. F9 Saved searches, alerts, weekly digests.
10. F13 Scheduling + diligence checklist.
11. F6 Team accounts (founders and investor firms).
12. F12 Readiness benchmarking (once ≥ a few hundred published projects).
*Exit criterion:* a small VC team can run its India early-stage pipeline in VentureX end to end.

**Phase 3 — differentiate with AI (P2; ~8–12 weeks)**
13. F14 Natural-language discovery for both sides.
14. F15 Startup comparison.
15. F17 AI diligence assistant with citations.
16. F16 Investor updates + company-reported KPIs → portfolio.
17. F18 Responsiveness & reputation signals.
*Exit criterion:* features no competitor offers together — explainable two-sided matching, code-aware readiness, cited diligence briefs, company-verified portfolio in ₹.

**Phase 4 — future (P3)**
18. F19 Round modelling with Indian instruments.
19. F20 API + MCP server.
20. Ecosystem dashboards for incubators/state startup missions (B2B revenue).

**Monetisation hypothesis** (from §10 patterns): keep discovery, matching, intros (with limits), readiness basics and the pipeline free; charge founders for higher intro limits, deck analytics depth, benchmarking and slide-by-slide review; charge investors for team workspaces, AI diligence briefs, saved-search alerts at scale and company-reported portfolio data.

---

## Appendix — source index

Full per-platform source lists are in the research notes:
`01-openvc.md` · `02-wellfound.md` · `03-gust.md` · `04-f6s.md` · `05-visible.md` · `06-crunchbase.md` · `07-angellist.md` · `08-dealroom.md` · `09-carta.md` (all in `project-documentation/competitor-research/`).

Key primary sources: openvc.app/pricing, openvc.app/invest, docs.openvc.app (articles 13205582, 13227759, 13227886, 13228069, 13228089, 13228104, 13228251, 13228311, 13228360, 13228450, 13228468, 13228470, 13228487, 13228447, 13228649, 14779652, 13228651, 15068911, 17779973, 17779974) · wellfound.com, wellfound.com/recruit/pricing, wellfound.com/company/wefunder, help.wellfound.com/article/711 · gust.com, gust.com/pricing, gust.com/investors, gust.helpscoutdocs.com (articles 210, 211, 213, 222, 223, 227, 228, 230, 232, 338, 345, 367) · f6s.com, f6s.com/investment-funds, f6s.helpscoutdocs.com (articles 62, 64, 88, 89, 91, 103, 116, 132, 220, 237) · visible.vc (pricing, investor-pricing, product/pipelines, product/pitch-decks, product/data-rooms, investor-updates, metrics, connect, data-collection, verification, reporting, mcp-server) · crunchbase.com, crunchbase.com/buy/select-product, support.crunchbase.com · angellist.com (spvs, link, funds, emerging-managers, investor-management/data-room), meridian.angellist.com, angellist.com/blog/introducing-roll-up-vehicles · dealroom.co (pricing, premium-access, ecosystems-network), knowledge.dealroom.co · carta.com/sg/en (equity-management/launch, fund-management/deal-crm, fund-management/portfolio-valuations, plans/equity-management, equity-management/cap-table/safes).
