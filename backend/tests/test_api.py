import pytest
from starlette.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    """Provides a TestClient context with lifespan (opening and closing the Neon Postgres pool)."""
    with TestClient(app) as test_client:
        yield test_client


def test_root_endpoint(client):
    """Verify that the API root endpoint returns system metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Venture X API"
    assert data["status"] == "online"
    assert "version" in data
    assert data["docs_url"] == "/docs"


def test_health_check(client):
    """Verify the health check endpoint and database reporting."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["service"] == "Venture X API"
    assert data["database_name"] in ("neondb", "")
    # Status should be healthy when connected to Neon or mock when offline
    assert data["status"] in ["healthy", "mock"]


def test_list_projects(client):
    """Verify listing published projects."""
    response = client.get("/api/projects")
    assert response.status_code == 200
    projects = response.json()
    assert isinstance(projects, list)
    if projects:
        first = projects[0]
        assert "id" in first
        assert "title" in first
        assert "industry" in first
        assert "funding_required" in first
        assert "readiness_score" in first


def test_project_lifecycle(client):
    """
    Test the full lifecycle:
    1. Create a draft project -> verify 201 Created and AI readiness score
    2. Retrieve draft by ID -> verify 200 OK
    3. Publish project -> verify 200 OK and is_published == True
    """
    new_project_payload = {
        "title": "Automated Test Startup",
        "tagline": "AI-driven edge analytics",
        "description": "Continuous real-time telemetry processing on low-power hardware.",
        "problem": "Legacy cloud streaming introduces 400ms latency into manufacturing robotics loops.",
        "solution": "On-device quantized inference reducing decision latency to under 3 milliseconds.",
        "industry": "Robotics & AI",
        "stage": "Seed",
        "funding_required": 750000,
        "business_model": "Hardware + SaaS",
        "target_market": "Automated manufacturing and assembly plants",
        "website": "https://autotest.demo",
        "is_published": False,
    }

    # 1. Create Project
    create_res = client.post("/api/projects", json=new_project_payload)
    assert create_res.status_code == 201
    created = create_res.json()
    project_id = created["id"]
    assert created["title"] == new_project_payload["title"]
    assert created["is_published"] is False
    assert "readiness_score" in created
    # Baseline rule-based readiness check runs on create
    assert 0.0 <= created["readiness_score"] <= 100.0
    assert "ai_readiness_breakdown" in created

    # 2. Get by ID
    get_res = client.get(f"/api/projects/{project_id}")
    assert get_res.status_code == 200
    fetched = get_res.json()
    assert fetched["id"] == project_id
    assert fetched["title"] == new_project_payload["title"]

    # 3. Publish the Project
    publish_res = client.patch(
        f"/api/projects/{project_id}/publish",
        json={"is_published": True},
    )
    assert publish_res.status_code == 200
    published = publish_res.json()
    assert published["is_published"] is True


def test_create_project_validation_error(client):
    """Verify that submitting an empty/invalid payload triggers a 422 Unprocessable Entity error."""
    response = client.post("/api/projects", json={})
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data


def test_list_investors(client):
    """Verify investor directory endpoint returns active investors."""
    response = client.get("/api/investors")
    assert response.status_code == 200
    investors = response.json()
    assert isinstance(investors, list)
    if investors:
        first = investors[0]
        assert "full_name" in first or "name" in first
        assert "firm_name" in first or "firm" in first


def test_ai_matches(client):
    """Verify AI matching engine endpoint returns match objects with scores and reasoning."""
    response = client.get("/api/matches")
    assert response.status_code == 200
    matches = response.json()
    assert isinstance(matches, list)
    if matches:
        first = matches[0]
        assert "match_score" in first
        assert "reasons" in first
        assert "investor_firm" in first
        assert "project_title" in first


