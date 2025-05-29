from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import (
    Inventory,
    InventoryUpdate,
    KPIData,
    InventoryTrendData,
    CategoryDistribution,
    PaginatedResponse,
    ApiResponse,
)
from app.database.connection import get_db_cursor
import math

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def get_inventory(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    low_stock_only: bool = Query(False),
):
    """Get inventory with pagination and filtering"""
    try:
        with get_db_cursor() as cursor:
            # Build query
            base_query = """
                SELECT i.inventory_id, i.store_id, i.product_id, i.quantity_cases,
                       i.reserved_cases, i.last_updated, i.version,
                       s.store_name, p.product_name, p.brand, p.category
                FROM inventory i
                JOIN stores s ON i.store_id = s.store_id
                JOIN products p ON i.product_id = p.product_id
                WHERE 1=1
            """

            count_query = """
                SELECT COUNT(*)
                FROM inventory i
                JOIN stores s ON i.store_id = s.store_id
                JOIN products p ON i.product_id = p.product_id
                WHERE 1=1
            """

            params = []
            conditions = []

            if region and region != "all":
                conditions.append(" AND s.region = %s")
                params.append(region)

            if category and category != "all":
                conditions.append(" AND p.category = %s")
                params.append(category)

            if search:
                conditions.append(
                    " AND (p.product_name ILIKE %s OR p.brand ILIKE %s OR s.store_name ILIKE %s)"
                )
                search_param = f"%{search}%"
                params.extend([search_param, search_param, search_param])

            if low_stock_only:
                conditions.append(" AND (i.quantity_cases - i.reserved_cases) <= 10")

            # Add conditions to both queries
            condition_str = "".join(conditions)
            base_query += condition_str
            count_query += condition_str

            # Get total count
            cursor.execute(count_query, params)
            total = cursor.fetchone()["count"]

            # Calculate pagination
            total_pages = math.ceil(total / limit)
            offset = (page - 1) * limit

            # Get paginated data
            base_query += " ORDER BY i.last_updated DESC LIMIT %s OFFSET %s"
            cursor.execute(base_query, params + [limit, offset])

            inventory_data = cursor.fetchall()

            return PaginatedResponse(
                data=[dict(item) for item in inventory_data],
                page=page,
                total_pages=total_pages,
                total=total,
                limit=limit,
            )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch inventory: {str(e)}"
        )


@router.get("/kpi", response_model=KPIData)
async def get_kpi_data(
    region: Optional[str] = Query(None), category: Optional[str] = Query(None)
):
    """Get KPI data for dashboard"""
    try:
        with get_db_cursor() as cursor:
            # Build conditions
            conditions = []
            params = []

            if region and region != "all":
                conditions.append(" AND s.region = %s")
                params.append(region)

            if category and category != "all":
                conditions.append(" AND p.category = %s")
                params.append(category)

            condition_str = "".join(conditions)

            # Total inventory value
            cursor.execute(
                f"""
                SELECT COALESCE(SUM(i.quantity_cases * p.unit_price), 0) as total_value
                FROM inventory i
                JOIN stores s ON i.store_id = s.store_id
                JOIN products p ON i.product_id = p.product_id
                WHERE 1=1 {condition_str}
            """,
                params,
            )
            total_value = cursor.fetchone()["total_value"]

            # Total products
            cursor.execute(
                f"""
                SELECT COUNT(DISTINCT i.product_id) as total_products
                FROM inventory i
                JOIN stores s ON i.store_id = s.store_id
                JOIN products p ON i.product_id = p.product_id
                WHERE 1=1 {condition_str}
            """,
                params,
            )
            total_products = cursor.fetchone()["total_products"]

            # Low stock alerts - use the dedicated endpoint logic
            low_stock_threshold = 50
            cursor.execute(
                f"""
                SELECT COUNT(*) as low_stock_count
                FROM inventory i
                JOIN stores s ON i.store_id = s.store_id
                JOIN products p ON i.product_id = p.product_id
                WHERE (i.quantity_cases - i.reserved_cases) <= %s {condition_str}
            """,
                [low_stock_threshold] + params,
            )
            low_stock_alerts = cursor.fetchone()["low_stock_count"]

            return KPIData(
                total_inventory_value=float(total_value or 0),
                total_products=int(total_products or 0),
                low_stock_alerts=int(low_stock_alerts or 0),
                average_turnover=7.5,  # Placeholder - would be calculated based on sales data
            )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch KPI data: {str(e)}"
        )


