import pytest
from starlette.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    """Provides a TestClient context with lifespan (connecting and disconnecting MongoDB)."""
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
    assert data["database_name"] == "VentureX"
    # Status should be healthy when connected to Atlas or mock when offline
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
    assert created["readiness_score"] >= 80.0
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
    """Verify retrieval of investor matching preferences."""
    response = client.get("/api/investors/preferences")
    assert response.status_code == 200
    prefs = response.json()
    assert "preferred_industries" in prefs
    assert "preferred_stages" in prefs
    assert "min_investment" in prefs
    assert "max_investment" in prefs
