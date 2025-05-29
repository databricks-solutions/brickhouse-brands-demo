import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Store, StoreFilters } from '../api/types';
import { StoreService } from '../api/services/storeService';

interface RegionOption {
  value: string;
  label: string;
  storeCount: number;
}

interface RegionSummary {
  region: string;
  totalStores: number;
  warehouseStores: number;
  urbanStores: number;
  suburbanStores: number;
  touristStores: number;
  businessStores: number;
  entertainmentStores: number;
  shoppingStores: number;
}

interface StoreState {
  // Data
  stores: Store[];
  storeOptions: Array<{ value: number; label: string; region: string }>;
  selectedStore: Store | null;
  regions: string[];
  regionOptions: RegionOption[];
  regionSummary: RegionSummary[];
  storeTypes: string[];

  // Loading states
  isLoading: boolean;
  isLoadingStore: boolean;
  isLoadingRegions: boolean;

  // Error states
  error: string | null;

  // Actions
  fetchStores: (filters?: StoreFilters) => Promise<void>;
  fetchStoreOptions: (region?: string) => Promise<void>;
  fetchStoreById: (storeId: number) => Promise<void>;
  fetchRegions: () => Promise<void>;
  fetchRegionOptions: () => Promise<void>;
  fetchRegionSummary: () => Promise<void>;
  fetchStoreTypes: () => Promise<void>;
  createStore: (storeData: {
    storeName: string;
    storeCode: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    region: string;
    storeType: string;
  }) => Promise<boolean>;
  updateStore: (
    storeId: number,
    updateData: Partial<{
      storeName: string;
      storeCode: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      region: string;
      storeType: string;
    }>
  ) => Promise<boolean>;
  clearSelectedStore: () => void;
  refreshStores: () => Promise<void>;
  getStoresByRegion: (region: string) => Promise<void>;
  getWarehouses: () => Promise<void>;
}

export const useStoreStore = create<StoreState>()(
  devtools(
    (set, get) => ({
      // Initial state
      stores: [],
      storeOptions: [],
      selectedStore: null,
      regions: [],
      regionOptions: [],
      regionSummary: [],
      storeTypes: [],
      isLoading: false,
      isLoadingStore: false,
      isLoadingRegions: false,
      error: null,

      // Actions
      fetchStores: async (filters = {}) => {
        set({ isLoading: true, error: null });

        try {
          const stores = await StoreService.getStores(filters);

          set({
            stores,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch stores: ${error}`,
            isLoading: false
          });
        }
      },

      fetchStoreOptions: async (region) => {
        try {
          const options = await StoreService.getStoreOptions(region);

          set({
            storeOptions: options
          });
        } catch (error) {
          set({
            error: `Failed to fetch store options: ${error}`
          });
        }
      },

      fetchStoreById: async (storeId: number) => {
        set({ isLoadingStore: true, error: null });

        try {
          const result = await StoreService.getStoreById(storeId);

          if (result.success) {
            set({
              selectedStore: result.data,
              isLoadingStore: false
            });
          } else {
            set({
              error: result.error || 'Failed to fetch store',
              isLoadingStore: false
            });
          }
        } catch (error) {
          set({
            error: `Failed to fetch store: ${error}`,
            isLoadingStore: false
          });
        }
      },

      fetchRegions: async () => {
        set({ isLoadingRegions: true, error: null });

        try {
          const regions = await StoreService.getRegions();
          set({
            regions,
            isLoadingRegions: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch regions: ${error}`,
            isLoadingRegions: false
          });
        }
      },

      fetchRegionOptions: async () => {
        set({ isLoadingRegions: true, error: null });

        try {
          const regionOptions = await StoreService.getRegionOptions();
          set({
            regionOptions,
            isLoadingRegions: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch region options: ${error}`,
            isLoadingRegions: false
          });
        }
      },

      fetchRegionSummary: async () => {
        try {
          const regionSummary = await StoreService.getRegionSummary();
          set({ regionSummary });
        } catch (error) {
          set({
            error: `Failed to fetch region summary: ${error}`
          });
        }
      },

      fetchStoreTypes: async () => {
        try {
          const storeTypes = await StoreService.getStoreTypes();
          set({ storeTypes });
        } catch (error) {
          set({
            error: `Failed to fetch store types: ${error}`
          });
        }
      },

      createStore: async (storeData) => {
        set({ error: null });

        try {
          const result = await StoreService.createStore(storeData);

          if (result.success) {
            // Refresh stores list and region data
            await Promise.all([
              get().fetchStores(),
              get().fetchStoreOptions(),
              get().fetchRegionOptions(),
              get().fetchRegionSummary()
            ]);

            return true;
          } else {
            set({
              error: result.error || 'Failed to create store'
            });
            return false;
          }
        } catch (error) {
          set({
            error: `Failed to create store: ${error}`
          });
          return false;
        }
      },

      updateStore: async (storeId: number, updateData) => {
        set({ error: null });

        try {
          const result = await StoreService.updateStore(storeId, updateData);

          if (result.success) {
            // Update the store in the stores list
            const { stores } = get();
            const updatedStores = stores.map(store =>
              store.storeId === storeId
                ? { ...store, ...updateData }
                : store
            );

            set({ stores: updatedStores });

            // Update selected store if it's the same one
            const { selectedStore } = get();
            if (selectedStore && selectedStore.storeId === storeId) {
              set({
                selectedStore: { ...selectedStore, ...updateData }
              });
            }

            // Refresh store options and region data if region was updated
            if (updateData.region) {
              await Promise.all([
                get().fetchStoreOptions(),
                get().fetchRegionOptions(),
                get().fetchRegionSummary()
              ]);
            }

            return true;
          } else {
            set({
              error: result.error || 'Failed to update store'
            });
            return false;
          }
        } catch (error) {
          set({
            error: `Failed to update store: ${error}`
          });
          return false;
        }
      },

      clearSelectedStore: () => {
        set({ selectedStore: null });
      },

      refreshStores: async () => {
        await Promise.all([
          get().fetchStores(),
          get().fetchStoreOptions(),
          get().fetchRegions(),
          get().fetchRegionOptions(),
          get().fetchRegionSummary(),
          get().fetchStoreTypes()
        ]);
      },

      getStoresByRegion: async (region: string) => {
        set({ isLoading: true, error: null });

        try {
          const stores = await StoreService.getStoresByRegion(region);
          set({
            stores,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch stores by region: ${error}`,
            isLoading: false
          });
        }
      },

      getWarehouses: async () => {
        set({ isLoading: true, error: null });

        try {
          const stores = await StoreService.getWarehouses();
          set({
            stores,
            isLoading: false
          });
        } catch (error) {
          set({
            error: `Failed to fetch warehouses: ${error}`,
            isLoading: false
          });
        }
      }
    }),
    {
      name: 'store-store',
    }
  )
); 