-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('store_manager', 'regional_manager')),
    store_id INTEGER REFERENCES stores(store_id),
    region VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stores table (migrate from locations)
CREATE TABLE IF NOT EXISTS stores (
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

-- Products table
CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    package_size VARCHAR(50) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    store_id INTEGER REFERENCES stores(store_id),
    quantity_cases INTEGER NOT NULL DEFAULT 0,
    reserved_cases INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    UNIQUE(product_id, store_id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_store_product ON inventory(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(to_store_id);

-- Create Materialized Views
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.inventory_summary AS
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

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.order_trends AS
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

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.low_stock_alerts AS
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

-- Create indexes on materialized views
CREATE INDEX IF NOT EXISTS idx_inventory_summary_region ON analytics.inventory_summary(region);
CREATE INDEX IF NOT EXISTS idx_order_trends_day ON analytics.order_trends(order_day);
CREATE INDEX IF NOT EXISTS idx_low_stock_status ON analytics.low_stock_alerts(stock_status);

-- Create Analytics Functions
CREATE OR REPLACE FUNCTION analytics.get_regional_performance(region_name TEXT)
RETURNS TABLE(
    store_name TEXT,
    total_inventory_value DECIMAL,
    pending_orders INTEGER,
    fulfillment_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.store_name::TEXT,
        COALESCE(SUM(i.quantity_cases * p.unit_price), 0) as total_inventory_value,
        COUNT(o.order_id)::INTEGER as pending_orders,
        COALESCE(
            COUNT(CASE WHEN o.order_status = 'fulfilled' THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(o.order_id), 0) * 100, 0
        ) as fulfillment_rate
    FROM stores s
    LEFT JOIN inventory i ON s.store_id = i.store_id
    LEFT JOIN products p ON i.product_id = p.product_id
    LEFT JOIN orders o ON s.store_id = o.to_store_id 
        AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'
    WHERE s.region = region_name AND s.store_type != 'Warehouse'
    GROUP BY s.store_name
    ORDER BY total_inventory_value DESC;
END;
$$ LANGUAGE plpgsql;