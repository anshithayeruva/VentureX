"""Profiles and settings: founder and investor profile updates with validation, settings that persist,
notification preferences that the notification service obeys, and privacy settings that change what
others see. Everything created here is removed afterwards."""
import pytest

from app.core.auth import CurrentUser, get_current_user
from app.database import postgres as pg
from app.main import app
from app.services.notification_service import NotificationService

FOUNDER = CurrentUser(id="ps-founder", email="ps-founder@example.com", name="PS Founder", role="FOUNDER", email_verified=True)
INVESTOR = CurrentUser(id="ps-investor", email="ps-investor@example.com", name="PS Investor", role="INVESTOR", email_verified=True)
USERS = (FOUNDER, INVESTOR)
IDS = "{ps-founder,ps-investor}"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


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
        ("DELETE FROM notifications WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM investor_profiles WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM founder_profiles WHERE user_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM projects WHERE founder_id = ANY(%s::text[])", [IDS]),
        ("DELETE FROM app_users WHERE id = ANY(%s::text[])", [IDS]),
    ])


@pytest.fixture(scope="module")
def world(client):
    _purge(client)
    for u in USERS:
        client.portal.call(pg.upsert, "app_users", {"id": u.id, "email": u.email, "name": u.name, "role": u.role}, ["id"])
    project = client.portal.call(pg.insert, "projects", {
        "founder_id": FOUNDER.id, "title": "PS Clinic Books", "description": "Books for clinics", "problem": "Messy books",
        "solution": "Automatic books", "industry": "Fintech", "stage": "Seed", "funding_required": 5000000,
        "business_model": "B2B SaaS", "target_market": "Clinics", "is_published": True, "monthly_revenue": 300000,
        "customer_count": 40,
    })
    yield {"project": project}
    _purge(client)


FOUNDER_PROFILE = {
    "first_name": "Priya", "last_name": "Sharma", "phone": "+91 98765 43210", "location": "Pune",
    "headline": "Building finance tools for clinics", "bio": "Ex-hospital CFO.", "linkedin": "linkedin.com/in/priya",
    "website": "priya.example", "expertise": ["Healthcare finance", "B2B sales"], "designation": "CEO",
    "experience": "10 years in hospital finance", "skills": ["Finance", "Sales", "finance"], "previous_startups": "MedLedger (acquired)",
    "company": "PS Clinic Books", "startup_role": "CEO and co-founder", "background": "Chartered accountant",
}


def test_founder_profile_round_trip(client, world, as_user):
    as_user(FOUNDER)
    res = client.put("/api/me/profile", json=FOUNDER_PROFILE)
    assert res.status_code == 200, res.text
    body = client.get("/api/me/profile").json()
    assert body["first_name"] == "Priya" and body["email"] == FOUNDER.email
    assert body["linkedin"] == "https://linkedin.com/in/priya" and body["skills"] == ["Finance", "Sales"]
    assert body["startups"][0]["title"] == "PS Clinic Books" and body["startups"][0]["is_owner"] is True
    name = client.portal.call(pg.fetch_val, "SELECT name FROM app_users WHERE id = %s", [FOUNDER.id])
    assert name == "Priya Sharma"


@pytest.mark.parametrize("bad", [{"phone": "call me"}, {"linkedin": "https://example.com/priya"},
                                 {"website": "not a site"}, {"expertise": [f"x{i}" for i in range(16)]},
                                 {"first_name": "x" * 61}])
def test_profile_validation(client, world, as_user, bad):
    as_user(FOUNDER)
    res = client.put("/api/me/profile", json={**FOUNDER_PROFILE, **bad})
    assert res.status_code == 422, res.text


