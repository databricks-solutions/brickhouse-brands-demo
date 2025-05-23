
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, TrendingUp, Package, BarChart, Calendar } from "lucide-react";

export const KPICards = () => {
  const kpis = [
    {
      title: "Inventory Value",
      value: "$2.4M",
      change: "+5.2%",
      changeType: "positive",
      icon: TrendingUp,
      description: "vs last month"
    },
    {
      title: "Stock Available",
      value: "84,532",
      change: "-2.1%",
      changeType: "negative",
      icon: Package,
      description: "units in stock"
    },
    {
      title: "Turnover Ratio",
      value: "8.5x",
      change: "+12.3%",
      changeType: "positive",
      icon: BarChart,
      description: "annual turnover"
    },
    {
      title: "Inventory-to-Sales",
      value: "2.3:1",
      change: "+0.2",
      changeType: "neutral",
      icon: BarChart,
      description: "ratio this quarter"
    },
    {
      title: "Avg Days Supply",
      value: "42.8",
      change: "-3.2",
      changeType: "positive",
      icon: Calendar,
      description: "days of inventory"
    }
  ];

  const getChangeIcon = (type: string) => {
    if (type === "positive") return <ArrowUp className="h-3 w-3" />;
    if (type === "negative") return <ArrowDown className="h-3 w-3" />;
    return null;
  };

  const getChangeColor = (type: string) => {
    if (type === "positive") return "text-green-600";
    if (type === "negative") return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {kpis.map((kpi, index) => (
        <Card key={index} className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {kpi.title}
            </CardTitle>
            <kpi.icon className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="flex items-center space-x-1 text-xs mt-1">
              <span className={`flex items-center ${getChangeColor(kpi.changeType)}`}>
                {getChangeIcon(kpi.changeType)}
                {kpi.change}
              </span>
              <span className="text-gray-500">{kpi.description}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
