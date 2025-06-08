import { apiClient, handleApiError } from '../config/apiClient';
import {
  Order,
  OrderFilters,
  PaginatedResponse,
  ApiResponse,
  User,
  Store,
  Product,
  OrderCreate,
  FulfillmentTimelineData,
  RegionalPerformanceData,
  OrderStatusDistributionData,
  DemandForecastData
} from '../types';
import { AxiosError, AxiosResponse } from 'axios';
import { useDateStore } from '@/store/useDateStore';

export class OrderService {
  private static currentRequest: Promise<AxiosResponse<PaginatedResponse<Order>>> | null = null;
  private static currentRequestKey: string | null = null;
  private static requestCounter: number = 0;

  // Helper method to get the configured date for "as of" filtering
  private static getAsOfDate(): string | null {
    const dateStore = useDateStore.getState();
    if (dateStore.isDateConfigured && dateStore.configuredDate) {
      const date = dateStore.configuredDate instanceof Date
        ? dateStore.configuredDate
        : new Date(dateStore.configuredDate);

      // Use local date formatting to avoid timezone issues
      // This ensures May 31st stays May 31st regardless of timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  // Get orders with pagination and filtering
  static async getOrders(
    filters: OrderFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<Order>> {
    try {
      // Cancel any existing request
      if (OrderService.currentRequest) {
        // Note: We can't actually cancel the request with axios, but we can ignore the result
        OrderService.currentRequest = null;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      // Add filters to params
      if (filters.region && filters.region !== 'all') {
        params.append('region', filters.region);
      }
      if (filters.category && filters.category !== 'all') {
        params.append('category', filters.category);
      }
      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.expiredSlaOnly) {
        params.append('expired_sla_only', 'true');
      }
      if (filters.dateFrom) {
        params.append('date_from', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('date_to', filters.dateTo);
      }

      // Always include as_of_date from DateStore if available (for demo mode consistency)
      const asOfDate = OrderService.getAsOfDate();
      if (asOfDate) {
        params.append('as_of_date', asOfDate);
      }

      // Store the current request
      const request = apiClient.get<PaginatedResponse<Order>>(`/orders?${params}`);
      OrderService.currentRequest = request;

      const response = await request;

      // Clear the current request if this was the active one
      if (OrderService.currentRequest === request) {
        OrderService.currentRequest = null;
      }

      return response.data;
    } catch (error) {
      // Clear the current request on error
      OrderService.currentRequest = null;
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get order by ID
  static async getOrderById(orderId: number): Promise<Order | null> {
    try {
      const response = await apiClient.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Create new order
  static async createOrder(orderData: {
    fromStoreId?: number;
    toStoreId: number;
    productId: number;
    quantityCases: number;
    requestedBy: number;
    notes?: string;
    approvedBy?: number; // Made optional, will be set by caller if available
  }): Promise<ApiResponse<Order>> {
    try {
      // Convert camelCase to snake_case for backend
      const backendOrderData: {
        from_store_id?: number;
        to_store_id: number;
        product_id: number;
        quantity_cases: number;
        requested_by: number;
        approved_by?: number;
        notes?: string;
        order_date?: string;
      } = {
        from_store_id: orderData.fromStoreId,
        to_store_id: orderData.toStoreId,
        product_id: orderData.productId,
        quantity_cases: orderData.quantityCases,
        requested_by: orderData.requestedBy,
        approved_by: orderData.approvedBy, // Re-enabled now that backend supports it
        notes: orderData.notes
      };

      // Add configured date if available (for demo purposes)
      const dateStore = useDateStore.getState();
      if (dateStore.isDateConfigured && dateStore.configuredDate) {
        const configuredDate = dateStore.configuredDate instanceof Date
          ? dateStore.configuredDate
          : new Date(dateStore.configuredDate);

        // Use local date formatting to avoid timezone issues
        // This ensures June 10th stays June 10th regardless of timezone
        const year = configuredDate.getFullYear();
        const month = String(configuredDate.getMonth() + 1).padStart(2, '0');
        const day = String(configuredDate.getDate()).padStart(2, '0');

        // Send as YYYY-MM-DD format to avoid UTC conversion issues
        backendOrderData.order_date = `${year}-${month}-${day}`;
      }

      const response = await apiClient.post('/orders', backendOrderData);
      return {
        success: true,
        data: response.data,
        message: 'Order created successfully'
      };
    } catch (error) {
      console.error('Order creation failed:', error);
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Update order
  static async updateOrder(
    orderId: number,
    updates: { quantity_cases?: number; notes?: string }
  ): Promise<ApiResponse<Order>> {
    try {
      const response = await apiClient.put(`/orders/${orderId}`, updates);
      return {
        success: true,
        data: response.data,
        message: 'Order updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Approve order
  static async approveOrder(
    orderId: number,
    approvedBy: number
  ): Promise<ApiResponse<Order>> {
    try {
      const response = await apiClient.patch(`/orders/${orderId}/approve`, {
        approved_by: approvedBy
      });
      return {
        success: true,
        data: response.data,
        message: 'Order approved successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Fulfill order
  static async fulfillOrder(orderId: number): Promise<ApiResponse<Order>> {
    try {
      const response = await apiClient.patch(`/orders/${orderId}/fulfill`);
      return {
        success: true,
        data: response.data,
        message: 'Order fulfilled successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Cancel order
  static async cancelOrder(
    orderId: number,
    reason?: string
  ): Promise<ApiResponse<Order>> {
    try {
      const response = await apiClient.put(`/orders/${orderId}/cancel`, {
        reason: reason || 'Order cancelled by user'
      });
      return {
        success: true,
        data: response.data,
        message: 'Order cancelled successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Delete order
  static async deleteOrder(orderId: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/orders/${orderId}`);
      return {
        success: true,
        data: undefined as any,
        message: 'Order deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Get orders by store
  static async getOrdersByStore(
    storeId: number,
    includeFromStore: boolean = true,
    includeToStore: boolean = true
  ): Promise<Order[]> {
    try {
      const params = new URLSearchParams({
        include_from_store: includeFromStore.toString(),
        include_to_store: includeToStore.toString()
      });

      const response = await apiClient.get(`/orders/store/${storeId}?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get orders by user
  static async getOrdersByUser(
    userId: number,
    role: 'store_manager' | 'regional_manager' = 'store_manager'
  ): Promise<Order[]> {
    try {
      const response = await apiClient.get(`/orders/user/${userId}?role=${role}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get pending approvals for regional managers
  static async getPendingApprovals(
    region?: string,
    limit: number = 50
  ): Promise<Order[]> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(region && { region })
      });

      const response = await apiClient.get(`/orders/pending-approvals?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get order statistics
  static async getOrderStats(filters: OrderFilters = {}): Promise<{
    total: number;
    pending: number;
    approved: number;
    fulfilled: number;
    cancelled: number;
    totalValue: number;
    averageOrderValue: number;
    fulfillmentRate: number;
  }> {
    try {
      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value != null && value !== '')
        )
      );

      const response = await apiClient.get(`/orders/stats?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get order trends for analytics
  static async getOrderTrends(
    filters: OrderFilters = {},
    days: number = 30
  ): Promise<Array<{
    date: string;
    orderCount: number;
    totalValue: number;
    fulfillmentRate: number;
  }>> {
    try {
      const params = new URLSearchParams({
        days: days.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value != null && value !== '')
        )
      });

      const response = await apiClient.get(`/orders/trends?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get fulfillment performance by region
  static async getFulfillmentPerformance(
    region?: string
  ): Promise<Array<{
    region: string;
    totalOrders: number;
    fulfilledOrders: number;
    fulfillmentRate: number;
    averageFulfillmentTime: number;
  }>> {
    try {
      const params = new URLSearchParams();
      if (region) {
        params.append('region', region);
      }

      const response = await apiClient.get(`/orders/fulfillment-performance?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get orders requiring attention (overdue, delayed, etc.)
  static async getOrdersRequiringAttention(
    region?: string
  ): Promise<Array<{
    order: Order;
    reason: string;
    daysSinceOrdered: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>> {
    try {
      const params = new URLSearchParams();
      if (region) {
        params.append('region', region);
      }

      const response = await apiClient.get(`/orders/requiring-attention?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Bulk approve orders
  static async bulkApproveOrders(
    orderIds: number[],
    approvedBy: number
  ): Promise<ApiResponse<Order[]>> {
    try {
      const response = await apiClient.patch('/orders/bulk-approve', {
        order_ids: orderIds,
        approved_by: approvedBy
      });

      return {
        success: true,
        data: response.data,
        message: `${orderIds.length} orders approved successfully`
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Bulk fulfill orders
  static async bulkFulfillOrders(orderIds: number[]): Promise<ApiResponse<Order[]>> {
    try {
      const response = await apiClient.patch('/orders/bulk-fulfill', {
        order_ids: orderIds
      });

      return {
        success: true,
        data: response.data,
        message: `${orderIds.length} orders fulfilled successfully`
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Get order history for a product
  static async getOrderHistoryByProduct(
    productId: number,
    limit: number = 50
  ): Promise<Order[]> {
    try {
      const response = await apiClient.get(`/orders/product/${productId}/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get order status summary with SLA tracking
  static async getOrderStatusSummary(filters: OrderFilters = {}): Promise<{
    status_counts: {
      pending_review: number;
      approved: number;
      fulfilled: number;
      cancelled: number;
    };
    expired_sla_count: number;
    total_cases: number;
    summary_period: string;
  }> {
    try {
      const params = new URLSearchParams();

      // Add region and category filters
      if (filters.region && filters.region !== 'all') {
        params.append('region', filters.region);
      }
      if (filters.category && filters.category !== 'all') {
        params.append('category', filters.category);
      }

      // Use dateFrom and dateTo to sync with date filter selection
      if (filters.dateFrom) {
        params.append('date_from', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('date_to', filters.dateTo);
      }

      // Always include as_of_date from DateStore if available (for demo mode consistency)
      const asOfDate = OrderService.getAsOfDate();
      if (asOfDate) {
        params.append('as_of_date', asOfDate);
      }

      const response = await apiClient.get(`/orders/status/summary?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Operational Efficiency Analytics Methods
  static async getFulfillmentTimeline(
    days: number = 30,
    region?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<FulfillmentTimelineData[]> {
    try {
      const params = new URLSearchParams();

      if (dateFrom && dateTo) {
        params.append('date_from', dateFrom);
        params.append('date_to', dateTo);
      } else {
        params.append('days', days.toString());
      }

      if (region && region !== 'all') {
        params.append('region', region);
      }

      const response = await apiClient.get(`/orders/analytics/fulfillment-timeline?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  static async getRegionalPerformance(
    dateFrom?: string,
    dateTo?: string
  ): Promise<RegionalPerformanceData[]> {
    try {
      const params = new URLSearchParams();

      if (dateFrom && dateTo) {
        params.append('date_from', dateFrom);
        params.append('date_to', dateTo);
      }

      const response = await apiClient.get(`/orders/analytics/regional-performance?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  static async getOrderStatusDistribution(
    days: number = 30,
    region?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<OrderStatusDistributionData[]> {
    try {
      const params = new URLSearchParams();

      if (dateFrom && dateTo) {
        params.append('date_from', dateFrom);
        params.append('date_to', dateTo);
      } else {
        params.append('days', days.toString());
      }

      if (region && region !== 'all') {
        params.append('region', region);
      }

      const response = await apiClient.get(`/orders/analytics/status-distribution?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  static async getDemandForecast(
    daysBack: number = 90,
    daysForward: number = 30,
    region?: string
  ): Promise<DemandForecastData[]> {
    try {
      const params = new URLSearchParams();
      params.append('days_back', daysBack.toString());
      params.append('days_forward', daysForward.toString());

      if (region && region !== 'all') {
        params.append('region', region);
      }

      const response = await apiClient.get(`/orders/analytics/demand-forecast?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }
} 