@router.get("/trends", response_model=List[InventoryTrendData])
async def get_inventory_trends(
    days: int = Query(30, ge=1, le=365), region: Optional[str] = Query(None)
):
    """Get inventory trend data"""
    try:
        with get_db_cursor() as cursor:
            conditions = []
            params = [days]

            if region and region != "all":
                conditions.append(" AND s.region = %s")
                params.append(region)

            condition_str = "".join(conditions)

            cursor.execute(
                f"""
                SELECT 
                    DATE(i.last_updated) as date,
                    SUM(i.quantity_cases * p.unit_price) as total_value,
                    SUM(i.quantity_cases) as total_quantity
                FROM inventory i
                JOIN stores s ON i.store_id = s.store_id
                JOIN products p ON i.product_id = p.product_id
                WHERE i.last_updated >= CURRENT_DATE - INTERVAL '%s days' {condition_str}
                GROUP BY DATE(i.last_updated)
                ORDER BY date
            """,
                params,
            )

            trends = cursor.fetchall()

            return [
                InventoryTrendData(
                    date=trend["date"].strftime("%Y-%m-%d"),
                    total_value=float(trend["total_value"] or 0),
                    total_quantity=int(trend["total_quantity"] or 0),
                )
                for trend in trends
            ]

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch inventory trends: {str(e)}"
        )


@router.get("/categories", response_model=List[CategoryDistribution])
async def get_category_distribution(region: Optional[str] = Query(None)):
    """Get category distribution data"""
    try:
        with get_db_cursor() as cursor:
            conditions = []
            params = []

            if region and region != "all":
                conditions.append(" AND s.region = %s")
                params.append(region)

            condition_str = "".join(conditions)

            # Get total value for percentage calculation
            cursor.execute(
                f"""
                SELECT COALESCE(SUM(i.quantity_cases * p.unit_price), 0) as total_value
                FROM inventory i
                JOIN stores s ON i.store_id = s.store_id
                JOIN products p ON i.product_id = p.product_id
                WHERE 1=1 {condition_str}
            """,
                params,
            )
            total_value = float(cursor.fetchone()["total_value"] or 0)

            # Get category breakdown
            cursor.execute(
                f"""
                SELECT 
                    p.category,
                    SUM(i.quantity_cases * p.unit_price) as category_value
                FROM inventory i
                JOIN stores s ON i.store_id = s.store_id
                JOIN products p ON i.product_id = p.product_id
                WHERE 1=1 {condition_str}
                GROUP BY p.category
                ORDER BY category_value DESC
            """,
                params,
            )

            categories = cursor.fetchall()

            return [
                CategoryDistribution(
                    category=cat["category"],
                    value=float(cat["category_value"] or 0),
                    percentage=(
                        round(
                            (float(cat["category_value"] or 0) / total_value * 100), 2
                        )
                        if total_value > 0
                        else 0
                    ),
                )
                for cat in categories
            ]

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch category distribution: {str(e)}"
        )


@router.put("/{inventory_id}", response_model=ApiResponse)
async def update_inventory(inventory_id: int, update_data: InventoryUpdate):
    """Update inventory levels"""
    try:
        # Build dynamic update query
        update_fields = []
        params = []

        for field, value in update_data.dict(exclude_unset=True).items():
            update_fields.append(f"{field} = %s")
            params.append(value)

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        params.extend([inventory_id])

        with get_db_cursor() as cursor:
            query = f"""
                UPDATE inventory 
                SET {', '.join(update_fields)}, last_updated = CURRENT_TIMESTAMP, 
                    version = version + 1
                WHERE inventory_id = %s
                RETURNING inventory_id
            """

            cursor.execute(query, params)
            result = cursor.fetchone()

            if not result:
                raise HTTPException(status_code=404, detail="Inventory item not found")

            return ApiResponse(success=True, message="Inventory updated successfully")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to update inventory: {str(e)}"
        )


@router.get("/alerts/low-stock")
async def get_low_stock_alerts(
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    """Get low stock alerts (defined as 50 or fewer available cases)"""
    low_stock_threshold = 50
    try:
        with get_db_cursor() as cursor:
            conditions = []
            params = []

            if region and region != "all":
                conditions.append(" AND s.region = %s")
                params.append(region)

            if category and category != "all":
                conditions.append(" AND p.category = %s")
                params.append(category)

            # Add limit parameter at the end for the LIMIT clause
            params.append(limit)

            condition_str = "".join(conditions)

            cursor.execute(
                f"""
                SELECT i.inventory_id, i.store_id, i.product_id, i.quantity_cases,
                       i.reserved_cases, (i.quantity_cases - i.reserved_cases) as available_cases,
                       s.store_name, p.product_name, p.brand, p.category
                FROM inventory i
                JOIN stores s ON i.store_id = s.store_id
                JOIN products p ON i.product_id = p.product_id
                WHERE (i.quantity_cases - i.reserved_cases) <= {low_stock_threshold} {condition_str}
                ORDER BY (i.quantity_cases - i.reserved_cases) ASC
                LIMIT %s
            """,
                params,
            )

            return cursor.fetchall()

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch low stock alerts: {str(e)}"
        )
