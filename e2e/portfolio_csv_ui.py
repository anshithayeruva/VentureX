"""Portfolio CSV import (bad then good file), export download, and the founder Team section.

    python e2e/portfolio_csv_ui.py [screenshot-dir]
Exits non-zero on any failure. Imported test rows are deleted at the end.
"""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import API, ENV as env, WEB as B  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots"
Path(OUT).mkdir(exist_ok=True)
FIX = Path(__file__).resolve().parent / "fixtures"
CHANNEL = os.environ.get("VX_BROWSER_CHANNEL") or None
results = []


def check(name, cond):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name)
def ctx(br, e, p):
    c = br.new_context(viewport={"width": 1440, "height": 950}, accept_downloads=True)
    c.request.post(B + "/api/auth/sign-in/email", headers={"Origin": B}, data={"email": env[e], "password": env[p]})
    return c
with sync_playwright() as p:
    br = p.chromium.launch(channel=CHANNEL)
    c = ctx(br, "E2E_INVESTOR_EMAIL", "E2E_INVESTOR_PASSWORD"); q = c.new_page()
    errors = []; q.on("pageerror", lambda e: errors.append(str(e)))
    q.goto(B + "/investor/portfolio", wait_until="networkidle")
    tok = q.evaluate("async () => (await (await fetch('/api/auth/token')).json()).token")
    h = {"Authorization": f"Bearer {tok}"}
    try:
        q.get_by_role("button", name="Import CSV").first.click()
        q.locator("input[type=file]").set_input_files(str(FIX / "bad.csv"))
        q.get_by_text("needs fixing before anything is imported").wait_for(timeout=20000)
        check("bad file shows its row errors", "Row 3" in q.locator("div.bg-danger-soft[role=alert]").inner_text())
        q.screenshot(path=OUT + "/m_import_errors.png")
        q.locator("input[type=file]").set_input_files(str(FIX / "good.csv"))
        q.get_by_text("2 investments ready to import").wait_for(timeout=20000)
        q.screenshot(path=OUT + "/m_import_ready.png")
        q.get_by_role("button", name="Import 2").click()
        q.get_by_text("Imported 2 investments.").wait_for(timeout=30000)
        q.wait_for_timeout(1500)
        check("import saves both rows (₹40 L invested)", "₹40 L" in q.locator("main").inner_text())
        q.get_by_role("button", name="Investments").click()
        with q.expect_download() as d:
            q.get_by_role("button", name="Export holdings CSV").click()
        path = d.value.path(); text = Path(path).read_text(encoding="utf-8-sig")
        check("holdings export contains both rows", "UI Import Kisan" in text and "UI Import MedSutra" in text)
        q.screenshot(path=OUT + "/m_holdings.png")
    finally:
        s = c.request.get(API + "/portfolio/summary", headers=h).json()
        for hd in s["holdings"]:
            if hd["company_name"].startswith("UI Import"):
                c.request.delete(API + f"/portfolio/investments/{hd['id']}", headers=h)
    f = ctx(br, "E2E_TEST_EMAIL", "E2E_TEST_EMAIL".replace("EMAIL", "PASSWORD")).new_page()
    f.goto(B + "/founder/projects/new", wait_until="networkidle"); f.wait_for_timeout(800)
    team = f.get_by_role("heading", name="Team")
    team.scroll_into_view_if_needed()
    check("project form has the Team section", team.count() == 1 and f.get_by_label("Technical founder").count() == 1)
    f.screenshot(path=OUT + "/m_team_form.png")
    q.goto(B + "/investor/preferences", wait_until="networkidle"); q.wait_for_timeout(600)
    check("criteria has a Team and IP priority", q.get_by_role("radiogroup", name="Team and IP priority").count() == 1)
    check("no page errors", not errors)
    br.close()

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
