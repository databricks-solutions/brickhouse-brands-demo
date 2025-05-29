import { apiClient, handleApiError } from '../config/apiClient';
import {
  Product,
  ApiResponse,
  PaginatedResponse,
} from '../types';
import { AxiosError } from 'axios';

export class ProductService {
  // Get all products with optional filtering
  static async getProducts(
    filters: {
      category?: string;
      brand?: string;
      searchTerm?: string;
    } = {},
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<Product>> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value != null && value !== '')
        )
      });

      const response = await apiClient.get(`/products?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get product by ID
  static async getProductById(productId: number): Promise<Product | null> {
    try {
      const response = await apiClient.get(`/products/${productId}`);
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Create new product
  static async createProduct(productData: Omit<Product, 'productId' | 'createdAt'>): Promise<ApiResponse<Product>> {
    try {
      const response = await apiClient.post('/products', productData);
      return {
        success: true,
        data: response.data,
        message: 'Product created successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Update product
  static async updateProduct(
    productId: number,
    updates: Partial<Product>
  ): Promise<ApiResponse<Product>> {
    try {
      const response = await apiClient.patch(`/products/${productId}`, updates);
      return {
        success: true,
        data: response.data,
        message: 'Product updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Delete product
  static async deleteProduct(productId: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/products/${productId}`);
      return {
        success: true,
        data: undefined as any,
        message: 'Product deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Get unique categories (for compatibility)
  static async getCategories(): Promise<string[]> {
    try {
      const response = await apiClient.get('/products/categories/list');
      return response.data.map((item: { value: string; label: string }) => item.value);
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get categories list for dropdowns
  static async getCategoriesList(): Promise<Array<{
    value: string;
    label: string;
  }>> {
    try {
      const response = await apiClient.get('/products/categories/list');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get brands list for dropdowns  
  static async getBrandsList(): Promise<Array<{
    value: string;
    label: string;
  }>> {
    try {
      const response = await apiClient.get('/products/brands/list');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get products by category
  static async getProductsByCategory(category: string): Promise<Product[]> {
    try {
      const response = await apiClient.get(`/products/category/${encodeURIComponent(category)}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get products by brand
  static async getProductsByBrand(brand: string): Promise<Product[]> {
    try {
      const response = await apiClient.get(`/products/brand/${encodeURIComponent(brand)}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Search products
  static async searchProducts(
    searchTerm: string,
    category?: string,
    brand?: string,
    limit: number = 10
  ): Promise<Product[]> {
    try {
      const params = new URLSearchParams({
        q: searchTerm,
        limit: limit.toString(),
        ...(category && { category }),
        ...(brand && { brand })
      });

      const response = await apiClient.get(`/products/search?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get products for dropdown/select options
  static async getProductOptions(
    category?: string,
    brand?: string
  ): Promise<Array<{
    productId: number;
    productName: string;
    brand: string;
    category: string;
    unitPrice: number;
  }>> {
    try {
      const params = new URLSearchParams({
        ...(category && { category }),
        ...(brand && { brand })
      });

      const response = await apiClient.get(`/products/options?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get product performance analytics
  static async getProductPerformance(
    productId?: number,
    category?: string,
    brand?: string,
    days: number = 30
  ): Promise<Array<{
    productId: number;
    productName: string;
    brand: string;
    category: string;
    totalInventoryValue: number;
    totalCases: number;
    ordersPlaced: number;
    ordersFulfilled: number;
    averageOrderSize: number;
    turnoverRate: number;
    lowStockStores: number;
  }>> {
    try {
      const params = new URLSearchParams({
        days: days.toString(),
        ...(productId && { product_id: productId.toString() }),
        ...(category && { category }),
        ...(brand && { brand })
      });

      const response = await apiClient.get(`/products/performance?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get top performing products
  static async getTopProducts(
    metric: 'inventory_value' | 'order_count' | 'turnover_rate' = 'inventory_value',
    limit: number = 10,
    category?: string,
    brand?: string
  ): Promise<Array<{
    productId: number;
    productName: string;
    brand: string;
    category: string;
    metricValue: number;
    rank: number;
  }>> {
    try {
      const params = new URLSearchParams({
        metric,
        limit: limit.toString(),
        ...(category && { category }),
        ...(brand && { brand })
      });

      const response = await apiClient.get(`/products/top?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get product statistics
  static async getProductStats(): Promise<{
    totalProducts: number;
    productsByCategory: Record<string, number>;
    productsByBrand: Record<string, number>;
    averagePrice: number;
    priceRange: { min: number; max: number };
  }> {
    try {
      const response = await apiClient.get('/products/stats');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get product trends (price changes, new products, etc.)
  static async getProductTrends(
    days: number = 30,
    category?: string,
    brand?: string
  ): Promise<Array<{
    date: string;
    newProducts: number;
    priceUpdates: number;
    averagePrice: number;
    category?: string;
    brand?: string;
  }>> {
    try {
      const params = new URLSearchParams({
        days: days.toString(),
        ...(category && { category }),
        ...(brand && { brand })
      });

      const response = await apiClient.get(`/products/trends?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Bulk update product prices
  static async bulkUpdatePrices(
    updates: Array<{ productId: number; unitPrice: number }>
  ): Promise<ApiResponse<Product[]>> {
    try {
      const response = await apiClient.patch('/products/bulk-price-update', {
        updates
      });

      return {
        success: true,
        data: response.data,
        message: `${updates.length} product prices updated successfully`
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Get products with low inventory across stores
  static async getProductsWithLowInventory(
    region?: string
  ): Promise<Array<{
    product: Product;
    totalStores: number;
    lowStockStores: number;
    criticalStockStores: number;
    totalInventory: number;
    averageInventoryPerStore: number;
  }>> {
    try {
      const params = new URLSearchParams();
      if (region) {
        params.append('region', region);
      }

      const response = await apiClient.get(`/products/low-inventory?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }
} 