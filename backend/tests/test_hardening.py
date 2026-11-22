"""Regression tests for the second round of security hardening (S4–S12 in the review).

* Matches, investor profiles, profile/criteria/settings reads and project materials need
  sign-in; there is no anonymous fallback to demo accounts.
* Demo projects get no special access; demo seeding only happens when allowed.
* The open "recalculate all matches" endpoint is gone; expensive actions are rate limited.
* Errors don't leak internal details; tokens are redacted from logs; security headers are set.
"""
import logging

import pytest
from fastapi import HTTPException

from app.core import rate_limit
from app.core.auth import CurrentUser, get_current_user
from app.core.config import Settings
from app.database import postgres as pg
from app.main import _RedactTokens, app

FOUNDER = CurrentUser(id="hard-founder", email="hard-founder@example.com", name="Hard Founder", role="FOUNDER")
INVESTOR = CurrentUser(id="hard-investor", email="hard-investor@example.com", name="Hard Investor", role="INVESTOR")


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
    else:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def clean(client):
    def purge():
        client.portal.call(pg.run_batch, [
            ("DELETE FROM matches WHERE project_id IN (SELECT id FROM projects WHERE founder_id = 'hard-founder')", []),
            ("DELETE FROM notifications WHERE user_id IN ('hard-founder', 'hard-investor')", []),
            ("DELETE FROM projects WHERE founder_id = 'hard-founder'", []),
            ("DELETE FROM investor_preferences WHERE investor_id = 'hard-investor'", []),
            ("DELETE FROM investor_profiles WHERE user_id = 'hard-investor'", []),
            ("DELETE FROM founder_profiles WHERE user_id = 'hard-founder'", []),
        ])
    purge()
    yield
    purge()


# ---------------------------------------------------------------- sign-in required

@pytest.mark.parametrize("path", [
    "/api/matches",
    "/api/investors",
    "/api/investors/profile",
    "/api/investors/preferences",
    "/api/investors/settings",
    "/api/founders/profile",
    "/api/founders/settings",
])
def test_reads_require_sign_in(client, as_user, path):
    as_user(None)
    assert client.get(path).status_code == 401, path


def test_profile_reads_require_the_right_role(client, as_user, clean):
    as_user(FOUNDER)
    assert client.get("/api/investors/profile").status_code == 403
    assert client.get("/api/founders/profile").status_code == 200
    as_user(INVESTOR)
    assert client.get("/api/founders/settings").status_code == 403
    assert client.get("/api/investors/settings").status_code == 200


def test_published_materials_need_sign_in(client, as_user, clean):
    as_user(FOUNDER)
    pid = client.post("/api/projects", json={
        "title": "Hardening Test Startup", "description": "Testing materials access.",
        "problem": "A real problem.", "solution": "A real solution.", "industry": "Fintech",
        "stage": "Seed", "funding_required": 100000, "business_model": "B2B SaaS",
        "target_market": "Banks", "is_published": True,
    }).json()["id"]
    up = client.post(f"/api/projects/{pid}/documents", data={"category": "pitch_deck"},
                     files={"file": ("deck.md", b"# Deck", "text/markdown")})
    assert up.status_code == 201, up.text
    doc_id = up.json()["id"]

    as_user(None)
    assert client.get(f"/api/projects/{pid}").status_code == 200  # the listing itself stays public
    assert client.get(f"/api/projects/{pid}/documents").status_code == 401
    assert client.get(f"/api/projects/{pid}/documents/{doc_id}/file").status_code == 401
    as_user(INVESTOR)
    assert client.get(f"/api/projects/{pid}/documents/{doc_id}/file").status_code == 200


