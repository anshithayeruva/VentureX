"""Founder outreach: the investor directory, investor profiles, founder-initiated intro requests with
their safeguards (published, readiness, criteria, AI check, daily limit), the investor's Interested /
Pass reply, and the 14-day "No response" expiry.

Everything created here is removed afterwards, also when a test fails.
"""
import pytest

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.database import postgres as pg
from app.main import app
from app.services.interest_service import InterestService

FOUNDER = CurrentUser(id="fo-founder", email="fo-founder@example.com", name="FO Founder", role="FOUNDER")
LEAD = CurrentUser(id="fo-lead", email="fo-lead@example.com", name="FO Lead", role="INVESTOR")
COINV = CurrentUser(id="fo-coinv", email="fo-coinv@example.com", name="FO Coinvest", role="INVESTOR")
NOFIN = CurrentUser(id="fo-nofin", email="fo-nofin@example.com", name="FO No Fintech", role="INVESTOR")
HIDDEN = CurrentUser(id="fo-hidden", email="fo-hidden@example.com", name="FO Hidden", role="INVESTOR")
USERS = (FOUNDER, LEAD, COINV, NOFIN, HIDDEN)
IDS = "{" + ",".join(u.id for u in USERS) + "}"
NOTE = "We'd love your view on our clinic payments raise; you've backed two fintechs we admire."


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
def rules_only(monkeypatch):
    """No real AI calls in tests; the AI step is exercised with a stand-in below."""
    monkeypatch.setattr(settings, "AI_PROVIDER", "none")


def _purge(client):
    client.portal.call(pg.run_batch, [
        ("DELETE FROM deal_rooms WHERE founder_id = %s", [FOUNDER.id]),
        ("DELETE FROM project_interests WHERE founder_id = %s OR investor_id = ANY(%s::text[])", [FOUNDER.id, IDS]),
        ("DELETE FROM matches WHERE investor_id = ANY(%s::text[]) OR project_id IN "
         "(SELECT id FROM projects WHERE founder_id = %s)", [IDS, FOUNDER.id]),
        ("DELETE FROM notifications WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_preferences WHERE investor_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_profiles WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM projects WHERE founder_id = %s", [FOUNDER.id]),
        ("DELETE FROM app_users WHERE id = ANY(%s::text[])", [IDS]),
    ])


def _thesis(**over):
    base = {
        "sectors": {"industries": ["Fintech"], "business_models": ["B2B SaaS"]},
        "stages": ["Seed", "Series A"],
        "check_size": {"min_check": "2500000", "max_check": "20000000", "total_allocation": "500000000"},
        "geography": {"countries": ["India"]},
        "structure": {"role": "lead"},
    }
    base.update(over)
    return base


def _project(client, **over):
    doc = {
        "founder_id": FOUNDER.id, "title": "FO Clinic Payments", "tagline": "Instant payouts for clinics",
        "description": "Clinic payments platform", "problem": "Slow payments", "solution": "Instant payouts",
        "industry": "Fintech", "stage": "Seed", "funding_required": 10000000, "business_model": "B2B SaaS",
        "target_market": "Clinics", "country": "India", "city": "Bengaluru", "monthly_revenue": 400000,
        "customer_count": 120, "product_status": "launched", "is_published": True, "readiness_score": 80.0,
    }
    doc.update(over)
    return client.portal.call(pg.insert, "projects", doc)


