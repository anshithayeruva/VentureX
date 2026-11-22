import asyncio
import sys

import pytest

# psycopg's async driver cannot run on Windows' default Proactor event loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.core.auth import CurrentUser, get_current_user  # noqa: E402
from app.main import app  # noqa: E402

TEST_FOUNDER = CurrentUser(
    id="test-founder-0001", email="founder@test.venturex.io", name="Test Founder", role="FOUNDER"
)


@pytest.fixture(autouse=True, scope="session")
def signed_in_founder():
    """Stand in for a verified Neon Auth JWT so write endpoints can be exercised."""
    async def _user():
        return TEST_FOUNDER

    app.dependency_overrides[get_current_user] = _user
    yield TEST_FOUNDER
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(autouse=True)
def fresh_rate_limits():
    """Rate-limit counts live in memory; start every test from zero."""
    from app.core import rate_limit
    rate_limit.reset()
    yield


@pytest.fixture(scope="module")
def client():
    """App client with lifespan (opens the Neon transport, applies schema, seeds demo data)."""
    from starlette.testclient import TestClient
    with TestClient(app) as test_client:
        yield test_client
        # Tests run against the real database: remove what the test founder created.
        test_client.portal.call(_remove_test_founder_data)


async def _remove_test_founder_data():
    from app.database import postgres as pg

    owned = "SELECT id FROM projects WHERE founder_id = %s"
    for table in ("matches", "project_interests"):
        await pg.execute(f"DELETE FROM {table} WHERE project_id IN ({owned})", [TEST_FOUNDER.id])
    await pg.execute("DELETE FROM notifications WHERE user_id = %s", [TEST_FOUNDER.id])
    # project_documents and project_analyses go with their project (ON DELETE CASCADE).
    await pg.execute("DELETE FROM projects WHERE founder_id = %s", [TEST_FOUNDER.id])
