from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.routers import stores, inventory, orders, users, products
from app.database.connection import init_connection_pool, close_connection_pool

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Brickstore Brands API",
    description="Backend API for Brickstore Brands Portal",
    version="1.0.0",
    redirect_slashes=False,  # Disable automatic slash redirects
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:3000",
        "http://localhost:5173",
    ],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Database connection lifecycle
@app.on_event("startup")
async def startup_event():
    """Initialize database connection pool on startup"""
    try:
        init_connection_pool()
        print("✅ Database connection pool initialized")
    except Exception as e:
        print(f"❌ Failed to initialize database connection pool: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection pool on shutdown"""
    close_connection_pool()
    print("✅ Database connection pool closed")


# API prefix
API_PREFIX = os.getenv("API_PREFIX", "/api")

# Include routers
app.include_router(stores.router, prefix=f"{API_PREFIX}/stores", tags=["stores"])
app.include_router(
    inventory.router, prefix=f"{API_PREFIX}/inventory", tags=["inventory"]
)
app.include_router(orders.router, prefix=f"{API_PREFIX}/orders", tags=["orders"])
app.include_router(users.router, prefix=f"{API_PREFIX}/users", tags=["users"])
app.include_router(products.router, prefix=f"{API_PREFIX}/products", tags=["products"])


@app.get("/", response_model=dict)
async def read_root():
    """Health check endpoint"""
    return {"message": "Brickstore Brands API is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}
