"""Verification: investor evidence and admin review, company verification by domain email code or
registration number, the admin queue, badges, verified-only filters, limited access for unverified
investors and the higher intro limit for verified companies.

Everything created here is removed afterwards, also when a test fails.
"""
from datetime import timedelta

import pytest

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.database import postgres as pg
from app.main import app

FOUNDER = CurrentUser(id="vf-founder", email="vf-founder@example.com", name="VF Founder", role="FOUNDER")
OTHER_FOUNDER = CurrentUser(id="vf-founder2", email="vf-founder2@example.com", name="VF Founder Two", role="FOUNDER")
INVESTOR = CurrentUser(id="vf-investor", email="vf-investor@example.com", name="VF Investor", role="INVESTOR")
ADMIN = CurrentUser(id="vf-admin", email="vf-admin@example.com", name="VF Admin", role="FOUNDER", is_admin=True)
USERS = (FOUNDER, OTHER_FOUNDER, INVESTOR, ADMIN)
IDS = "{" + ",".join(u.id for u in USERS) + "}"
EVIDENCE = {
    "linkedin_url": "linkedin.com/in/vf-investor",
    "website": "https://vf-capital.example",
    "past_investments": [{"company": "VF PayCo", "stage": "Seed", "year": 2024}],
}


@pytest.fixture
def as_user():
    previous = app.dependency_overrides.get(get_current_user)

    def switch(user):
        async def _user():
            return user
        app.dependency_overrides[get_current_user] = _user

    yield switch
    if previous is not None:
        app.dependency_overrides[get_current_user] = previous


@pytest.fixture(autouse=True)
def verification_on(monkeypatch):
    monkeypatch.setattr(settings, "REQUIRE_INVESTOR_VERIFICATION", True)
    monkeypatch.setattr(settings, "AI_PROVIDER", "none")


@pytest.fixture
def sent_codes(monkeypatch):
    """Capture verification codes instead of emailing them."""
    codes = []
    from app.services.email_service import EmailService

    def capture(to_email, project_title, code, minutes):
        codes.append((to_email, code))
        return {"status": "captured"}
    monkeypatch.setattr(EmailService, "send_verification_code_email", staticmethod(capture))
    return codes


def _purge(client):
    owned = "SELECT id FROM projects WHERE founder_id = ANY(%s::text[])"
    client.portal.call(pg.run_batch, [
        (f"DELETE FROM project_interests WHERE project_id IN ({owned}) OR investor_id = ANY(%s::text[])", [IDS, IDS]),
        (f"DELETE FROM matches WHERE project_id IN ({owned}) OR investor_id = ANY(%s::text[])", [IDS, IDS]),
        ("DELETE FROM notifications WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_preferences WHERE investor_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_profiles WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM projects WHERE founder_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM app_users WHERE id = ANY(%s::text[])", [IDS]),
    ])


def _project(client, founder=FOUNDER, **over):
    doc = {
        "founder_id": founder.id, "title": "VF Clinic Ledger", "tagline": "Books for clinics",
        "description": "Accounting for clinics", "problem": "Messy books", "solution": "Automatic books",
        "industry": "Fintech", "stage": "Seed", "funding_required": 5000000, "business_model": "B2B SaaS",
        "target_market": "Clinics", "country": "India", "city": "Pune", "is_published": True,
        "readiness_score": 80.0, "website": "https://www.vf-clinic.example", "pitch_deck_url": "https://deck.example/vf",
    }
    doc.update(over)
    return client.portal.call(pg.insert, "projects", doc)


@pytest.fixture(scope="module")
def world(client):
    _purge(client)
    for u in USERS:
        client.portal.call(pg.upsert, "app_users", {"id": u.id, "email": u.email, "name": u.name, "role": u.role}, ["id"])
    yield {
        "project": _project(client),
        "nodomain": _project(client, title="VF Kirana Co-op", website=""),
        "other": _project(client, founder=OTHER_FOUNDER, title="VF Other"),
    }
    _purge(client)


