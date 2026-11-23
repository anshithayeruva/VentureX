"""Teams: co-founders invited to a startup get full access except managing the team; investors
form firms with partners who see a shared pipeline; invitations are for one email and expire.

Everything created here is removed afterwards, also when a test fails.
"""
import pytest

from app.core.auth import CurrentUser, get_current_user
from app.database import postgres as pg
from app.main import app


def _u(uid, role, verified=True):
    return CurrentUser(id=uid, email=f"{uid}@example.com", name=uid.replace("-", " ").title(), role=role,
                       email_verified=verified)


OWNER = _u("tm-owner", "FOUNDER")
COFOUNDER = _u("tm-cofounder", "FOUNDER")
OUTSIDER = _u("tm-outsider", "FOUNDER")
NEWBIE = _u("tm-newbie", None)                    # signed up, no workspace chosen yet
UNVERIFIED = _u("tm-unverified", "FOUNDER", verified=False)
LEAD = _u("tm-lead", "INVESTOR")
PARTNER = _u("tm-partner", "INVESTOR")
RIVAL = _u("tm-rival", "INVESTOR")
USERS = (OWNER, COFOUNDER, OUTSIDER, NEWBIE, UNVERIFIED, LEAD, PARTNER, RIVAL)
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
        ("DELETE FROM team_invitations WHERE invited_by = ANY(%s::text[]) OR lower(email) LIKE 'tm-%%'", [IDS]),
        ("DELETE FROM firms WHERE created_by = ANY(%s::text[])", [IDS]),
        ("DELETE FROM firm_members WHERE user_id = ANY(%s::text[])", [IDS]),
        (f"DELETE FROM deal_rooms WHERE project_id IN ({owned})", [IDS]),
        (f"DELETE FROM project_interests WHERE project_id IN ({owned})", [IDS]),
        (f"DELETE FROM matches WHERE project_id IN ({owned})", [IDS]),
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
    for u in (LEAD, PARTNER, RIVAL):
        client.portal.call(pg.upsert, "investor_profiles", {"user_id": u.id, "name": u.name,
                                                             "verification_status": "verified"}, ["user_id"])
    project = client.portal.call(pg.insert, "projects", {
        "founder_id": OWNER.id, "title": "TM Draft Startup", "description": "Payments for clinics",
        "problem": "Slow settlements", "solution": "Same-day payouts", "industry": "Fintech", "stage": "Seed",
        "funding_required": 5000000, "business_model": "B2B SaaS", "target_market": "Clinics", "is_published": False,
    })
    yield {"project": project}
    _purge(client)


def _invite_id(client, user):
    async def _get():
        return await pg.fetch_val("SELECT id FROM team_invitations WHERE lower(email) = %s AND status = 'pending' "
                                  "ORDER BY created_at DESC LIMIT 1", [user.email])
    return client.portal.call(_get)


# ------------------------------------------------------------------ startups


def test_cofounder_invitation_and_access(client, world, as_user):
    pid = world["project"]["id"]
    as_user(OUTSIDER)
    assert client.post(f"/api/projects/{pid}/team/invitations", json={"email": COFOUNDER.email}).status_code == 403
    as_user(OWNER)
    assert client.post(f"/api/projects/{pid}/team/invitations", json={"email": "nope"}).status_code == 422
    res = client.post(f"/api/projects/{pid}/team/invitations", json={"email": COFOUNDER.email.upper()})
    assert res.status_code == 201, res.text
    assert client.post(f"/api/projects/{pid}/team/invitations", json={"email": OWNER.email}).status_code == 409
    team = client.get(f"/api/projects/{pid}/team").json()
    assert team["can_manage"] and [i["email"] for i in team["invitations"]] == [COFOUNDER.email]

    invite = _invite_id(client, COFOUNDER)
    # Before joining, the draft is private.
    as_user(COFOUNDER)
    assert client.get(f"/api/projects/{pid}").status_code == 404
    mine = client.get("/api/invitations").json()
    assert [i["id"] for i in mine] == [invite] and mine[0]["target_name"] == "TM Draft Startup"
    assert any("invited you" in n["title"] for n in client.get("/api/notifications").json())
    # Someone else can see the invite exists, masked, but not accept it.
    as_user(OUTSIDER)
    other = client.get(f"/api/invitations/{invite}").json()
    assert other["for_you"] is False and "•" in other["email"]
    assert client.post(f"/api/invitations/{invite}/accept").status_code == 404
    # The right person joins.
    as_user(COFOUNDER)
    res = client.post(f"/api/invitations/{invite}/accept")
    assert res.status_code == 200 and res.json()["project_id"] == pid
    assert client.post(f"/api/invitations/{invite}/accept").status_code == 409

    # Co-founder: sees and edits the draft, its private readiness, is not the owner, can't manage the team.
    project = client.get(f"/api/projects/{pid}").json()
    assert project["is_owner"] is False and "readiness_score" in project
    assert pid in [p["id"] for p in client.get("/api/projects", params={"founder_only": "true"}).json()]
    assert client.put(f"/api/projects/{pid}", json={"tagline": "Edited by the co-founder"}).status_code == 200
    assert client.get(f"/api/projects/{pid}/readiness").status_code == 200
    team = client.get(f"/api/projects/{pid}/team").json()
    assert {m["user_id"] for m in team["members"]} == {OWNER.id, COFOUNDER.id} and team["can_manage"] is False
    assert client.post(f"/api/projects/{pid}/team/invitations", json={"email": OUTSIDER.email}).status_code == 403
    assert client.delete(f"/api/projects/{pid}/team/members/{OWNER.id}").status_code == 422

    as_user(OWNER)
    assert any("joined your team" in n["title"] for n in client.get("/api/notifications").json())


