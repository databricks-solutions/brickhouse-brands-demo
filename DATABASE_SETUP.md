# Database Setup Guide

This guide will help you set up a PostgreSQL database for the Brickstore Brands application with FastAPI backend integration.

## Architecture Overview

The application now uses a **three-tier architecture**:

1. **Frontend (React/TypeScript)** - User interface with HTTP API calls
2. **Backend (FastAPI)** - API layer handling business logic and database operations  
3. **Database (PostgreSQL)** - Data persistence layer

The frontend **no longer connects directly** to PostgreSQL. Instead, it communicates with the FastAPI backend via HTTP API calls.

## Prerequisites

- PostgreSQL 12+ installed and running
- Python 3.8+ for FastAPI backend
- Node.js and npm for frontend
- Access to create databases and users

## Database Setup

### 1. Create Database and User

Connect to PostgreSQL as a superuser and run:

```sql
-- Create database
CREATE DATABASE store_analytics;

-- Create user (optional, you can use existing user)
CREATE USER store_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE store_analytics TO store_user;
```

### 2. Set Up Schema

Navigate to the project root and run the schema file:

```bash
# Using psql command line
psql -U store_user -d store_analytics -f database/schema.sql

# Or if using default postgres user
psql -U postgres -d store_analytics -f database/schema.sql
```

### 3. Load Sample Data (Optional)

To populate the database with sample data for testing:

```bash
# Load sample data
psql -U store_user -d store_analytics -f database/sample_data.sql

# Or if using default postgres user
psql -U postgres -d store_analytics -f database/sample_data.sql
```

## Environment Configuration

### Frontend Configuration

The frontend only needs the FastAPI backend URL. Create a `.env` file in the **frontend root**:

```env
# FastAPI Backend Configuration
VITE_API_BASE_URL=http://0.0.0.0:8000/api

# Development settings (optional)
NODE_ENV=development
```

### Backend Configuration

The FastAPI backend handles database connections. Configure the backend's `.env` file:

```env
# PostgreSQL Database Configuration (for FastAPI backend)
DATABASE_URL=postgresql://store_user:your_secure_password@localhost:5432/store_analytics
DB_HOST=localhost
DB_PORT=5432
DB_NAME=store_analytics
DB_USER=store_user
DB_PASSWORD=your_secure_password
DB_SSL=false

# FastAPI Configuration
API_PREFIX=/api
DEBUG=True
```

## Testing the Setup

### 1. Test Database Connection (Backend)

Start the FastAPI backend and verify database connectivity:

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python startup.py
```

Check the backend logs for successful database connection messages.

### 2. Test API Connection (Frontend)

Start the React development server:

```bash
npm run dev
```

The frontend will automatically test the API connection on startup. Check the browser console for connection status messages.

### 3. Verify API Endpoints

Visit the FastAPI interactive documentation:
- API Docs: `http://localhost:8000/docs`
- Alternative UI: `http://localhost:8000/redoc`

## Database Schema Overview

The database includes the following main tables:

### Core Tables
- **users**: Internal users (store managers, regional managers)
- **stores**: Store locations with regions and types
- **products**: Product catalog with brands, categories, and pricing
- **inventory**: Stock levels per product per store
- **orders**: Simplified order system (no separate order_items table)

### Analytics Schema
- **analytics.inventory_summary**: Materialized view for inventory analytics
- **analytics.order_trends**: Materialized view for order trend analysis
- **analytics.low_stock_alerts**: Materialized view for low stock monitoring

## Sample Data

The sample data includes:
- **10 stores** across 4 regions (Northeast, Southeast, Midwest, West)
- **13 users** (9 store managers, 4 regional managers)
- **15 products** across 5 categories (Beverages, Snacks, Dairy, Frozen, Personal Care)
- **Inventory records** for all store-product combinations
- **10 sample orders** with various statuses

## API Services

The frontend now uses HTTP-based services that call FastAPI endpoints:

### InventoryService
- `getInventory()` - GET `/api/inventory` with filtering and pagination
- `getKPIData()` - GET `/api/inventory/kpis` for key performance indicators
- `getInventoryTrends()` - GET `/api/inventory/trends` for historical data
- `getCategoryDistribution()` - GET `/api/inventory/category-distribution`
- `updateStock()` - PATCH `/api/inventory/{id}/stock` to update levels
- `getLowStockAlerts()` - GET `/api/inventory/low-stock-alerts`
- `getInventorySummary()` - GET `/api/inventory/summary` for analytics

### OrderService
- `getOrders()` - GET `/api/orders` with filtering and pagination
- `getOrderById()` - GET `/api/orders/{id}` for detailed information
- `createOrder()` - POST `/api/orders` to create new orders
- `approveOrder()` - PATCH `/api/orders/{id}/approve`
- `fulfillOrder()` - PATCH `/api/orders/{id}/fulfill`
- `cancelOrder()` - PATCH `/api/orders/{id}/cancel`
- `getPendingApprovals()` - GET `/api/orders/pending-approvals`
- `bulkApproveOrders()` - PATCH `/api/orders/bulk-approve`

