import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
import os
from dotenv import load_dotenv
from contextlib import contextmanager

load_dotenv()

# Database configuration
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "database": os.getenv("DB_NAME", "store_flow_analytics"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
}

# Connection pool
connection_pool = None


def validate_db_config():
    """Validate that required database configuration is present"""
    required_vars = ["DB_USER", "DB_PASSWORD"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}. Please check your .env file."
        )

    return True


def init_connection_pool():
    """Initialize the database connection pool"""
    global connection_pool
    try:
        # Validate configuration first
        validate_db_config()

        print(
            f"🔗 Connecting to database: {DB_CONFIG['user']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
        )

        connection_pool = ThreadedConnectionPool(minconn=1, maxconn=20, **DB_CONFIG)

        # Test the connection
        with connection_pool.getconn() as test_conn:
            with test_conn.cursor() as test_cursor:
                test_cursor.execute("SELECT 1")
                test_cursor.fetchone()
            connection_pool.putconn(test_conn)

        print("✅ Database connection pool initialized successfully")
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
        raise
    except psycopg2.OperationalError as e:
        print(f"❌ Database connection failed: {e}")
        print("💡 Please check your database is running and credentials are correct")
        raise
    except Exception as e:
        print(f"❌ Failed to initialize database connection pool: {e}")
        raise


def close_connection_pool():
    """Close the database connection pool"""
    global connection_pool
    if connection_pool:
        connection_pool.closeall()
        print("✅ Database connection pool closed")


@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    if connection_pool is None:
        raise RuntimeError(
            "Database connection pool not initialized. Call init_connection_pool() first."
        )

    connection = None
    try:
        connection = connection_pool.getconn()
        yield connection
    except Exception as e:
        if connection:
            connection.rollback()
        raise e
    finally:
        if connection:
            connection_pool.putconn(connection)


@contextmanager
def get_db_cursor(commit=True):
    """Context manager for database cursors with auto-commit"""
    with get_db_connection() as connection:
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
