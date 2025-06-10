from pydantic import BaseModel
from typing import Optional, List, Union
from datetime import datetime, date
from enum import Enum


# Store related models
class StoreType(str, Enum):
    WAREHOUSE = "Warehouse"
    URBAN = "Urban"
    SUBURBAN = "Suburban"
    TOURIST = "Tourist"
    BUSINESS = "Business"
    ENTERTAINMENT = "Entertainment"
    SHOPPING = "Shopping"


class Store(BaseModel):
    store_id: int
    store_name: str
    store_code: str
    address: str
    city: str
    state: str
    zip_code: str
    region: str
    store_type: StoreType
    created_at: datetime


class StoreCreate(BaseModel):
    store_name: str
    store_code: str
    address: str
    city: str
    state: str
    zip_code: str
    region: str
    store_type: StoreType


class StoreUpdate(BaseModel):
    store_name: Optional[str] = None
    store_code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    region: Optional[str] = None
    store_type: Optional[StoreType] = None


# Product related models
class Product(BaseModel):
    product_id: int
    product_name: str
    brand: str
    category: str
    package_size: str
    unit_price: float
    created_at: datetime


class ProductCreate(BaseModel):
    product_name: str
    brand: str
    category: str
    package_size: str
    unit_price: float


# Inventory related models
class Inventory(BaseModel):
    inventory_id: int
    store_id: int
    product_id: int
    quantity_cases: int
    reserved_cases: int
    last_updated: datetime
    version: int
    # Joined fields
    store_name: Optional[str] = None
    product_name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None


class InventoryUpdate(BaseModel):
    quantity_cases: Optional[int] = None
    reserved_cases: Optional[int] = None


# Order related models
class OrderStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"


class Order(BaseModel):
    order_id: int
    order_number: str
    from_store_id: Optional[int] = None
    to_store_id: int
    product_id: int
    quantity_cases: int
    order_status: OrderStatus
    requested_by: int
    approved_by: Optional[int] = None
    order_date: datetime
    approved_date: Optional[datetime] = None
    fulfilled_date: Optional[datetime] = None
    notes: Optional[str] = None
    version: int
    # Joined fields
    to_store_name: Optional[str] = None
    from_store_name: Optional[str] = None
    product_name: Optional[str] = None
    requester_name: Optional[str] = None
    requester_avatar_url: Optional[str] = None
    approver_name: Optional[str] = None
    approver_avatar_url: Optional[str] = None


class OrderCreate(BaseModel):
    order_number: Optional[str] = None
    from_store_id: Optional[int]
    to_store_id: int
    product_id: int
    quantity_cases: int
    requested_by: int
    approved_by: Optional[int] = None
    notes: Optional[str]
    order_date: Optional[Union[datetime, str]] = None


# User related models
class UserRole(str, Enum):
    STORE_MANAGER = "store_manager"
    REGIONAL_MANAGER = "regional_manager"


class User(BaseModel):
    user_id: int
    username: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    store_id: Optional[int] = None
    region: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime


class UserCreate(BaseModel):
    username: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    store_id: Optional[int] = None
    region: Optional[str] = None
    avatar_url: Optional[str] = None


# Analytics models
class KPIData(BaseModel):
    total_inventory_value: float
    total_products: int
    low_stock_alerts: int
    average_turnover: float


class RegionOption(BaseModel):
    value: str
    label: str
    store_count: int


class InventoryTrendData(BaseModel):
    date: str
    total_value: float
    total_quantity: int


class CategoryDistribution(BaseModel):
    category: str
    value: float
    percentage: float


# Response models
class PaginatedResponse(BaseModel):
    data: List[dict]
    page: int
    total_pages: int
    total: int
    limit: int


class ApiResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    message: Optional[str] = None
    error: Optional[str] = None
