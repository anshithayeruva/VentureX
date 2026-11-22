"""Investor portal: structured criteria, discovery, saved opportunities, deal flow and the
portfolio ledger (calculations, validation, and that one investor can't touch another's records).

Everything created here is removed afterwards, also when a test fails.
"""
from decimal import Decimal

import pytest

from app.core.auth import CurrentUser, get_current_user
from app.database import postgres as pg
from app.main import app

FOUNDER = CurrentUser(id="ip-founder", email="ip-founder@example.com", name="IP Founder", role="FOUNDER")
INVESTOR = CurrentUser(id="ip-investor", email="ip-investor@example.com", name="IP Investor", role="INVESTOR")
OTHER = CurrentUser(id="ip-other", email="ip-other@example.com", name="IP Other", role="INVESTOR")
IDS = "{ip-founder,ip-investor,ip-other}"
TITLE = "IP Test Fintech Startup"


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
    client.portal.call(pg.run_batch, [
        ("DELETE FROM investments WHERE investor_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM saved_opportunities WHERE investor_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM matches WHERE investor_id = ANY(%s::text[]) OR project_id IN "
         "(SELECT id FROM projects WHERE founder_id = 'ip-founder')", [IDS]),
        ("DELETE FROM notifications WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_preferences WHERE investor_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_profiles WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM projects WHERE founder_id = 'ip-founder'", []),
        ("DELETE FROM app_users WHERE id = ANY(%s::text[])", [IDS]),
    ])


@pytest.fixture(scope="module")
def world(client):
    _purge(client)
    for u in (FOUNDER, INVESTOR, OTHER):
        client.portal.call(pg.upsert, "app_users",
                           {"id": u.id, "email": u.email, "name": u.name, "role": u.role}, ["id"])
    project = client.portal.call(pg.insert, "projects", {
        "founder_id": FOUNDER.id, "title": TITLE, "tagline": "Payments for clinics",
        "description": "Clinic payments platform", "problem": "Slow payments", "solution": "Instant payouts",
        "industry": "Fintech", "stage": "Seed", "funding_required": 900000, "business_model": "B2B SaaS",
        "target_market": "Clinics", "country": "Germany", "city": "Berlin", "monthly_revenue": 40000,
        "customer_count": 120, "product_status": "launched", "is_published": True,
        "readiness_score": 77.0, "ai_feedback_summary": "PRIVATE FEEDBACK",
    })
    yield project
    _purge(client)


def _thesis(**over):
    base = {
        "sectors": {"industries": ["Fintech"], "business_models": ["B2B SaaS"]},
        "stages": ["Seed", "Series A"],
        "check_size": {"min_check": "250000", "max_check": "1500000", "preferred_check": "750000",
                       "total_allocation": "10000000"},
        "geography": {"regions": ["Europe"]},
        "traction": {"revenue": "required", "min_monthly_revenue": "10000"},
        "priorities": {"industry": "high", "stage": "high", "check_size": "medium",
                       "geography": "medium", "business_model": "low", "traction": "medium"},
    }
    base.update(over)
    return base


# ------------------------------------------------------------------ criteria


def test_thesis_saves_and_drives_matching(client, world, as_user):
    as_user(INVESTOR)
    res = client.put("/api/investors/preferences", json={"thesis": _thesis()})
    assert res.status_code == 200, res.text
    body = res.json()
    assert Decimal(body["thesis"]["check_size"]["total_allocation"]) == Decimal("10000000")
    assert body["preferred_industries"] == ["Fintech"]          # legacy columns mirror the thesis
    assert body["min_investment"] == 250000

    hits = client.get("/api/investors/discover", params={"matched_only": "true", "q": TITLE}).json()
    assert [i["id"] for i in hits["items"]] == [world["id"]]
    item = hits["items"][0]
    cats = {r["category"] for r in item["reasons"]}
    assert {"Industry Focus", "Geography", "Traction"} <= cats
    assert item["match_score"] >= 85


def test_excluded_industry_removes_match(client, world, as_user):
    as_user(INVESTOR)
    t = _thesis(sectors={"industries": [], "excluded_industries": ["Fintech"]})
    assert client.put("/api/investors/preferences", json={"thesis": t}).status_code == 200
    hits = client.get("/api/investors/discover", params={"matched_only": "true", "q": TITLE}).json()
    assert hits["items"] == []
    # Restore a matching thesis for later tests.
    client.put("/api/investors/preferences", json={"thesis": _thesis()})