def test_demo_projects_get_no_special_access(client, as_user):
    demo_draft = client.portal.call(
        pg.fetch_one, "SELECT id FROM projects WHERE founder_id = 'founder-001' AND NOT is_published LIMIT 1", []
    )
    demo_any = client.portal.call(pg.fetch_one, "SELECT id FROM projects WHERE founder_id = 'founder-001' LIMIT 1", [])
    if not demo_any:
        pytest.skip("no demo projects in this database")
    as_user(None)
    if demo_draft:
        assert client.get(f"/api/projects/{demo_draft['id']}").status_code == 404
    assert client.get(f"/api/projects/{demo_any['id']}/readiness").status_code == 404
    assert client.get(f"/api/projects/{demo_any['id']}/export-report").status_code == 404


def test_recalculate_endpoint_is_gone(client, as_user):
    as_user(FOUNDER)
    assert client.post("/api/matches/recalculate").status_code in (404, 405)


# ---------------------------------------------------------------- rate limiting

def test_rate_limit_blocks_after_the_limit():
    rate_limit.reset()
    for _ in range(3):
        assert rate_limit._check("unit", "user:a", 3, 60) is None
    wait = rate_limit._check("unit", "user:a", 3, 60)
    assert wait is not None and 1 <= wait <= 60
    assert rate_limit._check("unit", "user:b", 3, 60) is None  # other users unaffected


def test_rate_limited_endpoint_returns_429(client, as_user, clean, monkeypatch):
    as_user(FOUNDER)
    real_check = rate_limit._check

    def tight(bucket, key, limit, per_seconds):
        return real_check(bucket, key, 1 if bucket == "create_project" else limit, per_seconds)

    monkeypatch.setattr(rate_limit, "_check", tight)
    body = {
        "title": "Rate Limit Test", "description": "Testing rate limits.", "problem": "Too many calls.",
        "solution": "Limit them.", "industry": "Fintech", "stage": "Seed", "funding_required": 1000,
        "business_model": "B2B SaaS", "target_market": "Anyone", "is_published": False,
    }
    assert client.post("/api/projects", json=body).status_code == 201
    second = client.post("/api/projects", json=body)
    assert second.status_code == 429
    assert int(second.headers["Retry-After"]) >= 1


# ---------------------------------------------------------------- headers, errors, logs, seeding

def test_security_headers_present(client):
    r = client.get("/api/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert "Referrer-Policy" in r.headers


def test_health_hides_internal_errors(client):
    status = client.get("/api/health").json()["database"]
    assert status in ("connected", "degraded", "unavailable", "unconfigured")


def test_tokens_are_redacted_from_logs():
    record = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1,
                               '%s - "%s %s" %s', ("1.2.3.4", "GET", "/api/dealrooms/ws/r1?token=eyJabc.def", 101), None)
    _RedactTokens().filter(record)
    assert "eyJabc" not in record.getMessage()
    assert "token=[redacted]" in record.getMessage()


def test_demo_seeding_only_when_allowed():
    assert Settings(APP_ENV="development", SEED_DEMO_DATA=None).seed_demo_data is True
    assert Settings(APP_ENV="staging", SEED_DEMO_DATA=None).seed_demo_data is False
    assert Settings(APP_ENV="development", SEED_DEMO_DATA=False).seed_demo_data is False


def test_unknown_errors_return_a_generic_message(client, as_user, monkeypatch):
    from app.services.match_service import MatchService

    async def boom(*args, **kwargs):
        raise RuntimeError("internal detail: connection string postgres://secret")

    monkeypatch.setattr(MatchService, "list_matches", boom)
    as_user(INVESTOR)
    from starlette.testclient import TestClient
    # No `with`: skip the app's startup/shutdown so the shared database connection stays open.
    quiet = TestClient(app, raise_server_exceptions=False)
    r = quiet.get("/api/matches")
    assert r.status_code == 500
    assert "secret" not in r.text and "internal detail" not in r.text


def test_rate_limit_dependency_raises_429_with_retry_after():
    import asyncio

    rate_limit.reset()
    dep = rate_limit.rate_limit("unit_dep", 1, 60)

    class _Req:
        client = type("C", (), {"host": "9.9.9.9"})()

    asyncio.run(dep(_Req(), None))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(dep(_Req(), None))
    assert exc.value.status_code == 429 and "Retry-After" in exc.value.headers
