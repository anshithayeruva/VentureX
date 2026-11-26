"""Pitch-deck screenshots of the real app with a temporary, clearly-demo startup and investor criteria
on the E2E test accounts. Everything created is removed, and the investor criteria and names are restored afterwards.
Run with the backend (8000) and frontend (3000) dev servers up:  python capture_screens.py <out-dir>"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, r"C:\Users\anshv\VentureX\e2e")
from _common import API, ENV as env, WEB as B, db  # noqa

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
HIDE_DEV = "nextjs-portal{display:none!important}"

def signed_in(br, email, pw, w=1440, h=900):
    ctx = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=2)
    ctx.add_init_script(f"document.addEventListener('DOMContentLoaded',()=>{{const s=document.createElement('style');s.textContent='{HIDE_DEV}';document.head.appendChild(s);}});")
    ctx.request.post(B + "/api/auth/sign-in/email", headers={"Origin": B}, data={"email": email, "password": pw})
    page = ctx.new_page(); page.goto(B + "/", wait_until="networkidle")
    tok = page.evaluate("async () => { const r = await fetch('/api/auth/token'); return r.ok ? (await r.json()).token : null; }")
    return ctx, page, {"Authorization": f"Bearer {tok}"}

def shot(page, path, name, full=False, wait=1800):
    if path: page.goto(B + path, wait_until="networkidle")
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
    orig = ictx.request.get(API + "/investors/preferences", headers=ih).json()
    (OUT / "orig_prefs.json").write_text(json.dumps(orig))
    pid = None
    inv_id = ictx.request.get(API + "/me", headers=ih).json()["id"]
    prof = ictx.request.get(API + "/me/profile", headers=ih).json()
    old = {k: prof.get(k) for k in ("firm", "name", "first_name", "last_name")}
    old["account_name"] = ictx.request.get(API + "/me", headers=ih).json().get("name")
    (OUT / "orig_investor_names.json").write_text(json.dumps(old))
    print("old:", old)
    try:
        db([["UPDATE investor_profiles SET firm = %s, name = %s, first_name = %s, last_name = %s WHERE user_id = %s",
             ["Demo Capital", "Priya Menon", "Priya", "Menon", inv_id]],
            ["UPDATE app_users SET name = %s WHERE id = %s", ["Priya Menon", inv_id]]])
        r = fctx.request.post(API + "/projects", headers=fh, data=PROJECT, timeout=240000)
        print("create", r.status); pid = r.json().get("id")
        an = fctx.request.get(f"{API}/projects/{pid}/analyses", headers=fh).json()
        print("analyses:", json.dumps(an)[:400])
        r = ictx.request.put(API + "/investors/preferences", headers=ih, data={"thesis": THESIS})
        print("prefs", r.status, r.text()[:200])
        # founder side
        shot(f, "/founder/dashboard", "f_overview.png")
        shot(f, f"/founder/projects/{pid}", "f_project.png", full=True)
        shot(f, "/founder/dashboard?tab=readiness", "f_readiness.png", full=True)
        shot(f, "/founder/investors", "f_investors.png")
        # investor side
        shot(i, "/investor/dashboard", "i_overview.png")
        shot(i, "/investor/discover", "i_discover.png")
        shot(i, f"/investor/projects/{pid}", "i_project.png", full=True)
        shot(i, "/investor/preferences", "i_criteria.png", full=True)
    finally:
        print("restore names", db([["UPDATE investor_profiles SET firm = %s, name = %s, first_name = %s, last_name = %s WHERE user_id = %s",
             [old["firm"], old["account_name"], old["first_name"] or "", old["last_name"] or "", inv_id]],
            ["UPDATE app_users SET name = %s WHERE id = %s", [old["account_name"], inv_id]]]))
        if orig.get("thesis") is not None or True:
            r = ictx.request.put(API + "/investors/preferences", headers=ih, data={"thesis": orig.get("thesis") or {}})
            print("restore prefs", r.status)
        if pid:
            print("cleanup", db([["DELETE FROM saved_opportunities WHERE project_id = %s", [pid]],
                                 ["DELETE FROM project_interests WHERE project_id = %s", [pid]],
                                 ["DELETE FROM matches WHERE project_id = %s", [pid]],
                                 ["DELETE FROM projects WHERE id = %s", [pid]]]))
        br.close()
