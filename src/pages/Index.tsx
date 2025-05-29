import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { RecentOrders } from "@/components/orders/RecentOrders";
import { Insights } from "@/components/dashboard/Insights";
import { useStoreStore } from "@/store/useStoreStore";
import { useProductStore } from "@/store/useProductStore";
import { useInventoryStore } from "@/store/useInventoryStore";

const Index = () => {
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Get stores and regions from Zustand
  const { stores, regionOptions, isLoading: isLoadingStores, fetchStores, fetchRegionOptions } = useStoreStore();

  // Get categories from product store
  const { categoryOptions, isLoadingCategories, fetchCategoryOptions } = useProductStore();

  // Get inventory filters and update functions
  const { filters, setFilters, fetchKPIData, fetchChartData } = useInventoryStore();

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Brickhouse Brands - Store Management</h1>
            <p className="text-gray-600">Store Manager Dashboard</p>
          </div>
        </div>

        {/* Main Tabbed Interface */}
        <Tabs defaultValue="order-management" className="w-full">
          <TabsList className="h-auto p-0 bg-transparent border-b border-gray-200 rounded-none mb-6">
            <TabsTrigger
              value="order-management"
              className="bg-transparent border-0 rounded-none px-6 py-3 font-medium text-gray-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 hover:text-gray-900 transition-colors"
            >
              Order Management
            </TabsTrigger>
            <TabsTrigger
              value="insights"
              className="bg-transparent border-0 rounded-none px-6 py-3 font-medium text-gray-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 hover:text-gray-900 transition-colors"
            >
              Insights
            </TabsTrigger>
          </TabsList>

          {/* Shared Filters */}
          <Card className="mb-6">
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

          <TabsContent value="order-management" className="space-y-6">
            <RecentOrders />
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <Insights />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
