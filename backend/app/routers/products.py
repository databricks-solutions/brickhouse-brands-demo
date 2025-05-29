from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import Product, ProductCreate, ApiResponse
from app.database.connection import get_db_cursor

router = APIRouter()


@router.get("", response_model=List[Product])
async def get_products(
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """Get products with optional filtering"""
    try:
        with get_db_cursor() as cursor:
            query = """
                SELECT product_id, product_name, brand, category, package_size,
                       unit_price, created_at
                FROM products WHERE 1=1
            """
            params = []

            if category and category != "all":
                query += " AND category = %s"
                params.append(category)

            if brand and brand != "all":
                query += " AND brand = %s"
                params.append(brand)

            if search:
                query += " AND (product_name ILIKE %s OR brand ILIKE %s)"
                search_param = f"%{search}%"
                params.extend([search_param, search_param])

            query += " ORDER BY product_name LIMIT %s"
            params.append(limit)

            cursor.execute(query, params)
            products = cursor.fetchall()

            return [Product(**product) for product in products]

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch products: {str(e)}"
        )


@router.get("/{product_id}", response_model=Product)
async def get_product(product_id: int):
    """Get a specific product by ID"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT * FROM products WHERE product_id = %s", (product_id,)
            )
            product = cursor.fetchone()

            if not product:
                raise HTTPException(status_code=404, detail="Product not found")

            return Product(**product)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch product: {str(e)}"
        )


@router.post("", response_model=ApiResponse)
async def create_product(product_data: ProductCreate):
    """Create a new product"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO products (product_name, brand, category, package_size, unit_price)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING product_id
            """,
                (
                    product_data.product_name,
                    product_data.brand,
                    product_data.category,
                    product_data.package_size,
                    product_data.unit_price,
                ),
            )

            result = cursor.fetchone()
            product_id = result["product_id"]

            return ApiResponse(
                success=True,
                data={"product_id": product_id},
                message="Product created successfully",
            )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create product: {str(e)}"
        )


@router.get("/categories/list")
async def get_categories():
    """Get list of all product categories"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT DISTINCT category FROM products ORDER BY category")
            categories = cursor.fetchall()

            return [
                {"value": cat["category"], "label": cat["category"]}
                for cat in categories
            ]

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch categories: {str(e)}"
        )


@router.get("/brands/list")
async def get_brands():
    """Get list of all product brands"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT DISTINCT brand FROM products ORDER BY brand")
            brands = cursor.fetchall()

            return [
                {"value": brand["brand"], "label": brand["brand"]} for brand in brands
            ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch brands: {str(e)}")