@pytest.fixture(scope="module")
def world(client):
    _purge(client)
    for u in USERS:
        client.portal.call(pg.upsert, "app_users", {"id": u.id, "email": u.email, "name": u.name, "role": u.role}, ["id"])
    profiles = {
        LEAD.id: {"firm": "FO Lead Capital", "value_add": "Hiring help and bank partnerships",
               "portfolio": [{"company": "PayCo", "stage": "Seed", "year": 2024}]},
        COINV.id: {"firm": "FO Angels"},
        NOFIN.id: {"firm": "FO Health Fund"},
        HIDDEN.id: {"firm": "FO Stealth", "listed_for_founders": False},
    }
    theses = {
        LEAD.id: _thesis(additional={"notes": "PRIVATE NOTE: partner meeting Mondays"}),
        COINV.id: _thesis(structure={"role": "co_invest"}, geography={"is_global": True}),
        NOFIN.id: _thesis(sectors={"industries": ["Healthtech"], "excluded_industries": ["Fintech"]}),
        HIDDEN.id: _thesis(),
    }
    by_id = {u.id: u for u in USERS}
    for uid, extra in profiles.items():
        client.portal.call(pg.upsert, "investor_profiles",
                           {"user_id": uid, "name": by_id[uid].name, "location": "Mumbai", **extra}, ["user_id"])
    previous = app.dependency_overrides.get(get_current_user)
    for uid, thesis in theses.items():
        async def _user(u=by_id[uid]):
            return u
        app.dependency_overrides[get_current_user] = _user
        res = client.put("/api/investors/preferences", json={"thesis": thesis})
        assert res.status_code == 200, res.text
    if previous is not None:
        app.dependency_overrides[get_current_user] = previous
    yield {
        "ready": _project(client),
        "draft": _project(client, title="FO Draft", is_published=False),
        "early": _project(client, title="FO Early", readiness_score=30.0),
        "spare": _project(client, title="FO Spare"),
    }
    _purge(client)


def _ids(body):
    return [i["investor_id"] for i in body["items"] if i["investor_id"].startswith("fo-")]


# ------------------------------------------------------------------ directory & profile


def test_directory_ranks_by_fit_and_filters(client, world, as_user):
    as_user(FOUNDER)
    pid = world["ready"]["id"]
    body = client.get("/api/founders/investors", params={"project_id": pid, "q": "FO "}).json()
    ids = _ids(body)
    assert HIDDEN.id not in ids                                 # opted out of the directory
    assert set(ids) == {LEAD.id, COINV.id, NOFIN.id}
    assert ids[-1] == NOFIN.id                                  # criteria exclude Fintech: last
    nofin = next(i for i in body["items"] if i["investor_id"] == NOFIN.id)
    assert nofin["match_score"] is None and "Fintech" in nofin["excluded_reason"]
    lead = next(i for i in body["items"] if i["investor_id"] == LEAD.id)
    assert lead["match_score"] >= 80 and lead["reasons"]
    assert body["project"]["id"] == pid

    def ids_for(**params):
        return _ids(client.get("/api/founders/investors", params={"project_id": pid, "q": "FO ", **params}).json())

    assert set(ids_for(role="lead")) == {LEAD.id, NOFIN.id}
    assert set(ids_for(role="co_invest")) == {COINV.id}
    assert set(ids_for(sector="Healthtech")) == {NOFIN.id}
    assert set(ids_for(stage="Series B")) == set()
    assert set(ids_for(min_check=30000000)) == set()             # above everyone's maximum
    assert set(ids_for(max_check=1000000)) == set()              # below everyone's minimum
    assert LEAD.id in ids_for(location="India") and COINV.id in ids_for(location="Brazil")
    assert LEAD.id not in ids_for(location="Brazil")


def test_profile_hides_private_fields_and_contact(client, world, as_user):
    as_user(FOUNDER)
    res = client.get(f"/api/founders/investors/{LEAD.id}", params={"project_id": world["ready"]["id"]})
    assert res.status_code == 200, res.text
    body = res.json()
    text = res.text
    assert "PRIVATE NOTE" not in text and "total_allocation" not in text and "priorities" not in text
    assert body["email"] is None and body["connected"] is False
    assert body["value_add"].startswith("Hiring help")
    assert body["portfolio"][0]["company"] == "PayCo"
    assert body["thesis"]["check_size"]["min_check"] == 2500000
    assert body["stats"]["enough_data"] is False
    assert body["eligibility"]["can_request"] is True
    assert client.get(f"/api/founders/investors/{HIDDEN.id}").status_code == 404


