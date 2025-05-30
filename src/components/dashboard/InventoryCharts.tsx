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
  Line,
  Legend
} from "recharts";
import { Loader2 } from "lucide-react";
import { useInventoryStore } from "@/store/useInventoryStore";
import { useDarkModeStore } from "@/store/useDarkModeStore";

export const InventoryCharts = () => {
  const { chartData, fetchChartData, error } = useInventoryStore();
  const { isDarkMode } = useDarkModeStore();

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

  // Colors for pie chart (adapted for dark/light mode)
  const COLORS = isDarkMode
    ? ['#60a5fa', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#22d3ee', '#a3e635', '#fb923c']
    : ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

  // Chart theme based on dark mode
  const chartTheme = {
    grid: isDarkMode ? '#374151' : '#e5e7eb',
    text: isDarkMode ? '#d1d5db' : '#374151',
    tooltip: {
      background: isDarkMode ? '#374151' : '#ffffff',
      border: isDarkMode ? '#4b5563' : '#e5e7eb',
      text: isDarkMode ? '#f3f4f6' : '#1f2937'
    }
  };

  // Loading state
  if (chartData.isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3].map((index) => (
          <Card key={index} className={`col-span-1 lg:col-span-2 ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''
            }`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className={`h-8 w-8 animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-400'
                  }`} />
                <span className={`ml-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>Loading chart data...</span>
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
        <Card className={`col-span-full ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''
          }`}>
          <CardContent className="pt-6">
            <div className={`text-center ${isDarkMode ? 'text-red-400' : 'text-red-600'
              }`}>
              <p className="font-medium">Error loading chart data</p>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inventory Value Over Time */}
      <Card className={`col-span-1 lg:col-span-2 ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''
        }`}>
        <CardHeader>
          <CardTitle className={isDarkMode ? 'text-white' : ''}>
            Inventory Value Trends (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {inventoryValueData.length > 0 ? (
              <LineChart data={inventoryValueData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Inventory Value"]}
                  contentStyle={{
                    backgroundColor: chartTheme.tooltip.background,
                    border: `1px solid ${chartTheme.tooltip.border}`,
                    borderRadius: '6px',
                    color: chartTheme.tooltip.text
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={isDarkMode ? '#60a5fa' : '#3b82f6'}
                  strokeWidth={2}
                  dot={{ fill: isDarkMode ? '#60a5fa' : '#3b82f6', strokeWidth: 2 }}
                />
              </LineChart>
            ) : (
              <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                No trend data available
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Distribution */}
      <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : ''}>
        <CardHeader>
          <CardTitle className={isDarkMode ? 'text-white' : ''}>
            Inventory by Category
          </CardTitle>
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
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percentage }) => `${percentage}%`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Value"]}
                  contentStyle={{
                    backgroundColor: chartTheme.tooltip.background,
                    border: `1px solid ${chartTheme.tooltip.border}`,
                    borderRadius: '6px',
                    color: chartTheme.tooltip.text
                  }}
                  labelStyle={{
                    color: chartTheme.tooltip.text
                  }}
                  itemStyle={{
                    color: chartTheme.tooltip.text
                  }}
                />
                <Legend
                  wrapperStyle={{
                    color: chartTheme.text,
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            ) : (
              <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                No category data available
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Turnover Trends */}
      <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : ''}>
        <CardHeader>
          <CardTitle className={isDarkMode ? 'text-white' : ''}>
            Recent Activity Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {turnoverData.length > 0 ? (
              <AreaChart data={turnoverData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                />
                <YAxis
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                />
                <Tooltip
                  formatter={(value) => [value, "Days"]}
                  contentStyle={{
                    backgroundColor: chartTheme.tooltip.background,
                    border: `1px solid ${chartTheme.tooltip.border}`,
                    borderRadius: '6px',
                    color: chartTheme.tooltip.text
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="days"
                  stroke={isDarkMode ? '#34d399' : '#10b981'}
                  fill={isDarkMode ? '#34d399' : '#10b981'}
                  fillOpacity={0.3}
                />
              </AreaChart>
            ) : (
              <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                No activity data available
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
