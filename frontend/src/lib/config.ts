/**
 * Application Configuration
 * Centralized configuration for app-wide settings
 */

export const APP_CONFIG = {
  // Order Management
  orders: {
    maxQuantityPerProduct: 100000,
    maxQuantityPerAdd: 100000,
    lowStockThreshold: 2500,
    criticalStockThreshold: 1000,
    orderExpiryDays: 2, // Days after which pending orders are considered overdue
  },

  // API Configuration
  api: {
    debounceDelay: 500, // ms for search input debouncing
    defaultPageSize: 50,
    maxRetries: 3,
    batchSize: 10, // Number of concurrent API requests in parallel
    prefetchBatchSize: 20, // Max products to fetch in a single bulk request
    requestTimeout: 10000, // ms for API request timeout
  },

  // UI Configuration
  ui: {
    toastDuration: 5000, // ms
    animationDuration: 200, // ms
    maxModalHeight: '90vh',
    maxModalWidth: '7xl',
  },

  // Formatting
  formatting: {
    currency: 'USD',
    locale: 'en-US',
    dateFormat: {
      year: 'numeric' as const,
      month: 'long' as const,
      day: 'numeric' as const,
      hour: '2-digit' as const,
      minute: '2-digit' as const,
    },
  },

  // Business Rules
  business: {
    warehouseStoreId: 1, // Main warehouse store ID
    defaultRegionalManagerId: 26,
  },
} as const;

/**
 * Utility functions for accessing config values
 */
export const getMaxOrderQuantity = () => APP_CONFIG.orders.maxQuantityPerProduct;
export const getMaxAddQuantity = () => APP_CONFIG.orders.maxQuantityPerAdd;
export const getLowStockThreshold = () => APP_CONFIG.orders.lowStockThreshold;
export const getCriticalStockThreshold = () => APP_CONFIG.orders.criticalStockThreshold;
export const getOrderExpiryDays = () => APP_CONFIG.orders.orderExpiryDays;
export const getApiDebounceDelay = () => APP_CONFIG.api.debounceDelay;
export const getApiBatchSize = () => APP_CONFIG.api.batchSize;
export const getPrefetchBatchSize = () => APP_CONFIG.api.prefetchBatchSize;
export const getApiTimeout = () => APP_CONFIG.api.requestTimeout;
export const getWarehouseStoreId = () => APP_CONFIG.business.warehouseStoreId;
export const getDefaultRegionalManagerId = () => APP_CONFIG.business.defaultRegionalManagerId;

/**
 * Format currency using app configuration
 */
export const formatCurrency = (amount: number): string => {
  return amount.toLocaleString(APP_CONFIG.formatting.locale, {
    style: 'currency',
    currency: APP_CONFIG.formatting.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Format numbers using app configuration
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString(APP_CONFIG.formatting.locale);
};

/**
 * Format dates using app configuration
 */
export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString(
    APP_CONFIG.formatting.locale,
    APP_CONFIG.formatting.dateFormat
  );
}; 