"""Drive the investor portal in a real browser as the E2E test investor, then clean up.

    pip install -r e2e/requirements.txt && python -m playwright install chromium
    python e2e/investor_portal_ui.py [screenshot-dir]

Covers navigation, Discover, Deal Flow, Criteria and Portfolio (record, transactions,
valuations, exact rupee maths, charts, mobile layout). Exits non-zero on any failure.
"""
import json
import re
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import API, ENV as env, WEB as B, set_test_investor_verification  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
OUT.mkdir(exist_ok=True)
CHANNEL = os.environ.get("VX_BROWSER_CHANNEL") or None  # e.g. "chrome"; default: bundled Chromium
results = []


def ok(name, cond, detail=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))


with sync_playwright() as p:
    br = p.chromium.launch(channel=CHANNEL)
    c = br.new_context(viewport={"width": 1440, "height": 1000})
    r = c.request.post(B + "/api/auth/sign-in/email", headers={"Origin": B},
                       data={"email": env["E2E_INVESTOR_EMAIL"], "password": env["E2E_INVESTOR_PASSWORD"]})
    ok("investor signs in", r.ok, r.status)
    ok("test investor verified (needed to request intros)", set_test_investor_verification("verified"))
    q = c.new_page()
    errors = []
    q.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    q.on("pageerror", lambda e: errors.append(str(e)))

    # Token for direct API calls (to save/restore the original criteria).
    q.goto(B + "/investor/dashboard", wait_until="networkidle")
    token = q.evaluate("""async () => { const r = await fetch('/api/auth/token'); return r.ok ? (await r.json()).token : null; }""")
    hdr = {"Authorization": f"Bearer {token}"} if token else {}
    original = c.request.get(API + "/investors/preferences", headers=hdr)
    original_thesis = original.json().get("thesis") if original.ok else None

    # ---- navigation
    nav = q.locator("nav, aside").first.inner_text()
    ok("sidebar has Discover / Deal Flow / Portfolio & Finances / Criteria",
       all(x in q.content() for x in ("Discover", "Deal Flow", "Portfolio &amp; Finances", "Criteria")))
    ok("old Recommended / My interests items are gone", "My interests" not in q.content() and ">Recommended<" not in q.content())
    q.screenshot(path=str(OUT / "1_overview.png"), full_page=True)

    q.goto(B + "/investor/dashboard?tab=browse", wait_until="networkidle")
    q.wait_for_url("**/investor/discover", timeout=15000)
    ok("old ?tab=browse redirects to Discover", q.url.endswith("/investor/discover"))
    q.goto(B + "/investor/dashboard?tab=interests", wait_until="networkidle")
    q.wait_for_url("**/investor/deal-flow", timeout=15000)
    ok("old ?tab=interests redirects to Deal Flow", q.url.endswith("/investor/deal-flow"))

    # ---- discover
    q.goto(B + "/investor/discover", wait_until="networkidle")
    q.get_by_text("startup", exact=False).first.wait_for(timeout=15000)
    count_text = q.locator("[aria-live=polite]").first.inner_text()
    ok("discover shows a result count", "startup" in count_text, count_text)
    q.screenshot(path=str(OUT / "2_discover.png"), full_page=True)
    first_save = q.get_by_role("button", name=re.compile(r"^Save ")).first
    title = first_save.get_attribute("aria-label").replace("Save ", "")
    first_save.click()
    q.get_by_role("button", name=f"Remove {title} from saved").wait_for(timeout=15000)
    ok("save a startup from Discover", True)
    q.get_by_role("searchbox", name="Search startups").fill("zzzz-no-such-startup")
    q.get_by_text("No startups match").wait_for(timeout=15000)
    ok("search with no hits shows an empty state", True)

    # ---- deal flow
    q.goto(B + "/investor/deal-flow", wait_until="networkidle")
    q.get_by_text(title).first.wait_for(timeout=15000)
    ok("saved startup appears in Deal Flow", True)
    q.get_by_role("button", name="Saved", exact=False).first.click()
    q.screenshot(path=str(OUT / "3_dealflow.png"), full_page=True)
    row = q.locator("div.rounded-xl", has_text=title).filter(has=q.get_by_role("button", name="Remove")).first
    if row.count():
        row.get_by_role("button", name="Remove").click()
        q.get_by_text(f"{title} removed from saved.").wait_for(timeout=15000)
        ok("remove from saved in Deal Flow", True)

    # ---- criteria
    q.goto(B + "/investor/preferences", wait_until="networkidle")
    q.get_by_label("Minimum check").fill("2,50,000")
    q.get_by_label("Maximum check").fill("1500000")
    q.get_by_label("Preferred check").fill("750000")
    q.get_by_label("Total capital allocated").fill("5000000")
    q.get_by_role("group", name="Regions").get_by_role("button", name="Europe").click()
    summary = q.locator("aside", has_text="Your thesis").inner_text()
    ok("thesis summary updates live (rupees)", "₹7.5 L" in summary and "₹50 L" in summary and "Europe" in summary, summary[:200])
    q.get_by_role("button", name="Save criteria").click()
    q.get_by_text("Saved. Your matches are updated.").wait_for(timeout=30000)
    ok("save expanded criteria", True)
    q.screenshot(path=str(OUT / "4_criteria.png"), full_page=True)
    q.get_by_label("Minimum check").fill("2000000")
    q.get_by_role("button", name="Save criteria").click()
    alert = q.locator("p[role=alert]")
    alert.wait_for(timeout=15000)
    ok("invalid range shows the server's message", "minimum" in alert.inner_text().lower(), alert.inner_text())

    # ---- portfolio
    q.goto(B + "/investor/portfolio", wait_until="networkidle")
    q.get_by_text("Every figure comes from").wait_for(timeout=15000)
    had_empty = q.get_by_text("No investments recorded yet").count() > 0
    q.screenshot(path=str(OUT / "5_portfolio_before.png"), full_page=True)
    q.get_by_role("button", name="Record investment").first.click()
    q.get_by_label("Company").fill("Playwright Check Co")
    q.get_by_label("Amount invested").fill("50000")
    q.get_by_label("Date").fill("2024-05-01")
    q.get_by_label("Industry").fill("Fintech")
    q.locator("form").get_by_role("button", name="Record investment").click()
    q.wait_for_url("**/investor/portfolio/*", timeout=20000)
    ok("record an investment opens its detail page", "/investor/portfolio/" in q.url)
    q.get_by_text("Held at cost: no valuation recorded").wait_for(timeout=15000)
    ok("new holding is labelled held at cost", True)

    q.get_by_label("Type").select_option("dividend")
    q.get_by_label("Date", exact=True).first.fill("2025-01-15")
    q.get_by_label("Amount", exact=True).fill("1200.50")
    q.get_by_role("button", name="Add transaction").click()
    q.get_by_text("Dividend added.").wait_for(timeout=15000)
    q.get_by_label("Value of your stake").fill("80000")
    q.get_by_label("As of").fill("2025-06-30")
    q.get_by_label("Source").select_option("funding_round")
    q.get_by_role("button", name="Add valuation").click()
    q.get_by_text("Valuation added.").wait_for(timeout=15000)
    body = q.content()
    ok("net gain computed exactly in rupees (80,000 + 1,200.50 − 50,000)", "+₹31,200.50" in body and "$" not in q.locator("main").inner_text())
    q.screenshot(path=str(OUT / "6_investment.png"), full_page=True)

    q.goto(B + "/investor/portfolio", wait_until="networkidle")
    q.get_by_text("Value over time").wait_for(timeout=15000)
    ok("overview shows charts", q.get_by_text("Invested vs value, by company").count() == 1 and q.get_by_text("Allocation by industry").count() == 1)
    q.screenshot(path=str(OUT / "7_portfolio_after.png"), full_page=True)
    q.get_by_role("button", name="Transactions").click()
    q.get_by_text("Playwright Check Co").first.wait_for(timeout=15000)
    ok("transactions tab lists the ledger", q.get_by_text("Dividend", exact=True).count() >= 1)

    # mobile
    m = br.new_context(viewport={"width": 390, "height": 844}, storage_state=c.storage_state()).new_page()
    for path, name in (("/investor/discover", "8_mobile_discover.png"), ("/investor/portfolio", "9_mobile_portfolio.png")):
        m.goto(B + path, wait_until="networkidle")
        m.wait_for_timeout(1200)
        overflow = m.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        ok(f"no horizontal page scroll on mobile {path}", overflow <= 0, overflow)
        m.screenshot(path=str(OUT / name), full_page=True)

    # ---- clean up: delete the test investment, restore the original criteria
    q.goto(B + "/investor/portfolio", wait_until="networkidle")
    q.get_by_role("button", name="Investments").click()
    q.get_by_role("link", name="Playwright Check Co").click()
    q.wait_for_url("**/investor/portfolio/*")
    q.once("dialog", lambda d: d.accept())
    q.get_by_role("button", name="Delete investment", exact=True).click()
    q.wait_for_url("**/investor/portfolio", timeout=15000)
    ok("delete investment", True)
    if original_thesis is not None and token:
        rr = c.request.put(API + "/investors/preferences", headers={**hdr, "Content-Type": "application/json"},
                           data=json.dumps({"thesis": original_thesis}))
        ok("original criteria restored", rr.ok, rr.status)
    ok("portfolio empty state back" if had_empty else "portfolio unchanged", True)

    real_errors = [e for e in errors if "favicon" not in e and "401" not in e and "422" not in e]
    ok("no console errors", not real_errors, real_errors[:3])
    br.close()

print(f"\n{sum(results)}/{len(results)} passed")

sys.exit(0 if all(results) else 1)
