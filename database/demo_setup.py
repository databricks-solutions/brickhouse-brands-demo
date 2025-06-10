#!/usr/bin/env python3
"""
This script is used to setup the database for the Brickhouse Brands demo application.
It creates the database schema and populates the database with static data.
"""

import argparse
from collections import defaultdict
import os
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from threading import Lock

import numpy as np
import psycopg2
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
from psycopg2.extras import execute_batch
from tqdm import tqdm

# Load environment variables
load_dotenv()


def parse_arguments():
    """Parse command line arguments for database configuration"""
    parser = argparse.ArgumentParser(
        description="Setup database for Brickhouse Brands demo application",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--host",
        default=os.getenv("DB_HOST", "localhost"),
        help="Database host",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("DB_PORT", "5432")),
        help="Database port",
    )
    parser.add_argument(
        "--database",
        default=os.getenv("DB_NAME", "postgres"),
        help="Database name",
    )
    parser.add_argument(
        "--schema",
        default=os.getenv("DB_SCHEMA", "public"),
        help="Database schema",
    )
    parser.add_argument(
        "--user",
        default=os.getenv("DB_USER", "postgres"),
        help="Database username",
    )
    parser.add_argument(
        "--password",
        default=os.getenv("DB_PASSWORD") or "",
        help="Database password (can also use DB_PASSWORD env var)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Batch size for data insertion",
    )
    parser.add_argument(
        "--fulfilled-orders",
        type=int,
        default=226834,
        help="Number of fulfilled orders to generate",
    )
    parser.add_argument(
        "--pending-orders",
        type=int,
        default=1347,
        help="Number of pending review orders to generate",
    )
    parser.add_argument(
        "--cancelled-orders",
        type=int,
        default=580,
        help="Number of cancelled orders to generate",
    )
    parser.add_argument(
        "--approved-orders",
        type=int,
        default=13532,
        help="Number of approved orders to generate",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Test database connection without making changes",
    )

    return parser.parse_args()


# Parse command line arguments
args = parse_arguments()

# Database configuration from command line args (with env var fallbacks)
DB_HOST = args.host
DB_PORT = args.port
DB_NAME = args.database
DB_SCHEMA = args.schema
DB_USER = args.user
DB_PASS = args.password

if not DB_PASS:
    print("Error: Database password is required")
    print("Provide it via --password argument or DB_PASSWORD environment variable")
    sys.exit(1)

# Data generation configuration
AS_OF_DATE = datetime.now().strftime("%Y-%m-%d")

# Batch processing options (configurable via command line)
BATCH_SIZE = args.batch_size
MAX_WORKERS = 16
PROGRESS_UPDATE_INTERVAL = 100
MAX_RETRIES = 3
DEADLOCK_RETRY_DELAY = 0.1

# Order counts by status (configurable via command line)
FULFILLED_ORDERS_COUNT = args.fulfilled_orders
PENDING_REVIEW_ORDERS_COUNT = args.pending_orders
CANCELLED_ORDERS_COUNT = args.cancelled_orders
APPROVED_ORDERS_COUNT = args.approved_orders

# Growth trends
USE_GROWTH_PATTERN = True
MONTHLY_GROWTH_RATE = 0.12
BACKFILL_MONTHS = 6

# Threading locks
progress_lock = Lock()
failed_batches_lock = Lock()
failed_batches = []

# Parse the as-of date
as_of_datetime = datetime.strptime(AS_OF_DATE, "%Y-%m-%d")
backfill_start_date = as_of_datetime - relativedelta(months=BACKFILL_MONTHS)


def get_connection():
    """Create a database connection"""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        sslmode="require",
    )


def get_connection_pool():
    """Create a connection pool for thread-safe database operations"""
    # Note: This is a simplified connection factory
    # In production, you might want to use a proper connection pool like psycopg2.pool
    return get_connection()


def create_schema():
    """Create the database schema"""
    print("🏗️  Creating database schema...")
    conn = get_connection()
    cursor = conn.cursor()

    # Set schema
    cursor.execute(f"SET search_path TO {DB_SCHEMA};")

    # Products table - beverage products offered by CPG
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            product_id SERIAL PRIMARY KEY,
            product_name VARCHAR(255) NOT NULL,
            brand VARCHAR(100) NOT NULL,
            category VARCHAR(50) NOT NULL,
            package_size VARCHAR(50) NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """
    )

    # Stores table - retail locations across the US
    cursor.execute(
        """
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
    """
    )

    # Users table - internal CPG staff
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
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
    """
    )

    # Inventory table - stock levels across stores and headquarters
    cursor.execute(
        """
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
    """
    )

    # Orders table - order tracking and approval workflow
    cursor.execute(
        """
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
    """
    )

    # Create indexes for performance
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_inventory_store_product ON inventory(store_id, product_id);"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(to_store_id);"
    )

    conn.commit()
    cursor.close()
    conn.close()
    print("✅ Database schema created successfully!")


