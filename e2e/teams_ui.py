"""Teams in a real browser, with the two E2E test accounts plus teammates that exist only in the
database (no extra sign-in accounts are created):
  * the test founder is invited to a startup owned by a database-only founder, accepts through the
    invitations banner and the invite page, works on it as a co-founder, then leaves;
  * the test founder invites (and withdraws) a co-founder on their own startup;
  * the test investor starts a firm and invites a partner; a database-only partner's intro shows in
    the firm pipeline, on Discover, and on the investor's profile as founders see it.
Everything is removed afterwards.

    python e2e/teams_ui.py [screenshot-dir]
"""
import os
import secrets
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import API, ENV as env, WEB as B, db, set_test_investor_verification  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
OUT.mkdir(exist_ok=True)
CHANNEL = os.environ.get("VX_BROWSER_CHANNEL") or None
OWNER_ID, PARTNER_ID = "e2e-team-owner", "e2e-team-partner"
SHARED, MINE = "E2E Team Shared Startup", "E2E Team Own Startup"
FIRM = "E2E Team Capital"
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


PROJECT = {
    "tagline": "Instant settlement for clinics", "description": "Payments software for clinics.",
    "problem": "Clinics wait days for settlements.", "solution": "Same-day payouts over UPI.",
    "industry": "Fintech", "stage": "Seed", "funding_required": 10000000, "business_model": "B2B SaaS",
    "target_market": "Clinics in India", "country": "India", "city": "Pune",
}

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
    orig_firm = ictx.request.get(API + "/investors/profile", headers=ih).json().get("firm_name") or ""
    invite_id = secrets.token_urlsafe(24)
    shared_id = own_id = None
    try:
        ok("test investor verified", set_test_investor_verification("verified"))
        # ---- setup: a database-only founder owns a startup and invites the test founder
        r = fctx.request.post(API + "/projects", headers=fh, data={"title": MINE, **PROJECT, "is_published": True}, timeout=180000)
        own_id = r.json().get("id") if r.ok else None
        ok("test founder creates their own startup", bool(own_id), r.status)
        ok("database-only owner and invitation set up", db([
            ["INSERT INTO app_users (id, email, name, role) VALUES (%s, %s, %s, 'FOUNDER') ON CONFLICT (id) DO NOTHING",
             [OWNER_ID, f"{OWNER_ID}@example.com", "Asha Owner"]],
            ["INSERT INTO projects (founder_id, title, tagline, description, problem, solution, industry, stage, "
             "funding_required, business_model, target_market, is_published) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE)",
             [OWNER_ID, SHARED, PROJECT["tagline"], PROJECT["description"], PROJECT["problem"], PROJECT["solution"],
              PROJECT["industry"], PROJECT["stage"], PROJECT["funding_required"], PROJECT["business_model"], PROJECT["target_market"]]],
            ["INSERT INTO team_invitations (id, kind, project_id, email, role, invited_by, expires_at) "
             "SELECT %s, 'project', id, %s, 'cofounder', %s, now() + interval '14 days' FROM projects WHERE title = %s AND founder_id = %s",
             [invite_id, env["E2E_TEST_EMAIL"], OWNER_ID, SHARED, OWNER_ID]],
        ]))

        # ---- founder accepts through the banner and invite page
        f.goto(B + "/founder/dashboard", wait_until="networkidle")
        f.get_by_text(f"invited you to join {SHARED}", exact=False).wait_for(timeout=20000)
        ok("invitations banner shows the invite", True)
        f.get_by_role("link", name="View invitation").first.click()
        f.get_by_role("button", name="Accept").wait_for(timeout=20000)
        f.screenshot(path=str(OUT / "tm_1_invite.png"), full_page=True)
        f.get_by_role("button", name="Accept").click()
        f.wait_for_url("**/founder/projects/**", timeout=30000)
        shared_id = int(f.url.rstrip("/").split("/")[-1])
        f.get_by_text("You're a co-founder").wait_for(timeout=20000)
        team = f.locator("div.rounded-xl", has_text="Co-founders can edit").first
        team.wait_for(timeout=20000)
        ok("lands on the shared startup as a co-founder; team lists the owner",
           "Asha Owner" in team.inner_text() and "(you)" in team.inner_text())
        ok("co-founder can't invite (no invite form)", team.get_by_role("button", name="Invite co-founder").count() == 0)
        f.screenshot(path=str(OUT / "tm_2_cofounder_project.png"), full_page=True)
        r = fctx.request.put(API + f"/projects/{shared_id}", headers=fh, data={"tagline": "Edited by the co-founder"})
        ok("co-founder can edit the private draft", r.ok, r.status)
        f.goto(B + "/founder/dashboard?tab=projects", wait_until="networkidle")
        row = f.locator("tr", has_text=SHARED).first
        row.wait_for(timeout=20000)
        ok("shared startup appears in their projects, marked Co-founder", "Co-founder" in row.inner_text())

        # ---- founder invites (and withdraws) a co-founder on their own startup
        f.goto(f"{B}/founder/projects/{own_id}", wait_until="networkidle")
        f.get_by_label("Co-founder's email").fill("e2e-team-invitee@example.com")
        f.get_by_role("button", name="Invite co-founder").click()
        f.get_by_text("Invitation sent to e2e-team-invitee@example.com").wait_for(timeout=20000)
        ok("owner invites a co-founder; invitation listed", f.get_by_text("e2e-team-invitee@example.com").count() >= 1)
        f.get_by_role("button", name="Withdraw invitation to e2e-team-invitee@example.com").click()
        f.get_by_text("Invitation withdrawn.").wait_for(timeout=20000)
        ok("owner withdraws the invitation", True)

        # ---- investor: firm, partner invite, shared pipeline
        i.goto(B + "/investor/firm", wait_until="networkidle")
        i.get_by_label("Firm name").fill(FIRM)
        i.get_by_role("button", name="Create firm").click()
        i.get_by_text("Firm created.").wait_for(timeout=20000)
        ok("investor starts a firm", True)
        i.get_by_label("Partner's email").fill(f"{PARTNER_ID}@example.com")
        i.get_by_role("button", name="Invite", exact=True).click()
        i.get_by_text(f"Invitation sent to {PARTNER_ID}@example.com").wait_for(timeout=20000)
        ok("admin invites a partner", True)
        ok("database-only partner joins and asks for an intro", db([
            ["INSERT INTO app_users (id, email, name, role) VALUES (%s, %s, %s, 'INVESTOR') ON CONFLICT (id) DO NOTHING",
             [PARTNER_ID, f"{PARTNER_ID}@example.com", "Ravi Partner"]],
            ["INSERT INTO investor_profiles (user_id, name, title, verification_status) VALUES (%s, 'Ravi Partner', 'Principal', 'verified') "
             "ON CONFLICT (user_id) DO NOTHING", [PARTNER_ID]],
            ["INSERT INTO firm_members (firm_id, user_id, role) SELECT firm_id, %s, 'partner' FROM firm_members WHERE user_id = %s",
             [PARTNER_ID, investor_id]],
            ["INSERT INTO project_interests (id, project_id, investor_id, investor_name, founder_id, status, initiated_by, project_title) "
             "SELECT %s, id, %s, 'Ravi Partner', founder_id, 'pending', 'investor', title FROM projects WHERE id = %s",
             [f"intro-{own_id}-{PARTNER_ID}", PARTNER_ID, own_id]],
        ]))
        i.goto(B + "/investor/firm", wait_until="networkidle")
        pipe = i.locator("li", has_text=MINE).first
        pipe.wait_for(timeout=20000)
        ok("firm pipeline shows the partner's intro", "Ravi Partner" in pipe.inner_text() and "Intro pending" in pipe.inner_text())
        ok("partner listed in the firm", i.get_by_text("Ravi Partner").count() >= 1)
        i.screenshot(path=str(OUT / "tm_3_firm.png"), full_page=True)
        i.goto(B + "/investor/discover", wait_until="networkidle")
        i.get_by_role("searchbox", name="Search startups").fill(MINE)
        i.get_by_text("from your firm is already talking to them", exact=False).first.wait_for(timeout=20000)
        ok("Discover warns that a partner is already on this startup", True)

        # ---- founders see the partners on the investor's profile
        f.goto(f"{B}/founder/investors/{investor_id}?project={own_id}", wait_until="networkidle")
        f.get_by_text(f"Partners at {FIRM}").wait_for(timeout=20000)
        ok("founder sees the investor's firm partners", f.get_by_text("Ravi Partner").count() >= 1)

        # ---- co-founder leaves the shared startup
        f.goto(f"{B}/founder/projects/{shared_id}", wait_until="networkidle")
        f.get_by_role("button", name="Leave").click()
        f.wait_for_url("**/founder/dashboard**", timeout=30000)
        r = fctx.request.get(API + f"/projects/{shared_id}", headers=fh)
        ok("after leaving, the private draft is no longer visible", r.status == 404, r.status)

        f.set_viewport_size({"width": 390, "height": 860})
        f.goto(f"{B}/founder/projects/{own_id}", wait_until="networkidle")
        f.get_by_role("button", name="Invite co-founder").wait_for(timeout=20000)
        overflow = f.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        ok("project page with the team card fits a phone", overflow <= 1, overflow)
        ok("no page errors", not errors, errors[:3])
    finally:
        statements = [
            ["DELETE FROM team_invitations WHERE id = %s OR invited_by IN (%s, %s, (SELECT id FROM app_users WHERE email = %s))",
             [invite_id, OWNER_ID, investor_id, env["E2E_TEST_EMAIL"]]],
            ["DELETE FROM firms WHERE id IN (SELECT firm_id FROM firm_members WHERE user_id = %s)", [investor_id]],
            ["DELETE FROM firm_members WHERE user_id IN (%s, %s)", [investor_id, PARTNER_ID]],
            ["DELETE FROM project_interests WHERE investor_id = %s", [PARTNER_ID]],
            ["DELETE FROM projects WHERE founder_id = %s", [OWNER_ID]],
            ["DELETE FROM investor_profiles WHERE user_id = %s", [PARTNER_ID]],
            ["DELETE FROM notifications WHERE user_id IN (%s, %s)", [OWNER_ID, PARTNER_ID]],
            ["DELETE FROM app_users WHERE id IN (%s, %s)", [OWNER_ID, PARTNER_ID]],
            ["UPDATE investor_profiles SET firm = %s WHERE user_id = %s", [orig_firm, investor_id]],
        ]
        if own_id:
            statements[0:0] = [[f"DELETE FROM {t} WHERE project_id = %s", [own_id]] for t in ("project_interests", "matches")]
            statements.append(["DELETE FROM projects WHERE id = %s", [own_id]])
        db(statements)
        print("removed test startups, firm, invitations and database-only teammates")
    br.close()

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
