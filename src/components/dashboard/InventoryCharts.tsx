
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  LineChart
} from "recharts";

export const InventoryCharts = () => {
  // Mock data for charts
  const inventoryValueData = [
    { month: "Jan", value: 2200000 },
    { month: "Feb", value: 2350000 },
    { month: "Mar", value: 2180000 },
    { month: "Apr", value: 2420000 },
    { month: "May", value: 2380000 },
    { month: "Jun", value: 2400000 },
  ];

  const turnoverData = [
    { month: "Jan", days: 45 },
    { month: "Feb", days: 42 },
    { month: "Mar", days: 48 },
    { month: "Apr", days: 40 },
    { month: "May", days: 44 },
    { month: "Jun", days: 43 },
  ];

  const movementData = [
    { month: "Jan", purchases: 1500000, sales: 1200000, total: 2700000 },
    { month: "Feb", purchases: 1650000, sales: 1350000, total: 3000000 },
    { month: "Mar", purchases: 1400000, sales: 1180000, total: 2580000 },
    { month: "Apr", purchases: 1750000, sales: 1420000, total: 3170000 },
    { month: "May", purchases: 1600000, sales: 1380000, total: 2980000 },
    { month: "Jun", purchases: 1700000, sales: 1400000, total: 3100000 },
  ];

  const salesAnalysisData = [
    { month: "Jan", sales: 1200000, inventory: 2200000, ratio: 1.83 },
    { month: "Feb", sales: 1350000, inventory: 2350000, ratio: 1.74 },
    { month: "Mar", sales: 1180000, inventory: 2180000, ratio: 1.85 },
    { month: "Apr", sales: 1420000, inventory: 2420000, ratio: 1.70 },
    { month: "May", sales: 1380000, inventory: 2380000, ratio: 1.72 },
    { month: "Jun", sales: 1400000, inventory: 2400000, ratio: 1.71 },
  ];

  const topItemsValue = [
    { name: "Premium Cola 12pk", value: 245000 },
    { name: "Organic Chips", value: 185000 },
    { name: "Greek Yogurt", value: 165000 },
    { name: "Frozen Pizza", value: 145000 },
    { name: "Energy Drink", value: 125000 },
    { name: "Protein Bars", value: 105000 },
    { name: "Mineral Water", value: 95000 },
    { name: "Coffee Pods", value: 85000 },
    { name: "Shampoo", value: 75000 },
    { name: "Cereal", value: 65000 },
  ];

  const topItemsQuantity = [
    { name: "Mineral Water", value: 12500 },
    { name: "Premium Cola 12pk", value: 9800 },
    { name: "Energy Drink", value: 8300 },
    { name: "Coffee Pods", value: 7200 },
    { name: "Protein Bars", value: 6100 },
    { name: "Organic Chips", value: 5900 },
    { name: "Greek Yogurt", value: 4800 },
    { name: "Cereal", value: 4200 },
    { name: "Shampoo", value: 3100 },
    { name: "Frozen Pizza", value: 2900 },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inventory Value Over Time */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Inventory Value Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={inventoryValueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Inventory Value"]} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Turnover Days by Month */}
      <Card>
        <CardHeader>
          <CardTitle>Turnover Days by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={turnoverData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [value, "Days"]} />
              <Area type="monotone" dataKey="days" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Inventory Movement */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Movement</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={movementData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value) => [formatCurrency(Number(value))]} />
              <Bar dataKey="purchases" fill="#3b82f6" name="Purchases" />
              <Bar dataKey="sales" fill="#10b981" name="Sales" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Inventory-to-Sales Analysis */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Inventory-to-Sales Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={salesAnalysisData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" tickFormatter={formatCurrency} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === "ratio") return [Number(value).toFixed(2), "I/S Ratio"];
                  return [formatCurrency(Number(value)), name];
                }}
              />
              <Bar yAxisId="left" dataKey="sales" fill="#10b981" name="Sales" />
              <Bar yAxisId="left" dataKey="inventory" fill="#3b82f6" name="Inventory" />
              <Line yAxisId="right" type="monotone" dataKey="ratio" stroke="#f59e0b" strokeWidth={3} name="I/S Ratio" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 10 Items */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Top 10 Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="value" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="value">By Value</TabsTrigger>
              <TabsTrigger value="quantity">By Quantity</TabsTrigger>
            </TabsList>
            <TabsContent value="value" className="mt-4">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topItemsValue} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatCurrency} />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Value"]} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
            <TabsContent value="quantity" className="mt-4">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topItemsQuantity} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatNumber} />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip formatter={(value) => [formatNumber(Number(value)), "Quantity"]} />
                  <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
