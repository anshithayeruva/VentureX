"""Verification in a real browser:
  * the E2E test investor starts unverified: limited Discover, sends evidence, shows Pending;
  * the E2E test founder (made an admin for this run only) approves them on /admin;
  * the founder verifies a company by a code sent to an email on its domain, and another by a GSTIN
    that the admin approves; badges and verified-only filters show up for both sides.
Everything is put back afterwards.

    python e2e/verification_ui.py [screenshot-dir]

Needs both servers running in development (codes are read from backend/logs/emails.log, which is
where emails go when SMTP isn't configured). Exits non-zero on any failure.
"""
import os
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import API, BACKEND_DIR, ENV as env, WEB as B, db, set_test_investor_verification  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
OUT.mkdir(exist_ok=True)
CHANNEL = os.environ.get("VX_BROWSER_CHANNEL") or None
EMAIL_LOG = BACKEND_DIR / "logs" / "emails.log"
DOMAIN = "e2e-verify-clinic.example"
TITLE = "E2E Verify ClinicBooks"
TITLE2 = "E2E Verify Kirana"
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


def latest_code(to_email, since):
    """The newest verification code emailed to this address after `since` (dev email log)."""
    for _ in range(20):
        text = EMAIL_LOG.read_text(encoding="utf-8", errors="ignore") if EMAIL_LOG.exists() else ""
        hits = re.findall(r"\[([^\]]+)\] TO: " + re.escape(to_email) + r" \| SUBJECT: Your VentureX verification code: (\d{6})", text)
        hits = [c for ts, c in hits if ts >= since]
        if hits:
            return hits[-1]
        time.sleep(0.5)
    return None


