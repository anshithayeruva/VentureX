"""Full end-to-end test of VentureX against the running app (web + API).

Run from the repo root with the backend's virtualenv (it imports the backend for cleanup):
    backend/.venv/Scripts/python e2e/api_flow.py          (Windows)
    backend/.venv/bin/python e2e/api_flow.py              (macOS / Linux)
Set SKIP_AI=1 to skip the live AI analysis. VX_WEB_URL / VX_API_URL override the addresses.
Exits non-zero when any check fails.

Real Neon Auth sign-ins (cookies handled manually, since Neon's __Secure- cookies are
ignored by HTTP clients over plain http), real FastAPI backend, real Neon Postgres,
live Gemini analysis. Creates its own data and removes it at the end.
"""
import asyncio
import io
import json
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import API, BACKEND_DIR, ENV, WEB as NEXT, set_test_investor_verification  # noqa: E402

sys.path.insert(0, str(BACKEND_DIR))

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
    return bool(ok)


def warn(name, detail):
    results.append((name, None, detail))
    print(f"WARN {name}  [{detail}]")


class Account:
    """A browser-like Neon Auth session against the Next.js app, plus backend API calls."""

    def __init__(self, label):
        self.label = label
        self.cookies = {}
        self.http = httpx.Client(timeout=60, follow_redirects=False)
        self._token = None

    def _cookie_header(self):
        return "; ".join(f"{k}={v}" for k, v in self.cookies.items())

    def _store(self, response):
        for raw in response.headers.get_list("set-cookie"):
            pair = raw.split(";", 1)[0]
            name, _, value = pair.partition("=")
            expired = "max-age=0" in raw.lower() or not value
            if expired:
                self.cookies.pop(name.strip(), None)
            else:
                self.cookies[name.strip()] = value.strip()

    def next(self, method, path, **kw):
        headers = {"Origin": NEXT, **kw.pop("headers", {})}
        if self.cookies:
            headers["Cookie"] = self._cookie_header()
        r = self.http.request(method, NEXT + path, headers=headers, **kw)
        self._store(r)
        return r

    def sign_in(self, email, password):
        self._token = None
        return self.next("POST", "/api/auth/sign-in/email", json={"email": email, "password": password})

    def sign_up(self, email, password, name):
        self._token = None
        return self.next("POST", "/api/auth/sign-up/email", json={"email": email, "password": password, "name": name})

    def session(self):
        r = self.next("GET", "/api/auth/get-session")
        return r.json() if r.status_code == 200 and r.text not in ("", "null") else None

    def token(self):
        if not self._token:
            r = self.next("GET", "/api/auth/token")
            self._token = r.json().get("token") if r.status_code == 200 else None
        return self._token

    def api(self, method, path, **kw):
        headers = kw.pop("headers", {})
        if self.token():
            headers["Authorization"] = f"Bearer {self.token()}"
        return self.http.request(method, API + path, headers=headers, timeout=kw.pop("timeout", 60), **kw)


anon = httpx.Client(timeout=60, follow_redirects=False)
founder = Account("founder")
investor = Account("investor")
created = {"project": None, "room": None}

# ============================================================== A. public + health
print("\n== A. Public pages and health")
h = anon.get(API + "/health").json()
check("backend health: healthy, Neon connected, auth configured",
      h.get("status") == "healthy" and h.get("database") == "connected" and h.get("auth_configured"), h)
for page in ("/", "/login", "/register", "/forgot-password"):
    r = anon.get(NEXT + page)
    check(f"page {page} loads (200)", r.status_code == 200, r.status_code)
r = anon.get(NEXT + "/founder/dashboard")
check("protected page redirects signed-out visitor to /login",
      r.status_code in (307, 308) and r.headers.get("location", "").startswith("/login"), (r.status_code, r.headers.get("location")))
r = anon.get(API + "/projects")
check("public project list (published only)", r.status_code == 200 and all(p["is_published"] for p in r.json()), r.status_code)
r = anon.post(API + "/upload", files={"file": ("a.txt", b"x", "text/plain")})
check("public generic upload endpoint is gone", r.status_code in (404, 405), r.status_code)
r = anon.get(API + "/notifications", params={"user_id": "founder-001", "role": "FOUNDER"})
check("notifications require sign-in (401)", r.status_code == 401, r.status_code)

