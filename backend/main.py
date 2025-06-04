from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import os
from typing import Optional, Dict, Any
import pathlib

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

# Get the path to the static frontend files (local to backend)
FRONTEND_STATIC_PATH = pathlib.Path(__file__).parent / "static"

# Create FastAPI app
app = FastAPI(
    title="Brickhouse Brands API",
    description="Backend API for Brickhouse Brands Portal - Enhanced for Databricks Apps",
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

# Mount static files for the frontend (only if dist directory exists)
if FRONTEND_STATIC_PATH.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_STATIC_PATH / "assets")),
        name="assets",
    )
    log.info(f"📁 Static assets mounted from: {FRONTEND_STATIC_PATH / 'assets'}")
else:
    log.warning(f"⚠️ Frontend dist directory not found at: {FRONTEND_STATIC_PATH}")


# Route to serve static files from the root of dist directory (favicon, robots.txt, etc.)
@app.get("/favicon.ico", response_class=FileResponse)
async def favicon():
    """Serve favicon"""
    favicon_file = FRONTEND_STATIC_PATH / "favicon.ico"
    if favicon_file.exists():
        return FileResponse(str(favicon_file))
    raise HTTPException(status_code=404, detail="Favicon not found")


@app.get("/robots.txt", response_class=FileResponse)
async def robots():
    """Serve robots.txt"""
    robots_file = FRONTEND_STATIC_PATH / "robots.txt"
    if robots_file.exists():
        return FileResponse(str(robots_file))
    raise HTTPException(status_code=404, detail="Robots.txt not found")


@app.get("/brickhouse_brands_logo_favicon.png", response_class=FileResponse)
async def brickhouse_logo():
    """Serve Brickhouse Brands logo"""
    logo_file = FRONTEND_STATIC_PATH / "brickhouse_brands_logo_favicon.png"
    if logo_file.exists():
        return FileResponse(str(logo_file))
    raise HTTPException(status_code=404, detail="Logo not found")


@app.get("/placeholder.svg", response_class=FileResponse)
async def placeholder():
    """Serve placeholder.svg"""
    placeholder_file = FRONTEND_STATIC_PATH / "placeholder.svg"
    if placeholder_file.exists():
        return FileResponse(str(placeholder_file))
    raise HTTPException(status_code=404, detail="Placeholder not found")


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
        log.info(f"🚀 Starting Brickhouse Brands API in {env_type} mode")

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


@app.get("/", response_class=FileResponse)
async def read_root():
    """Serve the frontend application"""
    index_file = FRONTEND_STATIC_PATH / "index.html"
    if index_file.exists():
        log.debug("🏠 Serving frontend application at root")
        return FileResponse(str(index_file))
    else:
        log.warning("⚠️ Frontend index.html not found, falling back to API response")
        # Fallback to API response if frontend not built
        env_type = (
            "Databricks Apps" if app_config.is_databricks_app else "Local Development"
        )
        auth_status = bool(databricks_auth.get_service_principal_token())

        return {
            "message": "Brickhouse Brands API is running",
            "environment": env_type,
            "version": "1.0.0",
            "databricks_authenticated": auth_status,
            "frontend_status": "not_built",
        }


# API Health check endpoint (moved to /api/health to avoid conflicts)
@app.get("/api/health")
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


# Keep the old /health endpoint for backward compatibility
@app.get("/health")
async def health_check_legacy():
    """Legacy health check endpoint"""
    return await health_check()


@app.get("/api/user-info")
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


# Catch-all route for SPA routing - this must be last
@app.get("/{full_path:path}", response_class=FileResponse)
async def serve_spa(full_path: str):
    """
    Serve the SPA for all non-API routes
    This handles client-side routing by always returning index.html
    """
    # Don't interfere with API routes
    if (
        full_path.startswith("api/")
        or full_path.startswith("docs")
        or full_path.startswith("redoc")
        or full_path.startswith("openapi.json")
    ):
        raise HTTPException(status_code=404, detail="API endpoint not found")

    index_file = FRONTEND_STATIC_PATH / "index.html"
    if index_file.exists():
        log.debug(f"🔄 SPA routing - serving index.html for path: /{full_path}")
        return FileResponse(str(index_file))
    else:
        raise HTTPException(status_code=404, detail="Frontend application not found")
