from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import __version__
from app.api.router import api_router
from app.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import get_logger, setup_logging
from app.db.session import check_db_connection

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Application startup logic
    setup_logging()
    get_settings.cache_clear()
    settings = get_settings()
    logger.info(f"Starting {settings.APP_NAME} v{__version__} ({settings.ENVIRONMENT})")

    # Non-blocking probe of database readiness
    db_connected, db_error = check_db_connection()
    if db_connected:
        logger.info("PostgreSQL database connection pool established successfully.")
    else:
        logger.warning(
            f"PostgreSQL is currently unreachable: {db_error}. "
            "Database endpoints will return 503 until PostgreSQL is started."
        )

    yield

    # Application shutdown logic
    logger.info("Shutting down application server.")


def create_application() -> FastAPI:
    """Application factory for FastAPI instance."""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=__version__,
        description="Production-minded AI Career Counsellor backend API service.",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # Configure CORS for decoupled frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register standardized error handling
    register_error_handlers(app)

    # Mount API routes under /api/v1
    app.include_router(api_router)

    return app


app = create_application()

if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
