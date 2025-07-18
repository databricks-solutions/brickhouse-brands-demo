import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, TrendingUp, Package, BarChart, Calendar, Loader2 } from "lucide-react";
import { useInventoryStore } from "@/store/useInventoryStore";
import { useDarkModeStore } from "@/store/useDarkModeStore";

export const KPICards = () => {
  const { kpiData, lowStockCount, isLoadingKPIs, error, fetchKPIData } = useInventoryStore();
  const { isDarkMode } = useDarkModeStore();

  useEffect(() => {
    fetchKPIData();
  }, [fetchKPIData]);

  const getChangeIcon = (type: string) => {
    if (type === "positive") return <ArrowUp className="h-3 w-3" />;
    if (type === "negative") return <ArrowDown className="h-3 w-3" />;
    return null;
  };

  const getChangeColor = (type: string) => {
    if (type === "positive") return isDarkMode ? "text-green-400" : "text-green-600";
    if (type === "negative") return isDarkMode ? "text-red-400" : "text-red-600";
    return isDarkMode ? "text-gray-400" : "text-gray-600";
  };

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

  // Convert KPIData into display format
  const getKPICards = () => {
    if (!kpiData) return [];

    return [
      {
        title: "Inventory Value",
        value: formatCurrency(kpiData.total_inventory_value),
        change: "+5.2%", // TODO: Calculate actual change from historical data
        changeType: "positive",
        icon: TrendingUp,
        description: "vs last month"
      },
      {
        title: "Total Products",
        value: formatNumber(kpiData.total_products),
        change: "+2.1%", // TODO: Calculate actual change
        changeType: "positive",
        icon: Package,
        description: "active products"
      },
      {
        title: "Low Stock Alerts",
        value: formatNumber(lowStockCount),
        change: lowStockCount > 0 ? "+8.3%" : "0%", // TODO: Calculate actual change
        changeType: lowStockCount > 0 ? "negative" : "positive",
        icon: Package,
        description: "items below threshold"
      },
      {
        title: "Avg Turnover",
        value: `${kpiData.average_turnover.toFixed(1)}x`,
        change: "+12.3%", // TODO: Calculate actual change
        changeType: "positive",
        icon: BarChart,
        description: "annual turnover"
      }
    ];
  };

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`col-span-full ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}>
          <CardContent className="pt-6">
            <div className={`text-center ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
              <p className="font-medium">Error loading KPIs</p>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingKPIs || !kpiData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((index) => (
          <Card key={index} className={`hover:shadow-lg transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''
            }`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                <div className={`h-4 w-20 rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`}></div>
              </CardTitle>
              <Loader2 className={`h-4 w-4 animate-spin ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`} />
            </CardHeader>
            <CardContent>
              <div className={`h-8 w-16 rounded animate-pulse mb-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}></div>
              <div className={`h-4 w-24 rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpiCards = getKPICards();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiCards.map((kpi, index) => (
        <Card key={index} className={`hover:shadow-lg transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''
          }`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
              {kpi.title}
            </CardTitle>
            <kpi.icon className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>{kpi.value}</div>
            <div className="flex items-center space-x-1 text-xs mt-1">
              <span className={`flex items-center ${getChangeColor(kpi.changeType)}`}>
                {getChangeIcon(kpi.changeType)}
                {kpi.change}
              </span>
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>{kpi.description}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
