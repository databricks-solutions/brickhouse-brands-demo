-- Sample data for Brickhouse Brands Database
-- This file contains sample data to populate the database for testing

-- Insert sample stores
INSERT INTO stores (store_name, store_code, address, city, state, zip_code, region, store_type) VALUES
('Downtown Boston Store', 'BOS001', '123 Washington St', 'Boston', 'MA', '02101', 'Northeast', 'Retail'),
('Cambridge Store', 'CAM001', '456 Harvard Ave', 'Cambridge', 'MA', '02138', 'Northeast', 'Retail'),
('New York Flagship', 'NYC001', '789 Broadway', 'New York', 'NY', '10003', 'Northeast', 'Flagship'),
('Atlanta Central', 'ATL001', '321 Peachtree St', 'Atlanta', 'GA', '30309', 'Southeast', 'Retail'),
('Miami Beach Store', 'MIA001', '654 Ocean Dr', 'Miami', 'FL', '33139', 'Southeast', 'Retail'),
('Chicago Loop', 'CHI001', '987 Michigan Ave', 'Chicago', 'IL', '60601', 'Midwest', 'Retail'),
('Detroit Store', 'DET001', '147 Woodward Ave', 'Detroit', 'MI', '48226', 'Midwest', 'Retail'),
('Los Angeles Store', 'LAX001', '258 Sunset Blvd', 'Los Angeles', 'CA', '90028', 'West', 'Retail'),
('San Francisco Store', 'SFO001', '369 Market St', 'San Francisco', 'CA', '94102', 'West', 'Retail'),
('Regional Warehouse', 'WH001', '1000 Industrial Blvd', 'Memphis', 'TN', '38118', 'Southeast', 'Warehouse');

-- Insert sample users
INSERT INTO users (username, email, first_name, last_name, role, store_id, region) VALUES
-- Store Managers
('jsmith_bos', 'john.smith@company.com', 'John', 'Smith', 'store_manager', 1, 'Northeast'),
('mwilson_cam', 'mary.wilson@company.com', 'Mary', 'Wilson', 'store_manager', 2, 'Northeast'),
('rjohnson_nyc', 'robert.johnson@company.com', 'Robert', 'Johnson', 'store_manager', 3, 'Northeast'),
('sbrown_atl', 'sarah.brown@company.com', 'Sarah', 'Brown', 'store_manager', 4, 'Southeast'),
('dgarcia_mia', 'david.garcia@company.com', 'David', 'Garcia', 'store_manager', 5, 'Southeast'),
('lmiller_chi', 'lisa.miller@company.com', 'Lisa', 'Miller', 'store_manager', 6, 'Midwest'),
('kdavis_det', 'kevin.davis@company.com', 'Kevin', 'Davis', 'store_manager', 7, 'Midwest'),
('awilliams_lax', 'amanda.williams@company.com', 'Amanda', 'Williams', 'store_manager', 8, 'West'),
('cjones_sfo', 'chris.jones@company.com', 'Chris', 'Jones', 'store_manager', 9, 'West'),
-- Regional Managers
('tmartinez_ne', 'tom.martinez@company.com', 'Tom', 'Martinez', 'regional_manager', NULL, 'Northeast'),
('kanderson_se', 'karen.anderson@company.com', 'Karen', 'Anderson', 'regional_manager', NULL, 'Southeast'),
('bthomas_mw', 'brian.thomas@company.com', 'Brian', 'Thomas', 'regional_manager', NULL, 'Midwest'),
('jlee_west', 'jennifer.lee@company.com', 'Jennifer', 'Lee', 'regional_manager', NULL, 'West');

