from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import User, UserCreate, ApiResponse
from app.database.connection import get_db_cursor

router = APIRouter()


@router.get("", response_model=List[User])
async def get_users(
    role: Optional[str] = Query(None),
    store_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    """Get users with optional filtering"""
    try:
        with get_db_cursor() as cursor:
            query = """
                SELECT user_id, username, email, first_name, last_name, 
                       role, store_id, created_at
                FROM users WHERE 1=1
            """
            params = []

            if role:
                query += " AND role = %s"
                params.append(role)

            if store_id:
                query += " AND store_id = %s"
                params.append(store_id)

            query += " ORDER BY created_at DESC"

            cursor.execute(query, params)
            users = cursor.fetchall()

            return [User(**user) for user in users]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")


@router.get("/{user_id}", response_model=User)
async def get_user(user_id: int):
    """Get a specific user by ID"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
            user = cursor.fetchone()

            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            return User(**user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user: {str(e)}")


@router.post("", response_model=ApiResponse)
async def create_user(user_data: UserCreate):
    """Create a new user"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO users (username, email, first_name, last_name, role, store_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING user_id
            """,
                (
                    user_data.username,
                    user_data.email,
                    user_data.first_name,
                    user_data.last_name,
                    user_data.role,
                    user_data.store_id,
                ),
            )

            result = cursor.fetchone()
            user_id = result["user_id"]

            return ApiResponse(
                success=True,
                data={"user_id": user_id},
                message="User created successfully",
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")
