#!/usr/bin/env python3

import uvicorn
from app.database.connection import init_connection_pool, close_connection_pool
import atexit
import sys


def startup():
    """Initialize database connections and start the server"""
    try:
        print("🚀 Starting Brickstore Brands API...")
        print("📁 Initializing database connection pool...")

        # Initialize database connection pool
        init_connection_pool()

        # Register cleanup function
        atexit.register(close_connection_pool)

        print("✅ Database connection pool initialized successfully")
        print("🌐 Starting FastAPI server...")

        # Start the server
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,  # Enable auto-reload for development
            log_level="info",
        )

    except KeyboardInterrupt:
        print("\n🛑 Server shutdown requested by user")
        close_connection_pool()
        sys.exit(0)
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
        close_connection_pool()
        sys.exit(1)


if __name__ == "__main__":
    startup()
