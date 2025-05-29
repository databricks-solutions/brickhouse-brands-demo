import { apiClient, handleApiError } from '../config/apiClient';
import {
  Order,
  OrderFilters,
  PaginatedResponse,
  ApiResponse,
  User,
  Store,
  Product,
  OrderCreate
} from '../types';
import { AxiosError } from 'axios';

export class OrderService {
  // Get all orders with optional filtering
  static async getOrders(
    filters: OrderFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<Order>> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value != null && value !== '')
        )
      });

      const response = await apiClient.get(`/orders?${params}`);
      return response.data;
    } catch (error) {
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
  }): Promise<ApiResponse<Order>> {
    try {
      // Convert camelCase to snake_case for backend
      const backendOrderData = {
        from_store_id: orderData.fromStoreId,
        to_store_id: orderData.toStoreId,
        product_id: orderData.productId,
        quantity_cases: orderData.quantityCases,
        requested_by: orderData.requestedBy,
        notes: orderData.notes
      };

      const response = await apiClient.post('/orders', backendOrderData);
      return {
        success: true,
        data: response.data,
        message: 'Order created successfully'
      };
    } catch (error) {
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
    updates: Partial<Order>
  ): Promise<ApiResponse<Order>> {
    try {
      const response = await apiClient.patch(`/orders/${orderId}`, updates);
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
      const response = await apiClient.patch(`/orders/${orderId}/cancel`, {
        reason
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
  static async getOrderStatusSummary(region?: string): Promise<{
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
      if (region && region !== 'all') {
        params.append('region', region);
      }

      const response = await apiClient.get(`/orders/status/summary?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }
} 