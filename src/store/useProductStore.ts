import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Product } from '../api/types';
import { ProductService } from '../api/services/productService';

interface CategoryOption {
  value: string;
  label: string;
}

interface ProductState {
  // Data
  products: Product[];
  categories: string[];
  categoryOptions: CategoryOption[];
  brands: string[];

  // Loading states
  isLoading: boolean;
  isLoadingCategories: boolean;

  // Error states
  error: string | null;

  // Actions
  fetchProducts: (filters?: any) => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchCategoryOptions: () => Promise<void>;
  fetchBrands: () => Promise<void>;
}

export const useProductStore = create<ProductState>()(
  devtools(
    (set, get) => ({
      // Initial state
      products: [],
      categories: [],
      categoryOptions: [],
      brands: [],
      isLoading: false,
      isLoadingCategories: false,
      error: null,

      // Actions
      fetchProducts: async (filters = {}) => {
        set({ isLoading: true, error: null });

        try {
          const result = await ProductService.getProducts(filters);

          set({
            products: result.data,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch products: ${error}`,
            isLoading: false
          });
        }
      },

      fetchCategories: async () => {
        set({ isLoadingCategories: true, error: null });

        try {
          const categories = await ProductService.getCategories();

          set({
            categories,
            isLoadingCategories: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch categories: ${error}`,
            isLoadingCategories: false
          });
        }
      },

      fetchCategoryOptions: async () => {
        set({ isLoadingCategories: true, error: null });

        try {
          const categoryOptions = await ProductService.getCategoriesList();

          set({
            categoryOptions,
            isLoadingCategories: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch category options: ${error}`,
            isLoadingCategories: false
          });
        }
      },

      fetchBrands: async () => {
        try {
          const brands = await ProductService.getBrands();

          set({
            brands
          });
        } catch (error) {
          set({
            error: `Failed to fetch brands: ${error}`
          });
        }
      },
    }),
    {
      name: 'product-store',
    }
  )
); 