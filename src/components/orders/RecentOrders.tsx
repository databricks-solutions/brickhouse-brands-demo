import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";
import { OrdersTable } from "./OrdersTable";
import { PlaceOrderModal } from "./PlaceOrderModal";
import { OrderAnalyticsCards } from "./OrderAnalyticsCards";
import { useDarkModeStore } from "@/store/useDarkModeStore";

export const RecentOrders = () => {
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const { isDarkMode } = useDarkModeStore();

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
        <div className="space-y-6">
            {/* Order Analytics Cards */}
            <OrderAnalyticsCards />

            <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : ''}>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className={isDarkMode ? 'text-white' : ''}>Orders</CardTitle>
                        <div className="flex gap-3">
                            <Button
                                onClick={handleExportCSV}
                                variant="outline"
                                size="sm"
                                className={`flex items-center gap-2 ${isDarkMode
                                    ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white'
                                    : ''
                                    }`}
                            >
                                <Download className="h-4 w-4" />
                                Export CSV
                            </Button>
                            <Button
                                onClick={() => setIsOrderModalOpen(true)}
                                size="sm"
                                className={`flex items-center gap-2 ${isDarkMode
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                            >
                                <Plus className="h-4 w-4" />
                                Place Order
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <OrdersTable />
                </CardContent>
            </Card>

            {/* Place Order Modal */}
            <PlaceOrderModal
                isOpen={isOrderModalOpen}
                onClose={() => setIsOrderModalOpen(false)}
            />
        </div>
    );
}; 