-- Insert sample products
INSERT INTO products (product_name, brand, category, package_size, unit_price) VALUES
('Premium Cola 12-Pack', 'CocaCola', 'Beverages', '12 x 12oz cans', 8.99),
('Orange Juice', 'Tropicana', 'Beverages', '64oz bottle', 4.99),
('Energy Drink 4-Pack', 'RedBull', 'Beverages', '4 x 8.4oz cans', 12.99),
('Organic Potato Chips', 'Kettle Brand', 'Snacks', '8oz bag', 3.99),
('Mixed Nuts', 'Planters', 'Snacks', '16oz container', 6.99),
('Protein Bars 6-Pack', 'Clif Bar', 'Snacks', '6 x 2.4oz bars', 9.99),
('Whole Milk', 'Organic Valley', 'Dairy', '1 gallon', 5.99),
('Greek Yogurt', 'Chobani', 'Dairy', '32oz container', 7.99),
('Cheese Slices', 'Kraft', 'Dairy', '12oz package', 4.49),
('Frozen Pizza', 'DiGiorno', 'Frozen', '12 inch pizza', 8.99),
('Ice Cream', 'Ben & Jerrys', 'Frozen', '1 pint', 6.99),
('Frozen Vegetables', 'Birds Eye', 'Frozen', '12oz bag', 2.99),
('Shampoo', 'Pantene', 'Personal Care', '16oz bottle', 12.99),
('Body Wash', 'Dove', 'Personal Care', '18oz bottle', 9.99),
('Toothpaste', 'Crest', 'Personal Care', '4.1oz tube', 3.99);

-- Insert sample inventory data
-- Generate inventory for each store-product combination with realistic quantities
INSERT INTO inventory (product_id, store_id, quantity_cases, reserved_cases) 
SELECT 
    p.product_id,
    s.store_id,
    -- Random quantity between 20-150 cases for retail stores, 200-500 for warehouse
    CASE 
        WHEN s.store_type = 'Warehouse' THEN FLOOR(RANDOM() * 300) + 200
        ELSE FLOOR(RANDOM() * 130) + 20
    END as quantity_cases,
    -- Random reserved cases (0-10% of total)
    CASE 
        WHEN s.store_type = 'Warehouse' THEN FLOOR(RANDOM() * 20)
        ELSE FLOOR(RANDOM() * 10)
    END as reserved_cases
FROM products p
CROSS JOIN stores s;

-- Insert sample orders
INSERT INTO orders (order_number, from_store_id, to_store_id, product_id, quantity_cases, order_status, requested_by, notes) VALUES
-- Recent orders from various stores
('ORD000001', 10, 1, 1, 25, 'fulfilled', 1, 'Regular restock - Cola selling well'),
('ORD000002', 10, 2, 3, 15, 'approved', 2, 'Energy drinks for weekend promotion'),
('ORD000003', 10, 4, 7, 30, 'pending_review', 4, 'Milk supply running low'),
('ORD000004', 10, 6, 10, 20, 'fulfilled', 6, 'Pizza for game day weekend'),
('ORD000005', 10, 8, 13, 12, 'pending_review', 8, 'Shampoo promotion next week'),
('ORD000006', 10, 3, 2, 40, 'approved', 3, 'Orange juice for breakfast rush'),
('ORD000007', 10, 5, 11, 18, 'cancelled', 5, 'Ice cream order - cancelled due to freezer issues'),
('ORD000008', 10, 7, 5, 22, 'fulfilled', 7, 'Nuts for healthy snack display'),
('ORD000009', 10, 9, 14, 35, 'pending_review', 9, 'Body wash running low'),
('ORD000010', 10, 1, 6, 28, 'approved', 1, 'Protein bars for fitness section');

-- Update some orders with approval information
UPDATE orders SET approved_by = 10, approved_date = NOW() - INTERVAL '2 days' WHERE order_status = 'approved' AND to_store_id IN (SELECT store_id FROM stores WHERE region = 'Northeast');
UPDATE orders SET approved_by = 11, approved_date = NOW() - INTERVAL '1 day' WHERE order_status = 'approved' AND to_store_id IN (SELECT store_id FROM stores WHERE region = 'Southeast');
UPDATE orders SET approved_by = 12, approved_date = NOW() - INTERVAL '3 days' WHERE order_status = 'approved' AND to_store_id IN (SELECT store_id FROM stores WHERE region = 'Midwest');
UPDATE orders SET approved_by = 13, approved_date = NOW() - INTERVAL '1 day' WHERE order_status = 'approved' AND to_store_id IN (SELECT store_id FROM stores WHERE region = 'West');

-- Update fulfilled orders with fulfillment dates
UPDATE orders SET fulfilled_date = approved_date + INTERVAL '1 day' WHERE order_status = 'fulfilled';

-- Refresh materialized views
REFRESH MATERIALIZED VIEW analytics.inventory_summary;
REFRESH MATERIALIZED VIEW analytics.order_trends;
REFRESH MATERIALIZED VIEW analytics.low_stock_alerts; 