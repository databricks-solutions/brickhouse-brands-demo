import { apiClient, handleApiError } from '../config/apiClient';
import {
  Store,
  StoreFilters,
  PaginatedResponse,
  ApiResponse,
} from '../types';
import { AxiosError } from 'axios';

export class StoreService {
  // Get all stores with optional filtering
  static async getStores(
    filters: StoreFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<Store>> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value != null && value !== '')
        )
      });

      const response = await apiClient.get(`/stores?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get store by ID
  static async getStoreById(storeId: number): Promise<Store | null> {
    try {
      const response = await apiClient.get(`/stores/${storeId}`);
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Create new store
  static async createStore(storeData: Omit<Store, 'storeId' | 'createdAt'>): Promise<ApiResponse<Store>> {
    try {
      const response = await apiClient.post('/stores', storeData);
      return {
        success: true,
        data: response.data,
        message: 'Store created successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Update store
  static async updateStore(
    storeId: number,
    updates: Partial<Store>
  ): Promise<ApiResponse<Store>> {
    try {
      const response = await apiClient.patch(`/stores/${storeId}`, updates);
      return {
        success: true,
        data: response.data,
        message: 'Store updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Delete store
  static async deleteStore(storeId: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/stores/${storeId}`);
      return {
        success: true,
        data: undefined as any,
        message: 'Store deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Get region options for dropdowns (this replaces the old getRegions method)
  static async getRegionOptions(): Promise<Array<{
    value: string;
    label: string;
    storeCount: number;
  }>> {
    try {
      const response = await apiClient.get('/stores/regions/options');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get unique store types
  static async getStoreTypes(): Promise<string[]> {
    try {
      const response = await apiClient.get('/stores/store-types');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get stores by region
  static async getStoresByRegion(region: string): Promise<Store[]> {
    try {
      const response = await apiClient.get(`/stores/region/${encodeURIComponent(region)}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get stores by type
  static async getStoresByType(storeType: string): Promise<Store[]> {
    try {
      const response = await apiClient.get(`/stores/type/${encodeURIComponent(storeType)}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get stores for dropdown (id, name, code)
  static async getStoreOptions(region?: string): Promise<Array<{
    storeId: number;
    storeName: string;
    storeCode: string;
    region: string;
  }>> {
    try {
      const params = new URLSearchParams();
      if (region) {
        params.append('region', region);
      }

      const response = await apiClient.get(`/stores/options?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get store statistics
  static async getStoreStats(): Promise<{
    totalStores: number;
    storesByRegion: Record<string, number>;
    storesByType: Record<string, number>;
    averageStoresPerRegion: number;
  }> {
    try {
      const response = await apiClient.get('/stores/stats');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get store performance summary
  static async getStorePerformance(
    storeId?: number,
    region?: string
  ): Promise<Array<{
    storeId: number;
    storeName: string;
    region: string;
    totalProducts: number;
    totalInventoryValue: number;
    lowStockItems: number;
    pendingOrders: number;
    fulfilledOrders: number;
    lastOrderDate?: Date;
  }>> {
    try {
      const params = new URLSearchParams();
      if (storeId) {
        params.append('store_id', storeId.toString());
      }
      if (region) {
        params.append('region', region);
      }

      const response = await apiClient.get(`/stores/performance?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Search stores by name or code
  static async searchStores(
    searchTerm: string,
    limit: number = 10
  ): Promise<Store[]> {
    try {
      const params = new URLSearchParams({
        q: searchTerm,
        limit: limit.toString()
      });

      const response = await apiClient.get(`/stores/search?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get nearby stores (if coordinates are available)
  static async getNearbyStores(
    latitude: number,
    longitude: number,
    radiusKm: number = 50,
    limit: number = 10
  ): Promise<Array<Store & { distance: number }>> {
    try {
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius_km: radiusKm.toString(),
        limit: limit.toString()
      });

      const response = await apiClient.get(`/stores/nearby?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get stores with low inventory alerts
  static async getStoresWithLowStock(region?: string): Promise<Array<{
    store: Store;
    lowStockCount: number;
    criticalStockCount: number;
    totalInventoryValue: number;
  }>> {
    try {
      const params = new URLSearchParams();
      if (region) {
        params.append('region', region);
      }

      const response = await apiClient.get(`/stores/low-stock?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }
} 