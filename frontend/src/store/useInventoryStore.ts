import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  Inventory,
  KPIData,
  InventoryFilters,
  InventoryTrendData,
  CategoryDistribution,
  PaginatedResponse
} from '../api/types';
import { InventoryService } from '../api/services/inventoryService';
import { getLastDaysRange } from '@/utils/dateUtils';

interface InventoryState {
  // Data
  inventory: Inventory[];
  kpiData: KPIData | null;
  lowStockCount: number;
  inventoryTrends: InventoryTrendData[];
  categoryDistribution: CategoryDistribution[];

  // Chart data
  chartData: {
    trends: InventoryTrendData[];
    categories: CategoryDistribution[];
    topProducts: Array<{ name: string; value: number }>;
    isLoading: boolean;
  };

  // Pagination
  currentPage: number;
  totalPages: number;
  totalItems: number;

  // Filters
  filters: InventoryFilters;

  // Loading states
  isLoading: boolean;
  isLoadingKPIs: boolean;
  isLoadingTrends: boolean;
  isLoadingCategories: boolean;

  // Error states
  error: string | null;

  // Actions
  setFilters: (filters: Partial<InventoryFilters>) => void;
  clearFilters: () => void;
  fetchInventory: (filters?: InventoryFilters, page?: number, limit?: number) => Promise<void>;
  fetchWarehouseInventory: (filters?: { category?: string; search?: string }) => Promise<void>;
  fetchKPIData: (filters?: InventoryFilters) => Promise<void>;
  fetchInventoryTrends: (filters?: InventoryFilters) => Promise<void>;
  fetchCategoryDistribution: (filters?: InventoryFilters) => Promise<void>;
  fetchChartData: (filters?: InventoryFilters) => Promise<void>;
  fetchInventorySummary: (filters?: InventoryFilters) => Promise<void>;
  fetchInventoryByRegion: (filters?: InventoryFilters) => Promise<void>;
  fetchTopRegionsByValue: (limit?: number) => Promise<void>;
  updateStock: (inventoryId: number, quantityCases: number, reservedCases: number) => Promise<boolean>;
  getLowStockAlerts: (filters?: InventoryFilters) => Promise<void>;
  setPage: (page: number) => void;
  refreshData: () => Promise<void>;
}

const defaultDateRange = getLastDaysRange(30);

const initialFilters: InventoryFilters = {
  storeId: 'all',
  region: 'all',
  category: 'all',
  brand: 'all',
  lowStockOnly: false,
  searchTerm: '',
  // Date filters will be managed by shared date filter store
  dateFrom: undefined,
  dateTo: undefined,
};

