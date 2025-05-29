import { apiClient, handleApiError } from '../config/apiClient';
import {
  Inventory,
  Product,
  Store,
  InventoryFilters,
  PaginatedResponse,
  ApiResponse,
  KPIData,
  InventoryTrendData,
  CategoryDistribution,
  LowStockAlert,
  InventorySummary
} from '../types';
import { AxiosError } from 'axios';

export class InventoryService {
  // Get all inventory items with optional filtering
  static async getInventory(
    filters: InventoryFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<Inventory>> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value != null && value !== '')
        )
      });

      const response = await apiClient.get(`/inventory?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get KPI data
  static async getKPIData(filters: InventoryFilters = {}): Promise<KPIData> {
    try {
      // Backend KPI endpoint only supports region and category parameters
      const supportedParams: { [key: string]: any } = {};

      if (filters.region && filters.region !== 'all') {
        supportedParams.region = filters.region;
      }

      if (filters.category && filters.category !== 'all') {
        supportedParams.category = filters.category;
      }

      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(supportedParams).filter(([_, value]) => value != null && value !== '')
        )
      );

      // Fixed endpoint: /kpi instead of /kpis
      const response = await apiClient.get(`/inventory/kpi?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get inventory trends
  static async getInventoryTrends(
    filters: InventoryFilters = {},
    days: number = 30
  ): Promise<InventoryTrendData[]> {
    try {
      const supportedParams: { [key: string]: any } = {
        days: days.toString()
      };

      // Backend trends endpoint only supports region parameter
      if (filters.region && filters.region !== 'all') {
        supportedParams.region = filters.region;
      }

      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(supportedParams).filter(([_, value]) => value != null && value !== '')
        )
      );

      const response = await apiClient.get(`/inventory/trends?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get category distribution
  static async getCategoryDistribution(filters: InventoryFilters = {}): Promise<CategoryDistribution[]> {
    try {
      const supportedParams: { [key: string]: any } = {};

      // Backend categories endpoint only supports region parameter
      if (filters.region && filters.region !== 'all') {
        supportedParams.region = filters.region;
      }

      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(supportedParams).filter(([_, value]) => value != null && value !== '')
        )
      );

      const response = await apiClient.get(`/inventory/categories?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get low stock alerts count for KPI
  static async getLowStockCount(filters: InventoryFilters = {}): Promise<number> {
    try {
      const alerts = await this.getLowStockAlerts(filters);
      return alerts.length;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get low stock alerts
  static async getLowStockAlerts(filters: InventoryFilters = {}): Promise<LowStockAlert[]> {
    try {
      // Backend low stock alerts endpoint supports region and category parameters
      const supportedParams: { [key: string]: any } = {};

      if (filters.region && filters.region !== 'all') {
        supportedParams.region = filters.region;
      }

      if (filters.category && filters.category !== 'all') {
        supportedParams.category = filters.category;
      }

      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(supportedParams).filter(([_, value]) => value != null && value !== '')
        )
      );

      const response = await apiClient.get(`/inventory/alerts/low-stock?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Update stock
  static async updateStock(
    inventoryId: number,
    newStock: number
  ): Promise<ApiResponse<Inventory>> {
    try {
      const response = await apiClient.patch(`/inventory/${inventoryId}/stock`, {
        quantity_cases: newStock
      });

      return {
        success: true,
        data: response.data,
        message: 'Stock updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Get inventory summary (from materialized view)
  static async getInventorySummary(filters: InventoryFilters = {}): Promise<InventorySummary[]> {
    try {
      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value != null && value !== '')
        )
      );

      const response = await apiClient.get(`/inventory/summary?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get inventory by region
  static async getInventoryByRegion(filters: InventoryFilters = {}): Promise<Array<{
    region: string;
    totalStores: number;
    totalProducts: number;
    totalInventoryValue: number;
    totalCases: number;
    lowStockItems: number;
    averageStockPerStore: number;
  }>> {
    try {
      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value != null && value !== '')
        )
      );

      const response = await apiClient.get(`/inventory/by-region?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get top regions by value
  static async getTopRegionsByValue(limit: number = 5): Promise<Array<{
    region: string;
    inventoryValue: number;
    storeCount: number;
    averageValuePerStore: number;
  }>> {
    try {
      const response = await apiClient.get(`/inventory/top-regions?limit=${limit}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get inventory by product
  static async getInventoryByProduct(productId: number): Promise<Inventory[]> {
    try {
      const response = await apiClient.get(`/inventory/product/${productId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get inventory by store
  static async getInventoryByStore(storeId: number): Promise<Inventory[]> {
    try {
      const response = await apiClient.get(`/inventory/store/${storeId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get available stock (quantity_cases - reserved_cases)
  static async getAvailableStock(inventoryId: number): Promise<number> {
    try {
      const response = await apiClient.get(`/inventory/${inventoryId}/available-stock`);
      return response.data.availableStock;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Reserve stock
  static async reserveStock(
    inventoryId: number,
    quantity: number
  ): Promise<ApiResponse<Inventory>> {
    try {
      const response = await apiClient.patch(`/inventory/${inventoryId}/reserve`, {
        quantity
      });

      return {
        success: true,
        data: response.data,
        message: 'Stock reserved successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Release reserved stock
  static async releaseReservedStock(
    inventoryId: number,
    quantity: number
  ): Promise<ApiResponse<Inventory>> {
    try {
      const response = await apiClient.patch(`/inventory/${inventoryId}/release`, {
        quantity
      });

      return {
        success: true,
        data: response.data,
        message: 'Reserved stock released successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }
} 