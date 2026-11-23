"""Return the E2E test investor to its pre-test state (use after an interrupted browser run).

    backend/.venv/Scripts/python e2e/cleanup_test_investor.py
"""
import asyncio, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import BACKEND_DIR, ENV as env  # noqa: E402

sys.path.insert(0, str(BACKEND_DIR))
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from app.core.config import settings  # noqa
from app.database import postgres as pg


async def main():
    await pg.open_pool()
    uid = await pg.fetch_val("SELECT id FROM app_users WHERE email = %s", [env["E2E_INVESTOR_EMAIL"]])
    if not uid:
        print("no investor account"); return
    await pg.run_batch([
        ("DELETE FROM investments WHERE investor_id = %s AND company_name IN ('Playwright Check Co', 'UI Import Kisan', 'UI Import MedSutra')", [uid]),
        ("DELETE FROM saved_opportunities WHERE investor_id = %s", [uid]),
        ("DELETE FROM matches WHERE investor_id = %s", [uid]),
        ("DELETE FROM investor_preferences WHERE investor_id = %s", [uid]),
    ])
    left = await pg.fetch_val("SELECT count(*) AS n FROM investments WHERE investor_id = %s", [uid])
    print("cleaned; investments left for test investor:", left)
    await pg.close_pool()

asyncio.run(main())
