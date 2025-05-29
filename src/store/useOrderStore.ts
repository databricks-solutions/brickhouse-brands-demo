import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Order, OrderFilters, PaginatedResponse } from '../api/types';
import { OrderService } from '../api/services/orderService';

interface OrderStatusSummary {
  status_counts: {
    pending_review: number;
    approved: number;
    fulfilled: number;
    cancelled: number;
  };
  expired_sla_count: number;
  total_cases: number;
  summary_period: string;
}

interface OrderState {
  // Data
  orders: Order[];
  selectedOrder: Order | null;
  statusSummary: OrderStatusSummary | null;

  // Pagination
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;

  // Filters
  filters: OrderFilters;

  // Loading states
  isLoading: boolean;
  isLoadingOrder: boolean;
  isCreatingOrder: boolean;
  isUpdatingOrder: boolean;
  isLoadingStatusSummary: boolean;

  // Error states
  error: string | null;

  // Actions
  setFilters: (filters: Partial<OrderFilters>) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  fetchOrders: (filters?: OrderFilters, page?: number, limit?: number) => Promise<void>;
  fetchOrderById: (orderId: number) => Promise<void>;
  fetchOrdersByUser: (userId: number) => Promise<void>;
  fetchPendingOrders: (region?: string) => Promise<void>;
  fetchOrdersByRegion: (filters?: { status?: string; dateFrom?: string; dateTo?: string }) => Promise<void>;
  fetchOrderTrendsByRegion: (region?: string, days?: number) => Promise<void>;
  fetchOrderStatusSummary: (region?: string) => Promise<void>;
  createOrder: (orderData: {
    fromStoreId?: number;
    toStoreId: number;
    productId: number;
    quantityCases: number;
    requestedBy: number;
    notes?: string;
  }) => Promise<boolean>;
  updateOrderStatus: (orderId: number, status: string, userId?: number) => Promise<boolean>;
  approveOrder: (orderId: number, approvedBy: number) => Promise<boolean>;
  fulfillOrder: (orderId: number) => Promise<boolean>;
  cancelOrder: (orderId: number, reason?: string) => Promise<boolean>;
  getOrdersByUser: (userId: number, filters?: OrderFilters) => Promise<void>;
  getPendingOrders: (region?: string) => Promise<void>;
  clearSelectedOrder: () => void;
  refreshOrders: () => Promise<void>;
}

const initialFilters: OrderFilters = {
  storeId: 'all',
  region: 'all',
  status: 'all',
  searchTerm: '',
};