def test_cofounder_handles_intros_and_deal_room(client, world, as_user):
    pid = world["project"]["id"]
    client.portal.call(pg.execute, "UPDATE projects SET is_published = TRUE WHERE id = %s", [pid])
    as_user(LEAD)
    res = client.post("/api/interests", json={"project_id": pid, "message": "Keen to talk."})
    assert res.status_code == 201, res.text
    interest_id = res.json()["id"]
    as_user(COFOUNDER)
    assert any("Intro Request" in n["title"] for n in client.get("/api/notifications").json())
    assert interest_id in [i["id"] for i in client.get("/api/interests").json()]
    res = client.patch(f"/api/interests/{interest_id}/status", json={"status": "accepted"})
    assert res.status_code == 200, res.text
    room_id = res.json()["deal_room"]["room_id"]
    assert client.get(f"/api/dealrooms/{room_id}").status_code == 200
    assert room_id in [r["id"] for r in client.get("/api/dealrooms").json()]
    msg = client.post(f"/api/dealrooms/{room_id}/messages", json={
        "content": "Hello from the co-founder", "sender_id": COFOUNDER.id, "sender_role": "FOUNDER", "sender_name": COFOUNDER.name})
    assert msg.status_code in (200, 201), msg.text
    as_user(OUTSIDER)
    assert client.get(f"/api/dealrooms/{room_id}").status_code in (403, 404)


def test_leaving_and_removal(client, world, as_user):
    pid = world["project"]["id"]
    as_user(COFOUNDER)
    assert client.delete(f"/api/projects/{pid}/team/members/{COFOUNDER.id}").status_code == 204
    assert client.put(f"/api/projects/{pid}", json={"tagline": "Should fail"}).status_code == 403
    assert client.get(f"/api/projects/{pid}/team").status_code == 404
    # Re-invite, then the owner removes them.
    as_user(OWNER)
    client.post(f"/api/projects/{pid}/team/invitations", json={"email": COFOUNDER.email})
    as_user(COFOUNDER)
    assert client.post(f"/api/invitations/{_invite_id(client, COFOUNDER)}/accept").status_code == 200
    as_user(OWNER)
    assert client.delete(f"/api/projects/{pid}/team/members/{COFOUNDER.id}").status_code == 204
    as_user(COFOUNDER)
    assert pid not in [p["id"] for p in client.get("/api/projects", params={"founder_only": "true"}).json()]


