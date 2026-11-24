from fastapi import APIRouter
from app.routes.health import router as health_router
from app.routes.auth import router as auth_router
from app.routes.founders import router as founders_router
from app.routes.projects import router as projects_router
from app.routes.investors import router as investors_router
from app.routes.matches import router as matches_router
from app.routes.interests import router as interests_router
from app.routes.notifications import router as notifications_router
from app.routes.dealrooms import router as dealrooms_router
from app.routes.portfolio import router as portfolio_router

from app.routes.verification import router as verification_router  # noqa: E402
from app.routes.updates import router as updates_router  # noqa: E402
from app.routes.teams import router as teams_router  # noqa: E402
from app.routes.account import router as account_router  # noqa: E402
from app.routes.funding import router as funding_router  # noqa: E402

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(founders_router)
api_router.include_router(projects_router)
api_router.include_router(investors_router)
api_router.include_router(matches_router)
api_router.include_router(interests_router)
api_router.include_router(notifications_router)
api_router.include_router(verification_router)
api_router.include_router(updates_router)
api_router.include_router(teams_router)
api_router.include_router(account_router)
api_router.include_router(funding_router)
api_router.include_router(dealrooms_router)
api_router.include_router(portfolio_router)

__all__ = ["api_router"]
