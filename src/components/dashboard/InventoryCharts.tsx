import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { Loader2 } from "lucide-react";
import { useInventoryStore } from "@/store/useInventoryStore";
import { OrdersTable } from "@/components/orders/OrdersTable";

export const InventoryCharts = () => {
  const { chartData, fetchChartData, error } = useInventoryStore();

  useEffect(() => {
    // Fetch chart data when component mounts if not already loaded
    if (chartData.trends.length === 0 && !chartData.isLoading) {
      fetchChartData();
    }
  }, [fetchChartData, chartData.trends.length, chartData.isLoading]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDateString = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Transform trends data for the chart (last 30 days)
  const inventoryValueData = chartData.trends.map(trend => ({
    date: formatDateString(trend.date),
    value: trend.total_value
  }));

  // Generate mock turnover data since we don't have order/sales data yet
  const turnoverData = chartData.trends.slice(-6).map((trend, index) => ({
    date: formatDateString(trend.date),
    days: 40 + Math.random() * 10 // Mock turnover days between 40-50
  }));

  // Category distribution for pie chart
  const categoryData = chartData.categories.map(cat => ({
    name: cat.category,
    value: cat.value,
    percentage: cat.percentage
  }));

  // Colors for pie chart
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

  // Loading state
  if (chartData.isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((index) => (
          <Card key={index} className="col-span-1 lg:col-span-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600">Loading chart data...</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-full">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Error loading chart data</p>
              <p className="text-sm text-gray-600 mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inventory Value Over Time */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Inventory Value Trends (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {inventoryValueData.length > 0 ? (
              <LineChart data={inventoryValueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Inventory Value"]} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                />
              </LineChart>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No trend data available
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {categoryData.length > 0 ? (
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Value"]} />
              </PieChart>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No category data available
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Turnover Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {turnoverData.length > 0 ? (
              <AreaChart data={turnoverData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [value, "Days"]} />
                <Area
                  type="monotone"
                  dataKey="days"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                />
              </AreaChart>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No activity data available
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Categories by Value - REPLACED WITH ORDERS TABLE */}
      <div className="col-span-1 lg:col-span-2">
        <OrdersTable />
      </div>
    </div>
  );
};
