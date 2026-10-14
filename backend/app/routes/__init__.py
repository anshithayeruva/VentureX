from fastapi import APIRouter
from app.routes.health import router as health_router
from app.routes.founders import router as founders_router
from app.routes.projects import router as projects_router
from app.routes.investors import router as investors_router
from app.routes.matches import router as matches_router
from app.routes.interests import router as interests_router
from app.routes.notifications import router as notifications_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(founders_router)
api_router.include_router(projects_router)
api_router.include_router(investors_router)
api_router.include_router(matches_router)
api_router.include_router(interests_router)
api_router.include_router(notifications_router)

__all__ = ["api_router"]
