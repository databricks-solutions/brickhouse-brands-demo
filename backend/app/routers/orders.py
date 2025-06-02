from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import Order, OrderCreate, ApiResponse, PaginatedResponse
from app.database.connection import get_db_cursor
from pydantic import BaseModel
import math

router = APIRouter()


class OrderUpdateRequest(BaseModel):
    quantity_cases: Optional[int] = None
    notes: Optional[str] = None


class OrderCancelRequest(BaseModel):
    reason: str


@router.get("", response_model=PaginatedResponse)
async def get_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    expired_sla_only: Optional[bool] = Query(False),
    date_from: Optional[str] = Query(
        None, description="Filter orders from this date (YYYY-MM-DD)"
    ),
    date_to: Optional[str] = Query(
        None, description="Filter orders to this date (YYYY-MM-DD)"
    ),
    as_of_date: Optional[str] = Query(
        None, description="Show orders as they existed on this date (YYYY-MM-DD)"
    ),
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
                       CONCAT(u.first_name, ' ', u.last_name) as requester_name,
                       u.avatar_url as requester_avatar_url,
                       CONCAT(approver.first_name, ' ', approver.last_name) as approver_name,
                       approver.avatar_url as approver_avatar_url
                FROM orders o
                JOIN stores ts ON o.to_store_id = ts.store_id
                LEFT JOIN stores fs ON o.from_store_id = fs.store_id
                JOIN products p ON o.product_id = p.product_id
                JOIN users u ON o.requested_by = u.user_id
                LEFT JOIN users approver ON o.approved_by = approver.user_id
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

            # Handle "as of" date filtering - this filters to only show orders that existed as of that date
            if as_of_date:
                # Use DATE() function to compare just the date part, ignoring time
                # This ensures we get all orders from the specified date, regardless of timestamp
                conditions.append(" AND DATE(o.order_date) <= %s")
                params.append(as_of_date)
            else:
                # When in real-time mode (no as_of_date), filter out future orders
                # This prevents orders created with future dates during demos from appearing
                conditions.append(" AND DATE(o.order_date) <= CURRENT_DATE")

            # Handle expired SLA filtering first - this takes precedence
            if expired_sla_only:
                if as_of_date:
                    # When using as_of_date, calculate SLA based on that date instead of NOW()
                    # Use DATE() function to properly compare date parts
                    conditions.append(
                        " AND o.order_status = 'pending_review' AND DATE(o.order_date) < DATE(%s) - INTERVAL '2 days'"
                    )
                    params.append(as_of_date)
                else:
                    conditions.append(
                        " AND o.order_status = 'pending_review' AND o.order_date < NOW() - INTERVAL '2 days'"
                    )
            else:
                # Only apply status filter if not filtering by expired SLA
                if status and status != "all":
                    conditions.append(" AND o.order_status = %s")
                    params.append(status)

            if region and region != "all":
                conditions.append(" AND ts.region = %s")
                params.append(region)

            if category and category != "all":
                conditions.append(" AND p.category = %s")
                params.append(category)

            # Date range filtering (for analytics cards)
            if date_from:
                conditions.append(" AND DATE(o.order_date) >= %s")
                params.append(date_from)
            if date_to:
                conditions.append(" AND DATE(o.order_date) <= %s")
                params.append(date_to)

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