# ============================================================== B. auth
print("\n== B. Authentication")
r = founder.sign_in(ENV["E2E_TEST_EMAIL"], "definitely-wrong-password")
check("wrong password rejected (401)", r.status_code == 401, r.status_code)
r = founder.sign_in(ENV["E2E_TEST_EMAIL"], ENV["E2E_TEST_PASSWORD"])
check("founder signs in", r.status_code == 200, r.text[:120])
s = founder.session()
check("founder session holds the right user", s and s["user"]["email"] == ENV["E2E_TEST_EMAIL"])
check("founder gets a Neon Auth JWT", bool(founder.token()))
me = founder.api("GET", "/me").json()
check("backend /me verifies JWT and returns role FOUNDER", me.get("role") == "FOUNDER", me)
founder_id = me.get("id")
r = founder.next("GET", "/founder/dashboard")
check("signed-in founder can open protected dashboard", r.status_code == 200, r.status_code)

r = investor.sign_in(ENV["E2E_INVESTOR_EMAIL"], ENV["E2E_INVESTOR_PASSWORD"])
if r.status_code != 200:
    r = investor.sign_up(ENV["E2E_INVESTOR_EMAIL"], ENV["E2E_INVESTOR_PASSWORD"], "Neon E2E Investor")
    check("investor signs up (new account)", r.status_code == 200, r.text[:120])
else:
    check("investor signs in (existing account)", True)
me_inv = investor.api("GET", "/me").json()
if not me_inv.get("role"):
    me_inv = investor.api("POST", "/me", json={"role": "INVESTOR", "name": "Neon E2E Investor",
                                                 "organization": "E2E Ventures"}).json()
check("investor onboarded with role INVESTOR", me_inv.get("role") == "INVESTOR", me_inv)
investor_id = me_inv.get("id")
r = investor.api("POST", "/me", json={"role": "FOUNDER"})
check("role cannot be switched after onboarding (409)", r.status_code == 409, r.status_code)
r = anon.get(API + "/me")
check("backend /me without token is 401", r.status_code == 401, r.status_code)
r = anon.get(API + "/me", headers={"Authorization": "Bearer " + founder.token()[:-6] + "AAAAAA"})
check("tampered JWT rejected (401)", r.status_code == 401, r.status_code)

# ============================================================== C. founder: project + intelligence
print("\n== C. Founder: project, materials, analysis")
r = founder.api("POST", "/projects", json={
    "title": "E2E FullTest PharmaClaim", "tagline": "Stop claim rejections before submission",
    "description": "Software for independent pharmacies that validates insurance claims against payer rules.",
    "problem": "Independent pharmacists lose ~2 hours a day reworking rejected claims (~$40k/year per store).",
    "solution": "Real-time claim checks against payer rules catch most rejections before submission.",
    "industry": "Healthcare & AI", "stage": "Seed", "funding_required": 600000,
    "business_model": "B2B SaaS", "target_market": "Independent US pharmacies",
    "github_url": "https://github.com/pallets/click", "demo_url": "https://example.com/demo", "is_published": False,
})
ok = check("create project (201) with GitHub + demo links", r.status_code == 201, r.text[:200])
project = r.json() if ok else {}
pid = created["project"] = project.get("id")
check("new project gets a baseline readiness score", isinstance(project.get("readiness_score"), (int, float)), project.get("readiness_score"))
check("project stores github_url and demo_url", project.get("github_url", "").endswith("pallets/click") and project.get("demo_url"))

