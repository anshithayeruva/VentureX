# VentureX — Client Pitch Presentation

**Built deck:** https://claude.ai/artifact/14xpMDryPUdQAHLQCerCFf (private until shared from its Share menu; speaker notes are in each slide).
**Screens:** captured from the running product with sample data (startup "ClaimPilot", founder "Maya Chen", investor "Daniel Ortiz, Northlight Angels"), with a real Gemini analysis. The sample data was deleted afterwards. The deal-room screen has a test email address blurred.
**Format:** 17 slides, 16:9, about 20 minutes plus Q&A (≈ 70 seconds per slide; the four product slides take longer, the closing slides less).
**Story arc:** problem (1–4) → solution and journey (5–10) → value (11) → how it works (12–13) → trust (14–15) → vision and ask (16–17).
**Look:** navy `#14233F`, brand blue `#1D4E96`, brand green `#2E9461`, warm off-white `#F7F8FA`; Space Grotesk for headings, Inter for text. Screens are from the working product with sample data.

**Rules this deck follows:** only implemented functionality; matching is described as *explainable, rule-based*; the AI is described as *readiness analysis on Gemini or Claude*; no market statistics, adoption numbers or certifications; the product is presented as working but **not yet deployed**.

This document is the source of truth for wording and speaker notes.

---

## Slide 1 — VentureX

**Content**
* Title: **VentureX**
* Subtitle: **Get ready to raise. Meet investors who fit.**
* Line: Private AI feedback for founders · Explainable matching · Private deal rooms
* Footer: Capstone project · [Team names] · [Date]

**Layout:** full-bleed navy background, title left-aligned at large size, subtitle beneath, a cropped screenshot of the readiness report angled on the right half.
**Visual:** product screenshot (readiness report).
**Speaker notes:** "Every early-stage founder eventually sits across from an investor, often with one chance to make a first impression. VentureX is built for the moments before and after that meeting: getting ready for it, getting it with the right person, and running what comes next. Over the next twenty minutes I'll show you the problem, the product, and how it works under the hood."
**Transition:** "Let's start with that first meeting."

## Slide 2 — The first pitch is often the last

**Content**
* Statement: **Founders usually get one shot with an investor, and many take it before they're ready.**
* Three short lines:
  * The deck is missing what investors look for first.
  * The feedback, if it comes, is a polite "not for us".
  * Good advice depends on who you already know.

**Layout:** a light background with one large statement across the top two-thirds, then three short lines in a row below, each with a small icon.
**Visual:** icons only (warning, chat, users).
**Speaker notes:** "Think about a first-time founder. They've built something real, they put a deck together over a weekend, and they send it out. Most investors don't reply, and the few who do say 'not for us' without saying why. The founder never learns that the market slide had no numbers, or that traction was buried on slide fourteen. Founders with advisors or an accelerator get that feedback. Everyone else learns by being rejected."
**Transition:** "And it isn't only founders who feel this."

## Slide 3 — Both sides lose time

**Content**
| Founders | Investors |
| --- | --- |
| Pitch before the materials are ready | Sort through pitches outside their focus |
| Reach out to investors who don't fit their stage or sector | Filter by industry, stage and check size by hand |
| Lose track of who has what across email and links | Run first diligence in inboxes and shared folders |

**Layout:** two equal columns on a light card each, founders on the left, investors on the right, a thin divider.
**Visual:** none beyond icons per column header.
**Speaker notes:** "On the other side of the table, investors have their own version of this. A seed fund focused on healthcare still receives pitches for consumer apps and Series B rounds. Someone has to read them and say no. And when a conversation does start, the deck, the NDA and the follow-up questions end up spread across email threads and shared links. Both sides are spending time on the wrong conversations, and losing track of the right ones."
**Transition:** "So why should this matter to you?"

## Slide 4 — Why it matters

**Content**
* Heading: **Better-prepared founders make better conversations**
* Three cards:
  * **Less wasted time:** fewer meetings that were never a fit.
  * **Better first impressions:** founders fix gaps before investors see them.
  * **A clear record:** what was shared and agreed, in one place.
* Small note: *We haven't measured these outcomes yet; they're what the product is designed to do.*

**Layout:** a heading, then three cards in a row with an icon, a bold lead-in and one line.
**Visual:** icons (clock, star, lock).
**Speaker notes:** "For an accelerator, a fund or a founder community, the value is simple. Every meeting that happens should be a meeting worth having. Founders should walk in prepared, and the record of what happened next should be in one place. I want to be clear: we haven't run this with real users yet, so these aren't measured results. They're what we designed the product to do, and the next slides show how."
**Transition:** "Here's how VentureX does it."

