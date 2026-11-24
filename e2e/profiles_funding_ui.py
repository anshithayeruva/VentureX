"""Profiles, settings, funding rounds and the redesigned Discover page in a real browser, with the E2E
test founder and investor. All figures are made-up test data. Profiles and settings are restored
and the test startup (with its rounds) is removed afterwards.

    python e2e/profiles_funding_ui.py [screenshot-dir]
"""
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import API, ENV as env, WEB as B, db, set_test_investor_verification  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
OUT.mkdir(exist_ok=True)
CHANNEL = os.environ.get("VX_BROWSER_CHANNEL") or None
TITLE = "E2E Funding ClinicLedger"
results = []


def ok(name, cond, detail=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))


def signed_in(browser, email, password):
    ctx = browser.new_context(viewport={"width": 1440, "height": 1000})
    r = ctx.request.post(B + "/api/auth/sign-in/email", headers={"Origin": B}, data={"email": email, "password": password})
    page = ctx.new_page()
    page.goto(B + "/", wait_until="networkidle")
    token = page.evaluate("""async () => { const r = await fetch('/api/auth/token'); return r.ok ? (await r.json()).token : null; }""")
    return ctx, page, {"Authorization": f"Bearer {token}"} if token else {}, r.ok


PROFILE_KEYS_F = ("first_name", "last_name", "phone", "location", "headline", "bio", "linkedin", "website", "expertise",
                  "designation", "experience", "skills", "previous_startups", "company", "startup_role", "background")

