# Brickhouse Brands - FastAPI Backend

This is the backend API for the Brickhouse Brands dashboard, built with FastAPI and PostgreSQL.

## Features

- **FastAPI** - Modern, fast web framework for building APIs
- **PostgreSQL** - Production-ready database with connection pooling
- **Pydantic** - Data validation and serialization
- **CORS** - Configured for frontend integration
- **Modular Architecture** - Clean separation of concerns
- **Databricks Apps Support** - Enhanced for deployment on Databricks Apps platform
- **Dual Authentication** - Service Principal (Databricks) + CLI (Local development)
- **User Context Handling** - Support for Databricks user authorization

## Deployment Options

### 💻 Local Development

For local development and testing, follow the setup instructions below.

## API Endpoints

### Stores (`/api/stores`)
- `GET /` - List all stores with filtering
- `GET /{store_id}` - Get specific store
- `POST /` - Create new store
- `PUT /{store_id}` - Update store
- `GET /regions/options` - Get region dropdown options
- `GET /regions/summary` - Get region summary with store types

### Inventory (`/api/inventory`)
- `GET /` - List inventory with pagination and filtering
- `GET /kpi` - Get KPI data (total value, products, alerts)
- `GET /trends` - Get inventory trend data
- `GET /categories` - Get category distribution
- `GET /alerts/low-stock` - Get low stock alerts
- `PUT /{inventory_id}` - Update inventory levels

### Orders (`/api/orders`)
- `GET /` - List orders with filtering
- `GET /{order_id}` - Get specific order
- `POST /` - Create new order

### Products (`/api/products`)
- `GET /` - List products with filtering
- `GET /{product_id}` - Get specific product
- `POST /` - Create new product
- `GET /categories/list` - Get all categories
- `GET /brands/list` - Get all brands

### Users (`/api/users`)
- `GET /` - List users with filtering
- `GET /{user_id}` - Get specific user
- `POST /` - Create new user

## Setup Instructions

### 1. Prerequisites

- Python 3.8 or higher
- PostgreSQL database
- Virtual environment (recommended)

### 2. Installation

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Database Configuration

1. Copy the environment file:
```bash
cp env.example .env
```

2. Update `.env` with your database credentials:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/store_flow_analytics
DB_HOST=localhost
DB_PORT=5432
DB_NAME=store_flow_analytics
DB_USER=your_username
DB_PASSWORD=your_password

DEBUG=True
API_PREFIX=/api
```

### 4. Database Setup

Make sure your PostgreSQL database is running and has the required tables. Refer to the `../DATABASE_SETUP.md` file for schema creation.

### 5. Running the Server

```bash
# Start the development server
python startup.py

# Or alternatively with uvicorn directly:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API Base URL: `http://localhost:8000`
- Interactive Docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Development

### Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── database/
│   │   ├── __init__.py
│   │   └── connection.py      # Database connection management
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py         # Pydantic models
│   └── routers/
│       ├── __init__.py
│       ├── stores.py          # Store endpoints
│       ├── inventory.py       # Inventory endpoints
│       ├── orders.py          # Order endpoints
│       ├── users.py           # User endpoints
│       └── products.py        # Product endpoints
├── main.py                    # FastAPI application
├── startup.py                 # Server startup script
├── requirements.txt           # Python dependencies
├── env.example               # Environment variables template
└── README.md                 # This file
```

### Adding New Endpoints

1. Create or update the appropriate router in `app/routers/`
2. Add Pydantic models in `app/models/schemas.py` if needed
3. Update the router imports in `main.py`

### Database Queries

The application uses raw SQL queries with psycopg2 for database operations. Use the `get_db_cursor()` context manager for database operations:

```python
from app.database.connection import get_db_cursor

with get_db_cursor() as cursor:
    cursor.execute("SELECT * FROM stores")
    results = cursor.fetchall()
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string | - |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `store_flow_analytics` |
| `DB_USER` | Database username | - |
| `DB_PASSWORD` | Database password | - |
| `DEBUG` | Enable debug mode (also sets LOG_LEVEL=DEBUG) | `True` |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARNING, ERROR) | `INFO` |
| `API_PREFIX` | API route prefix | `/api` |
| `DATABRICKS_HOST` | Databricks workspace URL | - |
| `DATABRICKS_TOKEN` | Personal access token for local dev | - |

## Logging

The application uses centralized logging with ISO 8601 time format:

```
2025-06-01T22:14:19+0100 [INFO] app.config: 🔐 Databricks authentication successful
```

### Log Levels
- **DEBUG**: Detailed debugging information
- **INFO**: General operational information  
- **WARNING**: Warning messages for potential issues
- **ERROR**: Error messages for failures

### Configuration
Set logging level in your `.env` file:
```env
LOG_LEVEL=INFO  # Options: DEBUG, INFO, WARNING, ERROR
DEBUG=true      # Alternative way to enable DEBUG level
```

## Error Handling

The API returns consistent error responses:

```json
{
    "detail": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

## CORS Configuration

The API is configured to accept requests from:
- `http://localhost:3000` (React development server)
- `http://localhost:5173` (Vite development server)

## Production Deployment

For production deployment:

1. Set `DEBUG=False` in environment variables
2. Use a production WSGI server like Gunicorn
3. Configure proper database connection pooling
4. Set up SSL/TLS certificates
5. Use environment-specific configuration

```bash
# Production example with Gunicorn
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --host 0.0.0.0 --port 8000
``` 