def test_only_founders_use_the_directory(client, world, as_user):
    as_user(LEAD)
    assert client.get("/api/founders/investors").status_code == 403


# ------------------------------------------------------------------ safeguards


@pytest.mark.parametrize("which,code", [("draft", "not_published"), ("early", "low_readiness")])
def test_unready_projects_cannot_request(client, world, as_user, which, code):
    as_user(FOUNDER)
    res = client.post(f"/api/founders/investors/{LEAD.id}/intro-requests",
                      json={"project_id": world[which]["id"], "note": NOTE})
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == code


def test_investor_criteria_exclusion_blocks(client, world, as_user):
    as_user(FOUNDER)
    res = client.post(f"/api/founders/investors/{NOFIN.id}/intro-requests",
                      json={"project_id": world["ready"]["id"], "note": NOTE})
    assert res.status_code == 422 and res.json()["detail"]["code"] == "excluded"


def test_ai_check_blocks_on_investor_notes(client, world, as_user, monkeypatch):
    async def says_excluded(project, notes):
        assert "PRIVATE NOTE" in notes
        return "Their notes say they don't back payments companies."
    monkeypatch.setattr("app.services.intro_screen.ai_exclusion_reason", says_excluded)
    as_user(FOUNDER)
    res = client.post(f"/api/founders/investors/{LEAD.id}/intro-requests",
                      json={"project_id": world["spare"]["id"], "note": NOTE})
    assert res.status_code == 422
    assert "payments" in res.json()["detail"]["message"]


def test_note_is_required(client, world, as_user):
    as_user(FOUNDER)
    res = client.post(f"/api/founders/investors/{LEAD.id}/intro-requests",
                      json={"project_id": world["ready"]["id"], "note": "hi"})
    assert res.status_code == 422


# ------------------------------------------------------------------ request, pass, interested


def test_request_then_pass_with_reason(client, world, as_user):
    pid = world["ready"]["id"]
    as_user(FOUNDER)
    res = client.post(f"/api/founders/investors/{COINV.id}/intro-requests", json={"project_id": pid, "note": NOTE})
    assert res.status_code == 201, res.text
    sent = res.json()
    assert sent["initiated_by"] == "founder" and sent["status"] == "pending" and sent["investor_email"] is None
    again = client.post(f"/api/founders/investors/{COINV.id}/intro-requests", json={"project_id": pid, "note": NOTE})
    assert again.status_code == 409 and again.json()["detail"]["code"] == "already_requested"
    # The founder can't accept their own request.
    assert client.patch(f"/api/interests/{sent['id']}/status", json={"status": "accepted"}).status_code == 409

    as_user(COINV)
    flow = client.get("/api/investors/deal-flow").json()
    inbound = next(i for i in flow["items"] if i["project_id"] == pid)
    assert inbound["status"] == "inbound" and inbound["message"] == NOTE
    assert inbound["founder_email"] is None
    # An investor's own "request intro" doesn't overwrite the founder's request.
    assert client.post("/api/interests", json={"project_id": pid}).status_code == 400
    # Someone else's request can't be answered.
    as_user(LEAD)
    assert client.post(f"/api/interests/{sent['id']}/respond", json={"decision": "pass", "reason": "team"}).status_code == 404

    as_user(COINV)
    assert client.post(f"/api/interests/{sent['id']}/respond", json={"decision": "pass"}).status_code == 422
    res = client.post(f"/api/interests/{sent['id']}/respond",
                      json={"decision": "pass", "reason": "too_early", "note": "Come back after 6 months of revenue."})
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "declined" and res.json()["pass_reason"] == "too_early"
    assert client.post(f"/api/interests/{sent['id']}/respond", json={"decision": "interested"}).status_code == 409

    as_user(FOUNDER)
    mine = next(i for i in client.get("/api/interests").json() if i["id"] == sent["id"])
    assert mine["pass_reason"] == "too_early" and mine["response_note"].startswith("Come back")
    retry = client.post(f"/api/founders/investors/{COINV.id}/intro-requests", json={"project_id": pid, "note": NOTE})
    assert retry.status_code == 409 and retry.json()["detail"]["code"] == "passed"