@pytest.mark.parametrize("bad", [
    {"check_size": {"min_check": "500", "max_check": "100"}},
    {"check_size": {"max_check": "1000000", "total_allocation": "5000"}},
    {"sectors": {"industries": ["Fintech"], "excluded_industries": ["Fintech"]}},
    {"structure": {"min_ownership_pct": "30", "max_ownership_pct": "10"}},
])
def test_invalid_thesis_rejected(client, world, as_user, bad):
    as_user(INVESTOR)
    assert client.put("/api/investors/preferences", json={"thesis": _thesis(**bad)}).status_code == 422


# ------------------------------------------------------------------ discovery


def test_discover_filters_sort_and_privacy(client, world, as_user):
    as_user(INVESTOR)
    base = {"q": TITLE}
    assert client.get("/api/investors/discover", params={**base, "region": "Europe"}).json()["total"] == 1
    assert client.get("/api/investors/discover", params={**base, "country": "Canada"}).json()["total"] == 0
    assert client.get("/api/investors/discover", params={**base, "stage": "Seed"}).json()["total"] == 1
    assert client.get("/api/investors/discover", params={**base, "min_raise": 2_000_000}).json()["total"] == 0
    assert client.get("/api/investors/discover", params={**base, "min_monthly_revenue": 50_000}).json()["total"] == 0
    assert client.get("/api/investors/discover", params={**base, "live_product": "true"}).json()["total"] == 1
    page = client.get("/api/investors/discover", params={"sort": "newest", "page_size": 1})
    assert page.status_code == 200 and len(page.json()["items"]) <= 1

    item = client.get("/api/investors/discover", params=base).json()["items"][0]
    assert "readiness_score" not in item and "ai_feedback_summary" not in item
    # The general project endpoints hide the founder's private readiness data too.
    detail = client.get(f"/api/projects/{world['id']}").json()
    assert detail["readiness_score"] is None and detail["ai_feedback_summary"] is None


def test_founder_still_sees_own_readiness(client, world, as_user):
    as_user(FOUNDER)
    assert client.get(f"/api/projects/{world['id']}").json()["readiness_score"] == 77.0


def test_discover_is_investor_only(client, world, as_user):
    as_user(FOUNDER)
    assert client.get("/api/investors/discover").status_code == 403
    assert client.get("/api/portfolio/summary").status_code == 403
    as_user(None)
    assert client.get("/api/investors/deal-flow").status_code == 401


def test_save_and_deal_flow(client, world, as_user):
    as_user(INVESTOR)
    assert client.put(f"/api/investors/saved/{world['id']}").status_code == 204
    flow = client.get("/api/investors/deal-flow").json()
    row = next(i for i in flow["items"] if i["project_id"] == world["id"])
    assert row["status"] == "saved" and row["saved"] is True
    assert client.get("/api/investors/discover", params={"saved_only": "true"}).json()["total"] >= 1
    assert client.delete(f"/api/investors/saved/{world['id']}").status_code == 204
    assert client.put("/api/investors/saved/999999999").status_code == 404


# ------------------------------------------------------------------ portfolio


def test_empty_portfolio_has_no_numbers(client, world, as_user):
    as_user(OTHER)
    s = client.get("/api/portfolio/summary").json()
    assert s["holdings"] == [] and s["value_over_time"] == []
    assert s["totals"]["total_invested"] == "0.00"
    assert s["totals"]["roi_pct"] is None and s["totals"]["multiple"] is None


