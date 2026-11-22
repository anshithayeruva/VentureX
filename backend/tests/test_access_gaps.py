"""Regression tests for the three access gaps found in the security review.

S1  Notifications can't be read without signing in, and a signed-in user can't read
    someone else's by passing ?user_id=.
S2  Private drafts are never matched, listed in matches, or announced to investors.
S3  Deal-room files are stored privately: only the room's two participants can download
    them; the old public /uploads folder and /api/upload endpoint are gone; shared links
    must be http(s).

Everything created here is removed afterwards, also when a test fails.
"""
import shutil

import pytest

from app.core.auth import CurrentUser, get_current_user
from app.database import postgres as pg
from app.main import app
from app.schemas.dealroom import DealRoomCreateInput
from app.services.deal_room_service import DealRoomService
from app.services.dealroom_files import ROOM_FILES_DIR
from app.services.notification_service import NotificationService

FOUNDER = CurrentUser(id="gap-founder", email="gap-founder@example.com", name="Gap Founder", role="FOUNDER")
INVESTOR = CurrentUser(id="gap-investor", email="gap-investor@example.com", name="Gap Investor", role="INVESTOR")
OUTSIDER = CurrentUser(id="gap-outsider", email="gap-outsider@example.com", name="Gap Outsider", role="INVESTOR")
IDS = "{" + ",".join(u.id for u in (FOUNDER, INVESTOR, OUTSIDER)) + "}"
DRAFT_TITLE = "Gap Test Private Draft"


@pytest.fixture
def as_user():
    """Switch the signed-in user (None = signed out); restores the session default after."""
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


def _purge(client):
    rooms = client.portal.call(
        pg.fetch_all, "SELECT id FROM deal_rooms WHERE founder_id = ANY(%s::text[])", [IDS]
    )
    client.portal.call(pg.run_batch, [
        ("DELETE FROM deal_rooms WHERE founder_id = ANY(%s::text[]) OR investor_id = ANY(%s::text[])", [IDS, IDS]),
        ("DELETE FROM matches WHERE project_id IN (SELECT id FROM projects WHERE founder_id = 'gap-founder')", []),
        ("DELETE FROM notifications WHERE user_id = ANY(%s::text[]) OR title LIKE %s", [IDS, f"%{DRAFT_TITLE}%"]),
        ("DELETE FROM projects WHERE founder_id = 'gap-founder'", []),
    ])
    for r in rooms:
        shutil.rmtree(ROOM_FILES_DIR / r["id"], ignore_errors=True)


@pytest.fixture
def clean(client):
    _purge(client)
    yield
    _purge(client)


# ---------------------------------------------------------------- S1: notifications

def test_notifications_require_sign_in(client, as_user, clean):
    as_user(None)
    for path in ("/api/notifications", "/api/notifications/unread-count"):
        r = client.get(path, params={"user_id": FOUNDER.id, "role": "FOUNDER"})
        assert r.status_code == 401, (path, r.status_code)


def test_notifications_ignore_user_id_param(client, as_user, clean):
    client.portal.call(lambda: NotificationService.create_notification(
        target_role="FOUNDER", user_id=FOUNDER.id, title="Gap test: founder only", desc="private"))
    as_user(OUTSIDER)
    leaked = client.get("/api/notifications", params={"user_id": FOUNDER.id, "role": "FOUNDER"}).json()
    assert not any(n.get("user_id") == FOUNDER.id for n in leaked)
    as_user(FOUNDER)
    own = client.get("/api/notifications").json()
    assert any(n["title"] == "Gap test: founder only" for n in own)


# ---------------------------------------------------------------- S2: drafts

def _project_payload(published: bool) -> dict:
    # Fits the demo investors' criteria closely, so a published copy would be a strong match.
    return {
        "title": DRAFT_TITLE, "description": "Testing that drafts stay private.",
        "problem": "A painful problem.", "solution": "A good solution.",
        "industry": "Healthcare & AI", "stage": "Seed", "funding_required": 750000,
        "business_model": "B2B SaaS", "target_market": "Hospitals", "is_published": published,
    }


def _match_count(client, project_id):
    return client.portal.call(pg.fetch_val, "SELECT count(*) AS n FROM matches WHERE project_id = %s", [project_id])


