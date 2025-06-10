# Database - PostgreSQL Schema & Data Management

Database initialization and management tools for the Brickhouse Brands demo application, featuring automated schema creation and realistic demo data generation against PostgreSQL.

## 📒 Table of Contents

- [🗄️ Database Schema](#️-database-schema)
- [🚀 Quick Setup](#-quick-setup)
- [🔧 Database Setup Script](#-database-setup-script)
- [📊 Generated Demo Data](#-generated-demo-data)
- [🔄 Data Lifecycle](#-data-lifecycle)
- [📈 Analytics & Performance](#-analytics--performance)
- [🛠️ Development Tools](#️-development-tools)
- [🔐 Security & Permissions](#-security--permissions)
- [🧪 Testing & Validation](#-testing--validation)
- [🔄 Maintenance](#-maintenance)

## 🗄️ Database Schema

The application uses a normalized PostgreSQL schema designed for inventory management:

### Core Tables

- **`products`** - Product catalog with categories and pricing information
- **`stores`** - Store locations with regional organization and type classification
- **`users`** - User accounts with role-based access (store managers, regional managers)
- **`inventory`** - Stock levels across all product/store combinations
- **`orders`** - Order lifecycle management with approval workflows

### Schema Design

```sql
-- Products: Beverage products offered by CPG
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    package_size VARCHAR(50) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stores: Retail locations across the US
CREATE TABLE stores (
    store_id SERIAL PRIMARY KEY,
    store_name VARCHAR(255) NOT NULL,
    store_code VARCHAR(20) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    region VARCHAR(50) NOT NULL,
    store_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users: Internal CPG staff
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('store_manager', 'regional_manager')),
    store_id INTEGER REFERENCES stores(store_id),
    region VARCHAR(50),
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory: Stock levels across stores and headquarters
CREATE TABLE inventory (
    inventory_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    store_id INTEGER REFERENCES stores(store_id),
    quantity_cases INTEGER NOT NULL DEFAULT 0,
    reserved_cases INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    UNIQUE(product_id, store_id)
);

-- Orders: Order tracking and approval workflow
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    from_store_id INTEGER REFERENCES stores(store_id),
    to_store_id INTEGER NOT NULL REFERENCES stores(store_id),
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    quantity_cases INTEGER NOT NULL,
    order_status VARCHAR(50) NOT NULL DEFAULT 'pending_review' 
        CHECK (order_status IN ('pending_review', 'approved', 'fulfilled', 'cancelled')),
    requested_by INTEGER NOT NULL REFERENCES users(user_id),
    approved_by INTEGER REFERENCES users(user_id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_date TIMESTAMP,
    fulfilled_date TIMESTAMP,
    notes TEXT,
    version INTEGER DEFAULT 1
);

-- Performance indexes
CREATE INDEX idx_inventory_store_product ON inventory(store_id, product_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_store ON orders(to_store_id);
```

## 🚀 Quick Setup

### Automated Setup

The database is automatically configured when you run the main project setup:

```bash
# From project root - sets up all components including database
./setup-env.sh

# Initialize database with demo data
cd database
source venv/bin/activate
python demo_setup.py
```

### Manual Setup

For database-specific operations:

```bash
cd database
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database setup
python demo_setup.py
```

## 🔧 Database Setup Script

### Environment Variable Integration

The `demo_setup.py` script automatically loads environment variables from your `.env` file (created by `setup-env.sh`), so **you typically don't need to pass any command line arguments**:

```bash
# Simple setup - uses environment variables from .env
python demo_setup.py

# Test connection without making changes
python demo_setup.py --dry-run
```

### Command Line Options

All configuration options are available as command line arguments for advanced usage or overrides:

| Option | Description | Default | Environment Variable |
|--------|-------------|---------|---------------------|
| `--host` | Database host | `localhost` | `DB_HOST` |
| `--port` | Database port | `5432` | `DB_PORT` |
| `--database` | Database name | `postgres` | `DB_NAME` |
| `--schema` | Database schema | `public` | `DB_SCHEMA` |
| `--user` | Database username | `postgres` | `DB_USER` |
| `--password` | Database password | *(from env)* | `DB_PASSWORD` |
| `--batch-size` | Batch size for data insertion | `500` | - |
| `--fulfilled-orders` | Number of fulfilled orders | `226832` | - |
| `--pending-orders` | Number of pending orders | `1347` | - |
| `--cancelled-orders` | Number of cancelled orders | `580` | - |
| `--approved-orders` | Number of approved orders | `13532` | - |
| `--dry-run` | Test connection without changes | `false` | - |

### Usage Examples

```bash
# Basic setup using environment variables (recommended)
python demo_setup.py

# Override specific settings
python demo_setup.py --batch-size 1000 --fulfilled-orders 500000

# Use with different database (overriding environment)
python demo_setup.py \
  --host prod-db.example.com \
  --database brickhouse_prod \
  --user prod_user \
  --password $PROD_DB_PASSWORD

# Test connection without making changes
python demo_setup.py --dry-run

# Custom order volumes for testing
python demo_setup.py \
  --fulfilled-orders 10000 \
  --pending-orders 50 \
  --cancelled-orders 25 \
  --approved-orders 100
```

## 📊 Generated Demo Data

### Data Volumes

The setup script generates comprehensive demo data:

- **Products**: 50+ beverage products across 8 categories
- **Stores**: 20 locations (4 warehouses + 16 retail stores) across 4 US regions
- **Users**: 24 total users (20 store managers + 4 regional managers)
- **Inventory**: ~1,000 inventory records (products × stores)
- **Orders**: 240K+ orders with realistic distribution and growth patterns

### Product Categories

Mock beverage inventory across categories (to avoid copyright issues):

```python
CATEGORIES = {
    'Cola': ['Fizzy Classic Cola', 'Thunder Cola', 'Zero Splash Diet Cola', 'Professor Fizz', ...],
    'Citrus': ['Crystal Lime', 'Lucky Lemon', 'Peak Citrus Rush', 'Zesty Grapefruit', ...],
    'Soda': ['Root Beer Classic', 'Cream Soda Delight', 'Ginger Ale Supreme', 'Orange Soda Pop', ...],
    'Water': ['Pure Stream Water', 'Mountain Spring Water', 'Crystal Smart Water', ...],
    'Flavored Water': ['Lemon Cucumber Water', 'Berry Mint Infusion', 'Watermelon Basil Water', ...],
    'Sparkling Water': ['Classic Sparkling Water', 'Lime Sparkling Water', 'Berry Sparkling Water', ...],
    'Sports Drink': ['Hydro Punch', 'Energy Wave Blue', 'Muscle Fuel Strawberry', ...],
    'Energy Drink': ['Thunder Bolt Energy', 'Beast Mode Energy', 'Rocket Fuel Energy', ...],
    'Juice': ['Sunrise Orange', 'Berry Coast Cranberry', 'Apple Orchard Fresh', ...],
    'Coffee': ['Café Chill Frappuccino', 'Morning Rush Cold Brew', 'Vanilla Latte RTD', ...],
    'Tea': ['Golden Leaf Sweet Tea', 'Nature Brew Green Tea', 'Chai Spice Latte', ...],
    'Kombucha': ['Ginger Lemon Kombucha', 'Berry Blast Kombucha', 'Green Tea Kombucha', ...],
    'Plant Milk': ['Almond Milk Original', 'Oat Milk Vanilla', 'Coconut Milk Unsweetened', ...],
    'Functional': ['Immune Boost Citrus', 'Probiotic Berry Blend', 'Brain Boost Blueberry', ...],
    'Protein': ['Chocolate Protein Shake', 'Vanilla Protein Smoothie', 'Coffee Protein Fusion', ...],
    'Vitamin Water': ['Vitamin C Orange', 'B-Complex Berry', 'Multi-Vitamin Tropical', ...],
    'Mocktail': ['Virgin Mojito', 'Sparkling Cranberry', 'Ginger Moscow Mule', ...]
}
```

**Note**: All product names and brands are fictional mock data created specifically for this demo to avoid any copyright or trademark issues.

### Regional Distribution

Stores organized across eight US regions:

- **Southeast**: Georgia (Atlanta), Florida (Miami, Orlando, Tampa), North Carolina (Charlotte)
- **West**: California (Los Angeles, San Francisco, San Diego), Nevada (Las Vegas)
- **South**: Texas (Dallas, Houston, Austin), Tennessee (Nashville)
- **Midwest**: Illinois (Chicago), Minnesota (Minneapolis), Missouri (Kansas City), Michigan (Detroit)
- **Northeast**: Massachusetts (Boston), New York (New York City), Pennsylvania (Philadelphia)
- **Northwest**: Washington (Seattle), Oregon (Portland)
- **Southwest**: Arizona (Phoenix)
- **Mountain**: Colorado (Denver), Utah (Salt Lake City)

### Store Types

The demo includes diverse store formats:

- **Warehouse**: 1 headquarters location (Atlanta, GA)
- **Urban**: 11 city center locations for high foot traffic
- **Tourist**: 3 locations in tourist destinations (Miami Beach, Las Vegas, Orlando, NYC)
- **Business**: 3 locations in business districts (Denver, Charlotte, Tampa)
- **Suburban**: 1 suburban location (Dallas)
- **Shopping**: 2 locations in shopping centers (Houston, Kansas City)
- **Entertainment**: 2 locations in entertainment districts (Nashville, Austin)

**Total**: 26 locations across 8 regions with 1 warehouse and 25 retail stores

### Order Patterns

Realistic order generation with:

- **Seasonal variations** - Higher volumes in summer months
- **Weekly patterns** - Business days vs weekends
- **Growth trends** - Increasing volume over time
- **Approval workflows** - Realistic approval and fulfillment timing
- **Store type differences** - Warehouses vs retail locations

## 🔄 Data Lifecycle

### Setup Process

The setup script follows a structured approach:

1. **Schema Creation** - Create all tables with proper constraints and indexes
2. **Static Data Population** - Products, stores, and users
3. **Inventory Initialization** - Realistic stock levels for all product/store combinations
4. **Order Generation** - Historical order data with realistic patterns
5. **Analytics Setup** - Views and indexes for performance

## 📈 Analytics & Performance

### Analytics Schema

The setup creates a dedicated `analytics` schema with pre-built materialized views for dashboard performance.

### Materialized Views

Pre-built analytics views for dashboard performance:

```sql
-- Inventory summary by region and brand
CREATE MATERIALIZED VIEW analytics.inventory_summary AS
SELECT 
    s.region,
    s.store_name,
    p.brand,
    p.category,
    SUM(i.quantity_cases) as total_cases,
    SUM(i.reserved_cases) as total_reserved,
    SUM(i.quantity_cases * p.unit_price) as inventory_value,
    COUNT(DISTINCT p.product_id) as product_count
FROM inventory i
JOIN stores s ON i.store_id = s.store_id
JOIN products p ON i.product_id = p.product_id
WHERE s.store_type != 'Warehouse'
GROUP BY s.region, s.store_name, p.brand, p.category;

-- Order trends by day (last 30 days)
CREATE MATERIALIZED VIEW analytics.order_trends AS
SELECT 
    DATE_TRUNC('day', o.order_date) as order_day,
    s.region,
    p.category,
    COUNT(*) as order_count,
    SUM(o.quantity_cases) as total_cases_ordered,
    SUM(o.quantity_cases * p.unit_price) as total_order_value,
    COUNT(CASE WHEN o.order_status = 'fulfilled' THEN 1 END) as fulfilled_orders,
    AVG(EXTRACT(EPOCH FROM (o.fulfilled_date - o.order_date))/3600) as avg_fulfillment_hours
FROM orders o
JOIN stores s ON o.to_store_id = s.store_id
JOIN products p ON o.product_id = p.product_id
WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', o.order_date), s.region, p.category;

-- Low stock alerts with severity levels
CREATE MATERIALIZED VIEW analytics.low_stock_alerts AS
SELECT 
    s.store_name,
    s.region,
    p.product_name,
    p.brand,
    i.quantity_cases,
    i.reserved_cases,
    (i.quantity_cases - i.reserved_cases) as available_cases,
    CASE 
        WHEN (i.quantity_cases - i.reserved_cases) <= 10 THEN 'CRITICAL'
        WHEN (i.quantity_cases - i.reserved_cases) <= 25 THEN 'LOW'
        ELSE 'NORMAL'
    END as stock_status
FROM inventory i
JOIN stores s ON i.store_id = s.store_id
JOIN products p ON i.product_id = p.product_id
WHERE s.store_type != 'Warehouse'
AND (i.quantity_cases - i.reserved_cases) <= 25;
```

### Performance Indexes

Analytics-specific indexes for optimized query performance:

```sql
-- Analytics materialized view indexes
CREATE INDEX idx_inventory_summary_region ON analytics.inventory_summary(region);
CREATE INDEX idx_order_trends_day ON analytics.order_trends(order_day);
CREATE INDEX idx_low_stock_status ON analytics.low_stock_alerts(stock_status);

-- Base table indexes (created during schema setup)
CREATE INDEX idx_inventory_store_product ON inventory(store_id, product_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_store ON orders(to_store_id);
```

## 🛠️ Development Tools

### Data Inspection

Useful queries for development and testing:

```sql
-- Check data volumes
SELECT 
    'products' as table_name, COUNT(*) as record_count FROM products
UNION ALL
SELECT 'stores', COUNT(*) FROM stores
UNION ALL  
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL
SELECT 'orders', COUNT(*) FROM orders;

-- Inventory status by region
SELECT 
    s.region,
    COUNT(*) as total_items,
    AVG(i.quantity_cases) as avg_stock,
    COUNT(*) FILTER (WHERE i.quantity_cases <= 50) as low_stock_count
FROM inventory i
JOIN stores s ON i.store_id = s.store_id
GROUP BY s.region;

-- Order status distribution
SELECT order_status, COUNT(*), ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM orders 
GROUP BY order_status 
ORDER BY COUNT(*) DESC;

-- Top performing products by order volume
SELECT 
    p.product_name,
    p.brand,
    p.category,
    COUNT(o.order_id) as total_orders,
    SUM(o.quantity_cases) as total_cases_ordered,
    SUM(o.quantity_cases * p.unit_price) as total_value
FROM orders o
JOIN products p ON o.product_id = p.product_id
WHERE o.order_status = 'fulfilled'
GROUP BY p.product_id, p.product_name, p.brand, p.category
ORDER BY total_cases_ordered DESC
LIMIT 10;

-- Store performance by region
SELECT 
    s.region,
    s.store_name,
    COUNT(o.order_id) as orders_placed,
    SUM(CASE WHEN o.order_status = 'fulfilled' THEN 1 ELSE 0 END) as fulfilled_orders,
    AVG(i.quantity_cases) as avg_inventory_level
FROM stores s
LEFT JOIN orders o ON s.store_id = o.to_store_id
LEFT JOIN inventory i ON s.store_id = i.store_id
WHERE s.store_type != 'Warehouse'
GROUP BY s.store_id, s.region, s.store_name
ORDER BY orders_placed DESC;
```

### Data Refresh

Refresh materialized views after data changes:

```sql
REFRESH MATERIALIZED VIEW analytics.inventory_summary;
REFRESH MATERIALIZED VIEW analytics.order_trends;
REFRESH MATERIALIZED VIEW analytics.low_stock_alerts;
```

## 🔐 Security & Permissions

### Database User Management

We recommend creating a dedicated service account for database interactions:

```sql
-- Create dedicated service account
CREATE USER api_service_account WITH 
    ENCRYPTED PASSWORD 'SomeSecurePassword123'
    LOGIN
    NOCREATEDB 
    NOCREATEROLE;

-- Grant database connection
GRANT CONNECT ON DATABASE postgres TO api_service_account;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO api_service_account;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO api_service_account;

-- Grant sequence permissions (for auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO api_service_account;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO api_service_account;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT USAGE, SELECT ON SEQUENCES TO api_service_account;

-- Create read-only user for analytics
CREATE USER analytics_user WITH 
    ENCRYPTED PASSWORD 'analytics_password'
    LOGIN
    NOCREATEDB 
    NOCREATEROLE;

GRANT CONNECT ON DATABASE postgres TO analytics_user;
GRANT USAGE ON SCHEMA public TO analytics_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_user;
GRANT USAGE ON SCHEMA analytics TO analytics_user;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO analytics_user;
```

Update your `.env` file to use the service account credentials:
```bash
DB_USER=api_service_account
DB_PASSWORD=SomeSecurePassword123
```

## 🧪 Testing & Validation

### Data Validation

Built-in validation checks:

```python
# Example validation in demo_setup.py
def validate_data_integrity():
    """Validate data relationships and constraints"""
    
    # Check referential integrity
    cursor.execute("""
        SELECT COUNT(*) FROM inventory i 
        LEFT JOIN products p ON i.product_id = p.id 
        WHERE p.id IS NULL
    """)
    orphaned_inventory = cursor.fetchone()[0]
    
    # Check stock levels
    cursor.execute("""
        SELECT COUNT(*) FROM inventory 
        WHERE quantity_cases < 0
    """)
    invalid_stock = cursor.fetchone()[0]
    
    return orphaned_inventory == 0 and invalid_stock == 0
```

### Performance Testing

A simulation app is included in the root project for performance testing and load generation scenarios.  
Kindly note that this app is not intended for official benchmarking purposes but rather to provide some guidance on database optimization.

## 🔄 Maintenance

### Regular Maintenance Tasks

```sql
-- Update table statistics for query optimization
ANALYZE;

-- Vacuum to reclaim space and update statistics
VACUUM ANALYZE;

-- Refresh materialized views (can be automated)
REFRESH MATERIALIZED VIEW inventory_summary_by_region;
REFRESH MATERIALIZED VIEW order_trends;
```

### Backup Recommendations

```bash
# Full database backup
pg_dump -h <db-host> -U <db-user> -d databricks_postgres > backup.sql

# Schema-only backup
pg_dump -h <db-host> -U <db-user> -d databricks_postgres --schema-only > schema.sql

# Data-only backup
pg_dump -h <db-host> -U <db-user> -d databricks_postgres --data-only > data.sql
``` 