def test_portfolio_ledger_math(client, world, as_user):
    as_user(INVESTOR)
    a = client.post("/api/portfolio/investments", json={
        "project_id": world["id"], "investment_date": "2024-03-15", "amount": "100000.00",
        "instrument": "safe", "ownership_pct": "2.5",
    })
    assert a.status_code == 201, a.text
    a = a.json()
    assert a["holding"]["company_name"] == TITLE                       # taken from the linked startup
    assert a["holding"]["valuation_basis"] == "cost"                   # no valuation yet -> held at cost
    aid = a["holding"]["id"]

    client.post(f"/api/portfolio/investments/{aid}/transactions",
                json={"txn_date": "2024-09-01", "type": "follow_on", "amount": "50000.10"})
    client.post(f"/api/portfolio/investments/{aid}/transactions",
                json={"txn_date": "2025-01-10", "type": "dividend", "amount": "1200.45"})
    client.post(f"/api/portfolio/investments/{aid}/transactions",
                json={"txn_date": "2025-02-10", "type": "distribution", "amount": "999.99", "status": "pending"})
    d = client.post(f"/api/portfolio/investments/{aid}/valuations",
                    json={"valuation_date": "2025-06-30", "value": "240000.00", "source": "funding_round"}).json()
    h = d["holding"]
    assert h["cost_basis"] == "150000.10"
    assert h["cash_returned"] == "1200.45"                             # pending distribution not counted
    assert h["current_value"] == "240000.00" and h["valuation_basis"] == "valuation"
    assert h["unrealized_gain"] == "89999.90"
    assert h["net_gain"] == "91200.35"

    b = client.post("/api/portfolio/investments", json={
        "company_name": "Old Co", "industry": "Robotics", "investment_date": "2023-01-05", "amount": "20000",
    }).json()
    bid = b["holding"]["id"]
    client.post(f"/api/portfolio/investments/{bid}/transactions",
                json={"txn_date": "2024-12-01", "type": "exit_proceeds", "amount": "35000"})
    client.put(f"/api/portfolio/investments/{bid}", json={"status": "exited"})

    s = client.get("/api/portfolio/summary").json()
    t = s["totals"]
    assert t["total_invested"] == "170000.10"
    assert t["cash_returned"] == "36200.45"
    assert t["income"] == "1200.45"
    assert t["current_value"] == "240000.00"
    assert t["unrealized_gain"] == "89999.90"
    assert t["net_gain"] == "106200.35"
    assert t["realized_gain"] == "16200.45"
    assert Decimal(t["realized_gain"]) + Decimal(t["unrealized_gain"]) == Decimal(t["net_gain"])
    assert t["active_count"] == 1 and t["exited_count"] == 1 and t["pending_transactions"] == 1
    assert {a["label"] for a in s["allocation_by_industry"]} == {"Fintech", "Robotics"}
    assert s["value_over_time"][-1]["invested"] == "170000.10"

    txns = client.get("/api/portfolio/transactions", params={"type": "dividend"}).json()
    assert txns["total"] == 1 and txns["items"][0]["amount"] == "1200.45"

    # The deal flow knows this startup already has a recorded investment.
    flow = client.get("/api/investors/deal-flow").json()
    assert all(i["investment_id"] in (None, aid) for i in flow["items"])


def test_portfolio_validation(client, world, as_user):
    as_user(INVESTOR)
    bad = [
        {"company_name": "X", "investment_date": "2099-01-01", "amount": "10"},
        {"company_name": "X", "investment_date": "2024-01-01", "amount": "-5"},
        {"company_name": "X", "investment_date": "2024-01-01", "amount": "10.123"},
        {"investment_date": "2024-01-01", "amount": "10"},
    ]
    for payload in bad:
        assert client.post("/api/portfolio/investments", json=payload).status_code == 422, payload


def test_other_investor_cannot_touch_records(client, world, as_user):
    as_user(INVESTOR)
    inv = client.post("/api/portfolio/investments", json={
        "company_name": "Private Co", "investment_date": "2024-01-01", "amount": "5000"}).json()
    iid = inv["holding"]["id"]
    txn_id = inv["transactions"][0]["id"]

    as_user(OTHER)
    assert client.get(f"/api/portfolio/investments/{iid}").status_code == 404
    assert client.put(f"/api/portfolio/investments/{iid}", json={"status": "exited"}).status_code == 404
    assert client.post(f"/api/portfolio/investments/{iid}/transactions",
                       json={"txn_date": "2024-02-01", "type": "dividend", "amount": "1"}).status_code == 404
    assert client.delete(f"/api/portfolio/transactions/{txn_id}").status_code == 404
    assert client.delete(f"/api/portfolio/investments/{iid}").status_code == 404
    assert client.get("/api/portfolio/summary").json()["holdings"] == []

    as_user(INVESTOR)
    # The only capital contribution can't be deleted on its own.
    assert client.delete(f"/api/portfolio/transactions/{txn_id}").status_code == 409
    assert client.delete(f"/api/portfolio/investments/{iid}").status_code == 204