# ------------------------------------------------------------------ investors


def test_unverified_investor_explores_in_limited_form(client, world, as_user):
    as_user(INVESTOR)
    me = client.get("/api/me").json()
    assert me["verification_status"] == "unverified" and me["is_admin"] is False
    pid = world["project"]["id"]
    page = client.get("/api/investors/discover", params={"q": "VF Clinic"}).json()
    item = next(i for i in page["items"] if i["id"] == pid)
    assert item["website"] is None                                       # no founder links
    project = client.get(f"/api/projects/{pid}").json()
    assert project["website"] == "" and project["pitch_deck_url"] == ""
    assert client.get(f"/api/projects/{pid}/documents").status_code == 403
    res = client.post("/api/interests", json={"project_id": pid})
    assert res.status_code == 403 and res.json()["detail"]["code"] == "verification_required"


@pytest.mark.parametrize("bad,code", [
    ({"linkedin_url": "https://example.com/me"}, "bad_linkedin"),
    ({"website": "linkedin.com/company/vf"}, "bad_website"),
    ({"website": "not a url"}, "bad_firm_website"),
])
def test_investor_evidence_is_checked(client, world, as_user, bad, code):
    as_user(INVESTOR)
    res = client.post("/api/investors/verification", json={**EVIDENCE, **bad})
    assert res.status_code == 422, res.text
    assert res.json()["detail"]["code"] == code


def test_past_investments_are_optional(client, world, as_user):
    """A first-time angel can ask for review without past investments; blank rows are ignored."""
    as_user(INVESTOR)
    for past in ([], [{"company": " "}]):
        res = client.post("/api/investors/verification", json={**EVIDENCE, "past_investments": past})
        assert res.status_code == 200, res.text
        assert res.json()["status"] == "pending"
    res = client.post("/api/investors/verification", json={k: v for k, v in EVIDENCE.items() if k != "past_investments"})
    assert res.status_code == 200, res.text


def test_admin_only(client, world, as_user):
    as_user(FOUNDER)
    assert client.get("/api/admin/verifications").status_code == 403
    assert client.post(f"/api/admin/investors/{INVESTOR.id}/review", json={"decision": "approve"}).status_code == 403
    as_user(INVESTOR)
    assert client.get("/api/admin/verifications/counts").status_code == 403


def test_investor_review_flow(client, world, as_user):
    as_user(INVESTOR)
    res = client.post("/api/investors/verification", json=EVIDENCE)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "pending" and res.json()["linkedin_url"].startswith("https://linkedin.com")

    as_user(ADMIN)
    queue = client.get("/api/admin/verifications", params={"kind": "investor", "status": "pending"}).json()
    row = next(r for r in queue if r["user_id"] == INVESTOR.id)
    assert row["email"] == INVESTOR.email and row["portfolio"][0]["company"] == "VF PayCo"
    assert client.get("/api/admin/verifications/counts").json()["investors_pending"] >= 1
    # Rejecting needs a note, which the investor then sees.
    assert client.post(f"/api/admin/investors/{INVESTOR.id}/review", json={"decision": "reject"}).status_code == 422
    res = client.post(f"/api/admin/investors/{INVESTOR.id}/review",
                      json={"decision": "reject", "note": "Add a firm website we can open."})
    assert res.status_code == 200 and res.json()["status"] == "rejected"
    as_user(INVESTOR)
    mine = client.get("/api/investors/verification").json()
    assert mine["status"] == "rejected" and "firm website" in mine["review_note"]
    assert client.post("/api/interests", json={"project_id": world["project"]["id"]}).status_code == 403

    # Resubmit, approve: full access and a badge for founders.
    assert client.post("/api/investors/verification", json=EVIDENCE).json()["status"] == "pending"
    as_user(ADMIN)
    assert client.post(f"/api/admin/investors/{INVESTOR.id}/review", json={"decision": "approve"}).json()["status"] == "verified"
    as_user(INVESTOR)
    assert client.get("/api/me").json()["verification_status"] == "verified"
    assert client.post("/api/investors/verification", json=EVIDENCE).status_code == 409
    pid = world["project"]["id"]
    assert client.get(f"/api/projects/{pid}").json()["website"] == "https://www.vf-clinic.example"
    assert client.get(f"/api/projects/{pid}/documents").status_code == 200
    notes = client.get("/api/notifications").json()
    assert any("verified" in n["title"] for n in notes)

    as_user(FOUNDER)
    listing = client.get("/api/founders/investors", params={"q": "VF Investor", "verified_only": "true"}).json()
    assert [i["investor_id"] for i in listing["items"]] == [INVESTOR.id]
    assert listing["items"][0]["verified"] is True
    assert client.get(f"/api/founders/investors/{INVESTOR.id}").json()["verified"] is True


