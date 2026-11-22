"""Team / IP facts and their scoring; portfolio CSV export and all-or-nothing import.

Everything created here is removed afterwards, also when a test fails.
"""
import csv
import io

import pytest

from app.core.auth import CurrentUser, get_current_user
from app.database import postgres as pg
from app.main import app

FOUNDER = CurrentUser(id="tc-founder", email="tc-founder@example.com", name="TC Founder", role="FOUNDER")
INVESTOR = CurrentUser(id="tc-investor", email="tc-investor@example.com", name="TC Investor", role="INVESTOR")
OTHER = CurrentUser(id="tc-other", email="tc-other@example.com", name="TC Other", role="INVESTOR")
IDS = "{tc-founder,tc-investor,tc-other}"
TITLE = "TC Test Dairy Robotics"


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
        ("DELETE FROM matches WHERE investor_id = ANY(%s::text[]) OR project_id IN "
         "(SELECT id FROM projects WHERE founder_id = 'tc-founder')", [IDS]),
        ("DELETE FROM notifications WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_preferences WHERE investor_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_profiles WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM founder_profiles WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM projects WHERE founder_id = 'tc-founder'", []),
        ("DELETE FROM app_users WHERE id = ANY(%s::text[])", [IDS]),
    ])


@pytest.fixture(scope="module")
def project(client):
    _purge(client)
    for u in (FOUNDER, INVESTOR, OTHER):
        client.portal.call(pg.upsert, "app_users", {"id": u.id, "email": u.email, "name": u.name, "role": u.role}, ["id"])
    row = client.portal.call(pg.insert, "projects", {
        "founder_id": FOUNDER.id, "title": TITLE, "description": "Robots for dairies", "problem": "Labour",
        "solution": "Milking robots", "industry": "Robotics", "stage": "Seed", "funding_required": 1500000,
        "business_model": "B2B SaaS", "target_market": "Dairy co-operatives", "is_published": True,
    })
    yield row
    _purge(client)


def _fit(client, thesis):
    assert client.put("/api/investors/preferences", json={"thesis": thesis}).status_code == 200
    items = client.get("/api/investors/discover", params={"q": TITLE}).json()["items"]
    return items[0] if items else None


BASE = {"sectors": {"industries": ["Robotics"]}, "stages": ["Seed"]}


def test_founder_reports_team_and_investor_scores_it(client, project, as_user):
    as_user(FOUNDER)
    r = client.put(f"/api/projects/{project['id']}", json={
        "team_size": 6, "technical_founder": True, "repeat_founder": False, "ip_protected": True,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["team_size"] == 6 and body["technical_founder"] is True and body["repeat_founder"] is False

    as_user(INVESTOR)
    item = _fit(client, {**BASE, "team": {"technical_founder": "required", "min_team_size": 4},
                         "additional": {"ip_protection": "preferred"}})
    team = next(x for x in item["reasons"] if x["category"] == "Team")
    assert "technical founder" in team["explanation"] and "protected IP" in team["explanation"]
    assert item["technical_founder"] is True and item["team_size"] == 6       # public facts in Discover

    # A required fact the founder said "no" to rules the startup out.
    assert _fit(client, {**BASE, "team": {"repeat_founder": "required"}})["match_score"] is None
    # Not reported (full-time unknown) lowers the score but never excludes.
    unknown = _fit(client, {**BASE, "team": {"full_time_team": "required"}})
    assert unknown["match_score"] is not None
    assert "not reported" in next(x for x in unknown["reasons"] if x["category"] == "Team")["explanation"]

    # Founders can clear a fact back to "not specified".
    as_user(FOUNDER)
    cleared = client.put(f"/api/projects/{project['id']}", json={"technical_founder": None}).json()
    assert cleared["technical_founder"] is None


CSV_OK = (
    "company_name,investment_date,amount,instrument,industry,current_value,valuation_date\n"
    "Kisan Ledger,15/03/2024,\"25,00,000\",Equity,Fintech,\"41,00,000\",30/09/2025\n"
    '"=HYPERLINK(""x"")",2024-06-01,"₹5,00,000",SAFE,Robotics,,\n'
)
CSV_BAD = (
    "company_name,investment_date,amount\n"
    "Good Co,01/01/2024,100000\n"
    "Future Co,01/01/2099,100000\n"
    "No Amount Co,01/01/2024,\n"
)


def _upload(client, text, dry_run):
    return client.post(f"/api/portfolio/import?dry_run={'true' if dry_run else 'false'}",
                       files={"file": ("p.csv", text.encode("utf-8"), "text/csv")})


def test_csv_import_is_all_or_nothing(client, project, as_user):
    as_user(INVESTOR)
    bad = _upload(client, CSV_BAD, dry_run=False).json()
    assert bad["imported"] == 0 and [e["row"] for e in bad["errors"]] == [3, 4]
    assert client.get("/api/portfolio/summary").json()["holdings"] == []      # nothing saved

    check = _upload(client, CSV_OK, dry_run=True).json()
    assert check == {"valid_rows": 2, "errors": [], "imported": 0}
    assert client.get("/api/portfolio/summary").json()["holdings"] == []      # dry run saves nothing

    done = _upload(client, CSV_OK, dry_run=False).json()
    assert done["imported"] == 2
    t = client.get("/api/portfolio/summary").json()["totals"]
    assert t["total_invested"] == "3000000.00"
    assert t["current_value"] == "4600000.00"   # 41 L valuation + 5 L held at cost
    assert t["held_at_cost_count"] == 1


def test_csv_export_is_own_and_safe(client, project, as_user):
    as_user(INVESTOR)
    holdings = client.get("/api/portfolio/export/holdings.csv")
    assert holdings.status_code == 200 and holdings.headers["content-type"].startswith("text/csv")
    rows = list(csv.DictReader(io.StringIO(holdings.text.lstrip("﻿"))))
    names = {r["company_name"] for r in rows}
    assert "Kisan Ledger" in names
    assert "'=HYPERLINK(\"x\")" in names          # formula neutralised for spreadsheets
    tx = client.get("/api/portfolio/export/transactions.csv").text
    assert "investment" in tx and "2500000.00" in tx

    template = client.get("/api/portfolio/import/template.csv").text
    assert template.lstrip("﻿").startswith("company_name,investment_date,amount")

    as_user(OTHER)
    other_rows = list(csv.DictReader(io.StringIO(client.get("/api/portfolio/export/holdings.csv").text.lstrip("﻿"))))
    assert other_rows == []                        # another investor sees none of it

    as_user(FOUNDER)
    assert client.get("/api/portfolio/export/holdings.csv").status_code == 403
