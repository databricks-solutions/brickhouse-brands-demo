# Backend - FastAPI API Server

Demonstration REST API server built with FastAPI and integrated with PostgreSQL, designed for local development and sample deployment on Databricks Apps. **This is a demonstration application only** and is not intended for production use.

## 📒 Table of Contents

- [🛠️ Technology Stack](#️-technology-stack)
- [🚀 Getting Started](#-getting-started)
- [📁 Project Structure](#-project-structure)
- [🔌 API Endpoints](#-api-endpoints)
- [🔄 Data Models](#-data-models)
- [🗄️ Database Operations](#️-database-operations)
- [🔐 Authentication & Security](#-authentication--security)
- [📊 Performance Optimizations](#-performance-optimizations)
- [🚀 Databricks Apps Deployment](#-databricks-apps-deployment)
- [🔧 Development](#-development)
- [📝 Logging](#-logging)
- [🧪 Testing](#-testing)
- [🔍 Monitoring](#-monitoring)

## 🛠️ Technology Stack

- **FastAPI** - Modern, fast web framework for building APIs
- **PostgreSQL** - Database with connection pooling (demo setup)
- **Pydantic** - Data validation and serialization
- **psycopg2** - PostgreSQL database adapter
- **Uvicorn** - ASGI server for demonstration deployment

## 🚀 Getting Started

### Automated Setup

The backend is automatically configured when you run the main project setup:

```bash
# From project root
./setup-env.sh
./start-dev.sh
```

### Manual Development

For backend-specific development:

```bash
cd backend
source venv/bin/activate
python startup.py
```

The API server will be available at:
- **API Base**: `http://localhost:8000`
- **Interactive Docs**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 📁 Project Structure

```
backend/
├── app/
│   ├── database/
│   │   └── connection.py       # Database connection management
│   ├── models/
│   │   └── schemas.py          # Pydantic data models
│   └── routers/
│       ├── stores.py           # Store management endpoints
│       ├── inventory.py        # Inventory management endpoints
│       ├── orders.py           # Order management endpoints
│       ├── users.py            # User management endpoints
│       └── products.py         # Product management endpoints
├── static/                     # Frontend assets (after build)
├── main.py                     # FastAPI application setup
├── startup.py                  # Development server startup
├── app.yaml                    # Databricks Apps configuration
└── requirements.txt            # Python dependencies
```

## 🔌 API Endpoints

### Store Management (`/api/stores`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List all stores with filtering |
| `GET` | `/{store_id}` | Get specific store details |
| `POST` | `/` | Create new store |
| `PUT` | `/{store_id}` | Update store information |
| `GET` | `/regions/options` | Get region dropdown options |
| `GET` | `/regions/summary` | Get region summary with store types |

### Inventory Management (`/api/inventory`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List inventory with pagination and filtering |
| `GET` | `/kpi` | Get KPI data (total value, products, alerts) |
| `GET` | `/trends` | Get inventory trend data |
| `GET` | `/categories` | Get category distribution |
| `GET` | `/alerts/low-stock` | Get low stock alerts |
| `PUT` | `/{inventory_id}` | Update inventory levels |

### Order Management (`/api/orders`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List orders with filtering |
| `GET` | `/{order_id}` | Get specific order details |
| `POST` | `/` | Create new order |
| `PATCH` | `/{order_id}/approve` | Approve pending order |
| `PATCH` | `/{order_id}/fulfill` | Mark order as fulfilled |

### Product Management (`/api/products`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List products with filtering |
| `GET` | `/{product_id}` | Get specific product |
| `POST` | `/` | Create new product |
| `GET` | `/categories/list` | Get all product categories |
| `GET` | `/brands/list` | Get all product brands |

### User Management (`/api/users`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List users with filtering |
| `GET` | `/{user_id}` | Get specific user |
| `POST` | `/` | Create new user |
| `GET` | `/role/{role}` | Get users by role |

## 🔄 Data Models

### Request/Response Schemas

```python
# Store Schema
class Store(BaseModel):
    id: str
    name: str
    region: str
    store_type: str
    address: str
    manager_id: Optional[str] = None

# Inventory Schema  
class InventoryItem(BaseModel):
    id: str
    product_id: str
    store_id: str
    current_stock: int
    reorder_level: int
    max_stock: int
    last_updated: datetime

# Order Schema
class Order(BaseModel):
    id: str
    store_id: str
    product_id: str
    quantity: int
    status: OrderStatus
    created_at: datetime
    approved_at: Optional[datetime] = None
```

### Filtering and Pagination

All list endpoints support filtering and pagination:

```python
# Example: GET /api/inventory?region=West&category=Cola&page=1&limit=50
class InventoryFilters(BaseModel):
    region: Optional[List[str]] = None
    category: Optional[List[str]] = None
    low_stock: Optional[bool] = None
    page: int = 1
    limit: int = 50
```

## 🗄️ Database Operations

### Connection Management

The application uses a connection pool for efficient database operations:

```python
from app.database.connection import get_db_cursor

# Context manager for database operations
with get_db_cursor() as cursor:
    cursor.execute("SELECT * FROM stores WHERE region = %s", (region,))
    results = cursor.fetchall()
```

### Query Patterns

Common query patterns used throughout the application:

```python
# Parameterized queries for security
cursor.execute(
    "SELECT * FROM inventory WHERE store_id = %s AND current_stock <= reorder_level",
    (store_id,)
)

# Batch operations for performance
cursor.executemany(
    "UPDATE inventory SET current_stock = %s WHERE id = %s",
    batch_updates
)
```

## 🔐 Authentication & Security

### Databricks Apps Integration

The application supports dual authentication modes:

1. **Service Principal** (Production on Databricks Apps)
2. **Personal Access Token** (Local development)

```python
# Authentication is handled automatically based on environment
# Service Principal credentials come from Databricks secrets
# Local development uses DATABRICKS_TOKEN from .env
```

### CORS Configuration

Cross-origin requests are configured for development:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://localhost:5173",  # Vite dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 📊 Performance Optimizations

### Database Connection Pooling

```python
# Connection pool configuration
DATABASE_CONFIG = {
    "minconn": 1,
    "maxconn": 20,
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "database": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
}
```

### Query Optimization

- **Indexed columns** for frequently filtered fields
- **Batch operations** for bulk updates
- **Prepared statements** for repeated queries
- **Connection reuse** via connection pooling

## 🚀 Databricks Apps Deployment

### App Configuration

The `app.yaml` file configures the Databricks Apps deployment (sample below):

```yaml
command: ["python", "startup.py"]

env:
  - name: "API_PREFIX"
    value: "/api"
  - name: "DB_HOST"
    valueFrom: "db_host"          # From Databricks secrets
  - name: "DB_USER"
    valueFrom: "db_user"          # From Databricks secrets
  - name: "DB_PASSWORD"
    valueFrom: "db_password"      # From Databricks secrets
```

### Secret Management

Database credentials are managed through Databricks secrets:

```bash
# Create secret scope
databricks secrets create-scope brickhouse-scope --profile <my-profile>

# Set database credentials as secrets
databricks secrets put-secret brickhouse-scope db_host --string-value "your-db-host" --profile <my-profile>
databricks secrets put-secret brickhouse-scope db_user --string-value "your-db-username" --profile <my-profile>
databricks secrets put-secret brickhouse-scope db_password --string-value "your-db-password" --profile <my-profile>

# Verify secrets are created
databricks secrets list-secrets brickhouse-scope --profile <my-profile>
```

### Static File Serving

The backend serves the React frontend in production:

```python
# Serve frontend static files
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

## 🔧 Development

### Adding New Endpoints

1. **Create router function** in appropriate router file:
```python
@router.get("/new-endpoint")
async def new_endpoint():
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM table")
        return cursor.fetchall()
```

2. **Add Pydantic models** in `models/schemas.py`:
```python
class NewModel(BaseModel):
    field1: str
    field2: int
```

3. **Update main.py** to include the router:
```python
app.include_router(router, prefix="/api/new", tags=["new"])
```

### Database Schema Changes

When modifying database schema:

1. Update the database setup script in `../database/demo_setup.py`
2. Test changes with `python demo_setup.py --dry-run`
3. Update Pydantic models to match new schema
4. Update API endpoints to handle new fields

### Error Handling

Consistent error responses across all endpoints:

```python
from fastapi import HTTPException

# Example error handling
if not result:
    raise HTTPException(status_code=404, detail="Resource not found")
```

## 📝 Logging

Centralized logging with structured format:

```python
import logging

# Log levels: DEBUG, INFO, WARNING, ERROR
logger = logging.getLogger(__name__)

# Example usage
logger.info("API request processed", extra={
    "endpoint": "/api/inventory",
    "response_time": 0.123,
    "user_id": "user123"
})
```

## 🧪 Testing

### API Testing

Use the interactive documentation at `/docs` for manual testing, or tools like:

- **curl** for command-line testing
- **Postman** for GUI-based testing
- **pytest** for automated testing (when implemented)

### Local Testing

```bash
# Test database connection
python -c "from app.database.connection import get_db_cursor; print('DB OK')"

# Test API endpoints
curl http://localhost:8000/api/stores
```

## 🔍 Monitoring

### Health Checks

Built-in health check endpoint:

```python
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}
```

### Database Monitoring

Monitor database performance through:
- Connection pool statistics
- Query execution times
- Error rates and patterns 