## Slide 5 — One flow: prepare, match, connect, close the loop

**Content**
* Heading: **VentureX in one flow**
* Four steps, left to right:
  1. **Prepare:** founders get a private readiness report.
  2. **Match:** investors see startups that fit, with the reasons.
  3. **Connect:** investors request an intro; the founder decides.
  4. **Diligence:** a private deal room opens for the two of them.

**Layout:** a horizontal four-step flow with numbered circles joined by arrows; each step gets a short label and one line.
**Visual:** a simple flow diagram (drawn on the slide).
**Speaker notes:** "VentureX joins these steps into one flow. A founder prepares, privately. When they're ready, they publish, and investors whose criteria fit see the startup with the reasons it fits. An investor asks for an intro, and the founder decides. If they say yes, a private room opens for the two of them. I'll walk through each step with real screens from the product."
**Transition:** "Step one: prepare."

## Slide 6 — Prepare: an honest read before anyone else sees it

**Content**
* Heading: **Prepare: a private readiness report**
* Three points:
  * Reads the **pitch deck, documents and GitHub repository**, not just a form.
  * Scores **five areas**: problem and solution, market, business model, traction, product and technology.
  * Lists **strengths, gaps by severity, and fixes in order of impact**, plus industry-specific advice.
* Callout: **Only the founder can see it.**

**Layout:** a screenshot of the readiness report on the left (about 60% width), three points and the callout on the right.
**Visual:** screenshot of a real analysis (Readiness tab).
**Speaker notes:** "The founder adds their project and uploads what they have: the deck, a business plan, market research. If they have a GitHub repository, they link it. An AI analyst reads all of it together and writes a report: a score out of 100, five areas scored with the reasoning, what investors will like, what's missing, and the fixes in order of impact. It's instructed to cite the material it draws on and never to invent numbers. And this is important: nobody but the founder ever sees this report. Investors never see the score or the gaps."
**Transition:** "Once the founder is ready, they publish, and matching takes over."

## Slide 7 — Match: every recommendation says why

**Content**
* Heading: **Match: explainable, not a black box**
* Left: the investor's view of a match, with the reasons.
* Right, a small table:

| Factor | Weight |
| --- | --- |
| Industry | 40% |
| Stage | 30% |
| Check size | 20% |
| Business model | 10% |

* Line: **Every match lists its reasons**, e.g. "Target raise ($600K) fits inside the fund's check range ($500K–$1.5M)."

**Layout:** a screenshot left, the weights table and an example reason right.
**Visual:** screenshot of the investor's "Why it fits your criteria" panel.
**Speaker notes:** "Investors set their criteria once: industries, stages, check size, business models. Every published startup is scored against them on four factors, and each factor writes a sentence explaining itself. We chose transparent rules here on purpose. An investor can see exactly why something was recommended and trust it; a founder can see why an investor is a fit. There's no black box."
**Transition:** "When an investor likes what they see, the next step is a conversation, on the founder's terms."

## Slide 8 — Connect: the founder stays in control

**Content**
* Heading: **Connect: on the founder's terms**
* Three points:
  * The investor requests an intro with a **personal note**.
  * The founder **accepts or declines**.
  * Contact details are shared **only after acceptance**.

**Layout:** a screenshot of the founder's "Needs your reply" request on the left, three points on the right.
**Visual:** screenshot of an intro request with Accept and Decline.
**Speaker notes:** "The investor writes a short note and requests an intro. The founder gets a notification, reads the note, and decides. Until they accept, the investor doesn't get the founder's email. Nothing is shared that the founder hasn't agreed to. Accepting does one more thing: it opens a deal room."
**Transition:** "And this is where the real work starts."

## Slide 9 — Diligence: one private room per deal

**Content**
* Heading: **Diligence: a private deal room**
* Points:
  * Live chat between the two parties
  * A mutual NDA step
  * Documents shared in one place
  * Deal stage: intro, due diligence, partner meeting, term sheet, closed
  * A full activity history, exportable as PDF
* Callout: **Each message is linked to the one before it, so later changes can be detected.**

**Layout:** a large screenshot of a deal room (about 65%), points on the right.
**Visual:** screenshot of a deal room with a short conversation, the NDA card and the stage bar.
**Speaker notes:** "Each accepted intro gets its own room. Only the founder and that investor can open it. They chat in real time, sign the NDA, share documents and move the deal through its stages, from intro to due diligence to term sheet. Everything is recorded, and each message is linked to the previous one with a cryptographic hash, so if anyone changed the history later it would show. They can export the whole conversation as a PDF."
**Transition:** "Let me put those four steps together as one story."

