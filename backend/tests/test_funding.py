"""Funding rounds and allocations: interest is not investment, the status lifecycle, partial
allocations by several investors, committed vs received capital, remaining amounts, ownership
(agreed vs indicative, none for SAFEs), investor privacy, and founder/investor consistency.
All figures are made-up test data. Everything created here is removed afterwards."""
from datetime import date

import pytest

from app.core.auth import CurrentUser, get_current_user
from app.database import postgres as pg
from app.main import app

FOUNDER = CurrentUser(id="fd-founder", email="fd-founder@example.com", name="FD Founder", role="FOUNDER", email_verified=True)
A = CurrentUser(id="fd-inv-a", email="fd-a@example.com", name="Investor A", role="INVESTOR", email_verified=True)
B = CurrentUser(id="fd-inv-b", email="fd-b@example.com", name="Investor B", role="INVESTOR", email_verified=True)
C = CurrentUser(id="fd-inv-c", email="fd-c@example.com", name="Investor C", role="INVESTOR", email_verified=True)
STRANGER = CurrentUser(id="fd-stranger", email="fd-s@example.com", name="Stranger", role="INVESTOR", email_verified=True)
USERS = (FOUNDER, A, B, C, STRANGER)
IDS = "{" + ",".join(u.id for u in USERS) + "}"


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


def _purge(client):
    owned = "SELECT id FROM projects WHERE founder_id = ANY(%s::text[])"
    client.portal.call(pg.run_batch, [
        (f"DELETE FROM project_interests WHERE project_id IN ({owned})", [IDS]),
        (f"DELETE FROM matches WHERE project_id IN ({owned})", [IDS]),
        ("DELETE FROM notifications WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_profiles WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM projects WHERE founder_id = ANY(%s::text[])", [IDS]),   # rounds and allocations cascade
        ("DELETE FROM app_users WHERE id = ANY(%s::text[])", [IDS]),
    ])


@pytest.fixture(scope="module")
def world(client):
    _purge(client)
    for u in USERS:
        client.portal.call(pg.upsert, "app_users", {"id": u.id, "email": u.email, "name": u.name, "role": u.role}, ["id"])
    for u in (A, B, C, STRANGER):
        client.portal.call(pg.upsert, "investor_profiles", {"user_id": u.id, "name": u.name, "verification_status": "verified"}, ["user_id"])
    project = client.portal.call(pg.insert, "projects", {
        "founder_id": FOUNDER.id, "title": "FD Clinic Pay", "description": "Payments for clinics", "problem": "Slow settlements",
        "solution": "Same-day payouts", "industry": "Fintech", "stage": "Seed", "funding_required": 5000000,
        "business_model": "B2B SaaS", "target_market": "Clinics", "is_published": True})
    for u in (A, B, C):
        client.portal.call(pg.insert, "project_interests", {
            "id": f"intro-{project['id']}-{u.id}", "project_id": project["id"], "investor_id": u.id,
            "founder_id": FOUNDER.id, "status": "accepted", "initiated_by": "investor"})
    # STRANGER only expressed interest (pending): that's not an investment.
    client.portal.call(pg.insert, "project_interests", {
        "id": f"intro-{project['id']}-{STRANGER.id}", "project_id": project["id"], "investor_id": STRANGER.id,
        "founder_id": FOUNDER.id, "status": "pending", "initiated_by": "investor"})
    yield {"project": project}
    _purge(client)


ROUND = {"name": "Seed 2026", "round_type": "seed", "instrument": "equity", "target_amount": "5000000.00",
         "min_ticket": "100000", "max_ticket": "2000000", "pre_money_valuation": "45000000", "disclose_progress": True}


def _alloc(funding, investor_name):
    return next(a for a in funding["rounds"][0]["allocations"] if a["investor_name"] == investor_name)


def test_round_setup_and_validation(client, world, as_user):
    pid = world["project"]["id"]
    as_user(FOUNDER)
    assert client.post(f"/api/projects/{pid}/rounds", json={**ROUND, "min_ticket": "3000000"}).status_code == 422
    assert client.post(f"/api/projects/{pid}/rounds", json={**ROUND, "valuation_cap": "1000"}).status_code == 422
    res = client.post(f"/api/projects/{pid}/rounds", json=ROUND)
    assert res.status_code == 201, res.text
    rnd = res.json()["rounds"][0]
    assert rnd["status"] == "draft" and rnd["summary"]["committed"] == "0.00" and rnd["summary"]["remaining"] == "5000000.00"
    # Interest alone created nothing.
    assert rnd["allocations"] == []
    as_user(A)
    assert client.post(f"/api/rounds/{rnd['id']}/proposals", json={"amount": "1000000"}).status_code == 409  # not open
    as_user(FOUNDER)
    assert client.post(f"/api/rounds/{rnd['id']}/status", json={"status": "open"}).json()["rounds"][0]["status"] == "open"
    as_user(B)
    assert client.get(f"/api/projects/{pid}/rounds").json()["can_propose"] is True


