"""Signed-in users only ever see and act on their own data.

Walks a founder and an investor through intro request -> acceptance -> deal room,
with a third user checking that nothing leaks. Cleans up everything it creates.
"""
import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.auth import CurrentUser, get_current_user
from app.database import postgres as pg
from app.main import app
from app.routes import dealrooms as dealroom_routes

FOUNDER = CurrentUser(id="scope-founder", email="scope-founder@example.com", name="Scope Founder", role="FOUNDER")
INVESTOR = CurrentUser(id="scope-investor", email="scope-investor@example.com", name="Scope Investor", role="INVESTOR")
OUTSIDER = CurrentUser(id="scope-outsider", email="scope-outsider@example.com", name="Outsider", role="INVESTOR")
USERS = {u.id: u for u in (FOUNDER, INVESTOR, OUTSIDER)}


@pytest.fixture
def as_user():
    """Switch the signed-in user for subsequent requests; restores the session default after."""
    previous = app.dependency_overrides.get(get_current_user)

    def switch(user):
        async def _user():
            return user
        app.dependency_overrides[get_current_user] = _user

    yield switch
    if previous is not None:
        app.dependency_overrides[get_current_user] = previous
    else:
        app.dependency_overrides.pop(get_current_user, None)


def _purge_test_accounts(client):
    """Delete everything owned by this test's accounts (also leftovers from an interrupted run)."""
    ids = "{" + ",".join(USERS) + "}"
    projects = "(SELECT id FROM projects WHERE founder_id = 'scope-founder')"
    client.portal.call(pg.run_batch, [
        # deal_room_messages and deal_room_audit_logs cascade from deal_rooms
        ("DELETE FROM deal_rooms WHERE founder_id = ANY(%s::text[]) OR investor_id = ANY(%s::text[])", [ids, ids]),
        ("DELETE FROM project_interests WHERE founder_id = ANY(%s::text[]) OR investor_id = ANY(%s::text[])", [ids, ids]),
        (f"DELETE FROM matches WHERE project_id IN {projects} OR investor_id = ANY(%s::text[])", [ids]),
        ("DELETE FROM notifications WHERE user_id = ANY(%s::text[])", [ids]),
        ("DELETE FROM projects WHERE founder_id = 'scope-founder'", []),
        ("DELETE FROM investor_profiles WHERE user_id = ANY(%s::text[])", [ids]),
        ("DELETE FROM investor_preferences WHERE investor_id = ANY(%s::text[])", [ids]),
        ("DELETE FROM founder_profiles WHERE user_id = ANY(%s::text[])", [ids]),
    ])


def test_signed_in_users_only_see_their_own_data(client, as_user, monkeypatch):
    _purge_test_accounts(client)
    try:
        # Founder publishes a project.
        as_user(FOUNDER)
        created = client.post("/api/projects", json={
            "title": "Scoping Test Startup", "description": "Testing per-user data access.",
            "problem": "Data must not leak between accounts.", "solution": "Scope every query to the signed-in user.",
            "industry": "DevTools", "stage": "Seed", "funding_required": 250000,
            "business_model": "SaaS", "target_market": "Developers", "is_published": True,
        })
        assert created.status_code == 201
        project_id = created.json()["id"]

        # Investor requests an intro; the backend records the investor from the token.
        as_user(INVESTOR)
        requested = client.post("/api/interests", json={
            "project_id": project_id, "investor_id": "investor-001", "message": "Keen to learn more.",
        })
        assert requested.status_code == 201
        interest = requested.json()
        assert interest["investor_id"] == INVESTOR.id and interest["founder_id"] == FOUNDER.id

        # Each side sees only their own intros; an outsider sees none - query params can't widen it.
        as_user(FOUNDER)
        assert [i["id"] for i in client.get("/api/interests").json()] == [interest["id"]]
        founder_notes = client.get("/api/notifications").json()
        assert any("Intro Request" in n["title"] for n in founder_notes)
        assert client.get("/api/notifications/unread-count").json()["unread_count"] >= 1

        as_user(INVESTOR)
        assert [i["id"] for i in client.get("/api/interests").json()] == [interest["id"]]
        assert not any("Intro Request" in n["title"] for n in client.get("/api/notifications").json())

        as_user(OUTSIDER)
        assert client.get("/api/interests", params={"founder_id": FOUNDER.id}).json() == []
        assert client.get(f"/api/interests/{interest['id']}").status_code == 404
        assert all(n.get("user_id") in (None, OUTSIDER.id)
                   for n in client.get("/api/notifications", params={"user_id": FOUNDER.id}).json())
        foreign = next(n for n in founder_notes if n.get("user_id") == FOUNDER.id)
        assert client.patch(f"/api/notifications/{foreign['id']}/read").status_code == 404

        # Founder accepts: a deal room opens and is linked from the intro.
        as_user(FOUNDER)
        accepted = client.patch(f"/api/interests/{interest['id']}/status", json={"status": "accepted"})
        assert accepted.status_code == 200
        room_id = accepted.json()["deal_room"]["room_id"]
        assert room_id

        # Both parties see the room; the outsider does not, and cannot read or post.
        assert [r["id"] for r in client.get("/api/dealrooms").json()] == [room_id]
        as_user(INVESTOR)
        assert [r["id"] for r in client.get("/api/dealrooms").json()] == [room_id]
        sent = client.post(f"/api/dealrooms/{room_id}/messages", json={
            "sender_id": "founder-001", "sender_role": "FOUNDER", "sender_name": "Spoofed", "content": "Hello!",
        })
        assert sent.status_code == 201
        assert sent.json()["sender_id"] == INVESTOR.id  # identity from the token, not the body

        as_user(OUTSIDER)
        assert client.get("/api/dealrooms").json() == []
        for path in ("", "/messages", "/transcript", "/audit-logs"):
            assert client.get(f"/api/dealrooms/{room_id}{path}").status_code == 404

        as_user(None)
        assert client.get("/api/dealrooms").status_code == 401
        assert client.get(f"/api/dealrooms/{room_id}/messages").status_code == 401

        as_user(FOUNDER)
        messages = client.get(f"/api/dealrooms/{room_id}/messages").json()
        assert [m["content"] for m in messages][-1] == "Hello!"

        # Live channel: no token / non-participant are refused; a participant's messages are
        # attributed to the verified user.
        async def fake_user_from_token(token):
            return USERS[token]
        monkeypatch.setattr(dealroom_routes, "user_from_token", fake_user_from_token)

        for token, code in ((None, 4401), (OUTSIDER.id, 4403)):
            url = f"/api/dealrooms/ws/{room_id}" + (f"?token={token}" if token else "")
            with pytest.raises(WebSocketDisconnect) as refused:
                with client.websocket_connect(url) as ws:
                    ws.receive_text()
            assert refused.value.code == code

        with client.websocket_connect(f"/api/dealrooms/ws/{room_id}?token={FOUNDER.id}") as ws:
            ws.send_json({"type": "message", "data": {
                "sender_id": "investor-002", "sender_role": "INVESTOR", "sender_name": "Spoofed", "content": "Via socket",
            }})
            reply = ws.receive_json()
            assert reply["type"] == "message"
            assert reply["data"]["sender_id"] == FOUNDER.id and reply["data"]["content"] == "Via socket"

        # Matches: a founder sees only matches for their own projects.
        assert all(m["project_id"] == project_id for m in client.get("/api/matches").json())
    finally:
        _purge_test_accounts(client)
