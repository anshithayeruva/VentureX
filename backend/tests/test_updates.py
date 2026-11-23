"""Founder updates to investors: drafts, who receives them, sending, the investor feed, replies to asks,
refreshing the project's traction and applying a reported valuation to a holding.

Everything created here is removed afterwards, also when a test fails.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.core.auth import CurrentUser, get_current_user
from app.database import postgres as pg
from app.main import app

FOUNDER = CurrentUser(id="up-founder", email="up-founder@example.com", name="UP Founder", role="FOUNDER")
OTHER = CurrentUser(id="up-other", email="up-other@example.com", name="UP Other", role="FOUNDER")
BACKER = CurrentUser(id="up-backer", email="up-backer@example.com", name="UP Backer", role="INVESTOR")
CONNECTED = CurrentUser(id="up-connected", email="up-connected@example.com", name="UP Connected", role="INVESTOR")
STRANGER = CurrentUser(id="up-stranger", email="up-stranger@example.com", name="UP Stranger", role="INVESTOR")
USERS = (FOUNDER, OTHER, BACKER, CONNECTED, STRANGER)
IDS = "{" + ",".join(u.id for u in USERS) + "}"
LAST_MONTH = (date.today().replace(day=1) - timedelta(days=1)).isoformat()


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
        ("DELETE FROM investments WHERE investor_id = ANY(%s::text[])", [IDS]),
        (f"DELETE FROM project_interests WHERE project_id IN ({owned})", [IDS]),
        (f"DELETE FROM matches WHERE project_id IN ({owned})", [IDS]),
        ("DELETE FROM notifications WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_profiles WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM projects WHERE founder_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM app_users WHERE id = ANY(%s::text[])", [IDS]),
    ])


@pytest.fixture(scope="module")
def world(client):
    _purge(client)
    for u in USERS:
        client.portal.call(pg.upsert, "app_users", {"id": u.id, "email": u.email, "name": u.name, "role": u.role}, ["id"])

    def project(title, founder=FOUNDER):
        return client.portal.call(pg.insert, "projects", {
            "founder_id": founder.id, "title": title, "description": "Payments for clinics", "problem": "Slow settlements",
            "solution": "Same-day payouts",
            "industry": "Fintech", "stage": "Seed", "funding_required": 5000000, "business_model": "B2B SaaS",
            "target_market": "Clinics", "is_published": True, "monthly_revenue": 100000, "customer_count": 10,
        })

    main, lonely = project("UP ClinicPay"), project("UP Lonely")
    inv = client.portal.call(pg.insert, "investments", {
        "investor_id": BACKER.id, "project_id": main["id"], "company_name": "UP ClinicPay", "industry": "Fintech",
        "stage": "Seed", "instrument": "equity", "investment_date": date.today() - timedelta(days=200),
        "ownership_pct": Decimal("5"),
    })
    client.portal.call(pg.insert, "project_interests", {
        "id": f"intro-{main['id']}-{CONNECTED.id}", "project_id": main["id"], "investor_id": CONNECTED.id,
        "founder_id": FOUNDER.id, "status": "accepted", "initiated_by": "investor",
    })
    yield {"main": main, "lonely": lonely, "investment": inv}
    _purge(client)


def _body(**over):
    body = {
        "period_type": "month", "period_end": LAST_MONTH,
        "metrics": {"monthly_revenue": "250000", "customers": 42, "cash_in_bank": "6000000", "monthly_burn": "500000",
                    "headcount": 7, "custom": [{"label": "NPS", "value": "61"}]},
        "highlights": "Signed 3 hospital chains.\nLaunched UPI autopay.",
        "challenges": "Sales cycles are longer than planned.",
        "asks": ["Intros to hospital CFOs", "A senior backend engineer"],
    }
    body.update(over)
    return body


def test_drafts_and_permissions(client, world, as_user):
    as_user(FOUNDER)
    pid = world["main"]["id"]
    res = client.post(f"/api/projects/{pid}/updates", json=_body())
    assert res.status_code == 201, res.text
    draft = res.json()
    assert draft["status"] == "draft" and draft["period_label"]                     # label defaults to the month
    assert draft["metrics"]["runway_months"] == 12.0                                 # 60L cash / 5L burn
    assert [r["investor_id"] for r in draft["recipients"]] == [BACKER.id]            # default audience: investors
    res = client.put(f"/api/updates/{draft['id']}", json=_body(period_label="Oct close", audience="investors_and_connected"))
    assert res.json()["period_label"] == "Oct close"
    assert {r["investor_id"] for r in res.json()["recipients"]} == {BACKER.id, CONNECTED.id}

    as_user(OTHER)
    assert client.get(f"/api/updates/{draft['id']}").status_code == 404
    assert client.get(f"/api/projects/{pid}/updates").status_code == 404
    as_user(BACKER)
    assert client.get(f"/api/projects/{pid}/updates").status_code == 403

    as_user(FOUNDER)
    assert client.delete(f"/api/updates/{draft['id']}").status_code == 204


def test_no_recipients_and_empty_update(client, world, as_user):
    as_user(FOUNDER)
    lonely = client.post(f"/api/projects/{world['lonely']['id']}/updates", json=_body()).json()
    res = client.post(f"/api/updates/{lonely['id']}/send", json={})
    assert res.status_code == 422 and res.json()["detail"]["code"] == "no_recipients"
    empty = client.post(f"/api/projects/{world['main']['id']}/updates",
                        json={"period_end": LAST_MONTH, "metrics": {}, "highlights": "", "asks": []}).json()
    res = client.post(f"/api/updates/{empty['id']}/send", json={})
    assert res.status_code == 422 and res.json()["detail"]["code"] == "empty"
    client.delete(f"/api/updates/{empty['id']}")
    client.delete(f"/api/updates/{lonely['id']}")


def test_send_read_reply_and_traction(client, world, as_user):
    pid = world["main"]["id"]
    as_user(FOUNDER)
    draft = client.post(f"/api/projects/{pid}/updates", json=_body(audience="investors_and_connected")).json()
    res = client.post(f"/api/updates/{draft['id']}/send", json={"apply_to_project": True})
    assert res.status_code == 200, res.text
    sent = res.json()
    assert sent["status"] == "sent" and sent["recipients_count"] == 2
    assert client.put(f"/api/updates/{draft['id']}", json=_body()).status_code == 409
    assert client.post(f"/api/updates/{draft['id']}/send", json={}).status_code == 409
    project = client.get(f"/api/projects/{pid}").json()
    assert project["monthly_revenue"] == 250000 and project["customer_count"] == 42 and project["team_size"] == 7

    as_user(STRANGER)
    assert client.get("/api/investors/updates").json()["items"] == []
    assert client.post(f"/api/investors/updates/{draft['id']}/read").status_code == 404

    as_user(BACKER)
    feed = client.get("/api/investors/updates").json()
    item = next(i for i in feed["items"] if i["id"] == draft["id"])
    assert item["read_at"] is None and feed["unread"] >= 1
    assert item["asks"] == ["Intros to hospital CFOs", "A senior backend engineer"]
    assert any("update" in n["title"] for n in client.get("/api/notifications").json())
    assert client.post(f"/api/investors/updates/{draft['id']}/read").status_code == 204
    assert client.get("/api/investors/updates/unread-count").json()["unread"] == 0
    assert client.post(f"/api/investors/updates/{draft['id']}/responses",
                       json={"message": "Happy to help", "ask_index": 4}).status_code == 422
    res = client.post(f"/api/investors/updates/{draft['id']}/responses",
                      json={"message": "I know the CFO at two chains; will intro this week.", "ask_index": 0})
    assert res.status_code == 201, res.text

    as_user(FOUNDER)
    detail = client.get(f"/api/updates/{draft['id']}").json()
    reads = {r["investor_id"]: r["read_at"] for r in detail["recipients"]}
    assert reads[BACKER.id] and reads[CONNECTED.id] is None
    assert detail["responses"][0]["ask_index"] == 0 and detail["responses"][0]["name"] == BACKER.name
    assert any("replied" in n["title"] for n in client.get("/api/notifications").json())


def test_previous_metrics_and_valuation(client, world, as_user):
    pid = world["main"]["id"]
    as_user(FOUNDER)
    later = (date.fromisoformat(LAST_MONTH) + timedelta(days=20)).isoformat()
    draft = client.post(f"/api/projects/{pid}/updates", json=_body(
        period_end=later, metrics={"monthly_revenue": "300000", "post_money_valuation": "400000000"})).json()
    assert client.post(f"/api/updates/{draft['id']}/send", json={"apply_to_project": False}).status_code == 200
    listing = client.get(f"/api/projects/{pid}/updates").json()
    assert listing["next_due"] and listing["last_sent_at"]
    assert client.get(f"/api/projects/{pid}").json()["monthly_revenue"] == 250000   # not applied this time

    as_user(BACKER)
    item = next(i for i in client.get("/api/investors/updates").json()["items"] if i["id"] == draft["id"])
    assert float(item["previous"]["metrics"]["monthly_revenue"]) == 250000
    assert item["holding"]["suggested_value"] == 20000000.0                       # 5% of 40 Cr
    res = client.post(f"/api/investors/updates/{draft['id']}/apply-valuation",
                      json={"investment_id": world["investment"]["id"]})
    assert res.status_code == 201, res.text
    vals = res.json()["valuations"]
    assert vals[0]["value"] == "20000000.00" and vals[0]["source"] == "company_report"

    # Connected (not invested) investors have no holding to value.
    as_user(CONNECTED)
    res = client.post(f"/api/investors/updates/{draft['id']}/apply-valuation",
                      json={"investment_id": world["investment"]["id"]})
    assert res.status_code == 404