def test_investor_profile_and_photo(client, world, as_user):
    as_user(INVESTOR)
    res = client.put("/api/me/profile", json={
        "first_name": "Arjun", "last_name": "Mehta", "firm": "PS Ventures", "title": "Partner", "investor_type": "vc",
        "linkedin": "linkedin.com/in/arjun", "website": "psventures.example", "experience": "40 seed investments",
        "focus": "Healthcare and fintech", "expertise": ["Go-to-market"], "headline": "Seed investor"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["firm"] == "PS Ventures" and body["investor_type"] == "vc" and body["verification_status"] == "unverified"
    assert client.put("/api/me/profile", json={"investor_type": "billionaire"}).status_code == 422
    # Photo: images only, readable by signed-in users.
    bad = client.post("/api/me/profile/photo", files={"file": ("x.png", b"not an image", "image/png")})
    assert bad.status_code == 415
    ok = client.post("/api/me/profile/photo", files={"file": ("me.png", PNG, "image/png")})
    assert ok.status_code == 200 and ok.json()["has_photo"] is True
    as_user(FOUNDER)
    assert client.get(f"/api/users/{INVESTOR.id}/photo").status_code == 200
    as_user(INVESTOR)
    assert client.delete("/api/me/profile/photo").json()["has_photo"] is False


def test_settings_persist_and_validate(client, world, as_user):
    as_user(FOUNDER)
    current = client.get("/api/me/settings").json()
    assert set(current["categories"]) == {"investor_interest", "connections", "project_status", "ai_analysis"}
    s = current["settings"]
    s["notifications"]["categories"]["investor_interest"] = {"in_app": False, "email": False}
    s["privacy"]["share_traction"] = False
    s["privacy"]["default_private"] = False
    s["preferences"]["time_zone"] = "Europe/London"
    s["preferences"]["date_format"] = "YYYY-MM-DD"
    assert client.put("/api/me/settings", json=s).status_code == 200
    again = client.get("/api/me/settings").json()["settings"]
    assert again["notifications"]["categories"]["investor_interest"]["in_app"] is False
    assert again["preferences"]["time_zone"] == "Europe/London" and again["privacy"]["share_traction"] is False
    bad = {**again, "preferences": {**again["preferences"], "time_zone": "Mars/Base"}}
    assert client.put("/api/me/settings", json=bad).status_code == 422
    bad = {**again, "privacy": {**again["privacy"], "profile_visibility": "everyone"}}
    assert client.put("/api/me/settings", json=bad).status_code == 422


def test_notification_preferences_are_obeyed(client, world, as_user):
    async def send(category):
        return await NotificationService.create_notification(
            category=category, target_role="FOUNDER", user_id=FOUNDER.id, title=f"PS test {category}", desc="x")
    assert client.portal.call(send, "investor_interest") == {}           # switched off above
    assert client.portal.call(send, "connections")["id"]                 # still on
    assert client.portal.call(send, "account")["id"]                     # always delivered
    as_user(FOUNDER)
    titles = [n["title"] for n in client.get("/api/notifications").json()]
    assert "PS test investor_interest" not in titles and "PS test connections" in titles


def test_privacy_changes_what_investors_see(client, world, as_user):
    pid = world["project"]["id"]
    # Traction is private (set above): investors don't see the figures.
    as_user(INVESTOR)
    project = client.get(f"/api/projects/{pid}").json()
    assert project["monthly_revenue"] is None and project["customer_count"] is None
    # Profile visibility "connected": not shown before an accepted intro.
    assert client.get(f"/api/projects/{pid}/founders").json() == []
    client.portal.call(pg.insert, "project_interests", {
        "id": f"intro-{pid}-{INVESTOR.id}", "project_id": pid, "investor_id": INVESTOR.id, "founder_id": FOUNDER.id,
        "status": "accepted", "initiated_by": "investor"})
    founders = client.get(f"/api/projects/{pid}/founders").json()
    assert founders[0]["name"] == "Priya Sharma" and founders[0]["email"] == FOUNDER.email
    assert founders[0]["phone"] is None                                  # show_phone is off by default
    # The founder hides their email: connected investors no longer get it.
    as_user(FOUNDER)
    s = client.get("/api/me/settings").json()["settings"]
    s["privacy"]["show_email"] = False
    client.put("/api/me/settings", json=s)
    as_user(INVESTOR)
    assert client.get(f"/api/projects/{pid}/founders").json()[0]["email"] is None


def test_default_private_setting_applies_to_new_projects(client, world, as_user):
    as_user(FOUNDER)   # default_private was switched off above
    res = client.post("/api/projects", json={
        "title": "PS Second Startup", "description": "Second startup here", "problem": "A real problem",
        "solution": "A real solution", "industry": "Fintech", "stage": "Seed", "funding_required": 100000,
        "business_model": "B2B SaaS", "target_market": "Clinics"})
    assert res.status_code == 201, res.text
    assert res.json()["is_published"] is True


def test_account_and_deletion_request(client, world, as_user):
    as_user(INVESTOR)
    acct = client.get("/api/me/account").json()
    assert acct["email"] == INVESTOR.email and acct["status"] == "active" and "password" not in str(acct).lower()
    assert client.post("/api/me/deletion-request", json={"reason": "Testing"}).json()["status"] == "deletion_requested"
    assert client.delete("/api/me/deletion-request").json()["status"] == "active"
