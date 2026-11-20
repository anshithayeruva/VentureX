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