# ------------------------------------------------------------------ companies


def test_company_email_code_rules(client, world, as_user, sent_codes):
    as_user(FOUNDER)
    pid = world["project"]["id"]
    assert client.get(f"/api/projects/{pid}/verification").json()["website_domain"] == "vf-clinic.example"
    for email, code in [("me@gmail.com", "free_email"), ("me@other.example", "domain_mismatch"), ("nope", "bad_email")]:
        res = client.post(f"/api/projects/{pid}/verification/email", json={"email": email})
        assert res.status_code == 422 and res.json()["detail"]["code"] == code, (email, res.text)
    nodomain = world["nodomain"]["id"]
    res = client.post(f"/api/projects/{nodomain}/verification/email", json={"email": "me@vf-clinic.example"})
    assert res.json()["detail"]["code"] == "no_website"
    # Someone else's project
    as_user(OTHER_FOUNDER)
    assert client.post(f"/api/projects/{pid}/verification/email", json={"email": "a@vf-clinic.example"}).status_code == 404
    assert sent_codes == []


def test_company_verified_by_domain_code(client, world, as_user, sent_codes):
    as_user(FOUNDER)
    pid = world["project"]["id"]
    res = client.post(f"/api/projects/{pid}/verification/email", json={"email": "Founder@Mail.VF-Clinic.example"})
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "code_sent" and "@mail.vf-clinic.example" in res.json()["email"]
    to, code = sent_codes[-1]
    assert to == "founder@mail.vf-clinic.example" and len(code) == 6
    again = client.post(f"/api/projects/{pid}/verification/email", json={"email": "founder@vf-clinic.example"})
    assert again.status_code == 429                                         # resend cooldown

    wrong = "000000" if code != "000000" else "111111"
    res = client.post(f"/api/projects/{pid}/verification/confirm", json={"code": wrong})
    assert res.status_code == 422 and "tries left" in res.json()["detail"]["message"]
    res = client.post(f"/api/projects/{pid}/verification/confirm", json={"code": code})
    assert res.status_code == 200 and res.json()["status"] == "verified"

    as_user(INVESTOR)
    hits = client.get("/api/investors/discover", params={"verified_only": "true", "q": "VF "}).json()
    assert [i["id"] for i in hits["items"]] == [pid] and hits["items"][0]["company_verified"] is True
    assert client.get(f"/api/projects/{pid}").json()["company_verified"] is True

    # Moving the website to another domain drops the domain proof.
    as_user(FOUNDER)
    assert client.put(f"/api/projects/{pid}", json={"website": "https://new-domain.example"}).status_code == 200
    assert client.get(f"/api/projects/{pid}/verification").json()["status"] == "unverified"
    client.put(f"/api/projects/{pid}", json={"website": "https://www.vf-clinic.example"})


