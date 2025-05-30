import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { RecentOrders } from "@/components/orders/RecentOrders";
import { Insights } from "@/components/dashboard/Insights";
import { Navigation } from "@/components/layout/Navigation";
import { useStoreStore } from "@/store/useStoreStore";
import { useProductStore } from "@/store/useProductStore";
import { useInventoryStore } from "@/store/useInventoryStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useUserStore } from "@/store/useUserStore";
import { useDarkModeStore } from "@/store/useDarkModeStore";

const Index = () => {
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTab, setActiveTab] = useState<'order-management' | 'insights'>('order-management');

  // Get stores and regions from Zustand
  const { stores, regionOptions, isLoading: isLoadingStores, fetchStores, fetchRegionOptions } = useStoreStore();

  // Get categories from product store
  const { categoryOptions, isLoadingCategories, fetchCategoryOptions } = useProductStore();

  // Get inventory filters and update functions
  const { filters: inventoryFilters, setFilters: setInventoryFilters, fetchKPIData, fetchChartData } = useInventoryStore();

  // Get order filters and update functions for centralized order management
  const { setFilters: setOrderFilters } = useOrderStore();

  // Get user store for initialization
  const { initializeCurrentUser } = useUserStore();

  // Get dark mode state
  const { isDarkMode } = useDarkModeStore();

  // Initialize current user on mount
  useEffect(() => {
    initializeCurrentUser();
  }, [initializeCurrentUser]);

  // Fetch store and region data on mount
  useEffect(() => {
    fetchStores();
    fetchRegionOptions();
    fetchCategoryOptions();
  }, [fetchStores, fetchRegionOptions, fetchCategoryOptions]);

  // Update filters when region/category changes
  useEffect(() => {
    if (activeTab === 'order-management') {
      // For order management, use centralized order store
      setOrderFilters({
        region: selectedLocation === "all" ? "all" : selectedLocation,
        category: selectedCategory === "all" ? "all" : selectedCategory,
      });
    } else {
      // For insights, use inventory store (for KPI data)
      const currentFilters = {
        ...inventoryFilters,
        region: selectedLocation === "all" ? "all" : selectedLocation,
        category: selectedCategory === "all" ? "all" : selectedCategory,
      };

      setInventoryFilters(currentFilters);

      // Fetch both KPI and chart data with updated filters
      Promise.all([
        fetchKPIData(currentFilters),
        fetchChartData(currentFilters)
      ]);
    }
  }, [selectedLocation, selectedCategory, activeTab, setOrderFilters, setInventoryFilters, fetchKPIData, fetchChartData]);

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
