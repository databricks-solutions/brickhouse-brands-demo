import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Order, OrderFilters, PaginatedResponse } from '../api/types';
import { OrderService } from '../api/services/orderService';

// Add debouncing functionality
let filterDebounceTimer: NodeJS.Timeout | null = null;

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

  // Centralized Filters - ALL filters managed here
  filters: OrderFilters;

  // Unified Loading states - single source of truth
  isLoading: boolean;
  isLoadingOrder: boolean;
  isCreatingOrder: boolean;
  isUpdatingOrder: boolean;
  isLoadingStatusSummary: boolean;
  // New: unified batch loading state
  isBatchLoading: boolean;
  batchLoadingProgress: {
    orders: boolean;
    statusSummary: boolean;
    productPrefetch: boolean;
  };

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
  fetchOrderStatusSummary: (region?: string, category?: string) => Promise<void>;
  // New: unified batch operations
  batchFetchOrderData: (filters?: OrderFilters, page?: number, limit?: number, prefetchProducts?: boolean) => Promise<void>;
  // New: smart filter operation that only runs necessary operations
  smartFilterUpdate: (newFilters: Partial<OrderFilters>) => void;
  // New: selective batch operation
  smartBatchFetchOrderData: (filters?: OrderFilters, page?: number, limit?: number, operations?: { orders: boolean, statusSummary: boolean, productPrefetch: boolean }) => Promise<void>;
  createOrder: (orderData: {
    fromStoreId?: number;
    toStoreId: number;
    productId: number;
    quantityCases: number;
    requestedBy: number;
    notes?: string;
    approvedBy?: number;
  }) => Promise<boolean>;
  updateOrderStatus: (orderId: number, status: string, userId?: number) => Promise<boolean>;
  updateOrder: (orderId: number, updateData: { quantity_cases?: number; notes?: string }) => Promise<boolean>;
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
  expiredSlaOnly: false,
  category: 'all',
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
      // New unified loading states
      isBatchLoading: false,
      batchLoadingProgress: {
        orders: false,
        statusSummary: false,
        productPrefetch: false,
      },
      error: null,

      // Actions
      setFilters: (filters: Partial<OrderFilters>) => {
        const currentFilters = get().filters;
        const newFilters = { ...currentFilters, ...filters };

        // Detect what actually changed to determine which operations we need
        const regionChanged = currentFilters.region !== newFilters.region;
        const categoryChanged = currentFilters.category !== newFilters.category;
        const statusOrSlaChanged =
          currentFilters.status !== newFilters.status ||
          currentFilters.expiredSlaOnly !== newFilters.expiredSlaOnly;

        // If this is a status or SLA filter change (analytics card click), add 30-day date filter
        // to match the analytics data
        if (statusOrSlaChanged && !regionChanged && !categoryChanged) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          newFilters.dateFrom = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format
          newFilters.dateTo = new Date().toISOString().split('T')[0]; // Today
        }

        // If region or category changed (not analytics card click), clear date filters
        // to show all-time data for those broader filters
        if (regionChanged || categoryChanged) {
          newFilters.dateFrom = undefined;
          newFilters.dateTo = undefined;
        }

        // Determine which operations need to run
        const needsStatusSummary = regionChanged || categoryChanged;
        const needsOrders = regionChanged || categoryChanged || statusOrSlaChanged;
        const needsProductPrefetch = needsOrders; // Prefetch whenever orders change

        // Set loading states based on what actually needs to load
        const loadingStates = {
          orders: needsOrders,
          statusSummary: needsStatusSummary,
          productPrefetch: needsProductPrefetch,
        };

        // Update filters and UI state IMMEDIATELY
        set({
          filters: newFilters,
          currentPage: 1,
          error: null,
          // Use smart loading states
          isBatchLoading: needsOrders || needsStatusSummary,
          batchLoadingProgress: loadingStates,
          // Keep existing loading states for backward compatibility
          isLoading: needsOrders,
          isLoadingStatusSummary: needsStatusSummary,
        });

        // Clear existing debounce timer
        if (filterDebounceTimer) {
          clearTimeout(filterDebounceTimer);
        }

        // Debounce ONLY the API call, not the UI state
        filterDebounceTimer = setTimeout(() => {
          // Use the filters from state (in case they changed again)
          const currentFilters = get().filters;
          // Use smart batch fetch with selective operations
          get().smartBatchFetchOrderData(currentFilters, 1, get().pageSize, loadingStates);
          filterDebounceTimer = null;
        }, 300); // 300ms debounce for API calls only
      },

      clearFilters: () => {
        set({ filters: {} });
      },

      setPage: (page: number) => {
        set({ currentPage: page });
        // Use batch fetch for consistent loading experience
        const { pageSize, filters } = get();
        get().batchFetchOrderData(filters, page, pageSize, true);
      },

      setPageSize: (size: number) => {
        set({ pageSize: size });
      },

      clearSelectedOrder: () => {
        set({ selectedOrder: null });
      },

      fetchOrderStatusSummary: async (region?: string, category?: string) => {
        set({ isLoadingStatusSummary: true, error: null });

        try {
          const result = await OrderService.getOrderStatusSummary(region, category);

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
          const order = await OrderService.getOrderById(orderId);

          if (order) {
            set({
              selectedOrder: order,
              isLoadingOrder: false
            });
          } else {
            set({
              error: 'Order not found',
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
          const orders = await OrderService.getOrdersByUser(userId);

          set({
            orders,
            currentPage: 1,
            totalPages: 1,
            totalItems: orders.length,
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
          const orders = await OrderService.getPendingApprovals(region);

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
          // This method doesn't exist in OrderService, commenting out for now
          // const regionData = await OrderService.getOrdersByRegion(filters);
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
          // This method doesn't exist in OrderService, commenting out for now
          // const trendData = await OrderService.getOrderTrendsByRegion(region, days);
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
          const result = await OrderService.createOrder({
            ...orderData,
            approvedBy: orderData.approvedBy || 26 // Use provided approvedBy or default to 26
          });

          if (result.success) {
            set({ isCreatingOrder: false });

            // Refresh orders list using batch operation
            await get().refreshOrders();

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
          // This method doesn't exist in OrderService
          // Use specific methods like approveOrder, fulfillOrder, cancelOrder instead
          let result;

          if (status === 'approved' && userId) {
            result = await OrderService.approveOrder(orderId, userId);
          } else if (status === 'fulfilled') {
            result = await OrderService.fulfillOrder(orderId);
          } else if (status === 'cancelled') {
            result = await OrderService.cancelOrder(orderId);
          } else {
            throw new Error(`Unsupported status update: ${status}`);
          }

          if (result.success) {
            // Update the order in the orders list
            const { orders } = get();
            const updatedOrders = orders.map(order =>
              order.order_id === orderId
                ? { ...order, order_status: status as any, approved_by: userId, approved_date: status === 'approved' ? new Date() : order.approved_date }
                : order
            );

            set({
              orders: updatedOrders,
              isUpdatingOrder: false
            });

            // Update selected order if it's the same one
            const { selectedOrder } = get();
            if (selectedOrder && selectedOrder.order_id === orderId) {
              set({
                selectedOrder: {
                  ...selectedOrder,
                  order_status: status as any,
                  approved_by: userId,
                  approved_date: status === 'approved' ? new Date() : selectedOrder.approved_date
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

      updateOrder: async (orderId: number, updateData: { quantity_cases?: number; notes?: string }) => {
        set({ isUpdatingOrder: true, error: null });

        try {
          const result = await OrderService.updateOrder(orderId, updateData);

          if (result.success) {
            // Update the order in the orders list
            const { orders } = get();
            const updatedOrders = orders.map(order =>
              order.order_id === orderId
                ? { ...order, ...updateData, version: (order.version || 1) + 1 }
                : order
            );

            set({
              orders: updatedOrders,
              isUpdatingOrder: false
            });

            // Update selected order if it's the same one
            const { selectedOrder } = get();
            if (selectedOrder && selectedOrder.order_id === orderId) {
              set({
                selectedOrder: {
                  ...selectedOrder,
                  ...updateData,
                  version: (selectedOrder.version || 1) + 1
                }
              });
            }

            return true;
          } else {
            set({
              error: result.error || 'Failed to update order',
              isUpdatingOrder: false
            });
            return false;
          }
        } catch (error) {
          set({
            error: `Failed to update order: ${error}`,
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
          const orders = await OrderService.getOrdersByUser(userId);

          set({
            orders,
            currentPage: 1,
            totalPages: 1,
            totalItems: orders.length,
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
          const orders = await OrderService.getPendingApprovals(region);

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
        const { currentPage, filters, pageSize } = get();
        await get().batchFetchOrderData(filters, currentPage, pageSize, true);
      },

      // New: Unified batch fetch operation
      batchFetchOrderData: async (filters?: OrderFilters, page = 1, limit = 20, prefetchProducts = false) => {
        const currentFilters = filters || get().filters;

        try {
          // Start all operations in parallel
          const promises: Promise<any>[] = [];

          // 1. Fetch orders
          const ordersPromise = OrderService.getOrders(currentFilters, page, limit).then(result => {
            // Update orders data immediately when available
            set(state => ({
              orders: result.data,
              currentPage: result.page,
              totalPages: result.total_pages,
              totalItems: result.total,
              batchLoadingProgress: {
                ...state.batchLoadingProgress,
                orders: false,
              }
            }));
            return result;
          });
          promises.push(ordersPromise);

          // 2. Fetch status summary in parallel
          const statusPromise = OrderService.getOrderStatusSummary(
            currentFilters.region,
            currentFilters.category
          ).then(result => {
            set(state => ({
              statusSummary: result,
              batchLoadingProgress: {
                ...state.batchLoadingProgress,
                statusSummary: false,
              }
            }));
            return result;
          });
          promises.push(statusPromise);

          // 3. Wait for orders to complete, then prefetch products
          let productPrefetchPromise: Promise<void> = Promise.resolve();
          if (prefetchProducts) {
            productPrefetchPromise = ordersPromise.then(async (ordersResult) => {
              const productIds = [...new Set(ordersResult.data.map((order: Order) => order.product_id))];
              if (productIds.length > 0) {
                // Get product store instance
                const { useProductStore } = await import('./useProductStore');
                const productStore = useProductStore.getState();
                await productStore.prefetchProductsByIds(productIds);
              }

              set(state => ({
                batchLoadingProgress: {
                  ...state.batchLoadingProgress,
                  productPrefetch: false,
                }
              }));
            });
            promises.push(productPrefetchPromise);
          } else {
            // Mark product prefetch as complete immediately if not needed
            set(state => ({
              batchLoadingProgress: {
                ...state.batchLoadingProgress,
                productPrefetch: false,
              }
            }));
          }

          // Wait for all operations to complete
          await Promise.all(promises);

          // Clear all loading states when everything is done
          set({
            isBatchLoading: false,
            isLoading: false,
            isLoadingStatusSummary: false,
            batchLoadingProgress: {
              orders: false,
              statusSummary: false,
              productPrefetch: false,
            }
          });

        } catch (error) {
          set({
            error: `Failed to fetch order data: ${error}`,
            isBatchLoading: false,
            isLoading: false,
            isLoadingStatusSummary: false,
            batchLoadingProgress: {
              orders: false,
              statusSummary: false,
              productPrefetch: false,
            }
          });
        }
      },

      // New: smart filter operation that only runs necessary operations
      smartFilterUpdate: (newFilters: Partial<OrderFilters>) => {
        const currentFilters = get().filters;
        const updatedFilters = { ...currentFilters, ...newFilters };

        // Update filters and UI state IMMEDIATELY with unified loading
        set({
          filters: updatedFilters,
          currentPage: 1,
          error: null,
          // Use unified batch loading instead of individual loading states
          isBatchLoading: true,
          batchLoadingProgress: {
            orders: true,
            statusSummary: true,
            productPrefetch: true,
          },
          // Keep existing loading states for backward compatibility
          isLoading: true,
          isLoadingStatusSummary: true,
        });

        // Clear existing debounce timer
        if (filterDebounceTimer) {
          clearTimeout(filterDebounceTimer);
        }

        // Debounce ONLY the API call, not the UI state
        filterDebounceTimer = setTimeout(() => {
          // Use the filters from state (in case they changed again)
          const currentFilters = get().filters;
          // Use new unified batch fetch
          get().batchFetchOrderData(currentFilters, 1, get().pageSize, true);
          filterDebounceTimer = null;
        }, 300); // 300ms debounce for API calls only
      },

      // New: selective batch operation
      smartBatchFetchOrderData: async (filters?: OrderFilters, page = 1, limit = 20, operations?: { orders: boolean, statusSummary: boolean, productPrefetch: boolean }) => {
        const currentFilters = filters || get().filters;
        const ops = operations || { orders: true, statusSummary: true, productPrefetch: true };

        try {
          // Start only the requested operations in parallel
          const promises: Promise<any>[] = [];
          let ordersResult: PaginatedResponse<Order> | null = null;

          // 1. Fetch orders if needed
          if (ops.orders) {
            const ordersPromise = OrderService.getOrders(currentFilters, page, limit).then(result => {
              // Update orders data immediately when available
              set(state => ({
                orders: result.data,
                currentPage: result.page,
                totalPages: result.total_pages,
                totalItems: result.total,
                batchLoadingProgress: {
                  ...state.batchLoadingProgress,
                  orders: false,
                }
              }));
              ordersResult = result; // Store for product prefetching
              return result;
            });
            promises.push(ordersPromise);
          } else {
            // Mark orders as complete immediately if not needed
            set(state => ({
              batchLoadingProgress: {
                ...state.batchLoadingProgress,
                orders: false,
              }
            }));
          }

          // 2. Fetch status summary if needed
          if (ops.statusSummary) {
            const statusPromise = OrderService.getOrderStatusSummary(
              currentFilters.region,
              currentFilters.category
            ).then(result => {
              set(state => ({
                statusSummary: result,
                batchLoadingProgress: {
                  ...state.batchLoadingProgress,
                  statusSummary: false,
                }
              }));
              return result;
            });
            promises.push(statusPromise);
          } else {
            // Mark status summary as complete immediately if not needed
            set(state => ({
              batchLoadingProgress: {
                ...state.batchLoadingProgress,
                statusSummary: false,
              }
            }));
          }

          // Wait for orders to complete if they were requested
          if (ops.orders && promises.length > 0) {
            await Promise.all(promises);
          }

          // 3. Prefetch products if needed (after orders complete)
          if (ops.productPrefetch && ordersResult && ordersResult.data) {
            const productIds = [...new Set(ordersResult.data.map((order: Order) => order.product_id))];
            if (productIds.length > 0) {
              try {
                // Get product store instance
                const { useProductStore } = await import('./useProductStore');
                const productStore = useProductStore.getState();
                await productStore.prefetchProductsByIds(productIds);
              } catch (error) {
                console.warn('Product prefetching failed:', error);
              }
            }
          }

          // Mark product prefetch as complete
          set(state => ({
            batchLoadingProgress: {
              ...state.batchLoadingProgress,
              productPrefetch: false,
            }
          }));

          // Clear all loading states when everything is done
          set({
            isBatchLoading: false,
            isLoading: false,
            isLoadingStatusSummary: false,
            batchLoadingProgress: {
              orders: false,
              statusSummary: false,
              productPrefetch: false,
            }
          });

        } catch (error) {
          set({
            error: `Failed to fetch order data: ${error}`,
            isBatchLoading: false,
            isLoading: false,
            isLoadingStatusSummary: false,
            batchLoadingProgress: {
              orders: false,
              statusSummary: false,
              productPrefetch: false,
            }
          });
        }
      }
    }),
    {
      name: 'order-store',
    }
  )
); 