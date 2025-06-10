import { useEffect, useState } from "react";
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
  Legend,
  BarChart,
  Bar,
  ReferenceLine
} from "recharts";
import { Loader2 } from "lucide-react";
import { useInventoryStore } from "@/store/useInventoryStore";
import { useDarkModeStore } from "@/store/useDarkModeStore";
import { useDateFilterStore } from "@/store/useDateFilterStore";
import { useDateStore } from "@/store/useDateStore";
import { OrderService } from "@/api/services/orderService";
import {
  FulfillmentTimelineData,
  RegionalPerformanceData,
  OrderStatusDistributionData,
  DemandForecastData
} from "@/api/types";

export const InventoryCharts = () => {
  const { chartData, fetchChartData, error } = useInventoryStore();
  const { isDarkMode } = useDarkModeStore();
  const { dateFrom, dateTo, hasDateFilter } = useDateFilterStore();
  const { configuredDate } = useDateStore();

  // Operational efficiency data state
  const [fulfillmentTimeline, setFulfillmentTimeline] = useState<FulfillmentTimelineData[]>([]);
  const [regionalPerformance, setRegionalPerformance] = useState<RegionalPerformanceData[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<OrderStatusDistributionData[]>([]);
  const [demandForecast, setDemandForecast] = useState<DemandForecastData[]>([]);
  const [isLoadingOperational, setIsLoadingOperational] = useState(false);
  const [operationalError, setOperationalError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch chart data when component mounts if not already loaded
    if (chartData.trends.length === 0 && !chartData.isLoading) {
      fetchChartData();
    }

    // Fetch operational efficiency data when date filter changes
    fetchOperationalData();
  }, [fetchChartData, chartData.trends.length, chartData.isLoading, dateFrom, dateTo]);

  const fetchOperationalData = async () => {
    setIsLoadingOperational(true);
    setOperationalError(null);

    try {
      // Use actual date range if available, otherwise default to 30 days
      const [timelineData, performanceData, distributionData, forecastData] = await Promise.all([
        dateFrom && dateTo
          ? OrderService.getFulfillmentTimeline(30, undefined, dateFrom, dateTo)
          : OrderService.getFulfillmentTimeline(30),
        dateFrom && dateTo
          ? OrderService.getRegionalPerformance(dateFrom, dateTo)
          : OrderService.getRegionalPerformance(),
        dateFrom && dateTo
          ? OrderService.getOrderStatusDistribution(30, undefined, dateFrom, dateTo)
          : OrderService.getOrderStatusDistribution(30),
        // Demand forecast - always use default parameters for now
        OrderService.getDemandForecast(90, 30)
      ]);

      setFulfillmentTimeline(timelineData);
      setRegionalPerformance(performanceData);
      setStatusDistribution(distributionData);
      setDemandForecast(forecastData);
    } catch (error) {
      setOperationalError(`Failed to load operational data: ${error}`);
    } finally {
      setIsLoadingOperational(false);
    }
  };

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

  // Helper function to get date range display text
  const getDateRangeText = () => {
    if (hasDateFilter() && dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return "Last 30 Days";
  };

  // Colors for charts (adapted for dark/light mode) - Define early to avoid initialization error
  const COLORS = isDarkMode
    ? ['#60a5fa', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#22d3ee', '#a3e635', '#fb923c']
    : ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

  // Transform trends data for the chart (last 30 days)
  const inventoryValueData = chartData.trends.map(trend => ({
    date: formatDateString(trend.date),
    value: trend.total_value
  }));

  // Category distribution for pie chart
  const categoryData = chartData.categories.map(cat => ({
    name: cat.category,
    value: cat.value,
    percentage: cat.percentage
  }));

  // Transform fulfillment timeline data for chart - respect date range
  const fulfillmentChartData = fulfillmentTimeline
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(item => ({
      date: formatDateString(item.date),
      hours: Math.round(item.avg_fulfillment_hours * 10) / 10,
      orders: item.order_count
    }));

  // Transform status distribution data for vertical bar chart with colors
  const statusChartData = statusDistribution.map((item, index) => ({
    status: item.status.replace('_', ' ').toUpperCase(),
    count: item.count,
    percentage: item.percentage,
    fill: COLORS[index % COLORS.length]
  }));

  // Transform regional performance data with colors
  const regionalChartData = regionalPerformance
    .sort((a, b) => b.fulfillment_rate - a.fulfillment_rate) // Sort by fulfillment rate descending
    .map((item, index) => ({
      region: item.region,
      fulfillment_rate: item.fulfillment_rate,
      total_orders: item.total_orders,
      fulfilled_orders: item.fulfilled_orders
    }));

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

  // Transform demand forecast data for chart display
  const historicalData = demandForecast.filter(item => !item.is_forecast);
  const forecastData = demandForecast.filter(item => item.is_forecast);

  // Combine data for display but keep track of forecast boundary
  const demandChartData = [...historicalData, ...forecastData];

  // Calculate trend line data (simple linear regression on order_count)
  const calculateTrendLine = () => {
    if (demandChartData.length < 2) return [];

    const allData = demandChartData.map((item, index) => ({
      x: index,
      y: item.order_count,
      date: item.date
    }));

    // Simple linear regression
    const n = allData.length;
    const sumX = allData.reduce((sum, item) => sum + item.x, 0);
    const sumY = allData.reduce((sum, item) => sum + item.y, 0);
    const sumXY = allData.reduce((sum, item) => sum + item.x * item.y, 0);
    const sumXX = allData.reduce((sum, item) => sum + item.x * item.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return allData.map(item => ({
      date: item.date,
      trend_orders: Math.max(0, slope * item.x + intercept),
      is_forecast: demandForecast.find(d => d.date === item.date)?.is_forecast || false
    }));
  };

  const trendLineData = calculateTrendLine();

  // Get current date for reference line - use configured date if available, otherwise current date
  // Use local timezone formatting to avoid UTC timezone issues
  const currentDate = configuredDate
    ? configuredDate.toLocaleDateString('en-CA') // YYYY-MM-DD format in local timezone
    : new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format in local timezone

  // Loading state
  if (chartData.isLoading || isLoadingOperational) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((index) => (
          <Card key={index} className={`${index === 1 ? 'col-span-1 lg:col-span-2' : ''} ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className={`h-8 w-8 animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                <span className={`ml-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading chart data...</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Error state
  if (error || operationalError) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={`col-span-full ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}>
          <CardContent className="pt-6">
            <div className={`text-center ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
              <p className="font-medium">Error loading chart data</p>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {error || operationalError}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Demand Forecasting */}
      <Card className={`col-span-1 lg:col-span-2 ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}>
        <CardHeader>
          <CardTitle className={isDarkMode ? 'text-white' : ''}>
            Demand Forecasting - Order Volume Trends & Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            {demandForecast.length > 0 ? (
              <LineChart
                data={demandChartData}
                margin={{ top: 20, right: 100, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                />
                <YAxis
                  yAxisId="orders"
                  domain={[0, 6000]}
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                  label={{
                    value: 'Orders per Day',
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: chartTheme.text }
                  }}
                />
                <YAxis
                  yAxisId="value"
                  orientation="right"
                  domain={[0, 5000000]}
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                  tickFormatter={formatCurrency}
                  width={90}
                  label={{
                    value: 'Total Value',
                    angle: 90,
                    position: 'outside',
                    offset: 20,
                    dx: 40,
                    style: { textAnchor: 'middle', fill: chartTheme.text }
                  }}
                />

                {/* Vertical line at current date */}
                <ReferenceLine
                  x={currentDate}
                  yAxisId="orders"
                  stroke={isDarkMode ? '#ef4444' : '#dc2626'}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: "Today",
                    position: "top",
                    style: { fill: isDarkMode ? '#ef4444' : '#dc2626', fontSize: '12px' }
                  }}
                />

                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'order_count') return [value, 'Orders'];
                    if (name === 'total_value') return [formatCurrency(Number(value)), 'Total Value'];
                    if (name === 'trend_orders') return [Math.round(Number(value)), 'Trend Line'];
                    return [value, name];
                  }}
                  labelFormatter={(label, payload) => {
                    const dataPoint = payload?.[0]?.payload;
                    const forecastText = dataPoint?.is_forecast ? ' (Forecast)' : ' (Historical)';
                    return `${formatDateString(label)}${forecastText}`;
                  }}
                  contentStyle={{
                    backgroundColor: chartTheme.tooltip.background,
                    border: `1px solid ${chartTheme.tooltip.border}`,
                    borderRadius: '6px',
                    color: chartTheme.tooltip.text
                  }}
                />

                {/* Historical Order Count Line */}
                <Line
                  yAxisId="orders"
                  type="monotone"
                  dataKey="order_count"
                  stroke={isDarkMode ? '#60a5fa' : '#3b82f6'}
                  strokeWidth={2}
                  dot={(props) => {
                    const isHistorical = !props.payload?.is_forecast;
                    const isForecast = props.payload?.is_forecast;
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={isHistorical ? 3 : 2}
                        fill={isHistorical
                          ? (isDarkMode ? '#60a5fa' : '#3b82f6')
                          : (isDarkMode ? '#fb923c' : '#f97316')
                        }
                        stroke={isHistorical
                          ? (isDarkMode ? '#60a5fa' : '#3b82f6')
                          : (isDarkMode ? '#fb923c' : '#f97316')
                        }
                        strokeWidth={2}
                        opacity={isForecast ? 0.7 : 1}
                      />
                    );
                  }}
                  connectNulls={false}
                />

                {/* Forecast Order Count Line (separate line for different styling) */}
                <Line
                  yAxisId="orders"
                  type="monotone"
                  dataKey={(entry) => entry.is_forecast ? entry.order_count : null}
                  stroke={isDarkMode ? '#fb923c' : '#f97316'}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />

                {/* Historical Revenue Line */}
                <Line
                  yAxisId="value"
                  type="monotone"
                  dataKey="total_value"
                  stroke={isDarkMode ? '#34d399' : '#10b981'}
                  strokeWidth={2}
                  dot={(props) => {
                    const isHistorical = !props.payload?.is_forecast;
                    const isForecast = props.payload?.is_forecast;
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={isHistorical ? 3 : 2}
                        fill={isHistorical
                          ? (isDarkMode ? '#34d399' : '#10b981')
                          : (isDarkMode ? '#a78bfa' : '#8b5cf6')
                        }
                        stroke={isHistorical
                          ? (isDarkMode ? '#34d399' : '#10b981')
                          : (isDarkMode ? '#a78bfa' : '#8b5cf6')
                        }
                        strokeWidth={2}
                        opacity={isForecast ? 0.7 : 1}
                      />
                    );
                  }}
                  connectNulls={false}
                />

                {/* Forecast Revenue Line */}
                <Line
                  yAxisId="value"
                  type="monotone"
                  dataKey={(entry) => entry.is_forecast ? entry.total_value : null}
                  stroke={isDarkMode ? '#a78bfa' : '#8b5cf6'}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />

                {/* Trend Line for Orders */}
                {trendLineData.length > 0 && (
                  <Line
                    yAxisId="orders"
                    type="monotone"
                    data={trendLineData}
                    dataKey="trend_orders"
                    stroke={isDarkMode ? '#fbbf24' : '#f59e0b'}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                    connectNulls={true}
                  />
                )}
              </LineChart>
            ) : (
              <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No forecast data available
              </div>
            )}
          </ResponsiveContainer>

          {/* Custom Legend */}
          <div className="mt-2 flex justify-center">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm max-w-4xl">
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-0.5 ${isDarkMode ? 'bg-blue-400' : 'bg-blue-600'}`}></div>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Historical Orders</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-0.5 ${isDarkMode ? 'bg-orange-400' : 'bg-orange-600'}`}></div>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Forecast Orders</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-0.5 ${isDarkMode ? 'bg-green-400' : 'bg-green-600'}`}></div>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Historical Revenue</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-0.5 ${isDarkMode ? 'bg-purple-400' : 'bg-purple-600'}`}></div>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Forecast Revenue</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-0.5 ${isDarkMode ? 'bg-yellow-400' : 'bg-yellow-600'}`} style={{ borderTop: '1px dashed' }}></div>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Trend Line</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-0.5 ${isDarkMode ? 'bg-red-400' : 'bg-red-600'}`} style={{ borderTop: '2px dashed' }}></div>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Today</span>
              </div>
            </div>
          </div>
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
              <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No category data available
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Fulfillment Timeline */}
      <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : ''}>
        <CardHeader>
          <CardTitle className={isDarkMode ? 'text-white' : ''}>
            Fulfillment Timeline ({getDateRangeText()})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {fulfillmentChartData.length > 0 ? (
              <AreaChart data={fulfillmentChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartTheme.tooltip.background,
                    border: `1px solid ${chartTheme.tooltip.border}`,
                    borderRadius: '6px',
                    color: chartTheme.tooltip.text
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="hours"
                  stroke={isDarkMode ? '#60a5fa' : '#3b82f6'}
                  fill={isDarkMode ? '#60a5fa' : '#3b82f6'}
                  fillOpacity={0.3}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="orders"
                  stroke={isDarkMode ? '#fbbf24' : '#f59e0b'}
                  fill={isDarkMode ? '#fbbf24' : '#f59e0b'}
                  fillOpacity={0.3}
                />
              </AreaChart>
            ) : (
              <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No fulfillment data available
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Order Status Distribution */}
      <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : ''}>
        <CardHeader>
          <CardTitle className={isDarkMode ? 'text-white' : ''}>
            Order Status Distribution ({getDateRangeText()})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {statusChartData.length > 0 ? (
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="status"
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                />
                <YAxis
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                />
                <Tooltip
                  formatter={(value, name, props) => [
                    `${value}% (${props.payload.count} orders)`,
                    "Orders"
                  ]}
                  labelFormatter={(label) => `Status: ${label}`}
                  contentStyle={{
                    backgroundColor: chartTheme.tooltip.background,
                    border: `1px solid ${chartTheme.tooltip.border}`,
                    borderRadius: '6px',
                    color: chartTheme.tooltip.text
                  }}
                />
                <Bar dataKey="percentage" fill="#8884d8">
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No status data available
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Regional Performance */}
      <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : ''}>
        <CardHeader>
          <CardTitle className={isDarkMode ? 'text-white' : ''}>
            Regional Performance ({getDateRangeText()})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {regionalChartData.length > 0 ? (
              <BarChart
                data={regionalChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="region"
                  tick={{ fill: chartTheme.text, fontSize: 11 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fill: chartTheme.text, fontSize: 12 }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={{ stroke: chartTheme.grid }}
                  label={{
                    value: 'Fulfillment Rate (%)',
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: chartTheme.text }
                  }}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Fulfillment Rate"]}
                  labelFormatter={(label) => `Region: ${label}`}
                  contentStyle={{
                    backgroundColor: chartTheme.tooltip.background,
                    border: `1px solid ${chartTheme.tooltip.border}`,
                    borderRadius: '6px',
                    color: chartTheme.tooltip.text
                  }}
                />
                <Bar
                  dataKey="fulfillment_rate"
                  radius={[4, 4, 0, 0]}
                >
                  {regionalChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No regional data available
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
