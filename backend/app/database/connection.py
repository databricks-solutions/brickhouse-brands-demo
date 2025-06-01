import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
import os
from dotenv import load_dotenv
from contextlib import contextmanager
from typing import Optional, Dict, Any

from app.config import app_config
from app.auth import databricks_auth
from app.logging_config import get_logger

load_dotenv()

# Setup logger for this module
log = get_logger(__name__)

# Connection pool
connection_pool = None


def get_database_config(user_context: Optional[Dict[str, Any]] = None) -> dict:
    """Get database configuration with authentication context"""
    return databricks_auth.get_database_auth_config(user_context)


def validate_db_config(db_config: Optional[dict] = None):
    """Validate that required database configuration is present"""
    if db_config is None:
        db_config = get_database_config()

    required_vars = ["user", "password"]
    missing_vars = [var for var in required_vars if not db_config.get(var)]

    if missing_vars:
        # In Databricks Apps, we might have alternative auth methods
        if app_config.is_databricks_app:
            log.warning(
                "⚠️ Traditional DB credentials missing, checking for alternative auth..."
            )
            # Here you could implement OAuth or other auth methods
            # For now, we'll still require username/password

        raise ValueError(
            f"Missing required database configuration: {', '.join(missing_vars)}. Please check your .env file."
        )

    return True


def init_connection_pool():
    """Initialize the database connection pool"""
    global connection_pool
    try:
        # Get database configuration with auth context
        db_config = get_database_config()

        # Validate configuration first
        validate_db_config(db_config)

        # Log environment info
        env_type = (
            "Databricks Apps" if app_config.is_databricks_app else "Local Development"
        )
        log.info(f"🌍 Environment: {env_type}")

        # Verify Databricks connection if possible
        if app_config.is_databricks_app or os.getenv("DATABRICKS_HOST"):
            try:
                databricks_auth.verify_databricks_connection()
            except Exception as e:
                log.warning(f"⚠️ Databricks connection check failed: {e}")

        log.info(
            f"🔗 Connecting to database: {db_config['user']}@{db_config['host']}:{db_config['port']}/{db_config['database']}"
        )

        connection_pool = ThreadedConnectionPool(minconn=1, maxconn=20, **db_config)

        # Test the connection
        with connection_pool.getconn() as test_conn:
            with test_conn.cursor() as test_cursor:
                test_cursor.execute("SELECT 1")
                test_cursor.fetchone()
            connection_pool.putconn(test_conn)

        log.info("✅ Database connection pool initialized successfully")

        # Log OAuth token availability
        oauth_token = databricks_auth.get_service_principal_token()
        if oauth_token:
            log.info("🔑 Databricks OAuth token available for API calls")

    except ValueError as e:
        log.error(f"❌ Configuration error: {e}")
        raise
    except psycopg2.OperationalError as e:
        log.error(f"❌ Database connection failed: {e}")
        log.info("💡 Please check your database is running and credentials are correct")
        raise
    except Exception as e:
        log.error(f"❌ Failed to initialize database connection pool: {e}")
        raise


def close_connection_pool():
    """Close the database connection pool"""
    global connection_pool
    if connection_pool:
        connection_pool.closeall()
        log.info("✅ Database connection pool closed")


@contextmanager
def get_db_connection(user_context: Optional[Dict[str, Any]] = None):
    """
    Context manager for database connections

    Args:
        user_context: Optional user context for user-specific database access
    """
    if connection_pool is None:
        raise RuntimeError(
            "Database connection pool not initialized. Call init_connection_pool() first."
        )

    connection = None
    try:
        connection = connection_pool.getconn()

        # Log user context if available
        if user_context and user_context.get("is_authenticated"):
            user_email = user_context.get("user_email", "unknown")
            log.debug(f"📊 Database query by user: {user_email}")

        yield connection
    except Exception as e:
        if connection:
            connection.rollback()
        raise e
    finally:
        if connection:
            connection_pool.putconn(connection)


@contextmanager
def get_db_cursor(commit=True, user_context: Optional[Dict[str, Any]] = None):
    """
    Context manager for database cursors with auto-commit

    Args:
        commit: Whether to auto-commit transactions
        user_context: Optional user context for user-specific database access
    """
    with get_db_connection(user_context=user_context) as connection:
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        try:
            yield cursor
            if commit:
                connection.commit()
        except Exception as e:
            connection.rollback()
            raise e
        finally:
            cursor.close()
