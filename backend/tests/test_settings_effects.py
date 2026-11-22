"""Settings do what they say: strong-fit alerts, founder messaging, empty starting criteria,
founder strong-match notices, and email links from PUBLIC_APP_URL.

Everything created here is removed afterwards, also when a test fails.
"""
import pytest

from app.core.auth import CurrentUser, get_current_user
from app.database import postgres as pg
from app.main import app
from app.schemas.dealroom import DealRoomCreateInput
from app.services.deal_room_service import DealRoomService

FOUNDER = CurrentUser(id="se-founder", email="se-founder@example.com", name="SE Founder", role="FOUNDER")
INVESTOR = CurrentUser(id="se-investor", email="se-investor@example.com", name="SE Investor", role="INVESTOR")
NEWBIE = CurrentUser(id="se-newbie", email="se-newbie@example.com", name="SE Newbie", role="INVESTOR")
IDS = "{se-founder,se-investor,se-newbie}"
TITLE = "SE Test Agri Lending"

THESIS = {
    "sectors": {"industries": ["Fintech"], "business_models": ["B2B SaaS"]},
    "stages": ["Seed"],
    "check_size": {"min_check": "500000", "max_check": "2000000"},
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


def _purge(client):
    client.portal.call(pg.run_batch, [
        ("DELETE FROM deal_rooms WHERE founder_id = ANY(%s::text[]) OR investor_id = ANY(%s::text[])", [IDS, IDS]),
        ("DELETE FROM matches WHERE investor_id = ANY(%s::text[]) OR project_id IN "
         "(SELECT id FROM projects WHERE founder_id = 'se-founder')", [IDS]),
        ("DELETE FROM notifications WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_preferences WHERE investor_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_profiles WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM founder_profiles WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM projects WHERE founder_id = 'se-founder'", []),
        ("DELETE FROM app_users WHERE id = ANY(%s::text[])", [IDS]),
    ])


@pytest.fixture(scope="module")
def project(client):
    _purge(client)
    for u in (FOUNDER, INVESTOR, NEWBIE):
        client.portal.call(pg.upsert, "app_users", {"id": u.id, "email": u.email, "name": u.name, "role": u.role}, ["id"])
    row = client.portal.call(pg.insert, "projects", {
        "founder_id": FOUNDER.id, "title": TITLE, "description": "Credit for farmers", "problem": "No credit",
        "solution": "Crop-backed loans", "industry": "Fintech", "stage": "Seed", "funding_required": 1000000,
        "business_model": "B2B SaaS", "target_market": "Farmer co-operatives", "is_published": True,
    })
    yield row
    _purge(client)


def _notifications(client, user_id):
    return client.portal.call(pg.fetch_all, "SELECT title FROM notifications WHERE user_id = %s", [user_id])


def _set_investor_settings(client, auto_notify: bool, messaging: bool):
    r = client.put("/api/investors/settings", json={
        "auto_notify_high_conviction": auto_notify, "weekly_dealflow_summary": False,
        "direct_founder_messaging": messaging,
    })
    assert r.status_code == 200, r.text


def test_strong_fit_alert_respects_investor_setting(client, project, as_user):
    as_user(INVESTOR)
    _set_investor_settings(client, auto_notify=False, messaging=True)
    assert client.put("/api/investors/preferences", json={"thesis": THESIS}).status_code == 200
    assert not any(TITLE in n["title"] for n in _notifications(client, INVESTOR.id))

    _set_investor_settings(client, auto_notify=True, messaging=True)
    assert client.put("/api/investors/preferences", json={"thesis": THESIS}).status_code == 200
    assert any(TITLE in n["title"] for n in _notifications(client, INVESTOR.id))


def test_founder_hears_about_strong_fit_once(client, project, as_user):
    as_user(INVESTOR)
    client.put("/api/investors/preferences", json={"thesis": THESIS})
    client.put("/api/investors/preferences", json={"thesis": THESIS})  # recompute: no duplicate
    mine = [n for n in _notifications(client, FOUNDER.id) if n["title"].startswith("Strong investor fit")]
    assert len(mine) == 1 and TITLE in mine[0]["title"]


def test_founder_messaging_follows_investor_setting(client, project, as_user):
    room = client.portal.call(DealRoomService.create_or_get_from_interest, DealRoomCreateInput(
        interest_id="se-test-interest", project_id=project["id"], project_title=TITLE,
        founder_id=FOUNDER.id, founder_name=FOUNDER.name, founder_email=FOUNDER.email,
        investor_id=INVESTOR.id, investor_name=INVESTOR.name, investor_email=INVESTOR.email,
    ))
    msg = {"content": "Hello", "sender_id": "x", "sender_role": "x", "sender_name": "x"}

    as_user(INVESTOR)
    _set_investor_settings(client, auto_notify=True, messaging=False)
    as_user(FOUNDER)
    assert client.get(f"/api/dealrooms/{room['id']}").json()["founder_messaging_open"] is False
    blocked = client.post(f"/api/dealrooms/{room['id']}/messages", json=msg)
    assert blocked.status_code == 403 and "turned off messages" in blocked.json()["detail"]

    as_user(INVESTOR)  # the investor can still write
    assert client.post(f"/api/dealrooms/{room['id']}/messages", json=msg).status_code == 201
    _set_investor_settings(client, auto_notify=True, messaging=True)
    as_user(FOUNDER)
    assert client.post(f"/api/dealrooms/{room['id']}/messages", json=msg).status_code == 201


def test_new_investor_starts_without_criteria(client, project, as_user):
    as_user(NEWBIE)
    prefs = client.get("/api/investors/preferences").json()
    assert prefs["preferred_industries"] == [] and prefs["preferred_stages"] == []
    assert prefs["thesis"]["sectors"]["industries"] == [] and prefs["thesis"]["stages"] == []

    page = client.get("/api/investors/discover", params={"q": TITLE}).json()
    assert page["criteria_set"] is False
    assert page["items"] and page["items"][0]["match_score"] is None   # no made-up fit score

    client.put("/api/investors/preferences", json={"thesis": THESIS})
    page = client.get("/api/investors/discover", params={"q": TITLE}).json()
    assert page["criteria_set"] is True and page["items"][0]["match_score"] is not None


def test_email_links_use_public_app_url(monkeypatch):
    from app.core.config import settings
    from app.services.email_service import EmailService

    sent = {}
    monkeypatch.setattr(settings, "PUBLIC_APP_URL", "https://venturex.example/")
    monkeypatch.setattr(EmailService, "_send_email_raw", classmethod(
        lambda cls, to, subject, html, text=None: sent.update(html=html, text=text) or {}))
    EmailService.send_strong_match_email("f@example.com", "Asha", "ABC Capital", "KisanPay", 93.4)
    assert "https://venturex.example/founder/dashboard?tab=investors" in sent["text"]
    assert "localhost" not in sent["html"]
