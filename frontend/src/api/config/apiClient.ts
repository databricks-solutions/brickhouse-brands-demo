import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

// API configuration
export const apiConfig = {
  baseURL: import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
};

// Create axios instance
export const apiClient: AxiosInstance = axios.create(apiConfig);

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add any request modifications here (auth tokens, etc.)
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error: AxiosError) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    console.error('API Response Error:', error.response?.status, error.response?.data);

    // Handle common HTTP errors
    if (error.response?.status === 404) {
      console.error('Resource not found');
    } else if (error.response?.status === 500) {
      console.error('Internal server error');
    } else if (error.response?.status === 422) {
      console.error('Validation error:', error.response.data);
    }

    return Promise.reject(error);
  }
);

// Test API connection
export const testApiConnection = async (): Promise<boolean> => {
  try {
    const response = await apiClient.get('/health');
    console.log('API connection successful');
    return response.status === 200;
  } catch (error) {
    console.error('API connection failed:', error);
    return false;
  }
};

// Generic API error handler
export const handleApiError = (error: AxiosError): string => {
  if (error.response?.data && typeof error.response.data === 'object') {
    const errorData = error.response.data as any;
    return errorData.message || errorData.detail || 'An error occurred';
  }
  return error.message || 'Network error occurred';
}; 