with sync_playwright() as p:
    br = p.chromium.launch(channel=CHANNEL)
    fctx, f, fh, f_ok = signed_in(br, env["E2E_TEST_EMAIL"], env["E2E_TEST_PASSWORD"])
    ictx, i, ih, i_ok = signed_in(br, env["E2E_INVESTOR_EMAIL"], env["E2E_INVESTOR_PASSWORD"])
    ok("founder and investor sign in", f_ok and i_ok and fh and ih)
    errors = []
    for page in (f, i):
        page.on("pageerror", lambda e: errors.append(str(e)))

    prof = ictx.request.get(API + "/investors/profile", headers=ih).json()
    inv_name = prof.get("full_name") or "Investor"
    orig_profile = {"portfolio": prof.get("portfolio") or []}
    pids = []
    try:
        # ---- setup: investor starts unverified; founder is an admin for this run
        ok("investor reset to unverified", set_test_investor_verification("unverified"))
        ok("founder made an admin for this run",
           db([["UPDATE app_users SET is_admin = TRUE WHERE email = %s", [env["E2E_TEST_EMAIL"]]]]))
        for title, website in ((TITLE, f"https://www.{DOMAIN}"), (TITLE2, "")):
            r = fctx.request.post(API + "/projects", headers=fh, data={
                "title": title, "tagline": "Bookkeeping for clinics", "description": "Accounting software for Indian clinics.",
                "problem": "Clinic books are kept on paper.", "solution": "Automatic books from UPI and card payments.",
                "industry": "Fintech", "stage": "Seed", "funding_required": 8000000, "business_model": "B2B SaaS",
                "target_market": "Clinics in India", "country": "India", "city": "Pune", "website": website,
                "is_published": True,
            }, timeout=180000)
            ok(f"founder creates '{title}'", r.ok, r.status)
            if r.ok:
                pids.append(r.json()["id"])
        pid, pid2 = (pids + [None, None])[:2]

        # ---- investor: limited until verified
        i.goto(B + "/investor/discover", wait_until="networkidle")
        i.get_by_text("Verify your investor account to contact founders").wait_for(timeout=20000)
        ok("unverified investor sees the verification banner", True)
        i.get_by_role("searchbox", name="Search startups").fill(TITLE)
        i.get_by_role("link", name="Verify to request").first.wait_for(timeout=20000)
        ok("Discover offers 'Verify to request' instead of Express interest", i.get_by_role("button", name="Express interest").count() == 0)
        i.screenshot(path=str(OUT / "vf_1_discover_limited.png"), full_page=True)

        i.goto(B + "/investor/verification", wait_until="networkidle")
        i.get_by_label("LinkedIn profile").fill("linkedin.com/in/neon-e2e-investor")
        i.get_by_label("Firm website").fill("e2e-ventures.example")
        i.get_by_label("Company 1", exact=True).fill("E2E PayCo")
        i.get_by_label("Year 1", exact=True).fill("2024")
        i.get_by_role("button", name="Send for review").click()
        i.get_by_text("Sent for review").wait_for(timeout=20000)
        ok("investor sends evidence and shows Pending review", i.get_by_text("Pending review").count() > 0)
        i.screenshot(path=str(OUT / "vf_2_investor_pending.png"), full_page=True)

        # ---- admin approves the investor
        f.goto(B + "/admin", wait_until="networkidle")
        f.get_by_text("Verification review").wait_for(timeout=20000)
        card = f.locator("div.rounded-xl", has_text="linkedin.com/in/neon-e2e-investor").first
        card.wait_for(timeout=20000)
        ok("admin sees the investor's evidence", "E2E PayCo" in card.inner_text() and env["E2E_INVESTOR_EMAIL"] in card.inner_text())
        f.screenshot(path=str(OUT / "vf_3_admin_investor.png"), full_page=True)
        card.get_by_role("button", name="Approve").click()
        f.get_by_text("approved", exact=False).first.wait_for(timeout=20000)
        ok("admin approves the investor", True)

        i.goto(B + "/investor/verification", wait_until="networkidle")
        i.get_by_text("Your account is verified").wait_for(timeout=20000)
        ok("investor sees Verified", True)
        i.goto(B + "/investor/discover", wait_until="networkidle")
        i.get_by_role("searchbox", name="Search startups").fill(TITLE)
        i.get_by_role("button", name="Express interest").first.wait_for(timeout=20000)
        ok("verified investor can request intros; banner gone",
           i.get_by_text("Verify your investor account").count() == 0)

        # ---- founder: company verified by domain email code
        f.goto(f"{B}/founder/projects/{pid}", wait_until="networkidle")
        f.get_by_text("Verify your company").wait_for(timeout=20000)
        f.get_by_label(re.compile("An email address on")).fill("me@gmail.com")
        f.get_by_role("button", name="Send code").click()
        f.get_by_text("not a free email provider", exact=False).wait_for(timeout=20000)
        ok("free email is refused", True)
        since = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() - 5))
        f.get_by_label(re.compile("An email address on")).fill(f"founder@{DOMAIN}")
        f.get_by_role("button", name="Send code").click()
        f.get_by_text("We sent a 6-digit code", exact=False).wait_for(timeout=20000)
        code = latest_code(f"founder@{DOMAIN}", since)
        ok("code emailed to the company-domain address", bool(code))
        f.get_by_label("Verification code").fill("000000" if code != "000000" else "111111")
        f.get_by_role("button", name="Verify").click()
        f.get_by_text("tries left", exact=False).wait_for(timeout=20000)
        ok("a wrong code is refused", True)
        f.get_by_label("Verification code").fill(code or "")
        f.get_by_role("button", name="Verify").click()
        f.get_by_text("Verified company").first.wait_for(timeout=20000)
        ok("company verified by code; badge shown", True)
        f.screenshot(path=str(OUT / "vf_4_company_verified.png"), full_page=True)

        # ---- founder: company without a domain uses a GSTIN; admin approves
        f.goto(f"{B}/founder/projects/{pid2}", wait_until="networkidle")
        f.get_by_text("Verify your company").wait_for(timeout=20000)
        f.get_by_label("Registration number").fill("27AAPFU0939F1ZV")
        f.get_by_role("button", name="Send for review").click()
        f.get_by_text("Pending review").first.wait_for(timeout=20000)
        ok("GSTIN sent for review", True)
        f.goto(B + "/admin", wait_until="networkidle")
        f.get_by_role("button", name=re.compile("^Companies")).click()
        ccard = f.locator("div.rounded-xl", has_text=TITLE2).first
        ccard.wait_for(timeout=20000)
        ok("admin sees the GSTIN", "27AAPFU0939F1ZV" in ccard.inner_text())
        ccard.get_by_label(f"Note for {TITLE2}").fill("Checked on the GST portal.")
        ccard.get_by_role("button", name="Approve").click()
        f.get_by_text("approved", exact=False).first.wait_for(timeout=20000)
        ok("admin approves the company", True)

        # ---- badges and filters
        i.goto(B + "/investor/discover", wait_until="networkidle")
        i.get_by_role("button", name=re.compile("More filters")).click()
        i.get_by_text("Verified startups only", exact=True).click()
        i.get_by_role("searchbox", name="Search startups").fill("E2E Verify")
        i.get_by_role("link", name=TITLE2).first.wait_for(timeout=20000)
        body = i.locator("main").inner_text()
        ok("investor's 'Verified startups only' shows both companies with badges",
           TITLE in body and TITLE2 in body and body.count("Verified company") >= 2)
        i.screenshot(path=str(OUT / "vf_5_discover_verified.png"), full_page=True)

        f.goto(f"{B}/founder/investors?project={pid}", wait_until="networkidle")
        f.get_by_label("Verified investors only").check()
        f.get_by_role("link", name=inv_name, exact=True).first.wait_for(timeout=20000)
        card = f.locator("div.rounded-xl", has=f.get_by_role("link", name=inv_name, exact=True)).first
        ok("founder's 'Verified investors only' shows the investor with a badge", "Verified investor" in card.inner_text())
        f.screenshot(path=str(OUT / "vf_6_directory_verified.png"), full_page=True)
        ok("no page errors", not errors, errors[:3])
    finally:
        statements = [["UPDATE app_users SET is_admin = FALSE WHERE email = %s", [env["E2E_TEST_EMAIL"]]]]
        for pid_ in pids:
            statements += [[f"DELETE FROM {t} WHERE project_id = %s", [pid_]] for t in ("project_interests", "matches")]
            statements.append(["DELETE FROM projects WHERE id = %s", [pid_]])
        db(statements)
        ictx.request.put(API + "/investors/profile", headers=ih, data=orig_profile)
        # Leave the test investor verified, as the other suites expect.
        set_test_investor_verification("verified")
        print("removed test projects, admin flag and restored the test investor")
    br.close()

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