export const useInventoryStore = create<InventoryState>()(
  devtools(
    (set, get) => ({
      // Initial state
      inventory: [],
      kpiData: null,
      lowStockCount: 0,
      inventoryTrends: [],
      categoryDistribution: [],
      currentPage: 1,
      totalPages: 0,
      totalItems: 0,
      filters: initialFilters,
      isLoading: false,
      isLoadingKPIs: false,
      isLoadingTrends: false,
      isLoadingCategories: false,
      error: null,

      // Chart data
      chartData: {
        trends: [],
        categories: [],
        topProducts: [],
        isLoading: false,
      },

      // Actions
      setFilters: (filters: Partial<InventoryFilters>) => {
        set({ filters: { ...get().filters, ...filters } });
      },

      clearFilters: () => {
        set({ filters: {} });
      },

      fetchInventory: async (filters?: InventoryFilters, page = 1, limit = 50) => {
        set({ isLoading: true, error: null });

        try {
          const currentFilters = filters || get().filters;
          const result = await InventoryService.getInventory(currentFilters, page, limit);

          set({
            inventory: result.data,
            totalItems: result.total,
            totalPages: result.totalPages,
            currentPage: result.page,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch inventory: ${error}`,
            isLoading: false
          });
        }
      },

      fetchWarehouseInventory: async (filters?: { category?: string; search?: string }) => {
        set({ isLoading: true, error: null });

        try {
          const inventory = await InventoryService.getWarehouseInventory(filters || {});

          set({
            inventory,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch warehouse inventory: ${error}`,
            isLoading: false
          });
        }
      },

      fetchKPIData: async (filters?: InventoryFilters) => {
        set({ isLoadingKPIs: true });

        try {
          const currentFilters = filters || get().filters;

          // Fetch both KPI data and low stock count
          const [kpiData, lowStockCount] = await Promise.all([
            InventoryService.getKPIData(currentFilters),
            InventoryService.getLowStockCount(currentFilters)
          ]);

          set({
            kpiData,
            lowStockCount,
            isLoadingKPIs: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch KPI data: ${error}`,
            isLoadingKPIs: false
          });
        }
      },

      fetchInventoryTrends: async (filters?: InventoryFilters) => {
        set({ isLoadingTrends: true });

        try {
          const currentFilters = filters || get().filters;
          const trends = await InventoryService.getInventoryTrends(currentFilters, 30);

          set({
            inventoryTrends: trends,
            isLoadingTrends: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch inventory trends: ${error}`,
            isLoadingTrends: false
          });
        }
      },

      fetchCategoryDistribution: async (filters?: InventoryFilters) => {
        set({ isLoadingCategories: true });

        try {
          const currentFilters = filters || get().filters;
          const distribution = await InventoryService.getCategoryDistribution(currentFilters);

          set({
            categoryDistribution: distribution,
            isLoadingCategories: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch category distribution: ${error}`,
            isLoadingCategories: false
          });
        }
      },

      fetchChartData: async (filters?: InventoryFilters) => {
        set(state => ({
          chartData: { ...state.chartData, isLoading: true }
        }));

        try {
          const currentFilters = filters || get().filters;

          // Fetch chart data in parallel
          const [trends, categories] = await Promise.all([
            InventoryService.getInventoryTrends(currentFilters, 30),
            InventoryService.getCategoryDistribution(currentFilters)
          ]);

          // Generate mock top products for now (can be enhanced with real endpoint later)
          const topProducts = categories.slice(0, 10).map(cat => ({
            name: cat.category,
            value: cat.value
          }));

          set({
            chartData: {
              trends,
              categories,
              topProducts,
              isLoading: false
            }
          });
        } catch (error) {
          set({
            error: `Failed to fetch chart data: ${error}`,
            chartData: {
              trends: [],
              categories: [],
              topProducts: [],
              isLoading: false
            }
          });
        }
      },

      fetchInventorySummary: async (filters?: InventoryFilters) => {
        try {
          const currentFilters = filters || get().filters;
          const summary = await InventoryService.getInventorySummary(currentFilters);
          // Store summary data if needed
        } catch (error) {
          set({
            error: `Failed to fetch inventory summary: ${error}`
          });
        }
      },

      fetchInventoryByRegion: async (filters?: InventoryFilters) => {
        try {
          const currentFilters = filters || get().filters;
          const regionData = await InventoryService.getInventoryByRegion(currentFilters);
          // Store region data if needed
        } catch (error) {
          set({
            error: `Failed to fetch inventory by region: ${error}`
          });
        }
      },

      fetchTopRegionsByValue: async (limit = 10) => {
        try {
          const topRegions = await InventoryService.getTopRegionsByValue(limit);
          // Store top regions data if needed
        } catch (error) {
          set({
            error: `Failed to fetch top regions: ${error}`
          });
        }
      },

      getLowStockAlerts: async (filters?: InventoryFilters) => {
        try {
          const currentFilters = filters || get().filters;
          const alerts = await InventoryService.getLowStockAlerts(currentFilters);
          // Store alerts data if needed
        } catch (error) {
          set({
            error: `Failed to fetch low stock alerts: ${error}`
          });
        }
      },

      updateStock: async (inventoryId: number, quantityCases: number, reservedCases: number) => {
        try {
          const result = await InventoryService.updateStock(inventoryId, quantityCases);

          if (result.success) {
            // Update the inventory item in the state
            const { inventory } = get();
            const updatedInventory = inventory.map(item =>
              item.inventoryId === inventoryId
                ? { ...item, quantityCases: quantityCases, reservedCases: reservedCases, lastUpdated: new Date() }
                : item
            );

            set({ inventory: updatedInventory });
            return true;
          } else {
            set({
              error: result.error || 'Failed to update stock'
            });
            return false;
          }
        } catch (error) {
          set({
            error: `Failed to update stock: ${error}`
          });
          return false;
        }
      },

      setPage: (page: number) => {
        set({ currentPage: page });
        get().fetchInventory(undefined, page);
      },

      refreshData: async () => {
        const { currentPage, filters } = get();
        await Promise.all([
          get().fetchInventory(filters, currentPage),
          get().fetchKPIData(filters),
          get().fetchChartData(filters)
        ]);
      }
    }),
    {
      name: 'inventory-store',
    }
  )
); 