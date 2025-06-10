import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { RecentOrders } from "@/components/orders/RecentOrders";
import { Insights } from "@/components/dashboard/Insights";
import { Navigation } from "@/components/layout/Navigation";
import { DateFilter } from "@/components/filters/DateFilter";
import { useStoreStore } from "@/store/useStoreStore";
import { useProductStore } from "@/store/useProductStore";
import { useInventoryStore } from "@/store/useInventoryStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useUserStore } from "@/store/useUserStore";
import { useDarkModeStore } from "@/store/useDarkModeStore";
import { useDateFilterStore } from "@/store/useDateFilterStore";
import { useUIStore } from "@/store/useUIStore";

const Index = () => {
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Get persisted tab state from UI store
  const { activeTab, setActiveTab } = useUIStore();

  // Get stores and regions from Zustand
  const { stores, regionOptions, isLoading: isLoadingStores, fetchStores, fetchRegionOptions } = useStoreStore();

  // Get categories from product store
  const { categoryOptions, isLoadingCategories, fetchCategoryOptions } = useProductStore();

  // Get inventory filters and update functions
  const { filters: inventoryFilters, setFilters: setInventoryFilters, fetchKPIData, fetchChartData } = useInventoryStore();

  // Get order filters and update functions for centralized order management
  const { filters: orderFilters, setFilters: setOrderFilters } = useOrderStore();

  // Get user store for initialization
  const { initializeCurrentUser, initializeCurrentRegionalManager } = useUserStore();

  // Get dark mode state
  const { isDarkMode } = useDarkModeStore();

  // Get shared date filter state
  const { dateFrom, dateTo } = useDateFilterStore();

  // Initialize current user on mount
  useEffect(() => {
    initializeCurrentUser();
  }, [initializeCurrentUser]);

  // Initialize regional manager on mount
  useEffect(() => {
    initializeCurrentRegionalManager();
  }, [initializeCurrentRegionalManager]);

  // Fetch store and region data on mount
  useEffect(() => {
    fetchStores();
    fetchRegionOptions();
    fetchCategoryOptions();
  }, [fetchStores, fetchRegionOptions, fetchCategoryOptions]);

  // Sync shared date filter to both stores (consolidated single effect)
  useEffect(() => {
    // Get current filter states to avoid closure issues
    const currentOrderFilters = useOrderStore.getState().filters;
    const currentInventoryFilters = useInventoryStore.getState().filters;

    // Check if the date filters in the stores need to be updated
    const orderFiltersNeedUpdate =
      currentOrderFilters.dateFrom !== dateFrom || currentOrderFilters.dateTo !== dateTo;
    const inventoryFiltersNeedUpdate =
      currentInventoryFilters.dateFrom !== dateFrom || currentInventoryFilters.dateTo !== dateTo;

    // Sync to order store if needed (handles both set dates and cleared dates)
    if (orderFiltersNeedUpdate) {
      setOrderFilters({
        ...currentOrderFilters,
        dateFrom,
        dateTo,
      });
    }

    // Sync to inventory store if needed (handles both set dates and cleared dates)  
    if (inventoryFiltersNeedUpdate) {
      setInventoryFilters({
        ...currentInventoryFilters,
        dateFrom,
        dateTo,
      });
    }
  }, [dateFrom, dateTo, setOrderFilters, setInventoryFilters]);

  // Handle data fetching when date filters change (for insights tab)
  useEffect(() => {
    if (activeTab === 'insights') {
      const currentFilters = {
        ...inventoryFilters,
        dateFrom,
        dateTo,
      };

      // Fetch both KPI and chart data with updated filters
      Promise.all([
        fetchKPIData(currentFilters),
        fetchChartData(currentFilters)
      ]);
    }
  }, [dateFrom, dateTo, activeTab]);

  // Update filters when region/category changes (but NOT when date filters change)
  useEffect(() => {
    if (activeTab === 'order-management') {
      // For order management, use centralized order store
      // Get current filters from store to avoid closure issues and preserve date filters
      const currentOrderFilters = useOrderStore.getState().filters;

      setOrderFilters({
        ...currentOrderFilters, // Use current state from store, not closure variable
        region: selectedLocation === "all" ? "all" : selectedLocation,
        category: selectedCategory === "all" ? "all" : selectedCategory,
        // Date filters are preserved from currentOrderFilters
      });
    } else {
      // For insights, use inventory store (for KPI data)
      const currentFilters = {
        ...inventoryFilters,
        region: selectedLocation === "all" ? "all" : selectedLocation,
        category: selectedCategory === "all" ? "all" : selectedCategory,
        // Don't set date filters here - they're managed by the separate effect above
      };

      setInventoryFilters(currentFilters);

      // Fetch both KPI and chart data with updated filters
      Promise.all([
        fetchKPIData(currentFilters),
        fetchChartData(currentFilters)
      ]);
    }
  }, [selectedLocation, selectedCategory, activeTab]); // Removed dateFrom, dateTo from dependencies

  // Build category options from real product data
  const categoryDropdownOptions = [
    { value: "all", label: "All Categories" },
    ...(categoryOptions?.map(category => ({
      value: category.value,
      label: category.label
    })) || [])
  ];

  // Build location options from real store data
  const locationOptions = [
    // { value: "all", label: "All Regions" },
    ...(regionOptions?.map(region => ({
      value: region.value,
      label: region.label
    })) || [])
  ];

  const handleLocationChange = (value: string) => {
    setSelectedLocation(value);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
  };

  const handleTabChange = (tab: 'order-management' | 'insights') => {
    setActiveTab(tab);
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Navigation Bar */}
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6 pt-24">
        {/* Shared Filters */}
        <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : ''}>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <label className={`text-sm font-medium mb-2 block ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  Region
                </label>
                <Select value={selectedLocation} onValueChange={handleLocationChange}>
                  <SelectTrigger className={isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={isDarkMode ? 'bg-gray-700 border-gray-600' : ''}>
                    {isLoadingStores ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading regions...
                        </div>
                      </SelectItem>
                    ) : (
                      locationOptions.map((location) => (
                        <SelectItem
                          key={location.value}
                          value={location.value}
                          className={isDarkMode ? 'text-gray-300 hover:bg-gray-600 focus:bg-gray-600' : ''}
                        >
                          {location.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className={`text-sm font-medium mb-2 block ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  Category
                </label>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger className={isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={isDarkMode ? 'bg-gray-700 border-gray-600' : ''}>
                    {isLoadingCategories ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading categories...
                        </div>
                      </SelectItem>
                    ) : (
                      categoryDropdownOptions.map((category) => (
                        <SelectItem
                          key={category.value}
                          value={category.value}
                          className={isDarkMode ? 'text-gray-300 hover:bg-gray-600 focus:bg-gray-600' : ''}
                        >
                          {category.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <DateFilter activeTab={activeTab} />
            </div>
          </CardContent>
        </Card>

        {/* Tab Content */}
        {activeTab === 'order-management' && (
          <div className="space-y-6">
            <RecentOrders />
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-6">
            <Insights />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
