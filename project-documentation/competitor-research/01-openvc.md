# OpenVC — research notes (researched 2026-11-23)

Positioning: free-first fundraising platform for founders (investor database + screened outreach + CRM + deck tracking), plus a free sourcing/visibility tool for investors (OpenVC Flow, LP Navigator). 65k+ founders, 16k–20k investors.

## Access report
| Area | Status |
|---|---|
| Public website | Accessible (directly observed: home, /pricing, /invest) |
| Registration flow | Indirectly researched (official help docs; not signed up) |
| Founder dashboard | Indirectly researched (official docs describe sections) |
| Investor dashboard | Indirectly researched (official docs) |
| Documentation | Inspected (docs.openvc.app, Intercom; ~20 articles read) |
| Pricing | Verified (openvc.app/pricing, directly observed) |

Sources: https://www.openvc.app/ · https://www.openvc.app/pricing · https://www.openvc.app/invest · https://docs.openvc.app/en/ (articles cited by id below, path /en/articles/<id>)

## Founder side
- **Sign up** (doc 13205582): "Join for free" → "I'm a founder" → email+password or Google/LinkedIn/X → email verification. Basic account can browse investor list + masterclass; full features need startup setup: **upload pitch deck (auto-extracts info) or fill manually**. "We ask a lot of information at signup so we can create a custom list of investors."
- **Fundability Test** (13227886): 30 questions → 12 red flags, Fundability score (top 50%/10%/1% of raising startups), **valuation range based on Carta & AngelList data**, refines investor targeting. Confidential, never shared; retakeable. Completing it auto-lists the startup on anonymised OpenVC Flow within 24h (opt-out by email).
- **Deck upload + AI score** (13227759): upload PDF to "OpenVC Decks"; AI scores 0–5 with feedback; **must score ≥3/5 before sending to investors**; deck content auto-generates the cold email template. Deck private by default. Free = basic AI review; Premium = slide-by-slide; Ultra = one-time human video review; $999 deck design add-on.
- **Dashboard** (13228487): first screen after login — CRM overview, recent investor requests (inbound), daily outreach count / time until next pitch, fundraising checklist, announcements (webinars/events), resources, "amount raised" figure (editable), "Your decks".
- **Investor search** ("Search investors" menu, 13228069/13228089): 16k–20k investors, results **ranked by fit**. Free filters (4): Verticals (keywords), Geography (incorporation country), Stage (idea/prototype/early revenue/scaling/growth/pre-IPO), Round size. Premium filters (10): + Solicitation (investors with few decks this week), Outreach type (Submit deck / Send email / Online form / Intro preferred), Investor type (10 types), Investor HQ, Verified, Check size, Lead. Swipe-style triage: "Add to CRM" or "Skip" ("Tinder for VCs"). Verified (blue check) = investor signed up; non-verified = assembled from public data; no KYC.
- **Outreach** (13228251/13228311/13228360): 3 modes per investor preference — "Submit deck" (in-platform, **AI-screened** for quality before sending; email from OpenVC address with deck link as CTA; investor reply goes straight to founder's email), "Send email" (own Gmail/Outlook), "Fill form" (investor's form). Some investors only accept intros → "Find intro" button. Limits: Free 1 pitch/day, Premium 300/mo, Ultra 1,000/mo (max 50/day), shared across team. "Submit later" option. AI cold email writer.
- **Warm Intro Finder** (Premium): scans Gmail + LinkedIn connections for intro paths; advanced network search (beta).
- **Fundraising CRM** (free, 13228450/13228468): Kanban; every outreach auto-creates a card; deck analytics pulled in. Columns/statuses include "To be contacted", "Rejected by OpenVC", "Sent via OpenVC", "Email opened", "Investor interested" (investor clicked "I'm interested"), "Investor declined" ("Pass for now" + short reason), "Ignored" (no reply in 15 days), "Not happening". Card fields: notes ("Your notes" for co-founders/advisors), amount, status. Add external investors manually; search; export CRM data.
- **Auto follow-up** (13228470): with OpenVC Decks, automatically follows up twice over two weeks.
- **Deck links & tracking** (15068911): every CRM investor gets a unique tracked deck link (who opened, when); deck link meant 1:1. Can notify investor after deck update. No data room (17779973) — "use Google Drive, DocSend".
- **Inbound** (13228447): anonymised listing on OpenVC Flow; investors "Request deck"; requests appear on founder dashboard; founder accepts (reveals) or ignores (stays anonymous).
- **Team**: invite team free; each can edit profile, use CRM, reach out.
- Scheduling link in emails; email client setup / whitelist; data export; no API (17779974).
- Learning: 24-video Masterclass, deck template (50 layouts), ebook, webinars, events, $2M perks, "Use in ChatGPT / Use in Claude" (OpenVC available inside AI assistants), 400+ public investor lists (SEO), fundraising advisor marketplace (deck experts, lawyers, MVP builders).

## Investor side
- **Sign up** (13228649): "I'm a VC, scout, angel, accelerator" → investor type → angel fills personal form, firms pick/create firm → **manual review by OpenVC team** (may ask for evidence of activity).
- **Profile** (14779652): Overview — investor type, first check min/max (USD), Lead (always/sometimes/never), Themes (auto-derived from Funding requirements), Funding stage, Countries of investment, Who we are, Funding requirements (thesis), Value add, 8 standard FAQ answers, Location (map), YouTube video; accelerators add program fee, deal terms, application period. Team (invite colleagues), Portfolio showcase, **Reviews from founders (investor approves/hides)**, Settings: socials, deal-flow channel (email / online form / intros only), CRM used. Seen by ~3,000 founders/month.
- **Sourcing** (13228651): passive — screened decks by email (max ~2/week); active — **OpenVC Flow** (openvc.app/flow, directly observed on /invest): anonymised list of raising startups, filters company stage, HQ country, round size, chips "Exited founder", "Funding secured", "Supergrowth"; card = sector · traction headline · country · stage · "Sourced today"; "Request deck" → founder accepts/declines. Triage in inbox: "I'm interested" / "Pass for now" with reason.
- **LP Navigator**: 10k+ LPs, 5k verified emails, intro finder from Gmail/LinkedIn, 500+ LP events (for fund managers raising funds).
- Investors: free.

## Free vs paid (verified on pricing page)
Free $0: 20k investors, 4 filters, 1 pitch/day, basic AI deck review, CRM, deck hosting/analytics, Fundability test. Premium $299/yr ($25/mo billed yearly): 300 pitches/mo, Intro Finder, 10 filters, slide-by-slide AI review, masterclass + template, $2M perks, investor deck requests. Ultra $899/yr: 1,000 pitches/mo, one-time human deck review. Add-on: deck design $999.

## Notable patterns for VentureX
1. Deck-quality gate before outreach (score ≥3/5) + AI screening of every pitch → protects investor trust.
2. Anonymised inbound marketplace (Flow) with founder-controlled reveal.
3. Investor response buttons (Interested / Pass + reason) with auto "Ignored" after 15 days.
4. Per-investor tracked deck links + auto follow-ups.
5. Fundability test with valuation range and red flags.
6. Founder reviews of investors.
7. Investor outreach-channel preference (email/form/intro-only) and "solicitation" filter (investor load).