def test_investor_preferences(client):
    """An investor reads their own matching criteria; a founder gets 403 (no demo fallback)."""
    from app.core.auth import CurrentUser, get_current_user
    from app.main import app

    assert client.get("/api/investors/preferences").status_code == 403  # signed in as a founder
    previous = app.dependency_overrides[get_current_user]

    async def _investor():
        return CurrentUser(id="test-investor-prefs", email="inv@test.venturex.io", name="Test Investor", role="INVESTOR")

    app.dependency_overrides[get_current_user] = _investor
    try:
        response = client.get("/api/investors/preferences")
    finally:
        app.dependency_overrides[get_current_user] = previous
        from app.database import postgres as pg
        client.portal.call(pg.run_batch, [
            ("DELETE FROM investor_preferences WHERE investor_id = 'test-investor-prefs'", []),
            ("DELETE FROM investor_profiles WHERE user_id = 'test-investor-prefs'", []),
        ])
    assert response.status_code == 200
    prefs = response.json()
    assert "preferred_industries" in prefs
    assert "preferred_stages" in prefs
    assert "min_investment" in prefs
    assert "max_investment" in prefs


def test_project_intelligence_pipeline(client, monkeypatch):
    """Upload materials, run the readiness analysis (rule-based engine, no API key needed), read history."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "AI_PROVIDER", "none")

    created = client.post("/api/projects", json={
        "title": "Intelligence Test Startup",
        "description": "Workflow automation for independent pharmacies.",
        "problem": "Pharmacists lose hours each day to manual insurance claim rework.",
        "solution": "Automated claim validation that catches rejections before submission.",
        "industry": "HealthTech", "stage": "Pre-seed", "funding_required": 400000,
        "business_model": "B2B SaaS", "target_market": "Independent pharmacies in the US",
        "demo_url": "https://example.com/demo",
    })
    assert created.status_code == 201
    project_id = created.json()["id"]

    upload = client.post(
        f"/api/projects/{project_id}/documents",
        data={"category": "business_plan"},
        files={"file": ("plan.md", b"# Plan\nPricing: $199/month. TAM $3B. 12 pilot pharmacies signed LOIs.", "text/markdown")},
    )
    assert upload.status_code == 201
    doc = upload.json()
    assert doc["text_chars"] > 0 and doc["category"] == "business_plan"

    rejected = client.post(
        f"/api/projects/{project_id}/documents",
        files={"file": ("tool.exe", b"MZ", "application/octet-stream")},
    )
    assert rejected.status_code == 400

    report = client.post(f"/api/projects/{project_id}/analyze")
    assert report.status_code == 200
    body = report.json()
    assert body["engine"] == "rules" and body["is_ai_generated"] is False
    assert 0 <= body["readiness_score"] <= 100
    assert [d["key"] for d in body["dimensions"]] == [
        "problem_solution_fit", "market_sizing", "business_model_clarity", "traction_feasibility", "product_technology",
    ]
    assert body["inputs"]["documents"][0]["name"] == "plan.md"

    history = client.get(f"/api/projects/{project_id}/analyses").json()
    assert len(history) == 2  # baseline on create + this run

    assert client.delete(f"/api/projects/{project_id}/documents/{doc['id']}").status_code == 200
    assert client.get(f"/api/projects/{project_id}/documents").json() == []


def test_gemini_engine_without_key_reports_clearly(client, monkeypatch):
    """Choosing Gemini without GEMINI_API_KEY must fail with a 503 that says how to fix it."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    created = client.post("/api/projects", json={
        "title": "Gemini Config Test", "description": "Testing engine configuration.",
        "problem": "Engine selection must be explicit.", "solution": "Clear configuration errors.",
        "industry": "DevTools", "stage": "Idea", "funding_required": 1000,
        "business_model": "SaaS", "target_market": "Developers",
    })
    assert created.status_code == 201
    response = client.post(f"/api/projects/{created.json()['id']}/analyze")
    assert response.status_code == 503
    assert "GEMINI_API_KEY" in response.json()["detail"]
