from functools import lru_cache
from typing import Generator, Optional, Tuple
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from app.config import get_settings


@lru_cache
def get_engine() -> Engine:
    """Create and cache the SQLAlchemy engine with connection pooling and pre-ping."""
    settings = get_settings()
    return create_engine(
        settings.sqlalchemy_database_uri,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_pre_ping=True,
        echo=False,
    )


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    """Create and cache the thread-safe session factory."""
    engine = get_engine()
    return sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a clean database session.
    Commits on clean exit, rolls back on exception, and guarantees closure.
    """
    session_factory = get_session_factory()
    db: Session = session_factory()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_db_connection(timeout_seconds: float = 2.0) -> Tuple[bool, Optional[str]]:
    """
    Check live connectivity to the PostgreSQL database by running 'SELECT 1'.
    Returns (True, None) if healthy, or (False, error_message) on failure.
    """
    engine = get_engine()
    try:
        # Use connect with execution options to verify active socket
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:
        return False, str(exc)