def populate_static_data():
    """Populate the database with static data for products, stores, and users"""
    print("📊 Populating static data...")
    conn = get_connection()
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute("TRUNCATE TABLE users, stores, products RESTART IDENTITY CASCADE;")

    # Insert beverage products
    products_data = [
        # Cola Category (expanded)
        ("Fizzy Classic Cola", "BubbleCorp", "Cola", "24x12oz cans", 18.99),
        ("Thunder Cola", "Lightning Beverages", "Cola", "24x12oz cans", 18.49),
        ("Zero Splash Diet Cola", "BubbleCorp", "Cola", "24x12oz cans", 18.99),
        ("Lightning Zero Sugar", "Lightning Beverages", "Cola", "24x12oz cans", 18.49),
        ("Cherry Burst Cola", "BubbleCorp", "Cola", "24x12oz cans", 19.49),
        ("Professor Fizz", "Vintage Soda Co", "Cola", "24x12oz cans", 18.79),
        ("Vanilla Dream Cola", "BubbleCorp", "Cola", "24x12oz cans", 19.29),
        ("Retro Classic Cola", "Vintage Soda Co", "Cola", "24x12oz cans", 17.99),
        ("Max Power Cola", "Lightning Beverages", "Cola", "24x12oz cans", 19.99),
        ("Royal Crown Cola", "Premium Sodas", "Cola", "24x12oz cans", 20.49),
        # Citrus/Lemon-Lime Category (expanded)
        ("Crystal Lime", "BubbleCorp", "Citrus", "24x12oz cans", 17.99),
        ("Lucky Lemon", "Vintage Soda Co", "Citrus", "24x12oz cans", 17.79),
        ("Peak Citrus Rush", "Lightning Beverages", "Citrus", "24x12oz cans", 19.49),
        ("Misty Lime Splash", "Lightning Beverages", "Citrus", "24x12oz cans", 17.99),
        ("Golden Orange Burst", "Vintage Soda Co", "Citrus", "24x12oz cans", 18.29),
        ("Zesty Grapefruit", "BubbleCorp", "Citrus", "24x12oz cans", 18.49),
        (
            "Tropical Citrus Blend",
            "Lightning Beverages",
            "Citrus",
            "24x12oz cans",
            19.79,
        ),
        ("Lemon Lime Twist", "Fresh Fizz Co", "Citrus", "24x12oz cans", 17.89),
        ("Blood Orange Sensation", "Premium Sodas", "Citrus", "24x12oz cans", 20.99),
        ("Lime Mint Fusion", "BubbleCorp", "Citrus", "24x12oz cans", 18.79),
        # Other Sodas/Soft Drinks (new category)
        ("Root Beer Classic", "BubbleCorp", "Soda", "24x12oz cans", 18.49),
        ("Cream Soda Delight", "Vintage Soda Co", "Soda", "24x12oz cans", 18.79),
        ("Ginger Ale Supreme", "Lightning Beverages", "Soda", "24x12oz cans", 17.99),
        ("Orange Soda Pop", "BubbleCorp", "Soda", "24x12oz cans", 17.49),
        ("Grape Soda Fizz", "Fruit Fizz Co", "Soda", "24x12oz cans", 17.29),
        ("Black Cherry Soda", "Premium Sodas", "Soda", "24x12oz cans", 19.49),
        ("Strawberry Cream Soda", "Vintage Soda Co", "Soda", "24x12oz cans", 18.99),
        ("Pineapple Soda", "Tropical Drinks Co", "Soda", "24x12oz cans", 18.29),
        ("Dr. Pepper Style", "Unique Sodas", "Soda", "24x12oz cans", 18.89),
        ("Birch Beer Original", "Craft Soda Co", "Soda", "24x12oz cans", 19.99),
        # Water Category (expanded)
        ("Pure Stream Water", "BubbleCorp", "Water", "24x16.9oz bottles", 12.99),
        (
            "Aqua Fresh Water",
            "Lightning Beverages",
            "Water",
            "24x16.9oz bottles",
            12.79,
        ),
        ("Crystal Smart Water", "BubbleCorp", "Water", "24x16.9oz bottles", 24.99),
        ("Mountain Spring Water", "Alpine Waters", "Water", "24x16.9oz bottles", 32.99),
        ("Glacier Pure Water", "Arctic Springs", "Water", "24x16.9oz bottles", 28.99),
        ("Alkaline Spring Water", "Pure Life Co", "Water", "24x16.9oz bottles", 35.99),
        ("Artesian Well Water", "Premium Waters", "Water", "24x16.9oz bottles", 38.99),
        (
            "Electrolyte Enhanced Water",
            "BubbleCorp",
            "Water",
            "24x16.9oz bottles",
            29.99,
        ),
        ("Mineral Rich Water", "Natural Springs", "Water", "24x16.9oz bottles", 31.99),
        ("Purified Drinking Water", "Hydro Pure", "Water", "24x16.9oz bottles", 11.99),
        # Flavored Waters (new category)
        (
            "Lemon Cucumber Water",
            "BubbleCorp",
            "Flavored Water",
            "24x16.9oz bottles",
            19.99,
        ),
        (
            "Berry Mint Infusion",
            "Lightning Beverages",
            "Flavored Water",
            "24x16.9oz bottles",
            20.49,
        ),
        (
            "Watermelon Basil Water",
            "Fresh Infusions",
            "Flavored Water",
            "24x16.9oz bottles",
            21.99,
        ),
        (
            "Peach Ginger Water",
            "Natural Flavor Co",
            "Flavored Water",
            "24x16.9oz bottles",
            20.99,
        ),
        (
            "Lime Coconut Water",
            "Tropical Waters",
            "Flavored Water",
            "24x16.9oz bottles",
            22.49,
        ),
        (
            "Strawberry Lemon Water",
            "BubbleCorp",
            "Flavored Water",
            "24x16.9oz bottles",
            19.79,
        ),
        (
            "Raspberry Lime Water",
            "Berry Fresh Co",
            "Flavored Water",
            "24x16.9oz bottles",
            21.29,
        ),
        (
            "Mango Passion Water",
            "Exotic Waters",
            "Flavored Water",
            "24x16.9oz bottles",
            23.99,
        ),
        # Sparkling Water (new category)
        (
            "Classic Sparkling Water",
            "BubbleCorp",
            "Sparkling Water",
            "24x12oz cans",
            16.99,
        ),
        (
            "Lime Sparkling Water",
            "Lightning Beverages",
            "Sparkling Water",
            "24x12oz cans",
            17.49,
        ),
        (
            "Grapefruit Sparkling Water",
            "Citrus Bubbles",
            "Sparkling Water",
            "24x12oz cans",
            17.99,
        ),
        (
            "Berry Sparkling Water",
            "Fresh Bubbles",
            "Sparkling Water",
            "24x12oz cans",
            18.29,
        ),
        (
            "Orange Sparkling Water",
            "BubbleCorp",
            "Sparkling Water",
            "24x12oz cans",
            17.79,
        ),
        (
            "Cucumber Mint Sparkling",
            "Premium Bubbles",
            "Sparkling Water",
            "24x12oz cans",
            19.49,
        ),
        (
            "Watermelon Sparkling Water",
            "Summer Fizz Co",
            "Sparkling Water",
            "24x12oz cans",
            18.99,
        ),
        (
            "Peach Sparkling Water",
            "Orchard Bubbles",
            "Sparkling Water",
            "24x12oz cans",
            18.49,
        ),
        # Sports Drinks (expanded)
        (
            "Hydro Punch",
            "Lightning Beverages",
            "Sports Drink",
            "12x32oz bottles",
            24.99,
        ),
        (
            "Hydro Lemon-Lime",
            "Lightning Beverages",
            "Sports Drink",
            "12x32oz bottles",
            24.99,
        ),
        ("Energy Wave Blue", "BubbleCorp", "Sports Drink", "12x32oz bottles", 23.99),
        ("Energy Wave Red", "BubbleCorp", "Sports Drink", "12x32oz bottles", 23.99),
        (
            "Muscle Fuel Strawberry",
            "BubbleCorp",
            "Sports Drink",
            "12x16oz bottles",
            26.99,
        ),
        (
            "Electro Orange",
            "Athletic Performance",
            "Sports Drink",
            "12x32oz bottles",
            25.49,
        ),
        (
            "Power Grape",
            "Lightning Beverages",
            "Sports Drink",
            "12x32oz bottles",
            24.79,
        ),
        (
            "Tropical Punch Sport",
            "Island Athletics",
            "Sports Drink",
            "12x32oz bottles",
            25.99,
        ),
        (
            "Coconut Water Sport",
            "Natural Athletes",
            "Sports Drink",
            "12x16oz bottles",
            29.99,
        ),
        (
            "Recovery Formula",
            "Pro Sports Nutrition",
            "Sports Drink",
            "12x20oz bottles",
            31.99,
        ),
        # Energy Drinks (expanded)
        ("Thunder Bolt Energy", "Storm Drinks", "Energy Drink", "24x8.4oz cans", 45.99),
        ("Beast Mode Energy", "Wild Energy Co", "Energy Drink", "24x16oz cans", 52.99),
        (
            "Rocket Fuel Energy",
            "Lightning Beverages",
            "Energy Drink",
            "24x16oz cans",
            48.99,
        ),
        (
            "Blast Energy Blue Razz",
            "Explosive Drinks",
            "Energy Drink",
            "12x16oz cans",
            34.99,
        ),
        ("Voltage Energy", "Electric Drinks", "Energy Drink", "24x8.4oz cans", 46.99),
        ("Adrenaline Rush", "Extreme Energy", "Energy Drink", "24x16oz cans", 54.99),
        (
            "Zero Sugar Lightning",
            "Lightning Beverages",
            "Energy Drink",
            "24x16oz cans",
            49.99,
        ),
        (
            "Natural Energy Boost",
            "Organic Energy Co",
            "Energy Drink",
            "12x12oz cans",
            38.99,
        ),
        (
            "Tropical Energy Blast",
            "Island Energy",
            "Energy Drink",
            "24x8.4oz cans",
            47.99,
        ),
        ("Coffee Energy Fusion", "Café Energy", "Energy Drink", "12x16oz cans", 36.99),
        # Juices (expanded)
        ("Sunrise Orange", "BubbleCorp", "Juice", "12x59oz bottles", 28.99),
        (
            "Tropical Burst Orange",
            "Lightning Beverages",
            "Juice",
            "12x59oz bottles",
            29.99,
        ),
        ("Simply Fresh Orange", "BubbleCorp", "Juice", "12x52oz bottles", 32.99),
        ("Berry Coast Cranberry", "Coastal Juices", "Juice", "12x64oz bottles", 35.99),
        ("Apple Orchard Fresh", "Farm Fresh Juices", "Juice", "12x64oz bottles", 33.99),
        ("Grape Vineyard", "Premium Juices", "Juice", "12x59oz bottles", 36.99),
        ("Pineapple Paradise", "Tropical Juices", "Juice", "12x46oz bottles", 31.99),
        ("Pomegranate Power", "Antioxidant Juices", "Juice", "12x32oz bottles", 42.99),
        ("Mango Madness", "Exotic Juices", "Juice", "12x46oz bottles", 34.99),
        ("Mixed Berry Blend", "Berry Best Juices", "Juice", "12x59oz bottles", 37.99),
        ("Grapefruit Fresh", "Citrus Grove", "Juice", "12x52oz bottles", 30.99),
        ("Watermelon Fresh", "Summer Harvest", "Juice", "12x46oz bottles", 29.99),
        # Coffee Drinks (expanded)
        (
            "Café Chill Frappuccino",
            "Coffee House Co",
            "Coffee",
            "12x13.7oz bottles",
            24.99,
        ),
        ("Morning Rush Cold Brew", "Donut Café", "Coffee", "12x13.7oz bottles", 22.99),
        (
            "Vanilla Latte RTD",
            "Premium Coffee Co",
            "Coffee",
            "12x13.7oz bottles",
            26.99,
        ),
        ("Mocha Madness", "Chocolate Coffee Co", "Coffee", "12x13.7oz bottles", 25.99),
        ("Caramel Macchiato", "Sweet Coffee Co", "Coffee", "12x13.7oz bottles", 27.49),
        ("Iced Coffee Classic", "BubbleCorp", "Coffee", "12x16oz bottles", 23.99),
        ("Espresso Shot RTD", "Intense Coffee Co", "Coffee", "12x8oz bottles", 29.99),
        ("Nitro Cold Brew", "Craft Coffee Co", "Coffee", "12x11oz cans", 31.99),
        (
            "Protein Coffee Shake",
            "Fitness Coffee Co",
            "Coffee",
            "12x14oz bottles",
            34.99,
        ),
        (
            "Coconut Coffee Cooler",
            "Tropical Coffee Co",
            "Coffee",
            "12x13.7oz bottles",
            28.99,
        ),
        # Tea Drinks (expanded)
        ("Golden Leaf Sweet Tea", "BubbleCorp", "Tea", "12x18.5oz bottles", 19.99),
        (
            "Nature Brew Green Tea",
            "Lightning Beverages",
            "Tea",
            "12x18.5oz bottles",
            20.99,
        ),
        ("Chai Spice Latte", "Spice Tea Co", "Tea", "12x13.7oz bottles", 23.99),
        ("Matcha Green Tea", "Zen Tea Co", "Tea", "12x16oz bottles", 27.99),
        ("Peach Iced Tea", "Southern Tea Co", "Tea", "12x18.5oz bottles", 21.99),
        ("Raspberry Iced Tea", "Berry Tea Co", "Tea", "12x18.5oz bottles", 22.49),
        ("White Tea Antioxidant", "Pure Tea Co", "Tea", "12x16oz bottles", 25.99),
        ("Hibiscus Herbal Tea", "Herbal Blends Co", "Tea", "12x16oz bottles", 24.99),
        ("Earl Grey Iced Tea", "Classic Tea Co", "Tea", "12x18.5oz bottles", 23.49),
        ("Lemon Ginger Tea", "Wellness Tea Co", "Tea", "12x16oz bottles", 26.49),
        # Kombucha (new category)
        (
            "Ginger Lemon Kombucha",
            "Probiotic Brew Co",
            "Kombucha",
            "12x16oz bottles",
            35.99,
        ),
        (
            "Berry Blast Kombucha",
            "Fermented Fresh",
            "Kombucha",
            "12x16oz bottles",
            36.99,
        ),
        ("Green Tea Kombucha", "Zen Brew Co", "Kombucha", "12x16oz bottles", 34.99),
        (
            "Hibiscus Rose Kombucha",
            "Floral Ferments",
            "Kombucha",
            "12x16oz bottles",
            38.99,
        ),
        (
            "Pineapple Turmeric Kombucha",
            "Tropical Cultures",
            "Kombucha",
            "12x16oz bottles",
            37.99,
        ),
        ("Original GT Kombucha", "GT Brewing Co", "Kombucha", "12x16oz bottles", 39.99),
        ("Lavender Kombucha", "Artisan Ferments", "Kombucha", "12x16oz bottles", 41.99),
        (
            "Watermelon Mint Kombucha",
            "Summer Cultures",
            "Kombucha",
            "12x16oz bottles",
            36.49,
        ),
        # Plant-Based Beverages (new category)
        ("Almond Milk Original", "Nut Milk Co", "Plant Milk", "12x32oz cartons", 41.99),
        ("Oat Milk Vanilla", "Grain Beverages", "Plant Milk", "12x32oz cartons", 43.99),
        (
            "Coconut Milk Unsweetened",
            "Tropical Milk Co",
            "Plant Milk",
            "12x32oz cartons",
            39.99,
        ),
        (
            "Soy Milk Chocolate",
            "Bean Beverages",
            "Plant Milk",
            "12x32oz cartons",
            38.99,
        ),
        (
            "Cashew Milk Original",
            "Premium Nut Co",
            "Plant Milk",
            "12x32oz cartons",
            45.99,
        ),
        (
            "Rice Milk Vanilla",
            "Grain Goodness Co",
            "Plant Milk",
            "12x32oz cartons",
            37.99,
        ),
        (
            "Hemp Milk Original",
            "Hemp Harvest Co",
            "Plant Milk",
            "12x32oz cartons",
            47.99,
        ),
        (
            "Pea Protein Milk",
            "Plant Protein Co",
            "Plant Milk",
            "12x32oz cartons",
            49.99,
        ),
        # Functional Beverages (new category)
        (
            "Immune Boost Citrus",
            "Wellness Drinks",
            "Functional",
            "12x16oz bottles",
            31.99,
        ),
        (
            "Probiotic Berry Blend",
            "Gut Health Co",
            "Functional",
            "12x16oz bottles",
            33.99,
        ),
        (
            "Collagen Beauty Water",
            "Beauty Beverages",
            "Functional",
            "12x16oz bottles",
            45.99,
        ),
        (
            "Brain Boost Blueberry",
            "Cognitive Drinks",
            "Functional",
            "12x16oz bottles",
            38.99,
        ),
        ("Detox Green Juice", "Cleanse Co", "Functional", "12x16oz bottles", 42.99),
        (
            "Energy & Focus",
            "Mental Performance",
            "Functional",
            "12x16oz bottles",
            39.99,
        ),
        (
            "Sleep Support Chamomile",
            "Rest Beverages",
            "Functional",
            "12x16oz bottles",
            34.99,
        ),
        (
            "Hydration Plus",
            "Electrolyte Plus Co",
            "Functional",
            "12x16oz bottles",
            29.99,
        ),
        # Protein Drinks (new category)
        (
            "Chocolate Protein Shake",
            "Muscle Nutrition",
            "Protein",
            "12x14oz bottles",
            44.99,
        ),
        (
            "Vanilla Protein Smoothie",
            "Fit Beverages",
            "Protein",
            "12x14oz bottles",
            43.99,
        ),
        (
            "Strawberry Protein Drink",
            "Athletic Nutrition",
            "Protein",
            "12x14oz bottles",
            44.49,
        ),
        (
            "Cookies & Cream Protein",
            "Dessert Nutrition",
            "Protein",
            "12x14oz bottles",
            46.99,
        ),
        (
            "Coffee Protein Fusion",
            "Caffeine Gains",
            "Protein",
            "12x14oz bottles",
            47.99,
        ),
        (
            "Plant Protein Vanilla",
            "Vegan Gains Co",
            "Protein",
            "12x14oz bottles",
            48.99,
        ),
        (
            "Banana Protein Smoothie",
            "Tropical Gains",
            "Protein",
            "12x14oz bottles",
            45.49,
        ),
        (
            "Chocolate Peanut Protein",
            "Nut Gains Co",
            "Protein",
            "12x14oz bottles",
            49.99,
        ),
        # Vitamin Waters (new category)
        (
            "Vitamin C Orange",
            "Vitamin Waters Co",
            "Vitamin Water",
            "24x20oz bottles",
            39.99,
        ),
        (
            "B-Complex Berry",
            "Energy Vitamins",
            "Vitamin Water",
            "24x20oz bottles",
            41.99,
        ),
        (
            "Vitamin D Lemon",
            "Sunshine Vitamins",
            "Vitamin Water",
            "24x20oz bottles",
            40.99,
        ),
        (
            "Multi-Vitamin Tropical",
            "Complete Nutrition",
            "Vitamin Water",
            "24x20oz bottles",
            43.99,
        ),
        (
            "Antioxidant Pomegranate",
            "Antioxidant Waters",
            "Vitamin Water",
            "24x20oz bottles",
            44.99,
        ),
        ("Calcium Citrus", "Bone Health Co", "Vitamin Water", "24x20oz bottles", 42.99),
        (
            "Iron Plus Cherry",
            "Mineral Waters Co",
            "Vitamin Water",
            "24x20oz bottles",
            41.49,
        ),
        (
            "Magnesium Mint",
            "Relaxation Waters",
            "Vitamin Water",
            "24x20oz bottles",
            40.49,
        ),
        # Mocktails/Non-Alcoholic (new category)
        ("Virgin Mojito", "Mocktail Masters", "Mocktail", "12x12oz bottles", 27.99),
        (
            "Sparkling Cranberry",
            "Celebration Drinks",
            "Mocktail",
            "12x12oz bottles",
            25.99,
        ),
        (
            "Ginger Moscow Mule",
            "Premium Mocktails",
            "Mocktail",
            "12x12oz bottles",
            29.99,
        ),
        (
            "Virgin Piña Colada",
            "Tropical Mocktails",
            "Mocktail",
            "12x12oz bottles",
            31.99,
        ),
        (
            "Sparkling Grape Juice",
            "Festive Beverages",
            "Mocktail",
            "12x12oz bottles",
            24.99,
        ),
        (
            "Virgin Bloody Mary",
            "Savory Mocktails",
            "Mocktail",
            "12x12oz bottles",
            28.99,
        ),
        (
            "Cucumber Gin & Tonic",
            "Garden Mocktails",
            "Mocktail",
            "12x12oz bottles",
            30.99,
        ),
        (
            "Elderflower Spritz",
            "Floral Mocktails",
            "Mocktail",
            "12x12oz bottles",
            32.99,
        ),
    ]
    # Insert products
    cursor.executemany(
        "INSERT INTO products (product_name, brand, category, package_size, unit_price) VALUES (%s, %s, %s, %s, %s)",
        products_data,
    )

    # Insert store data
    stores_data = [
        (
            "Headquarters Warehouse",
            "HQ000",
            "1000 Corporate Blvd",
            "Atlanta",
            "GA",
            "30328",
            "Southeast",
            "Warehouse",
        ),
        (
            "Downtown Chicago Store",
            "CHI001",
            "123 Michigan Ave",
            "Chicago",
            "IL",
            "60601",
            "Midwest",
            "Urban",
        ),
        (
            "Suburban Dallas Store",
            "DAL002",
            "456 Preston Rd",
            "Dallas",
            "TX",
            "75201",
            "South",
            "Suburban",
        ),
        (
            "Los Angeles Metro",
            "LAX003",
            "789 Sunset Blvd",
            "Los Angeles",
            "CA",
            "90028",
            "West",
            "Urban",
        ),
        (
            "Miami Beach Store",
            "MIA004",
            "321 Ocean Dr",
            "Miami",
            "FL",
            "33139",
            "Southeast",
            "Tourist",
        ),
        (
            "Seattle Downtown",
            "SEA005",
            "654 Pine St",
            "Seattle",
            "WA",
            "98101",
            "Northwest",
            "Urban",
        ),
        (
            "Atlanta Midtown",
            "ATL006",
            "987 Peachtree St",
            "Atlanta",
            "GA",
            "30309",
            "Southeast",
            "Urban",
        ),
        (
            "Phoenix Central",
            "PHX007",
            "147 Central Ave",
            "Phoenix",
            "AZ",
            "85004",
            "Southwest",
            "Urban",
        ),
        (
            "Boston Commons",
            "BOS008",
            "258 Tremont St",
            "Boston",
            "MA",
            "02116",
            "Northeast",
            "Urban",
        ),
        (
            "Denver Tech Center",
            "DEN009",
            "369 Tech Center Dr",
            "Denver",
            "CO",
            "80237",
            "Mountain",
            "Business",
        ),
        (
            "Nashville Music Row",
            "NSH010",
            "741 Music Square",
            "Nashville",
            "TN",
            "37203",
            "South",
            "Entertainment",
        ),
        (
            "Houston Galleria",
            "HOU011",
            "5085 Westheimer Rd",
            "Houston",
            "TX",
            "77056",
            "South",
            "Shopping",
        ),
        (
            "Las Vegas Strip",
            "LAS012",
            "3200 Las Vegas Blvd",
            "Las Vegas",
            "NV",
            "89109",
            "West",
            "Tourist",
        ),
        (
            "Orlando Theme Park",
            "ORL013",
            "1234 International Dr",
            "Orlando",
            "FL",
            "32819",
            "Southeast",
            "Tourist",
        ),
        (
            "Minneapolis Skyway",
            "MSP014",
            "800 Nicollet Mall",
            "Minneapolis",
            "MN",
            "55402",
            "Midwest",
            "Urban",
        ),
        (
            "Portland Pearl District",
            "PDX015",
            "1420 NW Lovejoy St",
            "Portland",
            "OR",
            "97209",
            "Northwest",
            "Urban",
        ),
        (
            "San Francisco Union Square",
            "SFO016",
            "345 Stockton St",
            "San Francisco",
            "CA",
            "94108",
            "West",
            "Urban",
        ),
        (
            "New York Times Square",
            "NYC017",
            "1500 Broadway",
            "New York",
            "NY",
            "10036",
            "Northeast",
            "Tourist",
        ),
        (
            "Charlotte Uptown",
            "CLT018",
            "222 S Tryon St",
            "Charlotte",
            "NC",
            "28202",
            "Southeast",
            "Business",
        ),
        (
            "Kansas City Plaza",
            "MCI019",
            "4750 Broadway",
            "Kansas City",
            "MO",
            "64112",
            "Midwest",
            "Shopping",
        ),
        (
            "Salt Lake City Downtown",
            "SLC020",
            "50 W Broadway",
            "Salt Lake City",
            "UT",
            "84101",
            "Mountain",
            "Urban",
        ),
        (
            "Tampa Bay Area",
            "TPA021",
            "2223 N Westshore Blvd",
            "Tampa",
            "FL",
            "33607",
            "Southeast",
            "Business",
        ),
        (
            "San Diego Gaslamp",
            "SAN022",
            "555 Fifth Ave",
            "San Diego",
            "CA",
            "92101",
            "West",
            "Urban",
        ),
        (
            "Philadelphia Center City",
            "PHL023",
            "1234 Market St",
            "Philadelphia",
            "PA",
            "19107",
            "Northeast",
            "Urban",
        ),
        (
            "Detroit Renaissance",
            "DTW024",
            "400 Renaissance Dr",
            "Detroit",
            "MI",
            "48243",
            "Midwest",
            "Urban",
        ),
        (
            "Austin Downtown",
            "AUS025",
            "98 Red River St",
            "Austin",
            "TX",
            "78701",
            "South",
            "Entertainment",
        ),
    ]

    cursor.executemany(
        "INSERT INTO stores (store_name, store_code, address, city, state, zip_code, region, store_type) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        stores_data,
    )

    # Insert users data
    users_data = [
        # Store Managers (aligned with store IDs 1-25)
        (
            "hsmith",
            "holly.smith@cpg.com",
            "Holly",
            "Smith",
            "store_manager",
            1,
            "Midwest",
            "https://media.licdn.com/dms/image/v2/D4E03AQHhGDs3Yw0c8w/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1702582166483?e=1753920000&v=beta&t=yREAtqEv1RW0jg3RIbpXfvZCRjMq_QOc3yWOtsWjbwY",
        ),
        (
            "mjohnson",
            "mary.johnson@cpg.com",
            "Mary",
            "Johnson",
            "store_manager",
            2,
            "South",
            "https://randomuser.me/api/portraits/women/2.jpg",
        ),
        (
            "bwilliams",
            "bob.williams@cpg.com",
            "Bob",
            "Williams",
            "store_manager",
            3,
            "West",
            "https://randomuser.me/api/portraits/men/1.jpg",
        ),
        (
            "sgonzalez",
            "sofia.gonzalez@cpg.com",
            "Sofia",
            "Gonzalez",
            "store_manager",
            4,
            "Southeast",
            "https://randomuser.me/api/portraits/women/3.jpg",
        ),
        (
            "dchen",
            "david.chen@cpg.com",
            "David",
            "Chen",
            "store_manager",
            5,
            "Northwest",
            "https://randomuser.me/api/portraits/men/2.jpg",
        ),
        (
            "lbrown",
            "lisa.brown@cpg.com",
            "Lisa",
            "Brown",
            "store_manager",
            6,
            "Southeast",
            "https://randomuser.me/api/portraits/women/4.jpg",
        ),
        (
            "rgarcia",
            "robert.garcia@cpg.com",
            "Robert",
            "Garcia",
            "store_manager",
            7,
            "Southwest",
            "https://randomuser.me/api/portraits/men/3.jpg",
        ),
        (
            "kmiller",
            "karen.miller@cpg.com",
            "Karen",
            "Miller",
            "store_manager",
            8,
            "Northeast",
            "https://randomuser.me/api/portraits/women/5.jpg",
        ),
        (
            "tdavis",
            "tom.davis@cpg.com",
            "Tom",
            "Davis",
            "store_manager",
            9,
            "Mountain",
            "https://randomuser.me/api/portraits/men/4.jpg",
        ),
        (
            "awilson",
            "amy.wilson@cpg.com",
            "Amy",
            "Wilson",
            "store_manager",
            10,
            "South",
            "https://randomuser.me/api/portraits/women/6.jpg",
        ),
        (
            "crodriguez",
            "carlos.rodriguez@cpg.com",
            "Carlos",
            "Rodriguez",
            "store_manager",
            11,
            "South",
            "https://randomuser.me/api/portraits/men/5.jpg",
        ),
        (
            "jlee",
            "jessica.lee@cpg.com",
            "Jessica",
            "Lee",
            "store_manager",
            12,
            "West",
            "https://randomuser.me/api/portraits/women/7.jpg",
        ),
        (
            "mthomas",
            "michael.thomas@cpg.com",
            "Michael",
            "Thomas",
            "store_manager",
            13,
            "Southeast",
            "https://randomuser.me/api/portraits/men/6.jpg",
        ),
        (
            "swalker",
            "sarah.walker@cpg.com",
            "Sarah",
            "Walker",
            "store_manager",
            14,
            "Midwest",
            "https://randomuser.me/api/portraits/women/8.jpg",
        ),
        (
            "jharris",
            "james.harris@cpg.com",
            "James",
            "Harris",
            "store_manager",
            15,
            "Northwest",
            "https://randomuser.me/api/portraits/men/7.jpg",
        ),
        (
            "emartin",
            "emily.martin@cpg.com",
            "Emily",
            "Martin",
            "store_manager",
            16,
            "West",
            "https://randomuser.me/api/portraits/women/9.jpg",
        ),
        (
            "dclark",
            "daniel.clark@cpg.com",
            "Daniel",
            "Clark",
            "store_manager",
            17,
            "Northeast",
            "https://randomuser.me/api/portraits/men/8.jpg",
        ),
        (
            "alewis",
            "amanda.lewis@cpg.com",
            "Amanda",
            "Lewis",
            "store_manager",
            18,
            "Southeast",
            "https://randomuser.me/api/portraits/women/10.jpg",
        ),
        (
            "rjackson",
            "ryan.jackson@cpg.com",
            "Ryan",
            "Jackson",
            "store_manager",
            19,
            "Midwest",
            "https://randomuser.me/api/portraits/men/9.jpg",
        ),
        (
            "kwhite",
            "kevin.white@cpg.com",
            "Kevin",
            "White",
            "store_manager",
            20,
            "Mountain",
            "https://randomuser.me/api/portraits/men/10.jpg",
        ),
        (
            "lhall",
            "laura.hall@cpg.com",
            "Laura",
            "Hall",
            "store_manager",
            21,
            "Southeast",
            "https://randomuser.me/api/portraits/women/11.jpg",
        ),
        (
            "ballen",
            "brian.allen@cpg.com",
            "Brian",
            "Allen",
            "store_manager",
            22,
            "West",
            "https://randomuser.me/api/portraits/men/11.jpg",
        ),
        (
            "nking",
            "nicole.king@cpg.com",
            "Nicole",
            "King",
            "store_manager",
            23,
            "Northeast",
            "https://randomuser.me/api/portraits/women/12.jpg",
        ),
        (
            "jwright",
            "jason.wright@cpg.com",
            "Jason",
            "Wright",
            "store_manager",
            24,
            "Midwest",
            "https://randomuser.me/api/portraits/men/12.jpg",
        ),
        (
            "mscott",
            "melissa.scott@cpg.com",
            "Melissa",
            "Scott",
            "store_manager",
            25,
            "South",
            "https://randomuser.me/api/portraits/women/13.jpg",
        ),
        # Regional Managers (no store assignment)
        (
            "gmoodley",
            "giran.moodley@cpg.com",
            "Giran",
            "Moodley",
            "regional_manager",
            None,
            "Midwest",
            "https://media.licdn.com/dms/image/v2/C4D03AQEf-2-7ik3cuA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1586893805650?e=1753920000&v=beta&t=pRjsCJdshXqSeWtNKx3x3TBwLR-T3fY8PIXemv7uDDY",
        ),
        (
            "janderson",
            "jennifer.anderson@cpg.com",
            "Jennifer",
            "Anderson",
            "regional_manager",
            None,
            "South",
            "https://randomuser.me/api/portraits/women/14.jpg",
        ),
        (
            "slee",
            "steve.lee@cpg.com",
            "Steve",
            "Lee",
            "regional_manager",
            None,
            "West",
            "https://randomuser.me/api/portraits/men/14.jpg",
        ),
        (
            "nwhite",
            "nancy.white@cpg.com",
            "Nancy",
            "White",
            "regional_manager",
            None,
            "Southeast",
            "https://randomuser.me/api/portraits/women/15.jpg",
        ),
        (
            "pjones",
            "paul.jones@cpg.com",
            "Paul",
            "Jones",
            "regional_manager",
            None,
            "Northeast",
            "https://randomuser.me/api/portraits/men/15.jpg",
        ),
        (
            "rtaylor",
            "rachel.taylor@cpg.com",
            "Rachel",
            "Taylor",
            "regional_manager",
            None,
            "Northwest",
            "https://randomuser.me/api/portraits/women/16.jpg",
        ),
        (
            "ggreen",
            "gregory.green@cpg.com",
            "Gregory",
            "Green",
            "regional_manager",
            None,
            "Southwest",
            "https://randomuser.me/api/portraits/men/16.jpg",
        ),
        (
            "dadams",
            "diane.adams@cpg.com",
            "Diane",
            "Adams",
            "regional_manager",
            None,
            "Mountain",
            "https://randomuser.me/api/portraits/women/17.jpg",
        ),
    ]

    cursor.executemany(
        """
        INSERT INTO users (username, email, first_name, last_name, role, store_id, region, avatar_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """,
        users_data,
    )

    conn.commit()
    cursor.close()
    conn.close()
    print("✅ Static data populated successfully!")


