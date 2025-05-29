from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import Order, OrderCreate, ApiResponse, PaginatedResponse
from app.database.connection import get_db_cursor
import math

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def get_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    region: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    """Get orders with pagination and optional filtering"""
    try:
        with get_db_cursor() as cursor:
            # Build base query for orders with joins
            base_query = """
                SELECT o.order_id, o.order_number, o.from_store_id, o.to_store_id, 
                       o.product_id, o.quantity_cases, o.order_status, o.requested_by,
                       o.approved_by, o.order_date, o.approved_date, o.fulfilled_date,
                       o.notes, o.version,
                       ts.store_name as to_store_name, ts.region as to_store_region,
                       fs.store_name as from_store_name,
                       p.product_name, p.brand, p.category,
                       CONCAT(u.first_name, ' ', u.last_name) as requester_name
                FROM orders o
                JOIN stores ts ON o.to_store_id = ts.store_id
                LEFT JOIN stores fs ON o.from_store_id = fs.store_id
                JOIN products p ON o.product_id = p.product_id
                JOIN users u ON o.requested_by = u.user_id
                WHERE 1=1
            """

            # Count query for pagination
            count_query = """
                SELECT COUNT(*)
                FROM orders o
                JOIN stores ts ON o.to_store_id = ts.store_id
                LEFT JOIN stores fs ON o.from_store_id = fs.store_id
                JOIN products p ON o.product_id = p.product_id
                JOIN users u ON o.requested_by = u.user_id
                WHERE 1=1
            """

            params = []
            conditions = []

            if region and region != "all":
                conditions.append(" AND ts.region = %s")
                params.append(region)

            if status and status != "all":
                conditions.append(" AND o.order_status = %s")
                params.append(status)

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
            base_query += " ORDER BY o.order_date DESC LIMIT %s OFFSET %s"
            cursor.execute(base_query, params + [limit, offset])

            orders = cursor.fetchall()

            return PaginatedResponse(
                data=[dict(order) for order in orders],
                page=page,
                total_pages=total_pages,
                total=total,
                limit=limit,
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch orders: {str(e)}")


@router.post("/", response_model=ApiResponse)
async def create_order(order_data: OrderCreate):
    """Create a new order"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO orders (order_number, from_store_id, to_store_id, product_id, 
                                  quantity_cases, requested_by, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING order_id
            """,
                (
                    order_data.order_number,
                    order_data.from_store_id,
                    order_data.to_store_id,
                    order_data.product_id,
                    order_data.quantity_cases,
                    order_data.requested_by,
                    order_data.notes,
                ),
            )

            result = cursor.fetchone()
            order_id = result["order_id"]

            return ApiResponse(
                success=True,
                data={"order_id": order_id},
                message="Order created successfully",
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


@router.get("/{order_id}", response_model=Order)
async def get_order(order_id: int):
    """Get a specific order by ID"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT o.order_id, o.order_number, o.from_store_id, o.to_store_id, 
                       o.product_id, o.quantity_cases, o.order_status, o.requested_by,
                       o.approved_by, o.order_date, o.approved_date, o.fulfilled_date,
                       o.notes, o.version,
                       ts.store_name as to_store_name, ts.region as to_store_region,
                       fs.store_name as from_store_name,
                       p.product_name, p.brand, p.category,
                       CONCAT(u.first_name, ' ', u.last_name) as requester_name
                FROM orders o
                JOIN stores ts ON o.to_store_id = ts.store_id
                LEFT JOIN stores fs ON o.from_store_id = fs.store_id
                JOIN products p ON o.product_id = p.product_id
                JOIN users u ON o.requested_by = u.user_id
                WHERE o.order_id = %s
            """,
                (order_id,),
            )

            order = cursor.fetchone()

            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            return Order(**order)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch order: {str(e)}")


@router.put("/{order_id}/status", response_model=ApiResponse)
async def update_order_status(
    order_id: int, status: str, approved_by: Optional[int] = None
):
    """Update order status"""
    try:
        with get_db_cursor() as cursor:
            # Validate status
            valid_statuses = ["pending_review", "approved", "fulfilled", "cancelled"]
            if status not in valid_statuses:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid status. Must be one of: {valid_statuses}",
                )

            # Build update query based on status
            if status == "approved":
                query = """
                    UPDATE orders 
                    SET order_status = %s, approved_by = %s, approved_date = CURRENT_TIMESTAMP,
                        version = version + 1
                    WHERE order_id = %s
                    RETURNING order_id
                """
                params = [status, approved_by, order_id]
            elif status == "fulfilled":
                query = """
                    UPDATE orders 
                    SET order_status = %s, fulfilled_date = CURRENT_TIMESTAMP,
                        version = version + 1
                    WHERE order_id = %s
                    RETURNING order_id
                """
                params = [status, order_id]
            else:
                query = """
                    UPDATE orders 
                    SET order_status = %s, version = version + 1
                    WHERE order_id = %s
                    RETURNING order_id
                """
                params = [status, order_id]

            cursor.execute(query, params)
            result = cursor.fetchone()

            if not result:
                raise HTTPException(status_code=404, detail="Order not found")

            return ApiResponse(
                success=True, message=f"Order status updated to {status}"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to update order status: {str(e)}"
        )


@router.get("/status/summary")
async def get_order_status_summary(region: Optional[str] = Query(None)):
    """Get order status summary"""
    try:
        with get_db_cursor() as cursor:
            conditions = []
            params = []

            if region and region != "all":
                conditions.append(" AND s.region = %s")
                params.append(region)

            condition_str = "".join(conditions)

            cursor.execute(
                f"""
                SELECT 
                    o.order_status,
                    COUNT(*) as count,
                    SUM(o.quantity_cases) as total_cases
                FROM orders o
                JOIN stores s ON o.to_store_id = s.store_id
                WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days' {condition_str}
                GROUP BY o.order_status
                ORDER BY count DESC
            """,
                params,
            )

            return cursor.fetchall()

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch order status summary: {str(e)}"
        )