def test_invitation_rules(client, world, as_user):
    pid = world["project"]["id"]
    as_user(OWNER)
    for u in (UNVERIFIED, NEWBIE, LEAD):
        assert client.post(f"/api/projects/{pid}/team/invitations", json={"email": u.email}).status_code == 201
    as_user(UNVERIFIED)
    assert client.post(f"/api/invitations/{_invite_id(client, UNVERIFIED)}/accept").status_code == 403
    as_user(LEAD)
    res = client.post(f"/api/invitations/{_invite_id(client, LEAD)}/accept")
    assert res.status_code == 409 and res.json()["detail"]["code"] == "wrong_role"
    # A brand-new account becomes a founder by accepting.
    as_user(NEWBIE)
    assert client.post(f"/api/invitations/{_invite_id(client, NEWBIE)}/accept").status_code == 200
    role = client.portal.call(pg.fetch_val, "SELECT role FROM app_users WHERE id = %s", [NEWBIE.id])
    assert role == "FOUNDER"
    # Expired and revoked invitations.
    as_user(OWNER)
    client.post(f"/api/projects/{pid}/team/invitations", json={"email": OUTSIDER.email})
    inv = _invite_id(client, OUTSIDER)
    client.portal.call(pg.execute, "UPDATE team_invitations SET expires_at = now() - interval '1 day' WHERE id = %s", [inv])
    as_user(OUTSIDER)
    assert client.post(f"/api/invitations/{inv}/accept").status_code == 410
    as_user(OWNER)
    client.post(f"/api/projects/{pid}/team/invitations", json={"email": OUTSIDER.email})
    inv = _invite_id(client, OUTSIDER)
    assert client.delete(f"/api/invitations/{inv}").status_code == 204
    as_user(OUTSIDER)
    assert client.post(f"/api/invitations/{inv}/accept").status_code == 409
    assert client.delete(f"/api/invitations/{inv}").status_code == 404


# ------------------------------------------------------------------ firms


def test_firm_partners_and_pipeline(client, world, as_user):
    pid = world["project"]["id"]
    as_user(LEAD)
    assert client.get("/api/firms/mine").json()["firm"] is None
    res = client.post("/api/firms", json={"name": "TM Capital", "website": "tm-capital.example"})
    assert res.status_code == 201 and res.json()["is_admin"] is True
    assert client.post("/api/firms", json={"name": "Second"}).status_code == 409
    assert client.post("/api/firms/mine/invitations", json={"email": PARTNER.email}).status_code == 201

    as_user(PARTNER)
    assert client.post(f"/api/invitations/{_invite_id(client, PARTNER)}/accept").status_code == 200
    firm = client.get("/api/firms/mine").json()
    assert firm["firm"]["name"] == "TM Capital" and firm["is_admin"] is False
    assert {m["user_id"] for m in firm["members"]} == {LEAD.id, PARTNER.id}
    assert client.post("/api/firms/mine/invitations", json={"email": RIVAL.email}).status_code == 403
    profile_firm = client.portal.call(pg.fetch_val, "SELECT firm FROM investor_profiles WHERE user_id = %s", [PARTNER.id])
    assert profile_firm == "TM Capital"

    # The partner sees the lead's intro in the firm pipeline and on Discover.
    pipeline = client.get("/api/firms/mine/pipeline").json()["items"]
    assert any(r["project_id"] == pid and r["member_id"] == LEAD.id for r in pipeline)
    activity = client.get("/api/firms/mine/activity", params={"project_id": pid}).json()
    assert activity and activity[0]["name"] == LEAD.name
    hits = client.get("/api/investors/discover", params={"q": "TM Draft"}).json()["items"]
    assert next(i for i in hits if i["id"] == pid)["partners"][0]["name"] == LEAD.name

    # Founders see partners on the investor's profile.
    as_user(OWNER)
    prof = client.get(f"/api/founders/investors/{LEAD.id}").json()
    assert [p["name"] for p in prof["partners"]] == [PARTNER.name]

    # Someone in another firm can't join without leaving.
    as_user(RIVAL)
    client.post("/api/firms", json={"name": "TM Rival Fund"})
    as_user(LEAD)
    client.post("/api/firms/mine/invitations", json={"email": RIVAL.email})
    as_user(RIVAL)
    res = client.post(f"/api/invitations/{_invite_id(client, RIVAL)}/accept")
    assert res.status_code == 409 and res.json()["detail"]["code"] == "already_in_firm"


def test_firm_admins(client, world, as_user):
    as_user(LEAD)
    res = client.delete(f"/api/firms/mine/members/{LEAD.id}")
    assert res.status_code == 422 and res.json()["detail"]["code"] == "last_admin"
    assert client.put(f"/api/firms/mine/members/{PARTNER.id}/role", json={"role": "admin"}).status_code == 200
    assert client.delete(f"/api/firms/mine/members/{LEAD.id}").status_code == 204
    assert client.get("/api/firms/mine").json()["firm"] is None
    as_user(PARTNER)
    firm = client.get("/api/firms/mine").json()
    assert firm["is_admin"] and [m["user_id"] for m in firm["members"]] == [PARTNER.id]
    # The last member leaving removes the firm.
    assert client.delete(f"/api/firms/mine/members/{PARTNER.id}").status_code == 204
    assert client.get("/api/firms/mine").json()["firm"] is None
