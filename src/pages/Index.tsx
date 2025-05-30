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
import { useUserStore } from "@/store/useUserStore";

const Index = () => {
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTab, setActiveTab] = useState<'order-management' | 'insights'>('order-management');

  // Get stores and regions from Zustand
  const { stores, regionOptions, isLoading: isLoadingStores, fetchStores, fetchRegionOptions } = useStoreStore();

  // Get categories from product store
  const { categoryOptions, isLoadingCategories, fetchCategoryOptions } = useProductStore();

  // Get inventory filters and update functions
  const { filters, setFilters, fetchKPIData, fetchChartData } = useInventoryStore();

  // Get user store for initialization
  const { initializeCurrentUser } = useUserStore();

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

  // Update KPI data when filters change
  useEffect(() => {
    const currentFilters = {
      ...filters,
      region: selectedLocation === "all" ? "all" : selectedLocation,
      category: selectedCategory === "all" ? "all" : selectedCategory,
    };

    setFilters(currentFilters);

    // Fetch both KPI and chart data with updated filters
    Promise.all([
      fetchKPIData(currentFilters),
      fetchChartData(currentFilters)
    ]);
  }, [selectedLocation, selectedCategory, setFilters, fetchKPIData, fetchChartData]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6 pt-24">
        {/* Shared Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Region
                </label>
                <Select value={selectedLocation} onValueChange={handleLocationChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingStores ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading regions...
                        </div>
                      </SelectItem>
                    ) : (
                      locationOptions.map((location) => (
                        <SelectItem key={location.value} value={location.value}>
                          {location.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Category
                </label>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCategories ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading categories...
                        </div>
                      </SelectItem>
                    ) : (
                      categoryDropdownOptions.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
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