def partition_orders_by_inventory_key(orders):
    """Partition orders by inventory key to reduce deadlock conflicts"""
    partitions = defaultdict(list)

    for order in orders:
        # Create a partition key based on product_id and store combination
        product_id = order[3]  # product_id
        to_store_id = order[2]  # to_store_id
        from_store_id = order[1]  # from_store_id (HQ)

        # Use hash to distribute orders across partitions evenly
        partition_key = hash((product_id, to_store_id, from_store_id)) % MAX_WORKERS
        partitions[partition_key].append(order)

    return partitions


def batch_insert_orders_with_retry(
    order_batch, connection=None, max_retries=MAX_RETRIES
):
    """Insert a batch of orders with deadlock retry logic"""
    if connection is None:
        connection = get_connection_pool()

    for attempt in range(max_retries + 1):
        cursor = connection.cursor()

        try:
            # Prepare the insert query
            insert_query = """
                INSERT INTO orders (order_number, from_store_id, to_store_id, product_id, 
                                  quantity_cases, order_status, requested_by, approved_by,
                                  order_date, approved_date, fulfilled_date, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            # Execute batch insert
            execute_batch(cursor, insert_query, order_batch, page_size=len(order_batch))
            connection.commit()

            return len(order_batch)

        except psycopg2.errors.DeadlockDetected as e:
            connection.rollback()
            if attempt < max_retries:
                # Wait with exponential backoff
                time.sleep(DEADLOCK_RETRY_DELAY * (2**attempt) + random.uniform(0, 0.1))
                continue
            else:
                raise e
        except Exception as e:
            connection.rollback()
            raise e
        finally:
            cursor.close()

    if connection:
        connection.close()


def batch_update_inventory_with_retry(
    inventory_updates, connection=None, max_retries=MAX_RETRIES
):
    """Update inventory with deadlock retry logic and ordered operations"""
    if connection is None:
        connection = get_connection_pool()

    for attempt in range(max_retries + 1):
        cursor = connection.cursor()

        try:
            # Sort inventory updates by (product_id, store_id) to ensure consistent ordering
            # This helps prevent deadlocks by ensuring all threads access rows in the same order
            quantity_updates = []
            reserved_updates = []

            for update in sorted(
                inventory_updates, key=lambda x: (x["product_id"], x["store_id"])
            ):
                if update["type"] == "quantity":
                    quantity_updates.append(
                        (update["change"], update["product_id"], update["store_id"])
                    )
                elif update["type"] == "reserved":
                    reserved_updates.append(
                        (update["change"], update["product_id"], update["store_id"])
                    )

            # Execute quantity updates first, then reserved updates (consistent ordering)
            if quantity_updates:
                quantity_query = """
                    UPDATE inventory 
                    SET quantity_cases = quantity_cases + %s 
                    WHERE product_id = %s AND store_id = %s
                """
                execute_batch(
                    cursor,
                    quantity_query,
                    quantity_updates,
                    page_size=len(quantity_updates),
                )

            if reserved_updates:
                reserved_query = """
                    UPDATE inventory 
                    SET reserved_cases = reserved_cases + %s 
                    WHERE product_id = %s AND store_id = %s
                """
                execute_batch(
                    cursor,
                    reserved_query,
                    reserved_updates,
                    page_size=len(reserved_updates),
                )

            connection.commit()

            return len(inventory_updates)

        except psycopg2.errors.DeadlockDetected as e:
            connection.rollback()
            if attempt < max_retries:
                # Wait with exponential backoff and jitter
                time.sleep(DEADLOCK_RETRY_DELAY * (2**attempt) + random.uniform(0, 0.1))
                continue
            else:
                raise e
        except Exception as e:
            connection.rollback()
            raise e
        finally:
            cursor.close()

    if connection:
        connection.close()


def generate_order_batch(
    order_status, batch_size, order_dates, reference_data, start_counter
):
    """Generate a batch of orders for a specific status"""
    orders = []
    inventory_updates = []

    product_ids, store_ids, store_managers, regional_managers, hq_store_id = (
        reference_data
    )

    for i, order_date in enumerate(order_dates[:batch_size]):
        order_counter = start_counter + i

        to_store_id = random.choice(store_ids[1:])  # Exclude HQ
        product_id = random.choice(product_ids)
        quantity = random.randint(5, 50)

        store_manager = next(
            (sm[0] for sm in store_managers if sm[1] == to_store_id),
            store_managers[0][0],
        )
        regional_manager = random.choice(regional_managers)

        # Initialize order data
        order_data = [
            f"ORD{order_counter:06d}",  # order_number
            hq_store_id,  # from_store_id
            to_store_id,  # to_store_id
            product_id,  # product_id
            quantity,  # quantity_cases
            order_status,  # order_status
            store_manager,  # requested_by
            None,  # approved_by
            order_date,  # order_date
            None,  # approved_date
            None,  # fulfilled_date
            None,  # notes
        ]

        # Status-specific processing
        if order_status == "fulfilled":
            approved_date = order_date + timedelta(hours=random.randint(2, 48))
            fulfilled_date = approved_date + timedelta(hours=random.randint(4, 72))

            order_data[7] = regional_manager  # approved_by
            order_data[9] = approved_date  # approved_date
            order_data[10] = fulfilled_date  # fulfilled_date

            # Inventory updates for fulfilled orders
            inventory_updates.extend(
                [
                    {
                        "type": "quantity",
                        "change": -quantity,
                        "product_id": product_id,
                        "store_id": hq_store_id,
                    },
                    {
                        "type": "quantity",
                        "change": quantity,
                        "product_id": product_id,
                        "store_id": to_store_id,
                    },
                ]
            )

        elif order_status == "approved":
            approved_date = order_date + timedelta(hours=random.randint(2, 24))

            order_data[7] = regional_manager  # approved_by
            order_data[9] = approved_date  # approved_date

            # Reserve inventory for approved orders
            inventory_updates.append(
                {
                    "type": "reserved",
                    "change": quantity,
                    "product_id": product_id,
                    "store_id": hq_store_id,
                }
            )

        elif order_status == "cancelled":
            # Some cancelled orders were approved first
            if random.random() < 0.3:  # 30% were approved then cancelled
                approved_date = order_date + timedelta(hours=random.randint(2, 48))
                order_data[7] = regional_manager  # approved_by
                order_data[9] = approved_date  # approved_date
                order_data[11] = random.choice(
                    [  # notes
                        "Insufficient inventory at fulfillment time",
                        "Store request cancellation",
                        "Product recall - safety issue",
                        "Transportation issues",
                    ]
                )
            else:  # 70% cancelled during review
                order_data[11] = random.choice(
                    [  # notes
                        "Insufficient inventory available",
                        "Order exceeds store capacity",
                        "Duplicate order detected",
                        "Budget constraints",
                    ]
                )

        orders.append(order_data)

    return orders, inventory_updates


def process_order_batch_with_recovery(args):
    """Process a batch of orders with comprehensive error handling"""
    order_status, batch_dates, reference_data, start_counter, pbar = args

    batch_id = f"{order_status}_{start_counter}"

    try:
        # Generate orders and inventory updates
        orders, inventory_updates = generate_order_batch(
            order_status, len(batch_dates), batch_dates, reference_data, start_counter
        )

        # Use a single connection for the entire batch to ensure consistency
        connection = get_connection_pool()

        try:
            # Begin transaction
            connection.autocommit = False

            # Insert orders first
            orders_inserted = batch_insert_orders_with_retry(orders, connection)

            # Update inventory second (in same transaction)
            inventory_updated = 0
            if inventory_updates:
                inventory_updated = batch_update_inventory_with_retry(
                    inventory_updates, connection
                )

            # Commit transaction
            connection.commit()

            # Update progress
            with progress_lock:
                pbar.update(len(orders))

            return {
                "batch_id": batch_id,
                "status": order_status,
                "orders_inserted": orders_inserted,
                "inventory_updated": inventory_updated,
                "success": True,
                "retry_count": 0,
            }

        finally:
            connection.close()

    except Exception as e:
        # Log failed batch for potential retry
        with failed_batches_lock:
            failed_batches.append({"batch_id": batch_id, "args": args, "error": str(e)})

        return {
            "batch_id": batch_id,
            "status": order_status,
            "error": str(e),
            "success": False,
        }


def generate_realistic_order_dates(order_count, status, as_of_date, backfill_start):
    """Generate realistic order dates with upward trending distribution"""
    dates = []
    total_days = (as_of_date - backfill_start).days

    if status == "fulfilled":
        # Fulfilled orders: create upward trend with growth pattern
        # Use exponential growth curve for realistic business growth
        for i in range(order_count):
            # Create exponential growth curve - more orders as we approach as_of_date
            # Use reverse beta distribution to favor recent dates for growth trend
            beta_sample = np.random.beta(
                5, 2
            )  # REVERSED: Now skewed towards recent dates (1.0)

            # Add exponential growth factor
            growth_factor = np.exp(beta_sample * 2) / np.exp(
                2
            )  # Normalize to 0-1, then apply exponential
            days_back = int((1 - growth_factor) * total_days)

            # Add some seasonal variation (more orders near month-end)
            order_date = as_of_date - timedelta(days=days_back)

            # Add monthly seasonality (more orders in certain weeks of month)
            day_of_month = order_date.day
            if day_of_month >= 25 or day_of_month <= 5:  # End/beginning of month boost
                if (
                    random.random() < 0.7
                ):  # 70% chance to keep these high-activity periods
                    pass
            else:
                # Mid-month, add some randomness but still maintain growth trend
                if random.random() < 0.3:  # 30% chance to shift date slightly
                    order_date += timedelta(days=random.randint(-3, 3))

            # Add weekly pattern (fewer orders on weekends but not eliminate completely)
            if order_date.weekday() >= 5:  # Weekend
                if (
                    random.random() < 0.4
                ):  # 40% chance to keep weekend orders (higher than before)
                    order_date += timedelta(
                        days=random.choice([1, 2])
                    )  # Move to next weekday

            dates.append(order_date)

    elif status == "approved":
        # Approved orders: recent dates with slight growth trend (last 2 weeks)
        max_days_back = min(14, total_days)
        for i in range(order_count):
            # Slight bias towards more recent dates for approved orders too
            beta_sample = np.random.beta(3, 2)  # Mild bias towards recent
            days_back = int((1 - beta_sample) * max_days_back)
            dates.append(as_of_date - timedelta(days=days_back))

    elif status == "pending_review":
        # Pending orders: very recent with heavy bias towards most recent dates (last week)
        max_days_back = min(7, total_days)
        for i in range(order_count):
            # Heavy bias towards most recent dates
            beta_sample = np.random.beta(4, 1)  # Very strong bias towards recent
            days_back = int((1 - beta_sample) * max_days_back)
            dates.append(as_of_date - timedelta(days=days_back))

    elif status == "cancelled":
        # Cancelled orders: still distributed throughout but with less bias towards old dates
        for _ in range(order_count):
            # More uniform distribution for cancelled orders
            beta_sample = np.random.beta(2, 2)  # More uniform distribution
            days_back = int(beta_sample * total_days)
            dates.append(as_of_date - timedelta(days=days_back))

    return sorted(dates)


def generate_growth_weighted_order_dates(
    order_count, status, as_of_date, backfill_start, growth_rate=0.15
):
    """
    Alternative function to generate order dates with explicit growth patterns
    growth_rate: monthly growth rate (0.15 = 15% growth per month)
    """
    dates = []
    total_days = (as_of_date - backfill_start).days
    total_months = total_days / 30.44  # Average days per month

    if status == "fulfilled":
        # Calculate orders per time period with growth
        orders_by_period = []
        base_monthly_orders = order_count / (
            total_months * (1 + growth_rate) ** (total_months / 2)
        )

        # Calculate expected orders for each month with compound growth
        current_date = backfill_start
        month_count = 0

        while current_date < as_of_date:
            month_end = min(current_date + timedelta(days=30), as_of_date)
            month_orders = int(base_monthly_orders * (1 + growth_rate) ** month_count)

            # Generate dates for this month
            month_days = (month_end - current_date).days
            for _ in range(month_orders):
                if len(dates) >= order_count:
                    break

                # Random day within the month
                random_day = random.randint(0, month_days - 1)
                order_date = current_date + timedelta(days=random_day)

                # Skip weekends occasionally
                if order_date.weekday() >= 5 and random.random() < 0.4:
                    order_date += timedelta(days=random.choice([1, 2]))

                if order_date <= as_of_date:
                    dates.append(order_date)

            current_date = month_end
            month_count += 1

            if len(dates) >= order_count:
                break

        # Fill remaining orders in most recent period if needed
        while len(dates) < order_count:
            days_back = random.randint(0, min(30, total_days))
            order_date = as_of_date - timedelta(days=days_back)
            dates.append(order_date)

    else:
        # Use original logic for non-fulfilled orders
        return generate_realistic_order_dates(
            order_count, status, as_of_date, backfill_start
        )

    return sorted(dates)


def populate_dynamic_data():
    """Enhanced version with deadlock prevention and recovery"""
    print("🛒 Starting parallel data generation with deadlock prevention...")
    start_time = time.time()

    conn = get_connection()
    cursor = conn.cursor()

    # Clear existing dynamic data
    print("Clearing existing data...")
    cursor.execute("TRUNCATE TABLE orders, inventory RESTART IDENTITY;")
    conn.commit()

    # Get reference data
    cursor.execute("SELECT product_id FROM products ORDER BY product_id;")
    product_ids = [row[0] for row in cursor.fetchall()]

    cursor.execute("SELECT store_id FROM stores ORDER BY store_id;")
    store_ids = [row[0] for row in cursor.fetchall()]

    cursor.execute("SELECT user_id, role, store_id FROM users;")
    users = cursor.fetchall()
    store_managers = [(u[0], u[2]) for u in users if u[1] == "store_manager"]
    regional_managers = [u[0] for u in users if u[1] == "regional_manager"]

    # Generate initial inventory in batches
    print("Generating initial inventory...")
    hq_store_id = 1
    inventory_data = []

    # HQ inventory
    for product_id in product_ids:
        initial_stock = random.randint(500, 3000)
        inventory_data.append((product_id, hq_store_id, initial_stock, 0))

    # Retail store inventory
    for store_id in store_ids[1:]:
        for product_id in product_ids:
            initial_stock = random.randint(20, 150)
            inventory_data.append((product_id, store_id, initial_stock, 0))

    # Batch insert inventory
    inventory_query = """
        INSERT INTO inventory (product_id, store_id, quantity_cases, reserved_cases)
        VALUES (%s, %s, %s, %s)
    """
    execute_batch(cursor, inventory_query, inventory_data, page_size=BATCH_SIZE)
    conn.commit()

    cursor.close()
    conn.close()

    print(f"Inventory generated: {len(inventory_data)} records")

    # Prepare reference data for parallel processing
    reference_data = (
        product_ids,
        store_ids,
        store_managers,
        regional_managers,
        hq_store_id,
    )

    # Generate order dates for each status
    order_configs = [
        ("fulfilled", FULFILLED_ORDERS_COUNT),
        ("approved", APPROVED_ORDERS_COUNT),
        ("pending_review", PENDING_REVIEW_ORDERS_COUNT),
        ("cancelled", CANCELLED_ORDERS_COUNT),
    ]

    # Process orders in parallel
    total_orders = sum(count for _, count in order_configs)

    print(
        f"Processing {total_orders} orders in batches of {BATCH_SIZE} with {MAX_WORKERS} workers..."
    )

    with tqdm(total=total_orders, desc="Generating orders", unit="orders") as pbar:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = []
            order_counter = 1

            for order_status, order_count in order_configs:
                if order_count == 0:
                    continue

                # Generate realistic order dates with optional growth pattern
                if USE_GROWTH_PATTERN and order_status == "fulfilled":
                    # Use growth-weighted dates for fulfilled orders to ensure upward trend
                    order_dates = generate_growth_weighted_order_dates(
                        order_count,
                        order_status,
                        as_of_datetime,
                        backfill_start_date,
                        MONTHLY_GROWTH_RATE,
                    )
                else:
                    # Use improved realistic dates (still with upward bias)
                    order_dates = generate_realistic_order_dates(
                        order_count, order_status, as_of_datetime, backfill_start_date
                    )

                # Split orders into batches for parallel processing
                for i in range(0, len(order_dates), BATCH_SIZE):
                    batch_dates = order_dates[i : i + BATCH_SIZE]
                    batch_start_counter = order_counter + i

                    # Submit batch for processing
                    future = executor.submit(
                        process_order_batch_with_recovery,
                        (
                            order_status,
                            batch_dates,
                            reference_data,
                            batch_start_counter,
                            pbar,
                        ),
                    )
                    futures.append(future)

                order_counter += order_count

            # Wait for all batches to complete
            results = []
            successful_orders = 0
            failed_orders = 0

            for future in as_completed(futures):
                result = future.result()
                results.append(result)

                if result["success"]:
                    successful_orders += result["orders_inserted"]
                else:
                    failed_orders += BATCH_SIZE  # Assume full batch failed
                    print(f"❌ Failed batch {result['batch_id']}: {result['error']}")

    # Handle failed batches if any
    if failed_batches:
        print(f"\n⚠️  Retrying {len(failed_batches)} failed batches...")

        # Retry failed batches with reduced concurrency
        with ThreadPoolExecutor(max_workers=2) as retry_executor:
            retry_futures = []
            for failed_batch in failed_batches:
                future = retry_executor.submit(
                    process_order_batch_with_recovery, failed_batch["args"]
                )
                retry_futures.append(future)

            for future in as_completed(retry_futures):
                result = future.result()
                if result["success"]:
                    successful_orders += result["orders_inserted"]
                    print(f"✅ Recovered batch {result['batch_id']}")
                else:
                    print(
                        f"❌ Failed retry for batch {result['batch_id']}: {result['error']}"
                    )

    # Print summary
    end_time = time.time()
    processing_time = end_time - start_time

    print(f"\n🎉 Data generation completed in {processing_time:.2f} seconds!")
    print(f"📊 Performance: {successful_orders/processing_time:.0f} orders/second")
    print(f"✅ Successful orders: {successful_orders:,}")
    print(f"❌ Failed orders: {failed_orders:,}")
    print(
        f"📈 Success rate: {(successful_orders/(successful_orders + failed_orders)*100):.1f}%"
    )

    # Summary by status
    successful_results = [r for r in results if r["success"]]
    status_summary = {}
    for result in successful_results:
        status = result["status"]
        if status not in status_summary:
            status_summary[status] = 0
        status_summary[status] += result["orders_inserted"]

    print(f"\n📋 Generated orders by status:")
    for status, count in status_summary.items():
        print(f"  - {status}: {count:,} orders")

    print(f"📅 Date range: {backfill_start_date.strftime('%Y-%m-%d')} to {AS_OF_DATE}")
    print(f"⚙️  Performance: {MAX_WORKERS} workers, {BATCH_SIZE} batch size")


def setup_analytics():
    """Create analytics schema and views"""
    print("📈 Setting up analytics...")

    conn = get_connection()
    cursor = conn.cursor()

    # Create analytics schema
    cursor.execute("CREATE SCHEMA IF NOT EXISTS analytics;")

    # Create materialized views
    cursor.execute(
        """
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
    """
    )

    cursor.execute(
        """
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
    """
    )

    cursor.execute(
        """
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
    """
    )

    # Create indexes
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_inventory_summary_region ON analytics.inventory_summary(region);"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_order_trends_day ON analytics.order_trends(order_day);"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_low_stock_status ON analytics.low_stock_alerts(stock_status);"
    )

    # Refresh materialized views
    cursor.execute("REFRESH MATERIALIZED VIEW analytics.inventory_summary;")
    cursor.execute("REFRESH MATERIALIZED VIEW analytics.order_trends;")
    cursor.execute("REFRESH MATERIALIZED VIEW analytics.low_stock_alerts;")

    conn.commit()
    cursor.close()
    conn.close()

    print("✅ Analytics setup complete!")


def main():
    """Main execution function"""
    print("🚀 Starting Brickhouse Brands Demo Setup")
    print("========================================")
    print(f"Database: {DB_NAME} on {DB_HOST}:{DB_PORT}")
    print(f"Schema: {DB_SCHEMA}")
    print(f"User: {DB_USER}")
    print(f"As-of Date: {AS_OF_DATE}")
    print(f"Backfill Start: {backfill_start_date.strftime('%Y-%m-%d')}")
    print(f"Batch Size: {BATCH_SIZE}")
    print(
        f"Total Orders: {FULFILLED_ORDERS_COUNT + PENDING_REVIEW_ORDERS_COUNT + CANCELLED_ORDERS_COUNT + APPROVED_ORDERS_COUNT}"
    )
    print(f"  - Fulfilled: {FULFILLED_ORDERS_COUNT}")
    print(f"  - Approved: {APPROVED_ORDERS_COUNT}")
    print(f"  - Pending Review: {PENDING_REVIEW_ORDERS_COUNT}")
    print(f"  - Cancelled: {CANCELLED_ORDERS_COUNT}")

    if args.dry_run:
        print("🔍 DRY RUN MODE - Testing connection only")
    print()

    try:
        # Test database connection
        print("🔌 Testing database connection...")
        conn = get_connection()
        conn.close()
        print("✅ Database connection successful!")

        if args.dry_run:
            print("✅ Dry run completed - connection test successful!")
            print("Run without --dry-run to execute the full setup.")
            return

        # Execute setup steps
        create_schema()
        populate_static_data()
        populate_dynamic_data()
        setup_analytics()

        print()
        print("🎉 Demo setup completed successfully!")
        print("=====================================")
        print("✅ Database schema created")
        print("✅ Static data populated (products, stores, users)")
        print("✅ Initial inventory established")
        print("✅ Order data generated")
        print("✅ Analytics views created")
        print()
        print("Your Brickhouse Brands demo database is ready to use!")

    except Exception as e:
        print(f"❌ Setup failed: {e}")
        if args.dry_run:
            print("💡 Tip: Check your database connection details and credentials")
        sys.exit(1)


if __name__ == "__main__":
    main()
