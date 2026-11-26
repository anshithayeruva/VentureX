# Visible — research notes (researched 2026-11-23)

Positioning (directly observed): "The platform for investors and founders building together." Two products: **founders** — raise capital and manage investor relations (decks, data rooms, fundraising pipelines, investor updates, KPI dashboards, free investor database "Visible Connect"); **investors (VCs)** — AI-powered **portfolio monitoring & reporting** (data collection from portfolio companies, verification, dashboards, LP reporting). "Trusted by 7,000+ founders", "950+ VC firms", SOC 2 Type II. Notable: **MCP server** and listings in the Claude and ChatGPT directories.

## Access report
| Area | Status |
|---|---|
| Public website | Accessible (home, founder/investor pricing, 10 product pages — directly observed) |
| Registration flow | Not inspected (app.visible.vc/create-account; no account created) |
| Founder dashboard | Indirectly researched — product pages embed a mock of the app UI (nav: Home, Favorites, Fundraising, Update, Data Room, Reporting, Investor Updates, Dashboards, Fundraising Pipelines, Decks, Data Rooms) |
| Investor dashboard | Indirectly researched (product pages; demo-gated) |
| Documentation | Partially inspected (product pages; help centre not opened) |
| Pricing | Verified for founders; investor plans "custom pricing" (feature matrix verified) |

## Founder side (visible.vc/for-founders)
- **Fundraising Pipelines** (/product/pipelines): per-round pipeline (e.g. "Seed Round — Target raise: $3,000,000") with stages **Research · Contacted · Meeting · Light Diligence · Partner meeting · Term sheet · Keep in touch · Closed · Passed**, each column summing amounts; table columns Investor, Primary contact, Stage, Amount, Pitch Deck Link (unique per investor, e.g. decks.visible.vc/seed-round/<investor>); progress "Amount: $1,875,000 (82%)" of target. Add investors straight from Visible Connect.
- **Decks** (/product/pitch-decks): hosted decks, versioning, per-investor links, **per-slide analytics** (who engaged, how long), custom domain on Growth.
- **Data Rooms** (/product/data-rooms): folder management, permissions, advanced analytics; handles diligence requests.
- **Investor Updates** (/investor-updates): editor with Update Content → Recipients → Preview & Send; personalisation ("Hello First name"); embedded **live charts** from metrics; send from your own domain; test send; streak gamification ("1 update in a row"; "founders who share updates are 3x more likely to raise follow-on"); templates library.
- **Metric Tracking / Dashboards** (/metrics): KPI dashboards (ARR, ACV, MoM growth, new MRR, customers, revenue by product), goals, integrations to pull metrics automatically, share dashboards.
- **Visible Connect** (/connect, free): investor database, filter stage (Accelerator, Pre-Seed, Seed, Series A–C, Growth, Alt. VC, Angel, Early, Incubator, Late, Startup Studio), sector, check size; 800+ verified profiles, 19k+ records updated daily; card → View Profile; add to pipeline.
- **MCP Server** (/mcp-server): ask your AI tool for metrics, draft an investor update with charts and pipeline status, then send in Visible.
- **Pricing (verified)**: Starter $0 (updates to 100 investors, KPI dashboards, 2 decks, 2 pipelines, Connect); Base $59/mo annual ($69 monthly) — 250 recipients from own domain, unlimited pipelines, unlimited decks + versioning, 1 data room; Core $129/mo ($149) — 500 recipients, per-slide analytics, 3 data rooms + analytics, 3 integrations, unlimited dashboards; Growth $199/mo ($249) — 1,000 recipients, decks on own domain, 5 data rooms with advanced permissions, 5 integrations.

## Investor side (portfolio monitoring)
- **Data Collection** (/data-collection): recurring & one-time **requests** to portfolio companies; whatever comes back (spreadsheet, PDF, email) is **AI-structured**; Google Sheets/Airtable integrations; founders receive a "founder-friendly" form.
- **Verification** (/verification): every figure links to the exact document, page and line it came from; audit logs, change log, metric alerts, approval workflows (Enterprise).
- **Reporting** (/reporting): portfolio company dashboards, fund-level dashboards, LP tear sheets, partner decks, DDQs from one dataset; variance reporting; benchmark dashboards; segment metrics & cohorts; formula builder; multi-currency.
- **AI Inbox** (Premium): parse portfolio emails/files into data. **Open Platform**: API + MCP. **Managed Data Service** (team does the work).
- Plans (custom pricing): Essential, Premium, Enterprise (SSO, SLA).
- Not a deal-sourcing tool; deal flow pipelines exist mainly on the founder side.

## Relevance to VentureX
- **Investor updates + metric dashboards** connect founders and investors after the intro/investment — VentureX has nothing post-deal from the founder side; VentureX portfolio is investor self-reported only. A "founder shares KPIs/updates with their investors" loop would let VentureX portfolio values be **company-reported** rather than self-reported.
- **Round-level fundraising pipeline with target and committed amounts** for founders (VentureX founders only see intro requests).
- **Per-investor deck links with per-slide analytics**, data rooms with permissions (VentureX deal room has documents but no analytics/permissions).
- **Source-linked verification of numbers** (every figure traced to a document) — a strong pattern for VentureX's AI readiness and any extracted metrics.
- **MCP/AI-assistant distribution** (also OpenVC) — an emerging channel.

Sources: https://visible.vc/ · https://visible.vc/pricing/ · https://visible.vc/investor-pricing/ · https://visible.vc/product/pipelines/ · https://visible.vc/product/pitch-decks/ · https://visible.vc/investor-updates/ · https://visible.vc/data-collection/ · https://visible.vc/verification/ · https://visible.vc/reporting/ · https://visible.vc/connect/ · https://visible.vc/product/data-rooms/ · https://visible.vc/metrics/ · https://visible.vc/mcp-server/