export const useOrderStore = create<OrderState>()(
  devtools(
    (set, get) => ({
      // Initial state
      orders: [],
      selectedOrder: null,
      statusSummary: null,
      currentPage: 1,
      totalPages: 0,
      totalItems: 0,
      pageSize: 20,
      filters: initialFilters,
      isLoading: false,
      isLoadingOrder: false,
      isCreatingOrder: false,
      isUpdatingOrder: false,
      isLoadingStatusSummary: false,
      error: null,

      // Actions
      setFilters: (filters: Partial<OrderFilters>) => {
        const newFilters = { ...get().filters, ...filters };
        set({ filters: newFilters, currentPage: 1 }); // Reset to page 1 when filtering

        // Automatically refetch orders with new filters
        get().fetchOrders(newFilters, 1, get().pageSize);
      },

      clearFilters: () => {
        set({ filters: {} });
      },

      setPage: (page: number) => {
        set({ currentPage: page });
        const { pageSize } = get();
        get().fetchOrders(undefined, page, pageSize);
      },

      setPageSize: (size: number) => {
        set({ pageSize: size });
      },

      clearSelectedOrder: () => {
        set({ selectedOrder: null });
      },

      fetchOrderStatusSummary: async (region?: string) => {
        set({ isLoadingStatusSummary: true, error: null });

        try {
          const result = await OrderService.getOrderStatusSummary(region);

          set({
            statusSummary: result,
            isLoadingStatusSummary: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch order status summary: ${error}`,
            isLoadingStatusSummary: false
          });
        }
      },

      fetchOrders: async (filters?: OrderFilters, page = 1, limit = 20) => {
        set({ isLoading: true, error: null });

        try {
          const currentFilters = filters || get().filters;
          const result = await OrderService.getOrders(currentFilters, page, limit);

          set({
            orders: result.data,
            currentPage: result.page,
            totalPages: result.total_pages,
            totalItems: result.total,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch orders: ${error}`,
            isLoading: false
          });
        }
      },

      fetchOrderById: async (orderId: number) => {
        set({ isLoadingOrder: true, error: null });

        try {
          const result = await OrderService.getOrderById(orderId);

          if (result.success) {
            set({
              selectedOrder: result.data,
              isLoadingOrder: false
            });
          } else {
            set({
              error: result.error || 'Failed to fetch order',
              isLoadingOrder: false
            });
          }
        } catch (error) {
          set({
            error: `Failed to fetch order: ${error}`,
            isLoadingOrder: false
          });
        }
      },

      fetchOrdersByUser: async (userId: number) => {
        set({ isLoading: true, error: null });

        try {
          const result = await OrderService.getOrdersByUser(userId, {}, 1, 20);

          set({
            orders: result.data,
            currentPage: result.page,
            totalPages: result.total_pages,
            totalItems: result.total,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch user orders: ${error}`,
            isLoading: false
          });
        }
      },

      fetchPendingOrders: async (region) => {
        set({ isLoading: true, error: null });

        try {
          const orders = await OrderService.getPendingOrders(region);

          set({
            orders,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch pending orders: ${error}`,
            isLoading: false
          });
        }
      },

      fetchOrdersByRegion: async (filters?: { status?: string; dateFrom?: string; dateTo?: string }) => {
        set({ isLoading: true, error: null });

        try {
          const regionData = await OrderService.getOrdersByRegion(filters);
          // Store region data separately or transform as needed
          // For now, we'll just clear orders since this returns summary data
          set({
            orders: [],
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch orders by region: ${error}`,
            isLoading: false
          });
        }
      },

      fetchOrderTrendsByRegion: async (region, days = 30) => {
        set({ isLoading: true, error: null });

        try {
          const trendData = await OrderService.getOrderTrendsByRegion(region, days);
          // Store trend data separately or transform as needed
          // For now, we'll just clear orders since this returns trend data
          set({
            orders: [],
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch order trends by region: ${error}`,
            isLoading: false
          });
        }
      },

      createOrder: async (orderData) => {
        set({ isCreatingOrder: true, error: null });

        try {
          const result = await OrderService.createOrder(orderData);

          if (result.success) {
            set({ isCreatingOrder: false });

            // Refresh orders list
            await get().fetchOrders(get().filters, get().currentPage);

            return true;
          } else {
            set({
              error: result.error || 'Failed to create order',
              isCreatingOrder: false
            });
            return false;
          }
        } catch (error) {
          set({
            error: `Failed to create order: ${error}`,
            isCreatingOrder: false
          });
          return false;
        }
      },

      updateOrderStatus: async (orderId: number, status: string, userId?: number) => {
        set({ isUpdatingOrder: true, error: null });

        try {
          const result = await OrderService.updateOrderStatus(orderId, status, userId);

          if (result.success) {
            // Update the order in the orders list
            const { orders } = get();
            const updatedOrders = orders.map(order =>
              order.orderId === orderId
                ? { ...order, orderStatus: status as any, approvedBy: userId, approvedDate: status === 'approved' ? new Date() : order.approvedDate }
                : order
            );

            set({
              orders: updatedOrders,
              isUpdatingOrder: false
            });

            // Update selected order if it's the same one
            const { selectedOrder } = get();
            if (selectedOrder && selectedOrder.orderId === orderId) {
              set({
                selectedOrder: {
                  ...selectedOrder,
                  orderStatus: status as any,
                  approvedBy: userId,
                  approvedDate: status === 'approved' ? new Date() : selectedOrder.approvedDate
                }
              });
            }

            return true;
          } else {
            set({
              error: result.error || 'Failed to update order status',
              isUpdatingOrder: false
            });
            return false;
          }
        } catch (error) {
          set({
            error: `Failed to update order status: ${error}`,
            isUpdatingOrder: false
          });
          return false;
        }
      },

      approveOrder: async (orderId: number, approvedBy: number) => {
        return get().updateOrderStatus(orderId, 'approved', approvedBy);
      },

      fulfillOrder: async (orderId: number) => {
        return get().updateOrderStatus(orderId, 'fulfilled');
      },

      cancelOrder: async (orderId: number, reason?: string) => {
        return get().updateOrderStatus(orderId, 'cancelled');
      },

      getOrdersByUser: async (userId: number, filters = {}) => {
        set({ isLoading: true, error: null });

        try {
          const result = await OrderService.getOrdersByUser(userId, filters, 1, 20);

          set({
            orders: result.data,
            currentPage: result.page,
            totalPages: result.totalPages,
            totalItems: result.total,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch user orders: ${error}`,
            isLoading: false
          });
        }
      },

      getPendingOrders: async (region) => {
        set({ isLoading: true, error: null });

        try {
          const orders = await OrderService.getPendingOrders(region);

          set({
            orders,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch pending orders: ${error}`,
            isLoading: false
          });
        }
      },

      refreshOrders: async () => {
        const { currentPage, filters } = get();
        await get().fetchOrders(filters, currentPage);
      }
    }),
    {
      name: 'order-store',
    }
  )
); 