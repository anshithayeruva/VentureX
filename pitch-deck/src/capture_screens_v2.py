"""Fresh pitch-deck screenshots of the real running app, including a deal room.

Uses the E2E test accounts from backend/.env. Temporarily creates a clearly-demo startup
("Sahayak Health"), demo investor criteria, a demo investor name ("Priya Menon, Demo Capital"),
an accepted intro and a deal room with two demo messages. Afterwards it deletes the startup,
intro and deal room and restores the investor's criteria, names and verification status.
Run with the backend (8000) and frontend (3000) up:  python capture_screens_v2.py <out-dir>
"""
import json
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "e2e"))
from _common import API, BACKEND_DIR, ENV as env, WEB as B, db  # noqa: E402

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
HIDE_DEV = "nextjs-portal{display:none!important}"


def q(sql, params):
    """Read one row with the backend's own database helper."""
    code = "\n".join([
        "import asyncio, json, sys; sys.path.insert(0, '.')",
        "if sys.platform == 'win32': asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())",
        "from app.database import postgres as pg",
        "async def main():",
        "    await pg.open_pool()",
        "    row = await pg.fetch_one(sys.argv[1], json.loads(sys.argv[2]))",
        "    print(json.dumps(row, default=str))",
        "    await pg.close_pool()",
        "asyncio.run(main())",
    ])
    python = BACKEND_DIR / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    r = subprocess.run([str(python), "-c", code, sql, json.dumps(params)], cwd=str(BACKEND_DIR), capture_output=True, text=True)
    return json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode == 0 and r.stdout.strip() else None


def signed_in(br, email, pw):
    ctx = br.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    ctx.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='" + HIDE_DEV + "';document.head.appendChild(s);});")
    ctx.request.post(B + "/api/auth/sign-in/email", headers={"Origin": B}, data={"email": email, "password": pw})
    page = ctx.new_page(); page.goto(B + "/", wait_until="networkidle")
    tok = page.evaluate("async () => { const r = await fetch('/api/auth/token'); return r.ok ? (await r.json()).token : null; }")
    return ctx, page, {"Authorization": f"Bearer {tok}"}


def shot(page, path, name, full=False, wait=1800):
    if path:
        page.goto(B + path, wait_until="networkidle")
    page.wait_for_timeout(wait)
    page.screenshot(path=str(OUT / name), full_page=full)
    print("shot", name)


PROJECT = {
    "title": "Sahayak Health", "tagline": "AI-assisted triage for primary health centres",
    "description": "Sahayak Health helps nurses at primary health centres triage patients and decide who needs a referral, using a tablet app that works offline.",
    "problem": "Primary health centres in India see 80-120 patients a day with one doctor; nurses triage by hand and urgent cases wait in the same queue.",
    "solution": "An offline-first tablet app that guides nurses through symptom checks, flags red-flag cases for the doctor first and creates referral notes in the local language.",
    "industry": "Healthcare & AI", "stage": "Seed", "funding_required": 7500000, "business_model": "B2B SaaS",
    "target_market": "State health departments and private hospital chains running primary care clinics in tier-2 and tier-3 India",
    "country": "India", "city": "Hyderabad", "is_published": True, "monthly_revenue": 180000, "customer_count": 14,
}
THESIS = {
    "sectors": {"industries": ["Healthcare & AI", "HealthTech"], "business_models": ["B2B SaaS"]},
    "stages": ["Pre-seed", "Seed"],
    "check_size": {"min_check": "2500000.00", "max_check": "10000000.00"},
    "geography": {"countries": ["India"]},
    "traction": {"revenue": "preferred", "min_monthly_revenue": "100000.00"},
}

