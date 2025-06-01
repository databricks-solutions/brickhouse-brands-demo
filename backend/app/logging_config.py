import logging
import logging.config
import os
from typing import Dict, Any


def setup_logging(log_level: str = None) -> None:
    """
    Setup centralized logging configuration for the application

    Args:
        log_level: Optional log level override (DEBUG, INFO, WARNING, ERROR)
    """
    # Determine log level from environment or parameter
    if log_level is None:
        log_level = os.getenv("LOG_LEVEL", "INFO").upper()
        # Map DEBUG env var to log level
        if os.getenv("DEBUG", "false").lower() == "true":
            log_level = "DEBUG"

    # Logging configuration with ISO format
    logging_config: Dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%dT%H:%M:%S%z",  # ISO 8601 format
            },
            "detailed": {
                "format": "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d: %(message)s",
                "datefmt": "%Y-%m-%dT%H:%M:%S%z",  # ISO 8601 format
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": log_level,
                "formatter": "standard",
                "stream": "ext://sys.stdout",
            },
            "detailed_console": {
                "class": "logging.StreamHandler",
                "level": "DEBUG",
                "formatter": "detailed",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            # Application loggers
            "app": {"level": log_level, "handlers": ["console"], "propagate": False},
            "app.config": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False,
            },
            "app.auth": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False,
            },
            "app.database": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False,
            },
            "app.middleware": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False,
            },
            # Databricks SDK logger
            "databricks": {
                "level": "WARNING",  # Reduce verbosity of Databricks SDK
                "handlers": ["console"],
                "propagate": False,
            },
            # Database connector logger
            "databricks.sql": {
                "level": "WARNING",
                "handlers": ["console"],
                "propagate": False,
            },
            # FastAPI and Uvicorn loggers
            "uvicorn": {"level": "INFO", "handlers": ["console"], "propagate": False},
            "uvicorn.access": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
            "fastapi": {"level": "INFO", "handlers": ["console"], "propagate": False},
        },
        "root": {"level": "WARNING", "handlers": ["console"]},
    }

    # Use detailed formatter in debug mode
    if log_level == "DEBUG":
        for logger_name in [
            "app",
            "app.config",
            "app.auth",
            "app.database",
            "app.middleware",
        ]:
            logging_config["loggers"][logger_name]["handlers"] = ["detailed_console"]

    # Apply logging configuration
    logging.config.dictConfig(logging_config)

    # Log the configuration
    logger = logging.getLogger("app")
    logger.info(f"🔧 Logging configured with level: {log_level}")


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a specific module

    Args:
        name: Logger name (usually __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)