def test_lifecycle_and_partial_allocations(client, world, as_user):
    pid = world["project"]["id"]
    as_user(FOUNDER)
    round_id = client.get(f"/api/projects/{pid}/funding").json()["rounds"][0]["id"]
    # Interested-only investors can't propose; tickets are enforced.
    as_user(STRANGER)
    assert client.post(f"/api/rounds/{round_id}/proposals", json={"amount": "500000"}).status_code == 403
    as_user(A)
    assert client.post(f"/api/rounds/{round_id}/proposals", json={"amount": "50000"}).status_code == 422
    assert client.post(f"/api/rounds/{round_id}/proposals", json={"amount": "3000000"}).status_code == 422
    for u, amount in ((A, "1000000"), (B, "1500000"), (C, "500000")):
        as_user(u)
        res = client.post(f"/api/rounds/{round_id}/proposals", json={"amount": amount, "note": "Happy to lead"})
        assert res.status_code == 201, res.text
        assert res.json()["allocation"]["status"] == "proposed"
    as_user(A)
    assert client.post(f"/api/rounds/{round_id}/proposals", json={"amount": "1000000"}).status_code == 409

    as_user(FOUNDER)
    funding = client.get(f"/api/projects/{pid}/funding").json()
    s = funding["rounds"][0]["summary"]
    assert s["committed"] == "0.00" and s["in_negotiation"] == "3000000.00" and s["in_negotiation_count"] == 3
    # Investors confirming before the founders accept: not allowed.
    as_user(A)
    a_id = _alloc(funding, "Investor A")["id"]
    assert client.post(f"/api/investors/allocations/{a_id}/confirm").status_code == 409
    # Founder accepts A with agreed equity, B without (indicative only), and rejects C.
    as_user(FOUNDER)
    b_id, c_id = _alloc(funding, "Investor B")["id"], _alloc(funding, "Investor C")["id"]
    assert client.post(f"/api/allocations/{a_id}/accept", json={"amount": "1000000", "agreed_equity_pct": "2.0"}).status_code == 200
    assert client.post(f"/api/allocations/{b_id}/accept", json={"amount": "1500000"}).status_code == 200
    assert client.post(f"/api/allocations/{c_id}/reject", json={"note": "Round is full"}).status_code == 200
    for u, aid in ((A, a_id), (B, b_id)):
        as_user(u)
        res = client.post(f"/api/investors/allocations/{aid}/confirm")
        assert res.status_code == 200 and res.json()["allocation"]["status"] == "committed"
    as_user(C)
    mine = client.get(f"/api/investors/allocations/{c_id}").json()
    assert mine["allocation"]["status"] == "rejected" and mine["allocation"]["founder_note"] == "Round is full"

    # External investor recorded by the founder.
    as_user(FOUNDER)
    res = client.post(f"/api/rounds/{round_id}/external", json={"investor_name": "Angel Network X", "amount": "500000"})
    assert res.status_code == 201, res.text
    s = res.json()["rounds"][0]["summary"]
    assert s["committed"] == "3000000.00" and s["remaining"] == "2000000.00" and s["committed_pct"] == "60.00"
    assert s["received"] == "0.00" and s["investor_count"] == 3


def test_received_vs_committed(client, world, as_user):
    pid = world["project"]["id"]
    as_user(FOUNDER)
    funding = client.get(f"/api/projects/{pid}/funding").json()
    a_id, b_id = _alloc(funding, "Investor A")["id"], _alloc(funding, "Investor B")["id"]
    today = date.today().isoformat()
    # Can't receive more than committed; partial then full.
    assert client.post(f"/api/allocations/{a_id}/receipts", json={"amount": "1500000", "received_on": today}).status_code == 422
    res = client.post(f"/api/allocations/{a_id}/receipts", json={"amount": "1000000", "received_on": today, "reference": "UTR123"})
    assert res.status_code == 201, res.text
    res = client.post(f"/api/allocations/{b_id}/receipts", json={"amount": "1000000", "received_on": today})
    funding = res.json()
    s = funding["rounds"][0]["summary"]
    assert s["committed"] == "3000000.00" and s["received"] == "2000000.00"
    assert s["unreceived_committed"] == "1000000.00" and s["remaining"] == "2000000.00"
    assert _alloc(funding, "Investor A")["status"] == "funded"
    assert _alloc(funding, "Investor B")["status"] == "partially_funded" and _alloc(funding, "Investor B")["outstanding"] == "500000.00"
    # A refund moves B back.
    res = client.post(f"/api/allocations/{b_id}/receipts", json={"amount": "1000000", "received_on": today, "type": "refund"})
    assert _alloc(res.json(), "Investor B")["status"] == "committed"
    client.post(f"/api/allocations/{b_id}/receipts", json={"amount": "1000000", "received_on": today})
    # Committed capital with receipts can't be cancelled.
    assert client.post(f"/api/allocations/{a_id}/cancel-commitment").status_code == 409