def test_code_expiry_and_attempt_limit(client, world, as_user, sent_codes):
    as_user(OTHER_FOUNDER)
    pid = world["other"]["id"]
    assert client.post(f"/api/projects/{pid}/verification/email", json={"email": "x@vf-clinic.example"}).status_code == 200
    code = sent_codes[-1][1]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(settings.VERIFICATION_CODE_MAX_ATTEMPTS):
        client.post(f"/api/projects/{pid}/verification/confirm", json={"code": wrong})
    res = client.post(f"/api/projects/{pid}/verification/confirm", json={"code": code})
    assert res.status_code == 429 and res.json()["detail"]["code"] == "too_many_attempts"
    client.portal.call(pg.execute, "UPDATE company_verifications SET code_attempts = 0, "
                       "code_expires_at = now() - interval '1 minute' WHERE project_id = %s", [pid])
    res = client.post(f"/api/projects/{pid}/verification/confirm", json={"code": code})
    assert res.status_code == 410


def test_registration_number_reviewed_by_admin(client, world, as_user):
    as_user(FOUNDER)
    pid = world["nodomain"]["id"]
    bad = client.post(f"/api/projects/{pid}/verification/registration",
                      json={"registration_type": "gstin", "registration_number": "12345"})
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "bad_number"
    res = client.post(f"/api/projects/{pid}/verification/registration",
                      json={"registration_type": "gstin", "registration_number": "27aapfu0939f1zv", "note": "Pune GST"})
    assert res.status_code == 200 and res.json()["status"] == "pending"
    assert res.json()["registration_number"] == "27AAPFU0939F1ZV"

    as_user(ADMIN)
    queue = client.get("/api/admin/verifications", params={"kind": "company", "status": "pending"}).json()
    row = next(r for r in queue if r["project_id"] == pid)
    assert row["founder_email"] == FOUNDER.email and row["registration_type"] == "gstin"
    res = client.post(f"/api/admin/companies/{pid}/review", json={"decision": "approve", "note": "Checked on GST portal"})
    assert res.status_code == 200 and res.json()["status"] == "verified"
    as_user(FOUNDER)
    assert client.get(f"/api/projects/{pid}/verification").json()["status"] == "verified"
    assert any("verified" in n["title"] for n in client.get("/api/notifications").json())


def test_verified_company_gets_higher_intro_limit(client, world, as_user, monkeypatch):
    monkeypatch.setattr(settings, "FOUNDER_INTRO_DAILY_LIMIT", 3)
    monkeypatch.setattr(settings, "FOUNDER_INTRO_DAILY_LIMIT_VERIFIED", 9)
    as_user(FOUNDER)
    verified = client.get(f"/api/founders/investors/{INVESTOR.id}", params={"project_id": world["nodomain"]["id"]}).json()
    assert verified["eligibility"]["daily_limit"] == 9 and verified["eligibility"]["company_verified"] is True
    as_user(OTHER_FOUNDER)
    plain = client.get(f"/api/founders/investors/{INVESTOR.id}", params={"project_id": world["other"]["id"]}).json()
    assert plain["eligibility"]["daily_limit"] == 3


def test_unverified_investor_cannot_accept_founder_request(client, world, as_user):
    pid = world["other"]["id"]
    client.portal.call(pg.execute, "UPDATE investor_profiles SET verification_status = 'pending' WHERE user_id = %s", [INVESTOR.id])
    client.portal.call(pg.upsert, "project_interests", {
        "id": f"intro-{pid}-{INVESTOR.id}", "project_id": pid, "investor_id": INVESTOR.id,
        "founder_id": OTHER_FOUNDER.id, "status": "pending", "initiated_by": "founder", "message": "Hello",
    }, ["project_id", "investor_id"], ["status", "initiated_by"])
    as_user(INVESTOR)
    res = client.post(f"/api/interests/intro-{pid}-{INVESTOR.id}/respond", json={"decision": "interested"})
    assert res.status_code == 403
    res = client.post(f"/api/interests/intro-{pid}-{INVESTOR.id}/respond", json={"decision": "pass", "reason": "too_early"})
    assert res.status_code == 200                                          # passing is always allowed
