from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import Order, OrderCreate, ApiResponse, PaginatedResponse
from app.database.connection import get_db_cursor
from pydantic import BaseModel
import math
import time
from datetime import datetime, timedelta

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

            # Handle date filtering - both as_of_date and date_from/date_to can work together
            # as_of_date controls which orders "existed" at that point in time
            # date_from/date_to filters within that existing dataset
            if as_of_date:
                # Use DATE() function to compare just the date part, ignoring time
                # This ensures we get all orders from the specified date, regardless of timestamp
                #
                # Enhanced filtering: Show orders up to the as_of_date, plus a reasonable future window
                # to handle cases where users create orders with future dates but expect to see them.
                # This provides a better UX while maintaining the core as_of_date functionality.
                conditions.append(
                    " AND DATE(o.order_date) <= DATE(%s) + INTERVAL '7 days'"
                )
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

            # Apply date range filters within the as_of_date constraint
            if date_from:
                conditions.append(" AND DATE(o.order_date) >= %s")
                params.append(date_from)
            if date_to:
                conditions.append(" AND DATE(o.order_date) <= %s")
                params.append(date_to)

            condition_str = "".join(conditions)

            # Add conditions to both queries
            base_query += condition_str
            count_query += condition_str

            # Get total count
            cursor.execute(count_query, params)
            total = cursor.fetchone()["count"]

            # Calculate pagination
            total_pages = math.ceil(total / limit)
            offset = (page - 1) * limit

            # Get paginated data with improved ordering for as_of_date mode
            if as_of_date:
                # When in as_of_date mode, prioritize recently created orders (higher order_id)
                # while maintaining logical date ordering. This ensures newly created orders
                # appear at the top even when there are existing orders with future dates.
                base_query += " ORDER BY o.order_id DESC LIMIT %s OFFSET %s"
            else:
                # In live mode, use standard date ordering
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
                # Use a simpler two-step process within the same transaction
                # This avoids the complexity of CTE with UPDATE returning issues

                # Step 1: Insert with temporary order number and get the order_id
                if order_data.order_date:
                    cursor.execute(
                        """
                        INSERT INTO orders (order_number, from_store_id, to_store_id, product_id, 
                                          quantity_cases, requested_by, approved_by, notes, order_date)
                        VALUES ('TEMP', %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING order_id
                    """,
                        (
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
                        VALUES ('TEMP', %s, %s, %s, %s, %s, %s, %s)
                        RETURNING order_id
                    """,
                        (
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

                # Step 2: Generate unique order number by finding the next available number
                # This handles the case where existing data uses a different numbering scheme
                cursor.execute(
                    """
                    SELECT COALESCE(
                        MAX(CAST(SUBSTRING(order_number FROM 4) AS INTEGER)) + 1, 
                        %s
                    ) as next_number
                    FROM orders 
                    WHERE order_number ~ '^ORD[0-9]+$'
                    """,
                    (
                        order_id,
                    ),  # fallback to order_id if no existing ORD numbers found
                )
                next_number_result = cursor.fetchone()
                next_number = next_number_result["next_number"]
                proper_order_number = f"ORD{next_number:06d}"

                cursor.execute(
                    "UPDATE orders SET order_number = %s WHERE order_id = %s",
                    (proper_order_number, order_id),
                )
            else:
                # Use provided order number
                order_number = order_data.order_number

                # Build INSERT query based on whether order_date is provided
                if order_data.order_date:
                    cursor.execute(
                        """
                        INSERT INTO orders (order_number, from_store_id, to_store_id, product_id, 
                                          quantity_cases, requested_by, approved_by, notes, order_date)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING order_id, order_number
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
                        RETURNING order_id, order_number
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
    date_from: Optional[str] = Query(
        None, description="Filter orders from this date (YYYY-MM-DD)"
    ),
    date_to: Optional[str] = Query(
        None, description="Filter orders to this date (YYYY-MM-DD)"
    ),
    as_of_date: Optional[str] = Query(
        None, description="Show order status as it was on this date (YYYY-MM-DD)"
    ),
):
    """Get order status summary with SLA tracking"""
    try:
        with get_db_cursor() as cursor:
            conditions = []
            params = []

            # Handle date filtering - both as_of_date and date_from/date_to can work together
            # as_of_date controls which orders "existed" at that point in time
            # date_from/date_to filters within that existing dataset
            if as_of_date:
                # Use DATE() function to compare just the date part, ignoring time
                # This ensures we get all orders from the specified date, regardless of timestamp
                #
                # Enhanced filtering: Show orders up to the as_of_date, plus a reasonable future window
                # to handle cases where users create orders with future dates but expect to see them.
                # This provides a better UX while maintaining the core as_of_date functionality.
                conditions.append(
                    " AND DATE(o.order_date) <= DATE(%s) + INTERVAL '7 days'"
                )
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

            # Apply date range filters within the as_of_date constraint
            if date_from:
                conditions.append(" AND DATE(o.order_date) >= %s")
                params.append(date_from)
            if date_to:
                conditions.append(" AND DATE(o.order_date) <= %s")
                params.append(date_to)

            condition_str = "".join(conditions)

            # Determine summary period description
            if date_from and date_to:
                if as_of_date:
                    summary_period = (
                        f"From {date_from} to {date_to} (as of {as_of_date})"
                    )
                else:
                    summary_period = f"From {date_from} to {date_to}"
            elif as_of_date:
                summary_period = f"As of {as_of_date}"
            else:
                summary_period = "All time"

            # Get basic status counts with the combined filters
            # Use the same conditions for both the main query and count query
            status_query = f"""
                SELECT 
                    o.order_status,
                    COUNT(*) as count,
                    SUM(o.quantity_cases) as total_cases
                FROM orders o
                JOIN stores s ON o.to_store_id = s.store_id
                JOIN products p ON o.product_id = p.product_id
                WHERE 1=1 {condition_str}
                GROUP BY o.order_status
                ORDER BY count DESC
            """

            cursor.execute(status_query, params)
            status_summary = cursor.fetchall()

            # Get expired SLA count with the same base conditions
            # For SLA calculation, we need to check if orders were pending for > 2 days
            # relative to the as_of_date (if provided) or current time
            sla_conditions = list(conditions)  # Copy base conditions
            sla_params = list(params)  # Copy base params

            # Add SLA-specific condition
            sla_conditions.append(" AND o.order_status = 'pending_review'")

            if as_of_date:
                # Calculate expired SLA based on the as_of_date
                sla_conditions.append(
                    " AND DATE(o.order_date) < DATE(%s) - INTERVAL '2 days'"
                )
                sla_params.append(as_of_date)
            else:
                # Normal case: calculate based on current time
                sla_conditions.append(" AND o.order_date < NOW() - INTERVAL '2 days'")

            sla_condition_str = "".join(sla_conditions)

            sla_query = f"""
                SELECT COUNT(*) as expired_sla_count
                FROM orders o
                JOIN stores s ON o.to_store_id = s.store_id
                JOIN products p ON o.product_id = p.product_id
                WHERE 1=1 {sla_condition_str}
            """

            cursor.execute(sla_query, sla_params)
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
                "summary_period": summary_period,
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


@router.get("/analytics/fulfillment-timeline")
async def get_fulfillment_timeline(
    days: Optional[int] = Query(30, description="Number of days to look back"),
    region: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get order fulfillment timeline data by region"""
    try:
        with get_db_cursor() as cursor:
            conditions = []
            params = []

            # Base condition for fulfilled orders
            conditions.append(" AND o.order_status = 'fulfilled'")
            conditions.append(" AND o.fulfilled_date IS NOT NULL")

            # Prevent future dates from appearing
            conditions.append(" AND DATE(o.order_date) <= CURRENT_DATE")

            # Use date range if provided, otherwise use days
            if date_from and date_to:
                conditions.append(" AND DATE(o.order_date) >= %s")
                conditions.append(" AND DATE(o.order_date) <= %s")
                params.extend([date_from, date_to])
            else:
                conditions.append(" AND o.order_date >= NOW() - INTERVAL '%s days'")
                params.append(days)

            if region and region.lower() != "all":
                conditions.append(" AND s.region = %s")
                params.append(region)

            condition_str = "".join(conditions)

            query = f"""
                SELECT 
                    s.region,
                    DATE(o.order_date) as order_day,
                    AVG(EXTRACT(EPOCH FROM (o.fulfilled_date - o.order_date))/3600) as avg_fulfillment_hours,
                    COUNT(*) as order_count
                FROM orders o
                JOIN stores s ON o.to_store_id = s.store_id
                WHERE 1=1 {condition_str}
                GROUP BY s.region, DATE(o.order_date)
                ORDER BY order_day DESC, s.region
            """

            cursor.execute(query, params)
            results = cursor.fetchall()

            return [
                {
                    "region": row["region"],
                    "date": row["order_day"].strftime("%Y-%m-%d"),
                    "avg_fulfillment_hours": float(row["avg_fulfillment_hours"] or 0),
                    "order_count": int(row["order_count"]),
                }
                for row in results
            ]

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch fulfillment timeline: {str(e)}"
        )


@router.get("/analytics/regional-performance")
async def get_regional_performance(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get regional performance metrics"""
    try:
        with get_db_cursor() as cursor:
            conditions = []
            params = []

            # Prevent future dates from appearing
            conditions.append(" AND DATE(o.order_date) <= CURRENT_DATE")

            # Use date range if provided, otherwise use last 30 days
            if date_from and date_to:
                conditions.append(" AND DATE(o.order_date) >= %s")
                conditions.append(" AND DATE(o.order_date) <= %s")
                params.extend([date_from, date_to])
            else:
                conditions.append(" AND o.order_date >= NOW() - INTERVAL '30 days'")

            condition_str = "".join(conditions)

            query = f"""
                SELECT 
                    s.region,
                    COUNT(*) as total_orders,
                    COUNT(CASE WHEN o.order_status = 'fulfilled' THEN 1 END) as fulfilled_orders,
                    COUNT(CASE WHEN o.order_status = 'pending_review' THEN 1 END) as pending_orders,
                    COUNT(CASE WHEN o.order_status = 'approved' THEN 1 END) as approved_orders,
                    COUNT(CASE WHEN o.order_status = 'cancelled' THEN 1 END) as cancelled_orders,
                    AVG(CASE 
                        WHEN o.order_status = 'fulfilled' AND o.fulfilled_date IS NOT NULL 
                        THEN EXTRACT(EPOCH FROM (o.fulfilled_date - o.order_date))/3600
                        ELSE NULL 
                    END) as avg_fulfillment_hours,
                    ROUND(
                        COUNT(CASE WHEN o.order_status = 'fulfilled' THEN 1 END) * 100.0 / COUNT(*), 
                        2
                    ) as fulfillment_rate
                FROM orders o
                JOIN stores s ON o.to_store_id = s.store_id
                WHERE 1=1 {condition_str}
                GROUP BY s.region
                ORDER BY fulfillment_rate DESC
            """

            cursor.execute(query, params)
            results = cursor.fetchall()

            return [
                {
                    "region": row["region"],
                    "total_orders": int(row["total_orders"]),
                    "fulfilled_orders": int(row["fulfilled_orders"]),
                    "pending_orders": int(row["pending_orders"]),
                    "approved_orders": int(row["approved_orders"]),
                    "cancelled_orders": int(row["cancelled_orders"]),
                    "avg_fulfillment_hours": float(row["avg_fulfillment_hours"] or 0),
                    "fulfillment_rate": float(row["fulfillment_rate"] or 0),
                }
                for row in results
            ]

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch regional performance: {str(e)}"
        )


@router.get("/analytics/status-distribution")
async def get_order_status_distribution(
    days: Optional[int] = Query(30, description="Number of days to look back"),
    region: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
):
    """Get order status distribution for charts"""
    try:
        with get_db_cursor() as cursor:
            conditions = []
            params = []

            # Prevent future dates from appearing
            conditions.append(" AND DATE(o.order_date) <= CURRENT_DATE")

            # Use date range if provided, otherwise use days
            if date_from and date_to:
                conditions.append(" AND DATE(o.order_date) >= %s")
                conditions.append(" AND DATE(o.order_date) <= %s")
                params.extend([date_from, date_to])
            else:
                conditions.append(" AND o.order_date >= NOW() - INTERVAL '%s days'")
                params.append(days)

            if region and region.lower() != "all":
                conditions.append(" AND s.region = %s")
                params.append(region)

            condition_str = "".join(conditions)

            query = f"""
                SELECT 
                    o.order_status,
                    COUNT(*) as count,
                    SUM(o.quantity_cases * p.unit_price) as total_value
                FROM orders o
                JOIN stores s ON o.to_store_id = s.store_id
                JOIN products p ON o.product_id = p.product_id
                WHERE 1=1 {condition_str}
                GROUP BY o.order_status
                ORDER BY count DESC
            """

            cursor.execute(query, params)
            results = cursor.fetchall()

            total_orders = sum(row["count"] for row in results)

            return [
                {
                    "status": row["order_status"],
                    "count": int(row["count"]),
                    "percentage": round(
                        (row["count"] / total_orders * 100) if total_orders > 0 else 0,
                        1,
                    ),
                    "total_value": float(row["total_value"] or 0),
                }
                for row in results
            ]

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch status distribution: {str(e)}"
        )