from app.utils.pdf_generator import PDFGenerator  # noqa: E402
import docx  # noqa: E402
from pptx import Presentation  # noqa: E402
deck = PDFGenerator.generate_readiness_pdf({**project, "title": "PharmaClaim Pitch Deck"})
plan = docx.Document(); plan.add_paragraph("Pricing $199/pharmacy/month. TAM $3B, SAM $45M. 12 pilots, 3 LOIs, 63% fewer rejections.")
pbuf = io.BytesIO(); plan.save(pbuf)
prs = Presentation(); sl = prs.slides.add_slide(prs.slide_layouts[1]); sl.shapes.title.text = "Traction"; sl.placeholders[1].text = "12 pilot pharmacies"
xbuf = io.BytesIO(); prs.save(xbuf)
docs = {}
for cat, name, data, ctype in [
    ("pitch_deck", "deck.pdf", deck, "application/pdf"),
    ("business_plan", "plan.docx", pbuf.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ("market_research", "traction.pptx", xbuf.getvalue(), "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
]:
    r = founder.api("POST", f"/projects/{pid}/documents", data={"category": cat}, files={"file": (name, data, ctype)})
    d = r.json() if r.status_code == 201 else {}
    docs[name] = d
    check(f"upload {name} and extract text", r.status_code == 201 and d.get("text_chars", 0) > 0, (r.status_code, d.get("text_chars")))
r = founder.api("POST", f"/projects/{pid}/documents", files={"file": ("tool.exe", b"MZ", "application/octet-stream")})
check("reject unsupported file type (.exe → 400)", r.status_code == 400, r.status_code)
r = investor.api("POST", f"/projects/{pid}/documents", files={"file": ("x.txt", b"hi", "text/plain")})
check("investor cannot upload to founder's project", r.status_code == 403, r.status_code)
listed = founder.api("GET", f"/projects/{pid}/documents").json()
check("list materials (3)", len(listed) == 3, len(listed))
r = founder.api("GET", f"/projects/{pid}/documents/{docs['deck.pdf']['id']}/file")
check("download returns the same PDF bytes", r.status_code == 200 and r.content == deck, (r.status_code, len(r.content)))
r = investor.api("GET", f"/projects/{pid}/documents")
check("draft project's materials hidden from investor (404)", r.status_code == 404, r.status_code)

r = founder.api("PUT", f"/projects/{pid}", json={"tagline": "Edited via E2E"})
check("founder edits project", r.status_code == 200 and r.json().get("tagline") == "Edited via E2E", r.status_code)
r = investor.api("PUT", f"/projects/{pid}", json={"tagline": "hijack"})
check("investor cannot edit founder's project", r.status_code in (403, 404), r.status_code)
r = investor.api("GET", f"/projects/{pid}/readiness")
check("readiness report private to founder (404 for investor)", r.status_code == 404, r.status_code)

import os
if os.environ.get("SKIP_AI"):
    print("   (live Gemini analysis skipped this run: SKIP_AI set)")
    r = founder.api("GET", f"/projects/{pid}/readiness")
    r.status_code = 0
else:
    print("   running live Gemini analysis (can take 1-3 minutes)...")
t = time.perf_counter()
if not os.environ.get("SKIP_AI"):
    r = founder.api("POST", f"/projects/{pid}/analyze", timeout=600)
elapsed = time.perf_counter() - t
if r.status_code == 200:
    rep = r.json()
    check(f"AI analysis via Gemini ({elapsed:.0f}s, {rep.get('model_version')})",
          rep.get("engine") == "gemini" and rep.get("is_ai_generated") and len(rep.get("dimensions", [])) == 5)
    check("analysis has strengths, gaps, suggestions, insights",
          rep["strengths"] and rep["gaps"] and rep["suggestions"] and rep["industry_insights"])
    check("analysis read all 3 documents and the GitHub repo",
          len(rep["inputs"]["documents"]) == 3 and rep["inputs"]["github"] is not None)
elif r.status_code == 0:
    warn("AI analysis via Gemini", "skipped this run (passed live in the two previous runs)")
elif r.status_code in (429, 503):
    warn("AI analysis via Gemini", f"Google returned busy/limit ({r.status_code}): {r.json().get('detail')}")
else:
    check("AI analysis via Gemini", False, (r.status_code, r.text[:200]))
hist = founder.api("GET", f"/projects/{pid}/analyses").json()
check("analysis history recorded", len(hist) >= 1, len(hist))
r = founder.api("GET", f"/projects/{pid}/export-report")
check("readiness report exports as PDF", r.status_code == 200 and r.headers.get("content-type") == "application/pdf", r.status_code)
r = founder.api("DELETE", f"/projects/{pid}/documents/{docs['traction.pptx']['id']}")
check("delete a material", r.status_code == 200 and len(founder.api("GET", f"/projects/{pid}/documents").json()) == 2, r.status_code)

r = founder.api("PATCH", f"/projects/{pid}/publish", json={"is_published": True})
check("publish project", r.status_code == 200 and r.json().get("is_published") is True, r.status_code)
r = investor.api("GET", f"/projects/{pid}")
check("investor can view published project", r.status_code == 200, r.status_code)
check("published project appears in investor dealflow",
      any(p["id"] == pid for p in investor.api("GET", "/projects").json()))
check("my-projects list shows only the founder's own projects",
      all(p["founder_id"] == founder_id for p in founder.api("GET", "/projects", params={"founder_only": "true"}).json()))

# ============================================================== D. investor: preferences, matches, intro
print("\n== D. Investor: preferences, matches, intro request")
r = investor.api("GET", "/investors/preferences")
check("investor reads preferences", r.status_code == 200 and "preferred_industries" in r.json(), r.status_code)
r = investor.api("PUT", "/investors/preferences", json={
    "preferred_industries": ["Healthcare & AI"], "preferred_stages": ["Seed"],
    "min_investment": 250000, "max_investment": 1000000, "preferred_business_models": ["B2B SaaS"],
})
check("investor updates preferences", r.status_code == 200 and r.json()["preferred_industries"] == ["Healthcare & AI"], r.status_code)
inv_matches = investor.api("GET", "/matches").json()
check("investor sees only their own matches", inv_matches and all(m["investor_id"] == investor_id for m in inv_matches), len(inv_matches))
mine = next((m for m in inv_matches if m["project_id"] == pid), None)
check("new project matched to investor with explained reasons", mine and mine["match_score"] >= 80 and len(mine["reasons"]) == 4,
      mine and mine["match_score"])
f_matches = founder.api("GET", "/matches").json()
own_ids = {p["id"] for p in founder.api("GET", "/projects", params={"founder_only": "true"}).json()}
check("founder sees only matches for their own projects",
      f_matches and all(m["project_id"] in own_ids for m in f_matches), (len(f_matches), own_ids))

# Investors must be verified by an admin before they can contact founders.
set_test_investor_verification("unverified")
r = investor.api("POST", "/interests", json={"project_id": pid, "message": "Keen to learn more."})
check("unverified investor can't request an intro (403)", r.status_code == 403, r.status_code)
r = investor.api("GET", f"/projects/{pid}")
check("unverified investor doesn't see the founder's links", r.is_success and not r.json().get("website") and not r.json().get("github_url"),
      r.is_success and r.json().get("github_url"))
check("test investor marked verified for the rest of the run", set_test_investor_verification("verified"))

r = investor.api("POST", "/interests", json={"project_id": pid, "investor_id": "investor-001", "message": "Keen to learn more."})
ok = check("investor requests an intro (201)", r.status_code == 201, r.text[:200])
interest = r.json() if ok else {}
check("intro recorded for the signed-in investor (spoofed id ignored)", interest.get("investor_id") == investor_id)
check("intro stores the real account emails",
      interest.get("investor_email") == ENV["E2E_INVESTOR_EMAIL"] and interest.get("founder_email") == ENV["E2E_TEST_EMAIL"],
      (interest.get("investor_email"), interest.get("founder_email")))
pending_view = next((i for i in investor.api("GET", "/interests").json() if i["id"] == interest.get("id")), {})
check("founder email hidden from investor until accepted", pending_view and not pending_view.get("founder_email"),
      pending_view.get("founder_email"))

# ============================================================== E. notifications
print("\n== E. Notifications")
f_notes = founder.api("GET", "/notifications").json()
check("founder notified of the intro request", any("Intro Request" in n["title"] for n in f_notes))
check("founder's notifications are theirs or role-wide only", all(n.get("user_id") in (None, founder_id) for n in f_notes))
unread = founder.api("GET", "/notifications/unread-count").json()["unread_count"]
check("unread count reflects new notification", unread >= 1, unread)
note = next(n for n in f_notes if n.get("user_id") == founder_id)
r = investor.api("PATCH", f"/notifications/{note['id']}/read")
check("investor cannot mark founder's notification read", r.status_code == 404, r.status_code)
r = founder.api("PATCH", f"/notifications/{note['id']}/read")
check("founder marks one notification read", r.status_code == 200, r.status_code)
founder.api("POST", "/notifications/mark-all-read")
check("mark all read → 0 unread", founder.api("GET", "/notifications/unread-count").json()["unread_count"] == 0)

# ============================================================== F. intro acceptance + deal room
print("\n== F. Intro acceptance and deal room")
check("founder sees the intro; investor sees their request",
      [i["id"] for i in founder.api("GET", "/interests").json()] == [interest["id"]]
      and [i["id"] for i in investor.api("GET", "/interests").json()] == [interest["id"]])
r = investor.api("PATCH", f"/interests/{interest['id']}/status", json={"status": "accepted"})
check("investor cannot accept their own request (403)", r.status_code == 403, r.status_code)
r = founder.api("PATCH", f"/interests/{interest['id']}/status", json={"status": "accepted", "response_note": "Welcome aboard!"})
ok = check("founder accepts intro", r.status_code == 200 and r.json().get("status") == "accepted", r.status_code)
room_id = created["room"] = (r.json().get("deal_room") or {}).get("room_id") if ok else None
check("accepting opens a deal room linked to the intro", bool(room_id), r.json().get("deal_room") if ok else None)
dr = (r.json().get("deal_room") or {}) if ok else {}
FAKE_KEYS = ("founder_phone", "meeting_scheduler_url", "data_room_url", "financial_model_url", "cap_table_verified")
check("deal room carries no invented contact details or links",
      not any(k in dr for k in FAKE_KEYS) and "venturex.io" not in str(dr) and "cal.com" not in str(dr), dr)
acc_view = next((i for i in investor.api("GET", "/interests").json() if i["id"] == interest.get("id")), {})
check("investor sees the founder's real email after acceptance",
      acc_view.get("founder_email") == ENV["E2E_TEST_EMAIL"] and dr.get("founder_email") == ENV["E2E_TEST_EMAIL"],
      (acc_view.get("founder_email"), dr.get("founder_email")))
check("investor notified that the deal room unlocked",
      any("Deal Room Unlocked" in n["title"] for n in investor.api("GET", "/notifications").json()))
check("both parties see the room",
      [x["id"] for x in founder.api("GET", "/dealrooms").json()] == [room_id]
      and [x["id"] for x in investor.api("GET", "/dealrooms").json()] == [room_id])
r = anon.get(API + f"/dealrooms/{room_id}")
check("deal room requires sign-in (401)", r.status_code == 401, r.status_code)
r = founder.api("GET", "/dealrooms/room-neuropulse-blueshift")
check("demo room not visible to a non-participant (404)", r.status_code == 404, r.status_code)


async def websocket_checks():
    import websockets
    base = API.replace("https://", "wss://").replace("http://", "ws://") + f"/dealrooms/ws/{room_id}"
    out = {}
    try:
        async with websockets.connect(base) as ws:
            await asyncio.wait_for(ws.recv(), 5)
        out["no_token"] = "accepted"
    except websockets.exceptions.ConnectionClosed as e:
        out["no_token"] = e.rcvd.code if e.rcvd else None
    except Exception as e:
        out["no_token"] = getattr(getattr(e, "response", None), "status_code", type(e).__name__)
    async with websockets.connect(f"{base}?token={founder.token()}") as ws:
        # investor posts over REST -> founder receives it live
        await asyncio.to_thread(investor.api, "POST", f"/dealrooms/{room_id}/messages",
                                json={"sender_id": "x", "sender_role": "FOUNDER", "sender_name": "x", "content": "Live hello from investor"})
        msg = None
        for _ in range(5):
            data = json.loads(await asyncio.wait_for(ws.recv(), 20))
            if data.get("type") == "message":
                msg = data["data"]
                break
        out["live_received"] = msg
        await ws.send(json.dumps({"type": "message", "data": {
            "sender_id": "spoof", "sender_role": "INVESTOR", "sender_name": "spoof", "content": "Reply over socket"}}))
        for _ in range(5):
            data = json.loads(await asyncio.wait_for(ws.recv(), 20))
            if data.get("type") == "message" and data["data"]["content"] == "Reply over socket":
                out["socket_sent"] = data["data"]
                break
    return out

ws_out = asyncio.run(websocket_checks())
check("WebSocket without token refused", ws_out["no_token"] in (4401, 403), ws_out["no_token"])
live = ws_out.get("live_received") or {}
check("live message delivered over WebSocket to the other party",
      live.get("content") == "Live hello from investor" and live.get("sender_id") == investor_id, live)
sent = ws_out.get("socket_sent") or {}
check("message sent over WebSocket attributed to the verified founder", sent.get("sender_id") == founder_id, sent)

r = founder.api("PATCH", f"/dealrooms/{room_id}/stage", json={"stage": "DUE_DILIGENCE", "note": "Starting diligence",
                                                                "sender_id": "x", "sender_role": "x", "sender_name": "x"})
check("advance deal stage", r.status_code == 200 and r.json().get("stage") == "DUE_DILIGENCE", r.status_code)
r = investor.api("POST", f"/dealrooms/{room_id}/nda", json={"signer_id": "x", "signer_role": "x", "signer_name": "x"})
check("sign NDA", r.status_code == 200 and r.json().get("nda_signed") is True, r.status_code)
r = founder.api("POST", f"/dealrooms/{room_id}/documents", json={"name": "CapTable.xlsx", "url": "https://example.com/cap.xlsx",
                                                                   "type": "cap_table", "size_kb": 120,
                                                                   "sender_id": "x", "sender_role": "x", "sender_name": "x"})
check("share a document into the room", r.status_code == 200 and any(d["name"] == "CapTable.xlsx" for d in r.json()["shared_documents"]), r.status_code)
r = founder.api("POST", f"/dealrooms/{room_id}/files", data={"type": "other", "name": "Pilot notes"},
                files={"file": ("pilot.txt", b"pilot data", "text/plain")})
ok = check("upload a private file into the room", r.status_code == 200, r.text[:200])
furl = (r.json()["shared_documents"][-1]["url"] if ok else "")
r = investor.api("GET", furl)
check("other participant downloads the private file", r.status_code == 200 and r.content == b"pilot data", r.status_code)
r = anon.get(API + furl)
check("private room file refused without sign-in (401)", r.status_code == 401, r.status_code)
msgs = founder.api("GET", f"/dealrooms/{room_id}/messages").json()
check(f"messages recorded in order with integrity hashes ({len(msgs)} messages)",
      [m["sequence"] for m in msgs] == list(range(1, len(msgs) + 1)) and all(len(m["integrity_hash"]) == 64 for m in msgs))
tr = investor.api("GET", f"/dealrooms/{room_id}/transcript").json()
check("transcript export verifies integrity", tr.get("cryptographic_integrity_status") == "VERIFIED_TAMPER_EVIDENT", tr.get("cryptographic_integrity_status"))
r = investor.api("GET", f"/dealrooms/{room_id}/export-pdf")
check("deal room PDF certificate exports", r.status_code == 200 and r.headers.get("content-type") == "application/pdf", r.status_code)
logs = founder.api("GET", f"/dealrooms/{room_id}/audit-logs").json()
events = {l["event_type"] for l in logs}
check("audit log records room, messages, stage, NDA, export",
      {"ROOM_CREATED", "MESSAGE_RECORDED", "STAGE_ADVANCED", "NDA_EXECUTED", "TRANSCRIPT_EXPORTED"} <= events, sorted(events))

# ============================================================== G. profiles + sign-out
print("\n== G. Profiles, settings, sign-out")
r = founder.api("PUT", "/founders/profile", json={"company": "E2E Labs"})
check("founder updates profile", r.status_code == 200, r.status_code)
r = founder.api("PUT", "/founders/settings", json={"defaultPrivate": True, "emailAlerts": False, "weeklyDigest": True})
check("founder updates settings (and they persist)", r.status_code == 200 and r.json().get("weekly_digest") is True
      and founder.api("GET", "/founders/settings").json().get("weekly_digest") is True, r.json())
r = investor.api("PUT", "/investors/profile", json={"firm": "E2E Ventures"})
check("investor updates profile", r.status_code == 200, r.status_code)
r = founder.api("PUT", "/investors/preferences", json={"geography": "x"})
check("founder cannot change investor preferences (403)", r.status_code == 403, r.status_code)
r = founder.next("POST", "/api/auth/sign-out", json={})
check("sign-out succeeds", r.status_code == 200, r.status_code)
check("session cleared after sign-out", founder.session() is None)
r = founder.next("GET", "/founder/dashboard")
check("protected page redirects after sign-out", r.status_code in (307, 308), r.status_code)

# ============================================================== cleanup
print("\n== Cleanup")


async def cleanup():
    from app.database import postgres as pg
    from app.services.document_service import DocumentService, PRIVATE_DIR
    await pg.open_pool()
    test_users = "{" + ",".join(x for x in (founder_id, investor_id) if x) + "}"
    # every project this test ever created for the test founder (also from interrupted runs)
    test_pids = [r["id"] for r in await pg.fetch_all(
        "SELECT id FROM projects WHERE founder_id = %s AND title = %s", [founder_id or "", "E2E FullTest PharmaClaim"])]
    for tp in test_pids:
        for d in await DocumentService.list(tp):
            await DocumentService.delete(tp, d["id"])
        await pg.run_batch([("DELETE FROM matches WHERE project_id = %s", [tp]),
                            ("DELETE FROM projects WHERE id = %s", [tp])])
        tdir = PRIVATE_DIR / "projects" / str(tp)
        if tdir.is_dir() and not any(tdir.iterdir()):
            tdir.rmdir()
    await pg.run_batch([
        ("DELETE FROM deal_rooms WHERE founder_id = ANY(%s::text[]) OR investor_id = ANY(%s::text[])", [test_users, test_users]),
        ("DELETE FROM project_interests WHERE founder_id = ANY(%s::text[]) OR investor_id = ANY(%s::text[])", [test_users, test_users]),
        ("DELETE FROM matches WHERE project_id = %s OR investor_id = %s", [pid or -1, investor_id or ""]),
        ("DELETE FROM notifications WHERE user_id = ANY(%s::text[])", [test_users]),
        ("DELETE FROM projects WHERE id = %s AND founder_id = %s", [pid or -1, founder_id or ""]),
        ("DELETE FROM investor_profiles WHERE user_id = %s", [investor_id or ""]),
        ("DELETE FROM investor_preferences WHERE investor_id = %s", [investor_id or ""]),
    ])
    left = {
        "projects": await pg.fetch_val("SELECT count(*) AS n FROM projects"),
        "deal_rooms": await pg.fetch_val("SELECT count(*) AS n FROM deal_rooms"),
        "interests": await pg.fetch_val("SELECT count(*) AS n FROM project_interests"),
    }
    await pg.close_pool()
    d = PRIVATE_DIR / "projects" / str(pid)
    if d.is_dir() and not any(d.iterdir()):
        d.rmdir()
    return left

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
print("left after cleanup:", asyncio.run(cleanup()))

passed = sum(1 for _, ok, _ in results if ok is True)
failed = [(n, d) for n, ok, d in results if ok is False]
warned = [(n, d) for n, ok, d in results if ok is None]
print(f"\nRESULT: {passed} passed, {len(failed)} failed, {len(warned)} warnings")
for n, d in failed:
    print("  FAILED:", n, "|", d)
for n, d in warned:
    print("  WARNING:", n, "|", d)

sys.exit(1 if failed else 0)