def test_interested_opens_deal_room_and_shares_contact(client, world, as_user):
    pid = world["ready"]["id"]
    as_user(FOUNDER)
    sent = client.post(f"/api/founders/investors/{LEAD.id}/intro-requests", json={"project_id": pid, "note": NOTE})
    assert sent.status_code == 201, sent.text
    listed = next(i for i in client.get("/api/interests").json() if i["id"] == sent.json()["id"])
    assert listed["investor_email"] is None                      # hidden until Interested

    as_user(LEAD)
    res = client.post(f"/api/interests/{sent.json()['id']}/respond", json={"decision": "interested"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "accepted" and body["deal_room"]["room_id"]
    assert client.get(f"/api/dealrooms/{body['deal_room']['room_id']}").status_code == 200

    as_user(FOUNDER)
    profile = client.get(f"/api/founders/investors/{LEAD.id}", params={"project_id": pid}).json()
    assert profile["connected"] is True and profile["email"] == LEAD.email
    assert profile["relationship"]["status"] == "accepted"
    assert profile["eligibility"]["blockers"][0]["code"] == "connected"


def test_no_reply_in_14_days_expires(client, world, as_user):
    pid = world["spare"]["id"]
    as_user(FOUNDER)
    sent = client.post(f"/api/founders/investors/{COINV.id}/intro-requests", json={"project_id": pid, "note": NOTE})
    assert sent.status_code == 201, sent.text
    iid = sent.json()["id"]
    client.portal.call(pg.execute, "UPDATE project_interests SET created_at = now() - interval '15 days' WHERE id = %s", [iid])
    assert client.portal.call(InterestService.expire_stale, True) >= 1
    mine = next(i for i in client.get("/api/interests").json() if i["id"] == iid)
    assert mine["status"] == "expired"
    retry = client.post(f"/api/founders/investors/{COINV.id}/intro-requests", json={"project_id": pid, "note": NOTE})
    assert retry.status_code == 409 and retry.json()["detail"]["code"] == "recently_expired"

    as_user(COINV)
    assert client.post(f"/api/interests/{iid}/respond", json={"decision": "interested"}).status_code == 409
    flow = client.get("/api/investors/deal-flow").json()
    assert next(i for i in flow["items"] if i["project_id"] == pid)["status"] == "expired"


def test_founder_can_withdraw_waiting_request(client, world, as_user, monkeypatch):
    monkeypatch.setattr(settings, "FOUNDER_INTRO_DAILY_LIMIT", 50)
    pid = world["spare"]["id"]
    as_user(FOUNDER)
    sent = client.post(f"/api/founders/investors/{LEAD.id}/intro-requests", json={"project_id": pid, "note": NOTE})
    assert sent.status_code == 201, sent.text
    as_user(COINV)
    assert client.delete(f"/api/interests/{sent.json()['id']}").status_code == 403
    as_user(FOUNDER)
    assert client.delete(f"/api/interests/{sent.json()['id']}").status_code == 200


def test_daily_limit(client, world, as_user, monkeypatch):
    as_user(FOUNDER)
    sent = client.get(f"/api/founders/investors/{LEAD.id}", params={"project_id": world["spare"]["id"]}).json()
    monkeypatch.setattr(settings, "FOUNDER_INTRO_DAILY_LIMIT", sent["eligibility"]["sent_today"])
    res = client.post(f"/api/founders/investors/{LEAD.id}/intro-requests",
                      json={"project_id": world["spare"]["id"], "note": NOTE})
    assert res.status_code == 429 and res.json()["detail"]["code"] == "daily_limit"