def test_ownership_agreed_vs_indicative(client, world, as_user):
    pid = world["project"]["id"]
    as_user(FOUNDER)
    funding = client.get(f"/api/projects/{pid}/funding").json()
    rnd = funding["rounds"][0]
    a, b = _alloc(funding, "Investor A"), _alloc(funding, "Investor B")
    assert a["ownership"]["agreed_equity_pct"] == "2.00" and a["ownership"]["indicative_equity_pct"] is None
    # B: 15,00,000 / (4,50,00,000 pre-money + 30,00,000 committed) = 3.125%
    assert b["ownership"]["agreed_equity_pct"] is None and b["ownership"]["indicative_equity_pct"] == "3.1250"
    assert "Indicative" in b["ownership"]["basis"]
    assert rnd["indicative_post_money"] == "48000000.00" and rnd["combined_indicative_equity_pct"] == "6.2500"
    assert rnd["combined_agreed_equity_pct"] == "2.00"


def test_safe_round_has_no_ownership(client, world, as_user):
    as_user(FOUNDER)
    other = client.portal.call(pg.insert, "projects", {
        "founder_id": FOUNDER.id, "title": "FD SAFE Startup", "description": "Second company", "problem": "Problem here",
        "solution": "Solution here", "industry": "Fintech", "stage": "Pre-seed", "funding_required": 2000000,
        "business_model": "B2B SaaS", "target_market": "SMBs", "is_published": True})
    res = client.post(f"/api/projects/{other['id']}/rounds", json={
        "name": "SAFE 2026", "instrument": "safe", "target_amount": "2000000", "valuation_cap": "30000000", "discount_pct": "20"})
    rid = res.json()["rounds"][0]["id"]
    funding = client.post(f"/api/rounds/{rid}/external", json={"investor_name": "Angel Y", "amount": "500000"}).json()
    own = funding["rounds"][0]["allocations"][0]["ownership"]
    assert own["indicative_equity_pct"] is None and own["agreed_equity_pct"] is None and "Converts" in own["basis"]
    assert client.post(f"/api/rounds/{rid}/external", json={"investor_name": "Angel Z", "amount": "100000", "agreed_equity_pct": "1"}).status_code == 422


def test_investor_privacy_and_consistency(client, world, as_user):
    pid = world["project"]["id"]
    as_user(FOUNDER)
    founder_view = client.get(f"/api/projects/{pid}/funding").json()["rounds"][0]
    as_user(B)
    mine = client.get("/api/investors/allocations").json()
    assert len(mine) == 1 and mine[0]["investor_name"] == "Investor B"
    rounds = client.get(f"/api/projects/{pid}/rounds").json()["rounds"][0]
    assert [x["investor_name"] for x in rounds["allocations"]] == ["Investor B"]       # never other investors
    assert rounds["summary"] == founder_view["summary"]                                 # same numbers both sides
    detail = client.get(f"/api/investors/allocations/{mine[0]['id']}").json()
    assert detail["allocation"]["received"] == "1000000.00"
    assert [t["type"] for t in detail["transactions"]] == ["receipt", "refund", "receipt"]
    assert [h["action"] for h in detail["history"]][:3] == ["proposed", "accepted", "committed"]
    # Investors can't see the founder's full view or act as founders.
    assert client.get(f"/api/projects/{pid}/funding").status_code == 403
    assert client.post(f"/api/allocations/{mine[0]['id']}/receipts", json={"amount": "1", "received_on": date.today().isoformat()}).status_code == 403
    as_user(STRANGER)
    assert client.get(f"/api/investors/allocations/{mine[0]['id']}").status_code == 404
    # Hiding progress: investors see only the target.
    as_user(FOUNDER)
    client.put(f"/api/rounds/{founder_view['id']}", json={**ROUND, "disclose_progress": False})
    as_user(B)
    assert client.get(f"/api/projects/{pid}/rounds").json()["rounds"][0]["summary"] == {"target": "5000000.00"}
    # Target can't drop below committed capital.
    as_user(FOUNDER)
    assert client.put(f"/api/rounds/{founder_view['id']}", json={**ROUND, "target_amount": "1000000"}).status_code == 422


def test_discover_round_filters(client, world, as_user):
    pid = world["project"]["id"]
    as_user(STRANGER)
    hits = client.get("/api/investors/discover", params={"q": "FD Clinic", "round_status": "open"}).json()["items"]
    assert [h["id"] for h in hits] == [pid] and hits[0]["open_round"]["name"] == "Seed 2026"
    assert hits[0]["open_round"]["committed_pct"] is None                              # disclosure switched off above
    assert client.get("/api/investors/discover", params={"q": "FD Clinic", "round_status": "none"}).json()["items"] == []
    # Ticket range: round accepts 1L to 20L.
    assert client.get("/api/investors/discover", params={"q": "FD Clinic", "ticket_min": 2500000}).json()["items"] == []
    assert len(client.get("/api/investors/discover", params={"q": "FD Clinic", "ticket_min": 500000, "ticket_max": 800000}).json()["items"]) == 1