## Slide 10 — One journey, two people

**Content**
* Heading: **One journey, two people**
* A two-lane timeline:
  * **Founder (Maya):** adds the project → uploads the deck → reads the report, fixes two gaps → publishes → accepts the intro → shares pilot data in the room.
  * **Investor (Daniel):** sets criteria → sees the startup as a strong fit with reasons → requests an intro with a note → opens the room → moves the deal to due diligence.

**Layout:** two horizontal swim lanes with connected milestones; the intro request and the acceptance link the lanes.
**Visual:** a timeline diagram (drawn on the slide).
**Speaker notes:** "Here's the whole journey with two people. Maya, a founder, uploads her deck and gets her report. It tells her the market slide has no numbers and the GitHub link is wrong. She fixes both and publishes. Daniel, an angel focused on healthcare at seed stage, sees Maya's startup as a strong fit, with the reasons. He sends an intro request with a note. Maya accepts, the room opens, she shares her pilot data, and Daniel moves the deal to due diligence. Maya and Daniel are illustrative, but every step is something the product does today."
**Transition:** "So what makes this valuable, beyond any single feature?"

## Slide 11 — What makes VentureX valuable

**Content**
* Heading: **Why it's valuable**
* Four value cards:
  1. **Know before you pitch:** candid, private feedback grounded in your own materials.
  2. **Talk only to people who fit:** both sides see the reasons behind each match.
  3. **Founders stay in control:** nothing is visible or shared until they choose.
  4. **One place for early diligence:** chat, NDA, documents and stages, with a record.

**Layout:** a 2×2 grid of cards, each with a number, a bold title and one line.
**Visual:** icons.
**Speaker notes:** "If you remember four things: founders know where they stand before they pitch; nobody wastes a meeting on a poor fit, because both sides can see why a match was made; the founder controls visibility and contact details at every step; and early diligence lives in one place instead of ten. Each of these maps to a feature you just saw working."
**Transition:** "Now let's look at how it's built, starting with the AI."

## Slide 12 — How the AI works

**Content**
* Heading: **How the readiness analysis works**
* A five-step pipeline: **Collect** (profile, documents, GitHub summary) → **Send** (to Gemini or Claude with fixed instructions) → **Structure** (strict JSON format) → **Validate** (check and score) → **Save** (history kept, shown only to the founder)
* Two honest notes:
  * **AI:** the readiness analysis. **Rules:** the matching, by design.
  * **No AI key?** A transparent rule-based check still gives a baseline, clearly labelled.

**Layout:** a horizontal pipeline of five boxes across the middle, the two notes as a pair of cards beneath.
**Visual:** the pipeline diagram (drawn on the slide).
**Speaker notes:** "Here's exactly what the AI does. The system collects the founder's profile, their documents and a summary of their GitHub repository. PDFs and images go to the model as files, so it sees the actual slides. It sends all of this to Google's Gemini, or Anthropic's Claude if configured, with fixed instructions: score five areas on a defined scale, cite the material, never invent facts. It requires the answer in a strict structure, checks it, and saves it, keeping the history so founders can see progress. Two honest points: the AI is used for the readiness analysis, and matching is deliberately rule-based so it stays explainable. And if no AI is available, a rule-based check still gives founders a baseline, clearly labelled as such."
**Transition:** "The rest of the system is built on dependable, managed foundations."

## Slide 13 — Under the hood

**Content**
* Heading: **Built on managed, modern foundations**
* An architecture diagram: Browser → **Next.js 16 website** → **FastAPI server (Python)** → **Neon Postgres**; side services: **Neon Auth** (sign-in), **Gemini / Claude** (analysis), **GitHub API** (repo facts).
* Three facts:
  * **13 database tables, 52 API endpoints**, live chat over WebSocket.
  * **Every request is verified** with a short-lived signed token.
  * **Managed sign-in and database:** we never store passwords.

**Layout:** the diagram across the top two-thirds, three fact cards beneath.
**Visual:** the architecture diagram (drawn on the slide).
**Speaker notes:** "The website is built with Next.js and React. It talks to a Python FastAPI server, which holds all the business rules, and the server talks to a Postgres database hosted by Neon. Sign-in is handled by Neon's managed authentication, so we never see or store a password. Every request to our server carries a short-lived signed token that we verify before doing anything. The AI and GitHub are called only from the server, never from the browser. It's a deliberately simple, standard architecture, chosen so we could focus on the product."
**Transition:** "Simple is good, but you'll want to know why you can trust it."

