
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerWithRange } from "@/components/DateRangePicker";
import { KPICards } from "@/components/dashboard/KPICards";
import { InventoryCharts } from "@/components/dashboard/InventoryCharts";
import { PlaceOrderModal } from "@/components/orders/PlaceOrderModal";
import { Download, Plus } from "lucide-react";

const Index = () => {
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const locations = [
    { value: "all", label: "All Locations" },
    { value: "northeast", label: "Northeast Region" },
    { value: "southeast", label: "Southeast Region" },
    { value: "midwest", label: "Midwest Region" },
    { value: "west", label: "West Region" },
  ];

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "beverages", label: "Beverages" },
    { value: "snacks", label: "Snacks" },
    { value: "dairy", label: "Dairy" },
    { value: "frozen", label: "Frozen Foods" },
    { value: "personal-care", label: "Personal Care" },
  ];

  const handleExportCSV = () => {
    // Mock CSV export functionality
    const csvContent = "data:text/csv;charset=utf-8,SKU,Product,Inventory Value,Stock Level,Turnover\n12345,Premium Cola 12pk,$25000,1250,8.5\n12346,Organic Chips,$18500,925,12.3";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "inventory_summary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-gray-600">Store Manager Dashboard</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              onClick={() => setIsOrderModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Place Order
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Location
                </label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.value} value={location.value}>
                        {location.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Category
                </label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Date Range
                </label>
                <DatePickerWithRange />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <KPICards />

        {/* Charts */}
        <InventoryCharts />

        {/* Place Order Modal */}
        <PlaceOrderModal 
          isOpen={isOrderModalOpen} 
          onClose={() => setIsOrderModalOpen(false)} 
        />
      </div>
    </div>
  );
};

export default Index;
