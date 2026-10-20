import logging
import sys
from app.config import get_settings


def setup_logging() -> None:
    """Configure application-wide logging format and log levels."""
    settings = get_settings()
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO

    logging_config = {
        "level": log_level,
        "format": "%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        "datefmt": "%Y-%m-%dT%H:%M:%S%z",
        "handlers": [logging.StreamHandler(sys.stdout)],
    }

    logging.basicConfig(**logging_config)
    # Silence excessively verbose external loggers
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a logger instance with the specified name."""
    return logging.getLogger(name)