## Slide 14 — Why you can trust it

**Content**
* Heading: **Built privacy-first, and tested end to end**
* Left column, **Privacy by design**:
  * Readiness reports are visible only to the founder.
  * Projects stay private until published.
  * Contact details are shared only after acceptance.
  * Deal rooms are visible only to their two members.
* Right column, **Tested**:
  * **17** automated backend tests
  * **86**-check end-to-end run with real sign-ins for both roles
  * Product flows clicked through in a real browser

**Layout:** two columns with a vertical divider; the test numbers in large type on the right.
**Visual:** none; typography only.
**Speaker notes:** "Trust comes from two things: design and evidence. By design, privacy is built into the workflow. The report is the founder's alone, nothing is visible until they publish, contact details wait for their yes, and each room belongs to its two members. As evidence, we have automated backend tests, and an end-to-end run of 86 checks that signs in as a real founder and a real investor and goes all the way from creating a project to messaging in a deal room. It all passes."
**Transition:** "And we want to be just as clear about what's still ahead."

## Slide 15 — Where we are today

**Content**
* Heading: **Working today, and what comes before launch**
* **Working today:** sign-up and password reset · projects and document upload · AI readiness (Gemini) · explainable matching · intro requests · deal rooms · notifications
* **Before launch:**
  * Close the remaining medium-severity access issues
  * Add rate limiting
  * Move files to cloud storage
  * Send email notifications
  * Deploy behind HTTPS

**Layout:** two columns, a green "Working today" list and a blue "Before launch" list, each with check or step icons.
**Visual:** icons (Check for working, step numbers for the plan).
**Speaker notes:** "Everything on the left works today, and you've seen it. On the right is what we do before real users arrive. We ran our own security review and found three serious access-control gaps, for example some notifications readable without signing in. We've already fixed all three and added tests that prove it. A few smaller access issues are first on the list. Then rate limiting, cloud file storage, real email notifications and a production deployment. Right now the product runs locally, with the database and sign-in already hosted in the cloud."
**Transition:** "Beyond launch, here's where VentureX goes next."

## Slide 16 — The vision

**Content**
* Heading: **Where VentureX goes next**
* Three phases:
  1. **Launch:** security hardening, deployment, email, cloud storage.
  2. **Deeper insight:** the AI reads source code and opens demo links; analyses run in the background; founders see what changed between runs.
  3. **Scale:** teams for funds and accelerators, cohort views, smarter semantic matching, analytics.

**Layout:** a three-column roadmap with phase numbers and short lists; no dates.
**Visual:** a roadmap strip (drawn on the slide).
**Speaker notes:** "Phase one is launch: everything on the previous slide. Phase two makes the AI smarter: reading the actual code in a repository, looking at the founder's demo, running analyses in the background, and showing founders how their score changed after each improvement. Phase three is about scale: accounts for whole fund teams and accelerator cohorts, so a program can see every company's readiness at a glance, and matching that understands meaning rather than just categories. The long-term vision is simple: every founder walks into the right meeting, prepared."
**Transition:** "Which brings us to what we'd like from you."

## Slide 17 — Every founder in the right meeting, prepared

**Content**
* Statement: **Every founder in the right meeting, prepared.**
* Three lines:
  * A working product: prepare, match, connect, diligence.
  * AI grounded in real materials; matching you can explain.
  * A clear plan to launch.
* Ask: **Let's choose a first group to pilot with: an accelerator cohort, an angel network or a university program.**
* Footer: [Team names] · [Contact]

**Layout:** the navy statement slide (matching the cover), the statement large, three lines beneath, the ask in an accent-coloured box.
**Visual:** none; typography only.
**Speaker notes:** "To sum up: VentureX is a working product that prepares founders, connects them with investors who fit, and gives both sides a private place to move forward. The AI is grounded in the founder's own materials, and the matching explains itself. Our next step is a pilot, and we'd value your view on where to start. Thank you. I'm happy to take questions, and I can show any part of it live."
**Transition:** "Questions."

---

## Placeholders to fill in

* `[Team names]`, `[Date]`, `[Contact]` on slides 1 and 17.
* Maya and Daniel (slide 10) are illustrative personas. Say so if asked.

## If you're asked something hard

See `CLIENT_AND_TECHNICAL_QA.md`. The most likely hard questions are already answered there: "Is the matching AI?" (Q18), "How do you validate the AI?" (Q27), "What are the limitations?" (Q6), and "What security gaps exist?" (Q32).
