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
  currentProduct: Product | null;
  productCache: Map<number, Product>; // Cache products by ID for instant access

  // Loading states
  isLoading: boolean;
  isLoadingCategories: boolean;
  isLoadingCurrentProduct: boolean;
  isPrefetching: boolean;

  // Error states
  error: string | null;

  // Actions
  fetchProducts: (filters?: any) => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchCategoryOptions: () => Promise<void>;
  fetchBrands: () => Promise<void>;
  fetchProductById: (productId: number) => Promise<Product | null>;
  prefetchProductsByIds: (productIds: number[]) => Promise<void>;
  getProductFromCache: (productId: number) => Product | null;
  clearProductCache: () => void;
}

export const useProductStore = create<ProductState>()(
  devtools(
    (set, get) => ({
      // Initial state
      products: [],
      categories: [],
      categoryOptions: [],
      brands: [],
      currentProduct: null,
      productCache: new Map(),
      isLoading: false,
      isLoadingCategories: false,
      isLoadingCurrentProduct: false,
      isPrefetching: false,
      error: null,

      // Actions
      fetchProducts: async (filters = {}) => {
        set({ isLoading: true, error: null });

        try {
          const result = await ProductService.getProducts(filters);

          // The backend returns List[Product] directly, not a PaginatedResponse
          // So we should use result directly if result.data is undefined
          const products: Product[] = Array.isArray(result) ? result : (result.data || []);

          // Also cache these products for instant access
          const currentCache = get().productCache;
          products.forEach(product => {
            currentCache.set(product.product_id, product);
          });

          set({
            products: products,
            productCache: currentCache,
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
          const brandsList = await ProductService.getBrandsList();
          const brands = brandsList.map(brand => brand.value);

          set({
            brands
          });
        } catch (error) {
          set({
            error: `Failed to fetch brands: ${error}`
          });
        }
      },

      fetchProductById: async (productId: number) => {
        // First check cache for instant access
        const cachedProduct = get().productCache.get(productId);
        if (cachedProduct) {
          set({ currentProduct: cachedProduct });
          return cachedProduct;
        }

        set({ isLoadingCurrentProduct: true, error: null });

        try {
          const product = await ProductService.getProductById(productId);

          // Cache the product for future use
          if (product) {
            const currentCache = get().productCache;
            currentCache.set(productId, product);
            set({
              currentProduct: product,
              productCache: currentCache,
              isLoadingCurrentProduct: false
            });
          } else {
            set({
              currentProduct: null,
              isLoadingCurrentProduct: false
            });
          }

          return product;
        } catch (error) {
          set({
            error: `Failed to fetch product: ${error}`,
            isLoadingCurrentProduct: false,
            currentProduct: null
          });
          return null;
        }
      },

      prefetchProductsByIds: async (productIds: number[]) => {
        if (productIds.length === 0) return;

        // Filter out already cached products
        const currentCache = get().productCache;
        const uncachedIds = productIds.filter(id => !currentCache.has(id));

        if (uncachedIds.length === 0) {
          console.log('All products already cached');
          return;
        }

        set({ isPrefetching: true });
        console.log(`Prefetching ${uncachedIds.length} products:`, uncachedIds);

        try {
          // Use bulk fetch for better performance
          const startTime = performance.now();
          console.log(`🔄 Attempting bulk fetch for ${uncachedIds.length} products via /products/bulk`);
          const products = await ProductService.getProductsByIds(uncachedIds);
          const endTime = performance.now();

          // Cache successfully fetched products
          let cachedCount = 0;
          products.forEach(product => {
            if (product) {
              currentCache.set(product.product_id, product);
              cachedCount++;
            }
          });

          console.log(`✅ Bulk fetch successful! Cached ${cachedCount}/${uncachedIds.length} products in ${Math.round(endTime - startTime)}ms`);

          set({
            productCache: currentCache,
            isPrefetching: false
          });
        } catch (error) {
          console.error('Error prefetching products:', error);
          set({
            isPrefetching: false,
            error: `Failed to prefetch products: ${error}`
          });
        }
      },

      getProductFromCache: (productId: number) => {
        return get().productCache.get(productId) || null;
      },

      clearProductCache: () => {
        set({ productCache: new Map() });
      },
    }),
    {
      name: 'product-store',
    }
  )
); 