// User types
export interface User {
  // Backend returns snake_case fields (actual API format)
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'store_manager' | 'regional_manager';
  store_id?: number;
  region?: string;
  avatar_url?: string;
  created_at: Date;

  // Legacy camelCase compatibility (for backward compatibility)
  userId?: number;
  firstName?: string;
  lastName?: string;
  storeId?: number;
  avatarUrl?: string;
  createdAt?: Date;
}

// Store types (replacing Location)
export interface Store {
  storeId: number;
  storeName: string;
  storeCode: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  region: string;
  storeType: string;
  createdAt: Date;
}

// Product types
export interface Product {
  // Backend returns snake_case fields
  product_id: number;
  product_name: string;
  brand: string;
  category: string;
  package_size: string;
  unit_price: number;
  created_at: Date;

  // Legacy camelCase compatibility (for backward compatibility)
  productId?: number;
  productName?: string;
  packageSize?: string;
  unitPrice?: number;
  createdAt?: Date;
}

// Inventory types
export interface Inventory {
  // Backend returns snake_case fields
  inventory_id: number;
  product_id: number;
  store_id: number;
  quantity_cases: number;
  reserved_cases: number;
  last_updated: Date;
  version: number;

  // Flattened fields from joins (returned by backend in snake_case)
  store_name?: string;
  product_name?: string;
  brand?: string;
  category?: string;
  unit_price?: number;
  package_size?: string;

  // Aggregated fields from warehouse endpoint
  total_quantity_cases?: number;
  total_reserved_cases?: number;
  available_cases?: number;

  // Legacy camelCase compatibility (for backward compatibility)
  inventoryId?: number;
  productId?: number;
  storeId?: number;
  quantityCases?: number;
  reservedCases?: number;
  lastUpdated?: Date;

  // Optional nested objects (for compatibility)
  product?: Product;
  store?: Store;
}

// Order types (simplified - no order_items table)
export interface Order {
  // Backend returns snake_case fields
  order_id: number;
  order_number: string;
  from_store_id?: number;
  to_store_id: number;
  product_id: number;
  quantity_cases: number;
  order_status: 'pending_review' | 'approved' | 'fulfilled' | 'cancelled';
  requested_by: number;
  approved_by?: number;
  order_date: Date | string;
  approved_date?: Date | string;
  fulfilled_date?: Date | string;
  notes?: string;
  version: number;

  // Flattened fields from joins (returned by backend in snake_case)
  to_store_name?: string;
  to_store_region?: string;
  from_store_name?: string;
  product_name?: string;
  brand?: string;
  category?: string;
  requester_name?: string;
  requester_avatar_url?: string;
  approver_name?: string;
  approver_avatar_url?: string;

  // Legacy camelCase compatibility (for backward compatibility)
  orderId?: number;
  orderNumber?: string;
  fromStoreId?: number;
  toStoreId?: number;
  productId?: number;
  quantityCases?: number;
  orderStatus?: 'pending_review' | 'approved' | 'fulfilled' | 'cancelled';
  requestedBy?: number;
  approvedBy?: number;
  orderDate?: Date | string;
  approvedDate?: Date | string;
  fulfilledDate?: Date | string;
  toStoreName?: string;
  toStoreRegion?: string;
  fromStoreName?: string;
  productName?: string;
  requesterName?: string;

  // Optional nested objects (for compatibility)
  product?: Product;
  toStore?: Store;
  fromStore?: Store;
  requestedByUser?: User;
  approvedByUser?: User;
}

// KPI and Analytics types
export interface KPIData {
  total_inventory_value: number;
  total_products: number;
  low_stock_alerts: number;
  average_turnover: number;
}

export interface StorePerformance {
  storeId: number;
  storeName: string;
  region: string;
  inventoryValue: number;
  stockTurnover: number;
  lowStockCount: number;
  pendingOrders: number;
  fulfillmentRate: number;
}

// Chart data types
export interface InventoryTrendData {
  date: string;
  total_value: number;
  total_quantity: number;
  category?: string;
  region?: string;
}

export interface CategoryDistribution {
  category: string;
  value: number;
  percentage: number;
}

export interface RegionalSummary {
  region: string;
  totalStores: number;
  totalInventoryValue: number;
  lowStockAlerts: number;
  pendingOrders: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  totalPages?: number;
}

// Filter types
export interface InventoryFilters {
  storeId?: number | string;
  region?: string;
  category?: string;
  brand?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  dateFrom?: string;
  dateTo?: string;
  lowStockOnly?: boolean;
  searchTerm?: string;
}

export interface OrderFilters {
  storeId?: number | string;
  region?: string;
  status?: string;
  category?: string;
  requestedBy?: number;
  dateRange?: {
    from: Date;
    to: Date;
  };
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
  expiredSlaOnly?: boolean;
}

export interface StoreFilters {
  region?: string;
  storeType?: string;
  searchTerm?: string;
}

// Analytics types for materialized views
export interface InventorySummary {
  region: string;
  storeName: string;
  brand: string;
  category: string;
  totalCases: number;
  totalReserved: number;
  inventoryValue: number;
  productCount: number;
}

export interface OrderTrend {
  orderDay: Date;
  region: string;
  category: string;
  orderCount: number;
  totalCasesOrdered: number;
  totalOrderValue: number;
  fulfilledOrders: number;
  avgFulfillmentHours: number;
}

export interface LowStockAlert {
  storeName: string;
  region: string;
  productName: string;
  brand: string;
  quantityCases: number;
  reservedCases: number;
  availableCases: number;
  stockStatus: 'CRITICAL' | 'LOW' | 'NORMAL';
}

// Operational Efficiency Analytics types
export interface FulfillmentTimelineData {
  region: string;
  date: string;
  avg_fulfillment_hours: number;
  order_count: number;
}

export interface RegionalPerformanceData {
  region: string;
  total_orders: number;
  fulfilled_orders: number;
  pending_orders: number;
  approved_orders: number;
  cancelled_orders: number;
  avg_fulfillment_hours: number;
  fulfillment_rate: number;
}

export interface OrderStatusDistributionData {
  status: string;
  count: number;
  percentage: number;
  total_value: number;
}

export interface OrderCreate {
  order_number?: string;
  from_store_id?: number | null;
  to_store_id: number;
  product_id: number;
  quantity_cases: number;
  requested_by: number;
  notes?: string;
  order_date?: string; // For demo purposes - allow custom order dates
}

// Demand Forecasting types
export interface DemandForecastData {
  date: string;
  order_count: number;
  total_cases: number;
  total_value: number;
  avg_order_size: number;
  is_forecast: boolean;
} 