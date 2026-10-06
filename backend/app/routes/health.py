from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.session import get_db

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint to verify backend service and database connectivity."""
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unavailable: {str(e)}"

    return {
        "status": "healthy",
        "service": "Venture X API",
        "database": db_status,
        "version": "0.1.0"
    }
