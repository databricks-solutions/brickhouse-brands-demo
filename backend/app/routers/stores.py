from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import (
    Store,
    StoreCreate,
    StoreUpdate,
    RegionOption,
    ApiResponse,
)
from app.database.connection import get_db_cursor

router = APIRouter()


@router.get("", response_model=List[Store])
async def get_stores(
    region: Optional[str] = Query(None),
    store_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """Get all stores with optional filtering"""
    try:
        with get_db_cursor() as cursor:
            query = """
                SELECT store_id, store_name, store_code, address, city, state, 
                       zip_code, region, store_type, created_at
                FROM stores WHERE 1=1
            """
            params = []

            if region and region != "all":
                query += " AND region = %s"
                params.append(region)

            if store_type and store_type != "all":
                query += " AND store_type = %s"
                params.append(store_type)

            if search:
                query += (
                    " AND (store_name ILIKE %s OR store_code ILIKE %s OR city ILIKE %s)"
                )
                search_param = f"%{search}%"
                params.extend([search_param, search_param, search_param])

            query += " ORDER BY region, store_name"

            cursor.execute(query, params)
            stores = cursor.fetchall()

            return [Store(**store) for store in stores]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stores: {str(e)}")


@router.get("/{store_id}", response_model=Store)
async def get_store(store_id: int):
    """Get a specific store by ID"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM stores WHERE store_id = %s", (store_id,))
            store = cursor.fetchone()

            if not store:
                raise HTTPException(status_code=404, detail="Store not found")

            return Store(**store)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch store: {str(e)}")


@router.post("/", response_model=ApiResponse)
async def create_store(store_data: StoreCreate):
    """Create a new store"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO stores (store_name, store_code, address, city, state, 
                                  zip_code, region, store_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING store_id
            """,
                (
                    store_data.store_name,
                    store_data.store_code,
                    store_data.address,
                    store_data.city,
                    store_data.state,
                    store_data.zip_code,
                    store_data.region,
                    store_data.store_type,
                ),
            )

            result = cursor.fetchone()
            store_id = result["store_id"]

            return ApiResponse(
                success=True,
                data={"store_id": store_id},
                message="Store created successfully",
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create store: {str(e)}")


@router.put("/{store_id}", response_model=ApiResponse)
async def update_store(store_id: int, store_data: StoreUpdate):
    """Update an existing store"""
    try:
        # Build dynamic update query
        update_fields = []
        params = []

        for field, value in store_data.dict(exclude_unset=True).items():
            update_fields.append(f"{field} = %s")
            params.append(value)

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        params.append(store_id)

        with get_db_cursor() as cursor:
            query = f"""
                UPDATE stores 
                SET {', '.join(update_fields)}
                WHERE store_id = %s
                RETURNING store_id
            """

            cursor.execute(query, params)
            result = cursor.fetchone()

            if not result:
                raise HTTPException(status_code=404, detail="Store not found")

            return ApiResponse(success=True, message="Store updated successfully")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update store: {str(e)}")


@router.get("/regions/options", response_model=List[RegionOption])
async def get_region_options():
    """Get region options for dropdowns with store counts"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT region, COUNT(*) as store_count
                FROM stores 
                WHERE region IS NOT NULL
                GROUP BY region 
                ORDER BY region
            """
            )

            regions = cursor.fetchall()
            total_stores = sum(r["store_count"] for r in regions)

            # Build options list
            options = [
                RegionOption(
                    value="all",
                    label=f"All Regions ({total_stores} stores)",
                    store_count=total_stores,
                )
            ]

            for region in regions:
                options.append(
                    RegionOption(
                        value=region["region"],
                        label=f"{region['region']} ({region['store_count']} stores)",
                        store_count=region["store_count"],
                    )
                )

            return options

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch region options: {str(e)}"
        )


@router.get("/regions/summary")
async def get_region_summary():
    """Get detailed region summary with store type breakdown"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT 
                    region,
                    COUNT(*) as total_stores,
                    COUNT(CASE WHEN store_type = 'Warehouse' THEN 1 END) as warehouse_stores,
                    COUNT(CASE WHEN store_type = 'Urban' THEN 1 END) as urban_stores,
                    COUNT(CASE WHEN store_type = 'Suburban' THEN 1 END) as suburban_stores,
                    COUNT(CASE WHEN store_type = 'Tourist' THEN 1 END) as tourist_stores,
                    COUNT(CASE WHEN store_type = 'Business' THEN 1 END) as business_stores,
                    COUNT(CASE WHEN store_type = 'Entertainment' THEN 1 END) as entertainment_stores,
                    COUNT(CASE WHEN store_type = 'Shopping' THEN 1 END) as shopping_stores
                FROM stores 
                WHERE region IS NOT NULL
                GROUP BY region 
                ORDER BY region
            """
            )

            return cursor.fetchall()

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch region summary: {str(e)}"
        )