@router.post("", response_model=ApiResponse)
async def create_order(order_data: OrderCreate):
    """Create a new order"""
    try:
        with get_db_cursor() as cursor:
            # Generate order_number if not provided
            if not order_data.order_number:
                # Get the next order id
                cursor.execute(
                    "SELECT COALESCE(MAX(order_id), 0) + 1 as next_id FROM orders"
                )
                next_id = cursor.fetchone()["next_id"]
                order_number = f"ORD{next_id:06d}"
            else:
                order_number = order_data.order_number

            # Build INSERT query based on whether order_date is provided
            if order_data.order_date:
                cursor.execute(
                    """
                    INSERT INTO orders (order_number, from_store_id, to_store_id, product_id, 
                                      quantity_cases, requested_by, approved_by, notes, order_date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING order_id
                """,
                    (
                        order_number,
                        order_data.from_store_id,
                        order_data.to_store_id,
                        order_data.product_id,
                        order_data.quantity_cases,
                        order_data.requested_by,
                        order_data.approved_by,
                        order_data.notes,
                        order_data.order_date,
                    ),
                )
            else:
                # Use default database timestamp if no custom date provided
                cursor.execute(
                    """
                    INSERT INTO orders (order_number, from_store_id, to_store_id, product_id, 
                                      quantity_cases, requested_by, approved_by, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING order_id
                """,
                    (
                        order_number,
                        order_data.from_store_id,
                        order_data.to_store_id,
                        order_data.product_id,
                        order_data.quantity_cases,
                        order_data.requested_by,
                        order_data.approved_by,
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
                       CONCAT(u.first_name, ' ', u.last_name) as requester_name,
                       u.avatar_url as requester_avatar_url,
                       CONCAT(approver.first_name, ' ', approver.last_name) as approver_name,
                       approver.avatar_url as approver_avatar_url
                FROM orders o
                JOIN stores ts ON o.to_store_id = ts.store_id
                LEFT JOIN stores fs ON o.from_store_id = fs.store_id
                JOIN products p ON o.product_id = p.product_id
                JOIN users u ON o.requested_by = u.user_id
                LEFT JOIN users approver ON o.approved_by = approver.user_id
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
async def get_order_status_summary(
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    as_of_date: Optional[str] = Query(
        None, description="Show order status as it was on this date (YYYY-MM-DD)"
    ),
):
    """Get order status summary with SLA tracking"""
    try:
        with get_db_cursor() as cursor:
            conditions = []
            params = []

            # Handle "as of" date filtering
            if as_of_date:
                # Use DATE() function to compare just the date part, ignoring time
                # This ensures we get all orders from the specified date, regardless of timestamp
                conditions.append(" AND DATE(o.order_date) <= %s")
                params.append(as_of_date)
            else:
                # When in real-time mode (no as_of_date), filter out future orders
                # This prevents orders created with future dates during demos from appearing
                conditions.append(" AND DATE(o.order_date) <= CURRENT_DATE")

            if region and region != "all":
                conditions.append(" AND s.region = %s")
                params.append(region)

            if category and category != "all":
                conditions.append(" AND p.category = %s")
                params.append(category)

            condition_str = "".join(conditions)

            # Get basic status counts
            if as_of_date:
                # When using as_of_date, show data as it was 30 days before that date
                date_range_condition = f"WHERE o.order_date >= %s::DATE - INTERVAL '30 days' AND o.order_date <= %s {condition_str}"
                count_params = [as_of_date, as_of_date] + params
            else:
                # Normal case: last 30 days from current date
                date_range_condition = f"WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days' {condition_str}"
                count_params = params

            cursor.execute(
                f"""
                SELECT 
                    o.order_status,
                    COUNT(*) as count,
                    SUM(o.quantity_cases) as total_cases
                FROM orders o
                JOIN stores s ON o.to_store_id = s.store_id
                JOIN products p ON o.product_id = p.product_id
                {date_range_condition}
                GROUP BY o.order_status
                ORDER BY count DESC
            """,
                count_params,
            )

            status_summary = cursor.fetchall()

            # Get expired SLA count (pending review orders over 2 days old)
            if as_of_date:
                # Calculate expired SLA based on the as_of_date
                # Use DATE() function to properly compare date parts
                sla_condition = f"WHERE o.order_status = 'pending_review' AND DATE(o.order_date) < DATE(%s) - INTERVAL '2 days' {condition_str}"
                sla_params = [as_of_date] + params
            else:
                # Normal case: calculate based on current time
                sla_condition = f"WHERE o.order_status = 'pending_review' AND o.order_date < NOW() - INTERVAL '2 days' {condition_str}"
                sla_params = params

            cursor.execute(
                f"""
                SELECT COUNT(*) as expired_sla_count
                FROM orders o
                JOIN stores s ON o.to_store_id = s.store_id
                JOIN products p ON o.product_id = p.product_id
                {sla_condition}
            """,
                sla_params,
            )

            expired_sla_result = cursor.fetchone()
            expired_sla_count = (
                expired_sla_result["expired_sla_count"] if expired_sla_result else 0
            )

            # Convert to the expected format
            status_counts = {
                "pending_review": 0,
                "approved": 0,
                "fulfilled": 0,
                "cancelled": 0,
            }

            total_cases = 0

            for row in status_summary:
                status = row["order_status"]
                count = row["count"]
                cases = row["total_cases"] or 0

                if status in status_counts:
                    status_counts[status] = count

                total_cases += cases

            return {
                "status_counts": status_counts,
                "expired_sla_count": expired_sla_count,
                "total_cases": total_cases,
                "summary_period": (
                    f"As of {as_of_date}" if as_of_date else "Last 30 days"
                ),
            }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch order status summary: {str(e)}"
        )


@router.put("/{order_id}", response_model=Order)
async def update_order(order_id: int, request: OrderUpdateRequest):
    """Update order details (quantity and notes)"""
    try:
        with get_db_cursor() as cursor:
            # Build update query dynamically based on provided fields
            update_fields = []
            params = []

            if request.quantity_cases is not None:
                update_fields.append("quantity_cases = %s")
                params.append(request.quantity_cases)

            if request.notes is not None:
                update_fields.append("notes = %s")
                params.append(request.notes)

            if not update_fields:
                raise HTTPException(status_code=400, detail="No fields to update")

            # Always increment version
            update_fields.append("version = version + 1")

            # Add order_id for WHERE clause
            params.append(order_id)

            query = f"""
                UPDATE orders 
                SET {', '.join(update_fields)}
                WHERE order_id = %s AND order_status IN ('pending_review', 'approved')
                RETURNING order_id
            """

            cursor.execute(query, params)
            result = cursor.fetchone()

            if not result:
                raise HTTPException(
                    status_code=404,
                    detail="Order not found or cannot be modified (only pending_review and approved orders can be modified)",
                )

            # Fetch the updated order with all joined data
            cursor.execute(
                """
                SELECT o.order_id, o.order_number, o.from_store_id, o.to_store_id, 
                       o.product_id, o.quantity_cases, o.order_status, o.requested_by,
                       o.approved_by, o.order_date, o.approved_date, o.fulfilled_date,
                       o.notes, o.version,
                       ts.store_name as to_store_name, ts.region as to_store_region,
                       fs.store_name as from_store_name,
                       p.product_name, p.brand, p.category,
                       CONCAT(u.first_name, ' ', u.last_name) as requester_name,
                       u.avatar_url as requester_avatar_url,
                       CONCAT(approver.first_name, ' ', approver.last_name) as approver_name,
                       approver.avatar_url as approver_avatar_url
                FROM orders o
                JOIN stores ts ON o.to_store_id = ts.store_id
                LEFT JOIN stores fs ON o.from_store_id = fs.store_id
                JOIN products p ON o.product_id = p.product_id
                JOIN users u ON o.requested_by = u.user_id
                LEFT JOIN users approver ON o.approved_by = approver.user_id
                WHERE o.order_id = %s
            """,
                (order_id,),
            )

            updated_order = cursor.fetchone()
            return Order(**updated_order)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update order: {str(e)}")


@router.put("/{order_id}/cancel", response_model=ApiResponse)
async def cancel_order(order_id: int, request: OrderCancelRequest):
    """Cancel an order with a reason"""
    try:
        with get_db_cursor() as cursor:
            # Update order status to cancelled and increment version
            cursor.execute(
                """
                UPDATE orders 
                SET order_status = 'cancelled', 
                    notes = CASE 
                        WHEN notes IS NULL OR notes = '' THEN %s
                        ELSE CONCAT(notes, '\n\nCancellation reason: ', %s)
                    END,
                    version = version + 1
                WHERE order_id = %s AND order_status IN ('pending_review', 'approved')
                RETURNING order_id
                """,
                (f"Cancellation reason: {request.reason}", request.reason, order_id),
            )

            result = cursor.fetchone()

            if not result:
                raise HTTPException(
                    status_code=404,
                    detail="Order not found or cannot be cancelled (only pending_review and approved orders can be cancelled)",
                )

            return ApiResponse(
                success=True, message=f"Order {order_id} has been cancelled"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel order: {str(e)}")
