from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
from typing import Optional, Dict, Any

from app.routers import stores, inventory, orders, users, products
from app.database.connection import init_connection_pool, close_connection_pool
from app.config import app_config
from app.auth import databricks_auth
from app.logging_config import setup_logging, get_logger

# Load environment variables
load_dotenv()

# Setup logging FIRST - before any other imports that might use logging
setup_logging()

# Setup logger for this module
log = get_logger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Brickstore Brands API",
    description="Backend API for Brickstore Brands Portal - Enhanced for Databricks Apps",
    version="1.0.0",
    redirect_slashes=False,  # Disable automatic slash redirects
)

# Configure CORS with environment-aware origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=app_config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency to get user context from request headers
async def get_user_context(request: Request) -> Optional[Dict[str, Any]]:
    """Extract user context from request headers (Databricks Apps)"""
    headers = dict(request.headers)
    return databricks_auth.get_user_context(headers)


# Database connection lifecycle
@app.on_event("startup")
async def startup_event():
    """Initialize database connection pool on startup"""
    try:
        # Log environment information
        env_type = (
            "Databricks Apps" if app_config.is_databricks_app else "Local Development"
        )
        log.info(f"🚀 Starting Brickstore Brands API in {env_type} mode")

        # Initialize database connection pool
        init_connection_pool()
        log.info("✅ Database connection pool initialized")

        # Test Databricks authentication if configured
        if app_config.is_databricks_app or os.getenv("DATABRICKS_HOST"):
            try:
                oauth_token = databricks_auth.get_service_principal_token()
                if oauth_token:
                    log.info("🔐 Databricks authentication successful")
                else:
                    log.warning("⚠️ Databricks authentication not available")
            except Exception as e:
                log.warning(f"⚠️ Databricks authentication test failed: {e}")

    except Exception as e:
        log.error(f"❌ Failed to initialize application: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection pool on shutdown"""
    close_connection_pool()
    log.info("✅ Application shutdown completed")


# API prefix
API_PREFIX = os.getenv("API_PREFIX", "/api")

# Include routers with user context dependency
app.include_router(
    stores.router,
    prefix=f"{API_PREFIX}/stores",
    tags=["stores"],
    dependencies=[Depends(get_user_context)],
)
app.include_router(
    inventory.router,
    prefix=f"{API_PREFIX}/inventory",
    tags=["inventory"],
    dependencies=[Depends(get_user_context)],
)
app.include_router(
    orders.router,
    prefix=f"{API_PREFIX}/orders",
    tags=["orders"],
    dependencies=[Depends(get_user_context)],
)
app.include_router(
    users.router,
    prefix=f"{API_PREFIX}/users",
    tags=["users"],
    dependencies=[Depends(get_user_context)],
)
app.include_router(
    products.router,
    prefix=f"{API_PREFIX}/products",
    tags=["products"],
    dependencies=[Depends(get_user_context)],
)


@app.get("/", response_model=dict)
async def read_root():
    """Health check endpoint with environment information"""
    env_type = (
        "Databricks Apps" if app_config.is_databricks_app else "Local Development"
    )
    auth_status = bool(databricks_auth.get_service_principal_token())

    log.debug(
        f"🏠 Root endpoint accessed - Environment: {env_type}, Auth: {auth_status}"
    )

    return {
        "message": "Brickstore Brands API is running",
        "environment": env_type,
        "version": "1.0.0",
        "databricks_authenticated": auth_status,
    }


@app.get("/health")
async def health_check():
    """Detailed health check for Databricks Apps"""
    env_type = (
        "Databricks Apps" if app_config.is_databricks_app else "Local Development"
    )

    health_status = {
        "status": "healthy",
        "version": "1.0.0",
        "environment": env_type,
        "database": "connected",
        "databricks": "unknown",
    }

    # Check Databricks connection
    try:
        if app_config.is_databricks_app or os.getenv("DATABRICKS_HOST"):
            is_connected = databricks_auth.verify_databricks_connection()
            health_status["databricks"] = (
                "connected" if is_connected else "disconnected"
            )
    except Exception as e:
        health_status["databricks"] = f"error: {str(e)}"
        log.error(f"❌ Health check - Databricks connection error: {e}")

    log.debug(f"🩺 Health check completed: {health_status}")
    return health_status


@app.get("/user-info")
async def get_user_info(
    request: Request, user_context: Optional[Dict[str, Any]] = Depends(get_user_context)
):
    """Get current user information (Databricks Apps only)"""
    if not app_config.is_databricks_app:
        log.debug("👤 User info requested in local environment")
        return {"message": "User context only available in Databricks Apps environment"}

    if user_context and user_context.get("is_authenticated"):
        user_email = user_context.get("user_email")
        log.info(f"👤 User info retrieved for: {user_email}")
        return {
            "authenticated": True,
            "user_email": user_email,
            "user_id": user_context.get("user_id"),
            "environment": "Databricks Apps",
        }
    else:
        log.warning("👤 User info requested but no authenticated user found")
        return {"authenticated": False, "message": "No user context available"}
