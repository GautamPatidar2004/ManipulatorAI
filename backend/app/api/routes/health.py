from fastapi import APIRouter, Depends
from app import __version__
from app.api.schemas.health import DatabaseHealth, HealthResponse
from app.config import Settings, get_settings
from app.db.session import check_db_connection

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", response_model=HealthResponse, summary="Service Health and Database Connectivity Check")
def health_check(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """
    Return service health status, environment, and live PostgreSQL connectivity.
    Performs an active check to determine if the database connection pool is operational.
    """
    db_connected, db_error = check_db_connection()

    return HealthResponse(
        status="ok" if db_connected else "degraded",
        app_name=settings.APP_NAME,
        environment=settings.ENVIRONMENT,
        version=__version__,
        ai_service_available=settings.is_ai_configured,
        database=DatabaseHealth(
            connected=db_connected,
            error=db_error if not db_connected else None,
        ),
    )
