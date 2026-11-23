"""Shared settings for the end-to-end suites."""
import json
import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO / "backend"
WEB = os.environ.get("VX_WEB_URL", "http://localhost:3000").rstrip("/")
API = os.environ.get("VX_API_URL", "http://localhost:8000/api").rstrip("/")
# Test accounts (E2E_TEST_EMAIL / E2E_INVESTOR_EMAIL and passwords) come from the environment,
# falling back to backend/.env. They must be throwaway test accounts, never real users.
_ENV_FILE = BACKEND_DIR / ".env"
ENV = dict(
    line.split("=", 1) for line in (_ENV_FILE.read_text(encoding="utf-8").splitlines() if _ENV_FILE.exists() else [])
    if "=" in line and not line.startswith("#")
)
ENV.update({k: v for k, v in os.environ.items() if k.startswith("E2E_")})
ENV = {k: v.strip().strip('"') for k, v in ENV.items()}


def db(statements):
    """Run SQL statements with the backend's own database helper (test setup and cleanup)."""
    code = "\n".join([
        "import asyncio, json, sys; sys.path.insert(0, '.')",
        "if sys.platform == 'win32': asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())",
        "from app.database import postgres as pg",
        "async def main():",
        "    await pg.open_pool()",
        "    await pg.run_batch([(sql, params) for sql, params in json.loads(sys.argv[1])])",
        "    await pg.close_pool()",
        "asyncio.run(main())",
    ])
    python = BACKEND_DIR / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    r = subprocess.run([str(python), "-c", code, json.dumps(statements)],
                       cwd=str(BACKEND_DIR), capture_output=True, text=True)
    if r.returncode:
        print("DB step failed:", r.stderr.strip().splitlines()[-1:])
    return r.returncode == 0


def set_test_investor_verification(status="verified"):
    """Investors must be admin-verified to contact founders; the suites mark the E2E test
    investor (only that account) as verified, or reset it."""
    # Upsert: the API flow's cleanup removes the test investor's profile row.
    return db([[
        "INSERT INTO investor_profiles (user_id, verification_status) "
        "SELECT id, %s FROM app_users WHERE email = %s "
        "ON CONFLICT (user_id) DO UPDATE SET verification_status = EXCLUDED.verification_status",
        [status, ENV["E2E_INVESTOR_EMAIL"]],
    ]])