def _draft_notifications(client):
    return client.portal.call(
        pg.fetch_val, "SELECT count(*) AS n FROM notifications WHERE title LIKE %s", [f"%{DRAFT_TITLE}%"]
    )


def test_drafts_are_not_matched_or_announced(client, as_user, clean):
    as_user(FOUNDER)
    r = client.post("/api/projects", json=_project_payload(published=False))
    assert r.status_code == 201, r.text
    pid = r.json()["id"]

    assert _match_count(client, pid) == 0
    assert _draft_notifications(client) == 0
    as_user(None)
    assert client.get("/api/matches", params={"project_id": pid}).status_code == 401
    as_user(INVESTOR)
    assert client.get("/api/matches", params={"project_id": pid}).json() == []

    # Publishing makes it matchable...
    as_user(FOUNDER)
    assert client.patch(f"/api/projects/{pid}/publish", json={"is_published": True}).status_code == 200
    assert _match_count(client, pid) > 0

    # ...and unpublishing withdraws its matches again.
    assert client.patch(f"/api/projects/{pid}/publish", json={"is_published": False}).status_code == 200
    assert _match_count(client, pid) == 0
    as_user(INVESTOR)
    assert all(m["project_id"] != pid for m in client.get("/api/matches").json())


# ---------------------------------------------------------------- S3: deal-room files

def _make_room(client) -> str:
    room = client.portal.call(DealRoomService.create_or_get_from_interest, DealRoomCreateInput(
        interest_id="gap-test-interest", project_id=1, project_title="Gap Test Room",
        founder_id=FOUNDER.id, founder_name=FOUNDER.name, founder_email=FOUNDER.email,
        investor_id=INVESTOR.id, investor_name=INVESTOR.name, investor_email=INVESTOR.email,
    ))
    return room["id"]


def test_room_files_are_private_to_participants(client, as_user, clean):
    room_id = _make_room(client)
    content = b"pilot results: rejections fell from 11% to 6%"

    as_user(FOUNDER)
    r = client.post(f"/api/dealrooms/{room_id}/files",
                    files={"file": ("pilot.txt", content, "text/plain")},
                    data={"type": "other", "name": "Pilot results"})
    assert r.status_code == 200, r.text
    doc = r.json()["shared_documents"][-1]
    assert doc["name"] == "Pilot results"
    assert doc["url"].startswith(f"/dealrooms/{room_id}/files/")
    file_path = "/api" + doc["url"]

    # Both participants can download it...
    for user in (FOUNDER, INVESTOR):
        as_user(user)
        got = client.get(file_path)
        assert got.status_code == 200 and got.content == content, user.id

    # ...nobody else can.
    as_user(OUTSIDER)
    assert client.get(file_path).status_code == 404
    as_user(None)
    assert client.get(file_path).status_code == 401

    # A made-up file id is not found.
    as_user(FOUNDER)
    assert client.get(f"/api/dealrooms/{room_id}/files/{'0' * 32}").status_code == 404

    # The file is not stored under any web-served folder.
    stored = list((ROOM_FILES_DIR / room_id).glob("*"))
    assert len(stored) == 1 and "private_uploads" in str(stored[0])


def test_room_rejects_unsupported_files_and_unsafe_links(client, as_user, clean):
    room_id = _make_room(client)
    as_user(FOUNDER)
    r = client.post(f"/api/dealrooms/{room_id}/files", files={"file": ("tool.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 400
    r = client.post(f"/api/dealrooms/{room_id}/documents", json={
        "name": "x", "url": "javascript:alert(1)", "type": "other",
        "sender_id": "x", "sender_role": "FOUNDER", "sender_name": "x"})
    assert r.status_code == 400
    r = client.post(f"/api/dealrooms/{room_id}/documents", json={
        "name": "Deck", "url": "https://example.com/deck.pdf", "type": "pitch_deck",
        "sender_id": "x", "sender_role": "FOUNDER", "sender_name": "x"})
    assert r.status_code == 200


def test_public_upload_paths_are_gone(client, as_user):
    as_user(FOUNDER)
    assert client.post("/api/upload", files={"file": ("a.txt", b"x", "text/plain")}).status_code in (404, 405)
    assert client.get("/uploads/dealroom_attachment/anything.pdf").status_code == 404