@router.get("/analytics/demand-forecast")
async def get_demand_forecast(
    days_back: Optional[int] = Query(
        90, description="Days of historical data to analyze"
    ),
    days_forward: Optional[int] = Query(
        30, description="Days to forecast into the future"
    ),
    region: Optional[str] = Query(None),
):
    """Get demand forecasting based on historical order patterns"""
    try:
        with get_db_cursor() as cursor:
            conditions = []
            params = []

            # Get historical data
            conditions.append(" AND DATE(o.order_date) <= CURRENT_DATE")
            conditions.append(" AND o.order_date >= NOW() - INTERVAL '%s days'")
            params.append(days_back)

            if region and region.lower() != "all":
                conditions.append(" AND s.region = %s")
                params.append(region)

            condition_str = "".join(conditions)

            # Get daily order volumes and values for the historical period
            historical_query = f"""
                SELECT 
                    DATE(o.order_date) as order_date,
                    COUNT(*) as order_count,
                    SUM(o.quantity_cases) as total_cases,
                    SUM(o.quantity_cases * p.unit_price) as total_value,
                    AVG(o.quantity_cases) as avg_order_size
                FROM orders o
                JOIN stores s ON o.to_store_id = s.store_id
                JOIN products p ON o.product_id = p.product_id
                WHERE 1=1 {condition_str}
                GROUP BY DATE(o.order_date)
                ORDER BY order_date
            """

            cursor.execute(historical_query, params)
            historical_data = cursor.fetchall()

            if not historical_data:
                return []

            # Calculate simple moving averages and trends for forecasting
            historical_points = []
            for row in historical_data:
                historical_points.append(
                    {
                        "date": row["order_date"].strftime("%Y-%m-%d"),
                        "order_count": int(row["order_count"]),
                        "total_cases": int(row["total_cases"]),
                        "total_value": float(row["total_value"]),
                        "avg_order_size": float(row["avg_order_size"]),
                        "is_forecast": False,
                    }
                )

            # Simple forecasting using 7-day moving average
            if len(historical_points) >= 7:
                # Calculate the trend for the last 7 days
                recent_orders = [p["order_count"] for p in historical_points[-7:]]
                recent_cases = [p["total_cases"] for p in historical_points[-7:]]
                recent_values = [p["total_value"] for p in historical_points[-7:]]
                recent_avg_size = [p["avg_order_size"] for p in historical_points[-7:]]

                avg_orders = sum(recent_orders) / len(recent_orders)
                avg_cases = sum(recent_cases) / len(recent_cases)
                avg_value = sum(recent_values) / len(recent_values)
                avg_size = sum(recent_avg_size) / len(recent_avg_size)

                # Calculate growth trend (simple linear trend)
                if len(historical_points) >= 14:
                    prev_week_orders = (
                        sum([p["order_count"] for p in historical_points[-14:-7]]) / 7
                    )
                    growth_rate = (
                        (avg_orders - prev_week_orders) / prev_week_orders
                        if prev_week_orders > 0
                        else 0
                    )
                    # Cap growth rate to reasonable bounds
                    growth_rate = max(-0.2, min(0.2, growth_rate))
                else:
                    growth_rate = 0

                # Generate forecasted points
                forecast_points = []
                last_date = datetime.strptime(historical_points[-1]["date"], "%Y-%m-%d")

                for i in range(1, days_forward + 1):
                    forecast_date = last_date + timedelta(days=i)

                    # Apply weekly seasonality (simple pattern)
                    day_of_week = forecast_date.weekday()
                    seasonal_factor = 1.0
                    if day_of_week == 6:  # Sunday
                        seasonal_factor = 0.7
                    elif day_of_week == 5:  # Saturday
                        seasonal_factor = 0.8
                    elif day_of_week in [1, 2, 3]:  # Tue, Wed, Thu
                        seasonal_factor = 1.1

                    # Apply growth trend
                    trend_factor = 1 + (growth_rate * i / 7)  # Apply weekly growth

                    forecast_orders = max(
                        1, int(avg_orders * seasonal_factor * trend_factor)
                    )
                    forecast_cases = max(
                        1, int(avg_cases * seasonal_factor * trend_factor)
                    )
                    forecast_value = max(1, avg_value * seasonal_factor * trend_factor)

                    forecast_points.append(
                        {
                            "date": forecast_date.strftime("%Y-%m-%d"),
                            "order_count": forecast_orders,
                            "total_cases": forecast_cases,
                            "total_value": round(forecast_value, 2),
                            "avg_order_size": round(avg_size, 2),
                            "is_forecast": True,
                        }
                    )

                return historical_points + forecast_points
            else:
                return historical_points

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch demand forecast: {str(e)}"
        )
