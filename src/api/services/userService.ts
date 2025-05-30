import { apiClient, handleApiError } from '../config/apiClient';
import {
  User,
  ApiResponse,
  PaginatedResponse,
} from '../types';
import { AxiosError } from 'axios';

export class UserService {
  // Get all users with optional filtering
  static async getUsers(
    filters: {
      role?: 'store_manager' | 'regional_manager';
      region?: string;
      storeId?: number;
      searchTerm?: string;
    } = {},
    page: number = 1,
    limit: number = 50
  ): Promise<User[]> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value != null && value !== '')
        )
      });

      const response = await apiClient.get(`/users?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get user by ID
  static async getUserById(userId: number): Promise<User | null> {
    try {
      const response = await apiClient.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get user by username/email
  static async getUserByUsername(username: string): Promise<User | null> {
    try {
      const response = await apiClient.get(`/users/username/${encodeURIComponent(username)}`);
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Create new user
  static async createUser(userData: Omit<User, 'userId' | 'createdAt'>): Promise<ApiResponse<User>> {
    try {
      const response = await apiClient.post('/users', userData);
      return {
        success: true,
        data: response.data,
        message: 'User created successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Update user
  static async updateUser(
    userId: number,
    updates: Partial<User>
  ): Promise<ApiResponse<User>> {
    try {
      const response = await apiClient.patch(`/users/${userId}`, updates);
      return {
        success: true,
        data: response.data,
        message: 'User updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Delete user
  static async deleteUser(userId: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/users/${userId}`);
      return {
        success: true,
        data: undefined as any,
        message: 'User deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Get users by role
  static async getUsersByRole(role: 'store_manager' | 'regional_manager'): Promise<User[]> {
    try {
      const response = await apiClient.get(`/users/role/${role}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get users by store
  static async getUsersByStore(storeId: number): Promise<User[]> {
    try {
      const response = await apiClient.get(`/users/store/${storeId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get users by region
  static async getUsersByRegion(region: string): Promise<User[]> {
    try {
      const response = await apiClient.get(`/users/region/${encodeURIComponent(region)}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get store managers
  static async getStoreManagers(storeId?: number): Promise<User[]> {
    try {
      const params = new URLSearchParams();
      if (storeId) {
        params.append('store_id', storeId.toString());
      }

      const response = await apiClient.get(`/users/store-managers?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get regional managers
  static async getRegionalManagers(region?: string): Promise<User[]> {
    try {
      const params = new URLSearchParams();
      if (region) {
        params.append('region', region);
      }

      const response = await apiClient.get(`/users/regional-managers?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Authenticate user (if needed for the frontend)
  static async authenticateUser(username: string, password: string): Promise<ApiResponse<{
    user: User;
    token?: string;
  }>> {
    try {
      const response = await apiClient.post('/users/auth', {
        username,
        password
      });

      return {
        success: true,
        data: response.data,
        message: 'Authentication successful'
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: handleApiError(error as AxiosError)
      };
    }
  }

  // Get user permissions/capabilities
  static async getUserPermissions(userId: number): Promise<{
    canApproveOrders: boolean;
    canManageInventory: boolean;
    canViewAllStores: boolean;
    canViewRegionData: boolean;
    accessibleStoreIds: number[];
    accessibleRegions: string[];
  }> {
    try {
      const response = await apiClient.get(`/users/${userId}/permissions`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Search users
  static async searchUsers(
    searchTerm: string,
    role?: 'store_manager' | 'regional_manager',
    limit: number = 10
  ): Promise<User[]> {
    try {
      const params = new URLSearchParams({
        q: searchTerm,
        limit: limit.toString(),
        ...(role && { role })
      });

      const response = await apiClient.get(`/users/search?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get user activity summary
  static async getUserActivity(
    userId: number,
    days: number = 30
  ): Promise<{
    ordersRequested: number;
    ordersApproved: number;
    inventoryUpdates: number;
    lastLoginDate?: Date;
    lastActivityDate?: Date;
  }> {
    try {
      const response = await apiClient.get(`/users/${userId}/activity?days=${days}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }

  // Get users for dropdown/select options
  static async getUserOptions(
    role?: 'store_manager' | 'regional_manager',
    region?: string,
    storeId?: number
  ): Promise<Array<{
    userId: number;
    displayName: string;
    role: string;
    region?: string;
    storeId?: number;
  }>> {
    try {
      const params = new URLSearchParams({
        ...(role && { role }),
        ...(region && { region }),
        ...(storeId && { store_id: storeId.toString() })
      });

      const response = await apiClient.get(`/users/options?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  }
} 