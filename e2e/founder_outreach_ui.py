"""Founder outreach in a real browser: the founder finds the E2E test investor, opens their profile,
requests an intro; the investor passes with a reason in Deal Flow; the founder sees the reason.
Then everything is put back (project, request, investor criteria and profile).

    python e2e/founder_outreach_ui.py [screenshot-dir]

Needs both servers running and the E2E test accounts (backend/.env). Exits non-zero on any failure.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import API, ENV as env, WEB as B, db, set_test_investor_verification  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
OUT.mkdir(exist_ok=True)
CHANNEL = os.environ.get("VX_BROWSER_CHANNEL") or None
TITLE = "E2E Outreach ClinicPay"
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


THESIS = {
    "sectors": {"industries": ["Fintech"], "business_models": ["B2B SaaS"]},
    "stages": ["Seed", "Series A"],
    "check_size": {"min_check": "2500000", "max_check": "20000000"},
    "geography": {"countries": ["India"]},
    "structure": {"role": "lead"},
}

with sync_playwright() as p:
    br = p.chromium.launch(channel=CHANNEL)
    fctx, f, fh, f_ok = signed_in(br, env["E2E_TEST_EMAIL"], env["E2E_TEST_PASSWORD"])
    ictx, i, ih, i_ok = signed_in(br, env["E2E_INVESTOR_EMAIL"], env["E2E_INVESTOR_PASSWORD"])
    ok("founder and investor sign in", f_ok and i_ok and fh and ih)
    errors = []
    for page in (f, i):
        page.on("pageerror", lambda e: errors.append(str(e)))

    # ---- setup: investor criteria + public profile, founder project (all restored afterwards)
    prof = ictx.request.get(API + "/investors/profile", headers=ih).json()
    orig_profile = {"value_add": prof.get("value_add") or "", "portfolio": prof.get("portfolio") or [],
                    "listed_for_founders": prof.get("listed_for_founders", True)}
    inv_name = prof.get("full_name") or "Investor"
    r = ictx.request.put(API + "/investors/preferences", headers=ih, data={"thesis": THESIS})
    ok("investor criteria set for the test", r.ok, r.status)
    ok("test investor verified (needed to contact founders)", set_test_investor_verification("verified"))
    r = ictx.request.put(API + "/investors/profile", headers=ih, data={
        "value_add": "Bank partnerships and first 10 enterprise customers.",
        "portfolio": [{"company": "E2E PayCo", "stage": "Seed", "year": 2024}],
        "listed_for_founders": True,
    })
    ok("investor profile listed with value-add and portfolio", r.ok, r.status)

    r = fctx.request.post(API + "/projects", headers=fh, data={
        "title": TITLE, "tagline": "Instant settlement for clinic payments",
        "description": "Payments and settlement software for Indian clinics, with UPI collections and daily payouts.",
        "problem": "Clinics wait 3-5 days for card and insurance settlements, squeezing working capital.",
        "solution": "Same-day settlement with UPI collections and automated reconciliation for clinics.",
        "industry": "Fintech", "stage": "Seed", "funding_required": 10000000, "business_model": "B2B SaaS",
        "target_market": "Independent clinics in India", "country": "India", "city": "Bengaluru",
        "monthly_revenue": 400000, "customer_count": 120, "product_status": "launched",
        "website": "https://example.com", "is_published": False,
    })
    project = r.json() if r.ok else {}
    pid = project.get("id")
    ok("founder creates a project", bool(pid), r.status)
    score = project.get("readiness_score") or 0
    if score < 50:
        # Baseline is rules-based; lift it for the test only (the gate itself is unit-tested).
        ok("lift readiness for the test", db([["UPDATE projects SET readiness_score = 72 WHERE id = %s", [pid]]]))

    try:
        # ---- founder: private project can browse but not request
        f.goto(f"{B}/founder/investors?project={pid}", wait_until="networkidle")
        f.get_by_text("You can browse, but not request intros").wait_for(timeout=20000)
        ok("private project shows the publish/readiness gate", True)
        r = fctx.request.patch(API + f"/projects/{pid}/publish", headers=fh, data={"is_published": True}, timeout=180000)
        if not r.ok:
            r = fctx.request.put(API + f"/projects/{pid}", headers=fh, data={"is_published": True}, timeout=180000)
        ok("publish the project", r.ok, r.status)

        f.goto(B + "/founder/dashboard?tab=investors", wait_until="networkidle")
        f.wait_for_url("**/founder/investors**", timeout=15000)
        ok("old Investors tab redirects to Find investors", "/founder/investors" in f.url)

        f.goto(f"{B}/founder/investors?project={pid}", wait_until="networkidle")
        f.get_by_role("searchbox", name="Search investors").fill(inv_name)
        card = f.locator("div.rounded-xl", has=f.get_by_role("link", name=inv_name, exact=True)).first
        card.wait_for(timeout=20000)
        ok("test investor appears with a fit score", "% fit" in card.inner_text(), card.inner_text()[:200])
        f.screenshot(path=str(OUT / "fo_1_find_investors.png"), full_page=True)
        f.get_by_role("combobox", name="Leads or co-invests").select_option("co_invest")
        try:
            f.get_by_role("link", name=inv_name, exact=True).first.wait_for(state="detached", timeout=20000)
            hidden = True
        except Exception:
            hidden = False
        ok("role filter 'Co-invests' hides a lead investor", hidden)
        f.get_by_role("combobox", name="Leads or co-invests").select_option("lead")
        f.get_by_role("link", name=inv_name, exact=True).first.wait_for(timeout=15000)

        # ---- profile
        card.get_by_role("link", name="View profile").click()
        f.get_by_text("What they invest in").wait_for(timeout=20000)
        body = f.content()
        ok("profile shows criteria, value-add and past investments",
           "Bank partnerships" in body and "E2E PayCo" in body and "Invests in Fintech" in body)
        ok("contact details hidden before an intro", "Contact details are shared once they accept" in body)
        msg = f.get_by_role("textbox", name="Message to the investor")
        try:
            msg.wait_for(timeout=15000)
        except Exception:
            f.screenshot(path=str(OUT / "fo_2_profile_blocked.png"), full_page=True)
            raise
        ok("message is pre-filled from the project", TITLE in msg.input_value() and "Raising" in msg.input_value(), msg.input_value()[:120])
        msg.fill(msg.input_value() + "You backed E2E PayCo; we'd value your view on clinic settlements.")
        f.screenshot(path=str(OUT / "fo_2_profile.png"), full_page=True)
        f.get_by_role("button", name="Send request").click()
        f.get_by_text("Request sent", exact=False).first.wait_for(timeout=30000)
        ok("founder sends the intro request", True)

        # ---- investor: pass with a reason
        i.goto(B + "/investor/deal-flow", wait_until="networkidle")
        i.get_by_role("button", name="Founders asking", exact=False).click()
        row = i.locator("div.rounded-xl", has_text=TITLE).first
        row.wait_for(timeout=20000)
        ok("request shows in investor Deal Flow with the founder's note", "clinic settlements" in row.inner_text())
        i.screenshot(path=str(OUT / "fo_3_dealflow_inbound.png"), full_page=True)
        row.get_by_role("button", name="Pass").click()
        row.get_by_role("radio", name="Too early for us").click()
        row.get_by_role("button", name="Confirm pass").click()
        i.get_by_text(f"You passed on {TITLE}").wait_for(timeout=20000)
        ok("investor passes with a reason", True)

        # ---- founder sees the reason
        f.goto(B + "/founder/dashboard?tab=intros", wait_until="networkidle")
        f.get_by_role("button", name="Sent", exact=False).click()
        sent = f.locator("div.rounded-xl", has_text=TITLE).first
        sent.wait_for(timeout=20000)
        ok("founder sees Passed and the reason", "Passed" in sent.inner_text() and "Too early for us" in sent.inner_text(), sent.inner_text()[:200])
        f.screenshot(path=str(OUT / "fo_4_founder_sent.png"), full_page=True)

        # ---- mobile layout of the profile page
        f.set_viewport_size({"width": 390, "height": 860})
        f.goto(f"{B}/founder/investors?project={pid}", wait_until="networkidle")
        f.get_by_role("searchbox", name="Search investors").wait_for(timeout=20000)
        overflow = f.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        ok("Find investors fits a phone screen (no sideways scroll)", overflow <= 1, overflow)
        f.screenshot(path=str(OUT / "fo_5_mobile.png"), full_page=True)
        ok("no page errors", not errors, errors[:3])
    finally:
        # ---- restore
        ictx.request.put(API + "/investors/profile", headers=ih, data=orig_profile)
        statements = [[f"DELETE FROM {t} WHERE project_id = %s", [pid]] for t in ("deal_rooms", "project_interests", "matches")]
        statements.append(["DELETE FROM projects WHERE id = %s", [pid]])
        # Criteria go back to "none set", as e2e/cleanup_test_investor.py leaves them (the API always
        # answers with a rebuilt thesis, so re-saving what it returned would not be a true restore).
        statements.append(["DELETE FROM investor_preferences WHERE investor_id = (SELECT id FROM app_users WHERE email = %s)",
                           [env["E2E_INVESTOR_EMAIL"]]])
        if pid:
            db(statements)
        print("restored test investor and removed the test project")
    br.close()

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