### StoreService
- `getStores()` - GET `/api/stores` with filtering and pagination
- `getStoreById()` - GET `/api/stores/{id}` for store details
- `getStoreOptions()` - GET `/api/stores/options` for dropdowns
- `getRegions()` - GET `/api/stores/regions` for available regions
- `createStore()` - POST `/api/stores` to add new stores
- `updateStore()` - PATCH `/api/stores/{id}` to update details
- `getStorePerformance()` - GET `/api/stores/performance` for analytics

### UserService
- `getUsers()` - GET `/api/users` with filtering and pagination
- `getUserById()` - GET `/api/users/{id}` for user details
- `createUser()` - POST `/api/users` to create new users
- `updateUser()` - PATCH `/api/users/{id}` to update details
- `getUsersByRole()` - GET `/api/users/role/{role}`
- `getUserPermissions()` - GET `/api/users/{id}/permissions`

### ProductService
- `getProducts()` - GET `/api/products` with filtering and pagination
- `getProductById()` - GET `/api/products/{id}` for product details
- `createProduct()` - POST `/api/products` to create new products
- `getCategories()` - GET `/api/products/categories`
- `getBrands()` - GET `/api/products/brands`
- `getProductPerformance()` - GET `/api/products/performance`

## State Management

The application continues to use Zustand for state management with four main stores:

- **useInventoryStore**: Manages inventory data, KPIs, and filters via API calls
- **useOrderStore**: Manages order data and operations via API calls
- **useStoreStore**: Manages store data and operations via API calls  
- **useUserStore**: Manages user data and authentication context via API calls

All stores now use the HTTP-based services instead of direct database connections.

## Key Features

- **API-based architecture**: Frontend communicates with FastAPI backend
- **Environment-based configuration**: Separate configs for frontend and backend
- **Connection pooling**: Optimized database performance (handled by backend)
- **Type-safe API**: Full TypeScript coverage with axios HTTP client
- **Materialized views**: Pre-computed analytics for performance (backend)
- **User roles**: Store managers and regional managers with appropriate permissions
- **Order workflow**: Pending → Approved → Fulfilled status flow
- **Low stock monitoring**: Automated alerts for inventory management
- **Regional analytics**: Performance tracking by region
- **Error handling**: Comprehensive HTTP error handling and user feedback

## Troubleshooting

### API Connection Issues
- Verify FastAPI backend is running on port 8000
- Check `VITE_API_BASE_URL` in frontend `.env` file
- Ensure backend `/api` prefix is correctly configured
- Check browser console for API request/response logs

### Backend Database Issues
- Verify PostgreSQL is running: `sudo service postgresql status`
- Check backend database connection string in backend `.env`
- Ensure database credentials are correct
- Check FastAPI backend logs for database connection errors

### Permission Issues
- Make sure the database user has proper permissions
- Check if the database exists: `\l` in psql
- Verify backend can connect to database

### Schema Issues
- Verify the schema was applied correctly: `\dt` in psql
- Check for any error messages during schema creation
- Ensure materialized views were created: `\dm` in psql

### CORS Issues (Development)
- Ensure FastAPI backend has CORS configured for frontend origin
- Check browser network tab for CORS-related errors
- Verify frontend and backend are running on expected ports

## Production Considerations

For production deployment:

### Frontend
1. Set production API URL in environment variables
2. Build optimized frontend bundle: `npm run build`
3. Deploy to static hosting or CDN
4. Configure proper error boundaries and fallbacks

### Backend
1. Use production database with proper connection pooling
2. Enable database SSL connections
3. Set up proper logging and monitoring
4. Use environment-specific configuration
5. Deploy with production WSGI server (Gunicorn/Uvicorn)
6. Set up database backups and monitoring

### Database
1. Use managed PostgreSQL services for reliability
2. Set up read replicas for scaling
3. Monitor database performance and query optimization
4. Set up automated backups
5. Implement proper user authentication and authorization
6. Monitor materialized view refresh performance

## Support

If you encounter issues:

1. **Frontend Issues**: Check browser console for API request errors
2. **Backend Issues**: Check FastAPI backend logs for database/API errors  
3. **Database Issues**: Verify PostgreSQL connectivity and schema setup
4. **Network Issues**: Ensure frontend can reach backend API endpoints
5. **Environment Issues**: Verify all required environment variables are set correctly

## Migration from Direct Database Connection

If migrating from a previous version that used direct database connections:

1. Remove old database environment variables (`VITE_DB_*`)
2. Add new API environment variable (`VITE_API_BASE_URL`)
3. Ensure FastAPI backend is properly configured and running
4. Test API connectivity using browser developer tools
5. Verify all features work through the new API layer 