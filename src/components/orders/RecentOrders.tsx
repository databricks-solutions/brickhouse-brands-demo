import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";
import { OrdersTable } from "./OrdersTable";
import { PlaceOrderModal } from "./PlaceOrderModal";
import { OrderAnalyticsCards } from "./OrderAnalyticsCards";
import { useDarkModeStore } from "@/store/useDarkModeStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useDateStore } from "@/store/useDateStore";

export const RecentOrders = () => {
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const { isDarkMode } = useDarkModeStore();
    const { filters } = useOrderStore();
    const { isDateConfigured, configuredDate } = useDateStore();

    // Determine if we're showing filtered data (from analytics cards)
    const hasDateFilter = filters.dateFrom && filters.dateTo;

    const getSubtitle = () => {
        if (hasDateFilter) {
            return "Last 30 days";
        }
        // Always show "All orders" instead of configured date to hide date spoofing
        return "All orders";
    };

    const subtitle = getSubtitle();

    const handleExportCSV = () => {
        // Mock CSV export functionality
        const csvContent = "data:text/csv;charset=utf-8,Order ID,Product,Quantity,Store,Status,Date\n12345,Premium Cola 12pk,25,Store A,Pending,2024-01-15\n12346,Organic Chips,50,Store B,Approved,2024-01-14";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "recent_orders.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <div className="space-y-6">
                {/* Analytics Cards */}
                <OrderAnalyticsCards />

                {/* Recent Orders Table */}
                <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : ''}>
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className={`text-xl font-semibold ${isDarkMode ? 'text-white' : ''}`}>
                                    Recent Orders
                                </CardTitle>
                                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {subtitle}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={handleExportCSV}
                                    className={isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white' : ''}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export CSV
                                </Button>
                                <Button
                                    onClick={() => setIsOrderModalOpen(true)}
                                    className={isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Place Order
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <OrdersTable />
                    </CardContent>
                </Card>
            </div>

            <PlaceOrderModal
                isOpen={isOrderModalOpen}
                onClose={() => setIsOrderModalOpen(false)}
            />
        </>
    );
}; 