with sync_playwright() as p:
    br = p.chromium.launch(channel="chrome")
    fctx, f, fh = signed_in(br, env["E2E_TEST_EMAIL"], env["E2E_TEST_PASSWORD"])
    ictx, i, ih = signed_in(br, env["E2E_INVESTOR_EMAIL"], env["E2E_INVESTOR_PASSWORD"])
    inv_id = ictx.request.get(API + "/me", headers=ih).json()["id"]
    founder_id = fctx.request.get(API + "/me", headers=fh).json()["id"]
    orig_prefs = ictx.request.get(API + "/investors/preferences", headers=ih).json()
    orig = q("SELECT p.firm, p.name, p.first_name, p.last_name, p.verification_status, u.name AS account_name "
             "FROM investor_profiles p JOIN app_users u ON u.id = p.user_id WHERE p.user_id = %s", [inv_id])
    (OUT / "originals.json").write_text(json.dumps({"prefs": orig_prefs, "investor": orig}))
    print("saved originals:", {k: orig[k] for k in ("firm", "verification_status")} if orig else None)
    pid = None
    try:
        db([["UPDATE investor_profiles SET firm = %s, name = %s, first_name = %s, last_name = %s, verification_status = 'verified' WHERE user_id = %s",
             ["Demo Capital", "Priya Menon", "Priya", "Menon", inv_id]],
            ["UPDATE app_users SET name = %s WHERE id = %s", ["Priya Menon", inv_id]]])
        r = fctx.request.post(API + "/projects", headers=fh, data=PROJECT, timeout=240000)
        pid = r.json().get("id"); print("project", r.status, pid)
        print("prefs", ictx.request.put(API + "/investors/preferences", headers=ih, data={"thesis": THESIS}).status)

        # founder side
        shot(f, "/founder/dashboard", "f_overview.png")
        shot(f, f"/founder/projects/{pid}", "f_project.png", full=True)
        shot(f, "/founder/investors", "f_investors.png")
        # investor side
        shot(i, "/investor/dashboard", "i_overview.png")
        shot(i, "/investor/discover", "i_discover.png")
        shot(i, f"/investor/projects/{pid}", "i_project.png", full=True)
        shot(i, "/investor/preferences", "i_criteria.png", full=True)

        # connect: investor expresses interest, founder accepts, a short exchange, NDA signed
        r = ictx.request.post(API + "/interests", headers=ih, data={"project_id": pid, "message": "We back primary-care tools in tier-2 India and would like to see your pilot data."})
        print("interest", r.status, r.text()[:160]); interest = r.json()
        r = fctx.request.patch(f"{API}/interests/{interest['id']}/status", headers=fh, data={"status": "accepted"})
        print("accept", r.status); room_id = r.json()["deal_room"]["room_id"]
        ictx.request.post(f"{API}/dealrooms/{room_id}/messages", headers=ih, data={"sender_id": inv_id, "sender_role": "INVESTOR", "sender_name": "Priya Menon",
            "content": "Thanks for accepting. Could you share the results from your two pilot health centres?"})
        fctx.request.post(f"{API}/dealrooms/{room_id}/messages", headers=fh, data={"sender_id": founder_id, "sender_role": "FOUNDER", "sender_name": "Founder",
            "content": "Of course. Once the NDA is signed I'll add the pilot summary here, and we can walk you through it on Thursday."})
        print("nda", fctx.request.post(f"{API}/dealrooms/{room_id}/nda", headers=fh, data={"signer_id": founder_id, "signer_role": "FOUNDER", "signer_name": "Founder"}).status)
        shot(f, f"/dealroom/{room_id}", "f_dealroom.png")
        shot(i, f"/dealroom/{room_id}", "i_dealroom.png")
    finally:
        ictx.request.put(API + "/investors/preferences", headers=ih, data={"thesis": orig_prefs.get("thesis") or {}})
        if orig:
            print("restore investor", db([
                ["UPDATE investor_profiles SET firm = %s, name = %s, first_name = %s, last_name = %s, verification_status = %s WHERE user_id = %s",
                 [orig["firm"], orig["name"] or orig["account_name"], orig["first_name"] or "", orig["last_name"] or "", orig["verification_status"], inv_id]],
                ["UPDATE app_users SET name = %s WHERE id = %s", [orig["account_name"], inv_id]]]))
        if pid:
            print("cleanup", db([["DELETE FROM deal_rooms WHERE project_id = %s", [pid]],
                                 ["DELETE FROM saved_opportunities WHERE project_id = %s", [pid]],
                                 ["DELETE FROM project_interests WHERE project_id = %s", [pid]],
                                 ["DELETE FROM matches WHERE project_id = %s", [pid]],
                                 ["DELETE FROM projects WHERE id = %s", [pid]]]))
        br.close()
