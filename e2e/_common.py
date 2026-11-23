"""Shared settings for the end-to-end suites."""
import os
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
