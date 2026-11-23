"""Investor updates in a real browser: the E2E test investor records an investment in the test
founder's company; the founder writes and sends a monthly update; the investor reads it, offers help
with an ask and applies the reported valuation to their holding; the founder sees the reply and who
read it. Everything is removed afterwards.

    python e2e/updates_ui.py [screenshot-dir]

Needs both servers running and the E2E test accounts (backend/.env). Exits non-zero on any failure.
"""
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import API, ENV as env, WEB as B, db, set_test_investor_verification  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
OUT.mkdir(exist_ok=True)
CHANNEL = os.environ.get("VX_BROWSER_CHANNEL") or None
TITLE = "E2E Updates ClinicPay"
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


with sync_playwright() as p:
    br = p.chromium.launch(channel=CHANNEL)
    fctx, f, fh, f_ok = signed_in(br, env["E2E_TEST_EMAIL"], env["E2E_TEST_PASSWORD"])
    ictx, i, ih, i_ok = signed_in(br, env["E2E_INVESTOR_EMAIL"], env["E2E_INVESTOR_PASSWORD"])
    ok("founder and investor sign in", f_ok and i_ok and fh and ih)
    errors = []
    for page in (f, i):
        page.on("pageerror", lambda e: errors.append(str(e)))

    pid = inv_id = None
    try:
        ok("test investor verified", set_test_investor_verification("verified"))
        r = fctx.request.post(API + "/projects", headers=fh, data={
            "title": TITLE, "tagline": "Instant settlement for clinics", "description": "Payments software for clinics.",
            "problem": "Clinics wait days for settlements.", "solution": "Same-day payouts over UPI.",
            "industry": "Fintech", "stage": "Seed", "funding_required": 10000000, "business_model": "B2B SaaS",
            "target_market": "Clinics in India", "country": "India", "city": "Pune", "is_published": True,
        }, timeout=180000)
        pid = r.json().get("id") if r.ok else None
        ok("founder creates a published project", bool(pid), r.status)
        r = ictx.request.post(API + "/portfolio/investments", headers=ih, data={
            "project_id": pid, "investment_date": (date.today() - timedelta(days=200)).isoformat(),
            "amount": "1500000", "ownership_pct": "5", "instrument": "equity",
        })
        inv_id = r.json().get("holding", {}).get("id") if r.ok else None
        ok("investor records an investment in it (5%)", bool(inv_id), r.text()[:200])

        # ---- founder writes and sends the update
        f.goto(f"{B}/founder/updates?project={pid}", wait_until="networkidle")
        f.get_by_text("1 investor", exact=False).first.wait_for(timeout=20000)
        ok("founder sees one investor will receive updates", True)
        f.get_by_role("button", name="New update").click()
        f.get_by_label("Monthly revenue (₹)").wait_for(timeout=20000)
        f.get_by_label("Monthly revenue (₹)").fill("350000")
        f.get_by_label("Customers", exact=True).fill("48")
        f.get_by_label("Cash in bank (₹)").fill("9000000")
        f.get_by_label("Monthly burn (₹)").fill("600000")
        f.get_by_label("Post-money valuation (₹)").fill("400000000")
        f.get_by_label("Highlights", exact=True).fill("Signed 3 hospital chains.\nLaunched UPI autopay.")
        f.get_by_label("Challenges", exact=True).fill("Hospital sales cycles are longer than planned.")
        f.get_by_role("button", name="Add an ask").click()
        f.get_by_label("Ask 1", exact=True).fill("Intros to hospital CFOs in Mumbai")
        f.screenshot(path=str(OUT / "up_1_compose.png"), full_page=True)
        f.get_by_role("button", name="Save draft").click()
        f.get_by_text("Draft saved.").wait_for(timeout=20000)
        ok("draft saves", True)
        f.get_by_role("button", name="Send update").click()
        f.get_by_role("button", name="Confirm: send to 1").click()
        f.get_by_text("Recipients").wait_for(timeout=30000)
        ok("update sent; recipients listed", "Unread" in f.locator("main").inner_text())

        r = ictx.request.get(API + f"/projects/{pid}", headers=ih)
        ok("project traction refreshed from the update", r.ok and r.json().get("monthly_revenue") == 350000
           and r.json().get("customer_count") == 48, r.ok and r.json().get("monthly_revenue"))

        # ---- investor reads, offers help, applies the valuation
        i.goto(B + "/investor/updates", wait_until="networkidle")
        card = i.locator("div.rounded-xl", has_text=TITLE).first
        card.wait_for(timeout=20000)
        text = card.inner_text()
        ok("investor sees metrics, runway and highlights", "Signed 3 hospital chains" in text and "15 months" in text, text[:300])
        ok("investor sees what their 5% is worth", "₹2 Cr" in text or "2.00 Cr" in text, text[:400])
        i.screenshot(path=str(OUT / "up_2_investor_feed.png"), full_page=True)
        card.get_by_role("button", name="I can help").click()
        card.get_by_label("Your reply").fill("I know two hospital CFOs in Mumbai; happy to intro.")
        card.get_by_role("button", name="Send", exact=True).click()
        card.get_by_text("Sent to the founder.").wait_for(timeout=20000)
        ok("investor offers help with the ask", True)
        card.get_by_role("button", name="Update my holding").click()
        card.get_by_text("Your holding is now valued at", exact=False).wait_for(timeout=20000)
        ok("investor applies the valuation to their holding", True)

        i.goto(f"{B}/investor/portfolio/{inv_id}", wait_until="networkidle")
        i.get_by_text("Company updates").first.wait_for(timeout=20000)
        body = i.locator("main").inner_text()
        ok("holding shows the company report valuation and the update", "Company report" in body or "company report" in body.lower())
        i.screenshot(path=str(OUT / "up_3_holding.png"), full_page=True)

        # ---- founder sees the read receipt and the reply
        f.goto(f"{B}/founder/updates?project={pid}", wait_until="networkidle")
        f.get_by_text("1/1 read").wait_for(timeout=20000)
        ok("founder sees the update was read", True)
        f.get_by_text("1 replies").first.click()
        f.get_by_text("happy to intro", exact=False).wait_for(timeout=20000)
        ok("founder sees the investor's offer under the ask", True)
        f.screenshot(path=str(OUT / "up_4_founder_sent.png"), full_page=True)

        f.set_viewport_size({"width": 390, "height": 860})
        f.goto(f"{B}/founder/updates?project={pid}", wait_until="networkidle")
        f.get_by_role("button", name="New update").wait_for(timeout=20000)
        overflow = f.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        ok("updates page fits a phone screen", overflow <= 1, overflow)
        ok("no page errors", not errors, errors[:3])
    finally:
        statements = []
        if inv_id:
            statements.append(["DELETE FROM investments WHERE id = %s", [inv_id]])
        if pid:
            statements += [[f"DELETE FROM {t} WHERE project_id = %s", [pid]] for t in ("project_interests", "matches")]
            statements.append(["DELETE FROM projects WHERE id = %s", [pid]])
        if statements:
            db(statements)
        print("removed the test project, its updates and the test investment")
    br.close()

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