with sync_playwright() as p:
    br = p.chromium.launch(channel=CHANNEL)
    fctx, f, fh, f_ok = signed_in(br, env["E2E_TEST_EMAIL"], env["E2E_TEST_PASSWORD"])
    ictx, i, ih, i_ok = signed_in(br, env["E2E_INVESTOR_EMAIL"], env["E2E_INVESTOR_PASSWORD"])
    ok("founder and investor sign in", f_ok and i_ok and fh and ih)
    errors = []
    for page in (f, i):
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("dialog", lambda d: d.accept())
    investor_id = ictx.request.get(API + "/me", headers=ih).json()["id"]
    founder_id = fctx.request.get(API + "/me", headers=fh).json()["id"]
    orig_fprofile = fctx.request.get(API + "/me/profile", headers=fh).json()
    orig_fsettings = fctx.request.get(API + "/me/settings", headers=fh).json()["settings"]
    orig_isettings = ictx.request.get(API + "/me/settings", headers=ih).json()["settings"]
    pid = None
    try:
        ok("test investor verified", set_test_investor_verification("verified"))
        r = fctx.request.post(API + "/projects", headers=fh, data={
            "title": TITLE, "tagline": "Books and payouts for clinics", "description": "Accounting and payouts for clinics.",
            "problem": "Clinics reconcile payments by hand.", "solution": "Automatic books from UPI and card payments.",
            "industry": "Fintech", "stage": "Seed", "funding_required": 5000000, "business_model": "B2B SaaS",
            "target_market": "Clinics in India", "country": "India", "city": "Pune", "is_published": True,
            "monthly_revenue": 250000, "customer_count": 30,
        }, timeout=180000)
        pid = r.json().get("id") if r.ok else None
        ok("founder creates a published startup", bool(pid), r.status)
        ok("investor and founder connected (accepted intro)", db([[
            "INSERT INTO project_interests (id, project_id, investor_id, founder_id, status, initiated_by, project_title) "
            "VALUES (%s, %s, %s, %s, 'accepted', 'investor', %s)", [f"intro-{pid}-{investor_id}", pid, investor_id, founder_id, TITLE]]]))

        # ---- founder profile: edit, save, cancel, validation
        f.goto(B + "/founder/profile", wait_until="networkidle")
        f.get_by_text("Personal information").wait_for(timeout=20000)
        sec = f.locator("div.rounded-xl", has=f.get_by_role("heading", name="Personal information")).first
        sec.get_by_role("button", name="Edit").click()
        f.get_by_label("First name").fill("Neha")
        f.get_by_label("Last name").fill("Rao")
        f.get_by_label("Phone").fill("not a phone")
        sec.get_by_role("button", name="Save").click()
        sec.get_by_text("phone number", exact=False).first.wait_for(timeout=20000)
        ok("invalid phone is refused with a message", True)
        f.get_by_label("Phone").fill("+91 98765 43210")
        f.get_by_label("Professional headline").fill("Building books for clinics")
        sec.get_by_role("button", name="Save").click()
        sec.get_by_text("Saved.").wait_for(timeout=20000)
        f.reload(wait_until="networkidle")
        f.get_by_text("Building books for clinics").first.wait_for(timeout=20000)
        ok("founder profile saves and reloads", f.get_by_text("Neha Rao").count() >= 1)
        f.screenshot(path=str(OUT / "pf_1_founder_profile.png"), full_page=True)

        # ---- founder settings: privacy, notifications, preferences persist
        f.goto(B + "/founder/settings", wait_until="networkidle")
        f.get_by_role("heading", name="Privacy").wait_for(timeout=20000)
        privacy = f.locator("#privacy")
        privacy.get_by_text("Share traction figures with investors", exact=True).click()
        privacy.get_by_role("button", name="Save changes").click()
        privacy.get_by_text("Saved.").wait_for(timeout=20000)
        prefs = f.locator("#preferences")
        prefs.get_by_label("Date format").select_option("YYYY-MM-DD")
        prefs.get_by_role("button", name="Save changes").click()
        prefs.get_by_text("Saved.").wait_for(timeout=20000)
        f.reload(wait_until="networkidle")
        f.locator("#account").get_by_text("Member since").wait_for(timeout=20000)
        member_since = f.locator("#account dd").nth(2).inner_text()
        ok("date format applies after reload", re.fullmatch(r"\d{4}-\d{2}-\d{2}", member_since.strip()) is not None, member_since)
        saved = fctx.request.get(API + "/me/settings", headers=fh).json()["settings"]
        ok("privacy setting persisted", saved["privacy"]["share_traction"] is False)
        f.locator("#security").get_by_text("This device").wait_for(timeout=20000)
        ok("active sessions list shows this device", True)
        f.screenshot(path=str(OUT / "pf_2_founder_settings.png"), full_page=True)
        r = ictx.request.get(API + f"/projects/{pid}", headers=ih)
        ok("investors no longer see traction figures", r.ok and r.json().get("monthly_revenue") is None)

        # ---- investor settings: international currency display
        i.goto(B + "/investor/settings", wait_until="networkidle")
        i.locator("#preferences").get_by_label("Currency display").select_option("international")
        i.locator("#preferences").get_by_role("button", name="Save changes").click()
        i.locator("#preferences").get_by_text("Saved.").wait_for(timeout=20000)
        ok("investor display preference saved", True)

        # ---- founder: create and open a round
        f.goto(f"{B}/founder/projects/{pid}/funding", wait_until="networkidle")
        f.get_by_role("button", name="Create a round").click()
        f.get_by_label("Round name").fill("Seed 2026")
        f.get_by_label("Funding target (₹)").fill("5000000")
        f.get_by_label("Minimum ticket (₹)").fill("100000")
        f.get_by_label("Maximum ticket (₹)").fill("2000000")
        f.get_by_label("Pre-money valuation (₹)").fill("45000000")
        f.get_by_role("button", name="Create round").click()
        f.get_by_role("button", name="Open", exact=True).wait_for(timeout=20000)
        f.get_by_role("button", name="Open", exact=True).click()
        f.get_by_text("Round open.").wait_for(timeout=20000)
        ok("founder creates and opens a round", True)

        # ---- investor proposes from the startup page
        i.goto(f"{B}/investor/projects/{pid}", wait_until="networkidle")
        i.get_by_label("Propose an investment (₹)").fill("1000000")
        i.get_by_role("button", name="Send proposal").click()
        i.get_by_text("Proposal sent").wait_for(timeout=20000)
        ok("investor proposes ₹10 L", True)

        # ---- founder accepts with agreed equity; investor confirms
        f.reload(wait_until="networkidle")
        f.get_by_role("button", name="Review").click()
        f.get_by_label("Agreed equity (%)").fill("2")
        f.get_by_role("button", name="Accept these terms").click()
        f.get_by_text("Terms sent to the investor").wait_for(timeout=20000)
        ok("founder accepts with 2% agreed equity", True)
        i.reload(wait_until="networkidle")
        i.get_by_role("button", name="Confirm commitment").click()
        i.get_by_text("Committed.").wait_for(timeout=20000)
        ok("investor confirms the commitment", True)

        # ---- founder: outside investor and a partial payment
        f.reload(wait_until="networkidle")
        f.get_by_role("button", name="Record an outside investor").click()
        f.get_by_label("Investor or organization").fill("Angel Network X")
        f.get_by_label("Committed amount (₹)").fill("500000")
        f.get_by_role("button", name="Record", exact=True).click()
        f.get_by_text("Commitment recorded.").wait_for(timeout=20000)
        row = f.locator("tr", has_text="Neon E2E Investor").first
        row.get_by_role("button", name="Record payment").click()
        f.get_by_label("Amount (₹)").fill("400000")
        f.get_by_label("Reference (e.g. UTR)").fill("UTR-E2E-1")
        f.get_by_role("button", name="Save", exact=True).click()
        f.get_by_text("Payment recorded.").wait_for(timeout=20000)
        overview = f.locator("div.rounded-xl", has_text="Seed 2026").first.inner_text()
        ok("founder overview: ₹15 L committed, ₹4 L received, ₹35 L remaining",
           "₹15 L" in overview and "₹4 L" in overview and "₹35 L" in overview, overview[:400])
        ok("allocation table shows agreed equity and partial receipt", "2% agreed" in overview and "Partly received" in overview)
        f.screenshot(path=str(OUT / "pf_3_founder_funding.png"), full_page=True)

        # ---- investor: own figures, receipt confirmation, portfolio panel (international format)
        alloc_id = ictx.request.get(API + "/investors/allocations", headers=ih).json()[0]["id"]
        i.goto(f"{B}/investor/allocations/{alloc_id}", wait_until="networkidle")
        i.get_by_text("Your investment").wait_for(timeout=20000)
        body = i.locator("main").inner_text()
        ok("investor sees their amount, received and equity", "₹1,000,000.00" in body and "₹400,000.00" in body and "2% agreed" in body, body[:400])
        ok("investor doesn't see other investors", "Angel Network X" not in body)
        i.get_by_role("button", name="Confirm it matches").click()
        i.get_by_text("Receipt confirmed.").wait_for(timeout=20000)
        ok("investor confirms the receipt", True)
        i.screenshot(path=str(OUT / "pf_4_investor_allocation.png"), full_page=True)
        i.goto(B + "/investor/portfolio", wait_until="networkidle")
        i.get_by_text("Funding rounds on VentureX").wait_for(timeout=20000)
        ok("portfolio lists the round allocation", i.get_by_role("link", name=TITLE).count() >= 1)

        # ---- Discover: sidebar layout, filters, save
        i.goto(B + "/investor/discover", wait_until="networkidle")
        i.get_by_role("heading", name="Discover Startups").wait_for(timeout=20000)
        aside_visible = i.evaluate("(() => { const a = document.querySelector('aside'); if (!a) return false; const r = a.getBoundingClientRect(); return r.right > 0; })()")
        ok("Discover keeps the sidebar on desktop", aside_visible)
        i.get_by_role("searchbox", name="Search startups").fill(TITLE)
        i.get_by_role("button", name=re.compile("More filters")).click()
        i.get_by_label("Funding round").select_option("open")
        row = i.locator("li", has_text=TITLE).first
        row.wait_for(timeout=20000)
        text = row.inner_text()
        ok("open-round filter finds the startup with disclosed progress", "% committed" in text and "Seed 2026" in text, text[:300])
        ok("raise shown in the international format", "₹5M" in text, text[:300])
        row.get_by_role("button", name=f"Save {TITLE}").click()
        row.get_by_role("button", name=f"Remove {TITLE} from saved").wait_for(timeout=20000)
        i.get_by_role("button", name="Saved opportunities").click()
        i.locator("li", has_text=TITLE).first.wait_for(timeout=20000)
        ok("saved opportunities shortcut lists it", True)
        i.screenshot(path=str(OUT / "pf_5_discover.png"), full_page=True)

        i.set_viewport_size({"width": 390, "height": 860})
        i.goto(B + "/investor/discover", wait_until="networkidle")
        i.get_by_role("heading", name="Discover Startups").wait_for(timeout=20000)
        overflow = i.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        ok("Discover fits a phone", overflow <= 1, overflow)
        i.screenshot(path=str(OUT / "pf_6_discover_mobile.png"), full_page=False)
        f.set_viewport_size({"width": 390, "height": 860})
        f.goto(f"{B}/founder/projects/{pid}/funding", wait_until="networkidle")
        f.get_by_text("Seed 2026").first.wait_for(timeout=20000)
        overflow = f.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        ok("Funding page fits a phone (the table scrolls inside its box)", overflow <= 1, overflow)
        ok("no page errors", not errors, errors[:3])
    finally:
        body = {k: orig_fprofile.get(k) for k in PROFILE_KEYS_F}
        fctx.request.put(API + "/me/profile", headers=fh, data=body)
        fctx.request.put(API + "/me/settings", headers=fh, data=orig_fsettings)
        ictx.request.put(API + "/me/settings", headers=ih, data=orig_isettings)
        if pid:
            db([["DELETE FROM saved_opportunities WHERE project_id = %s", [pid]],
                ["DELETE FROM project_interests WHERE project_id = %s", [pid]],
                ["DELETE FROM matches WHERE project_id = %s", [pid]],
                ["DELETE FROM projects WHERE id = %s", [pid]]])
        print("restored profiles and settings; removed the test startup and its rounds")
    br.close()

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
