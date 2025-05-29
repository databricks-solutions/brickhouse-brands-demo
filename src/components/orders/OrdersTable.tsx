import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, Package, Store, User, Calendar } from "lucide-react";
import { useOrderStore } from "@/store/useOrderStore";
import { useInventoryStore } from "@/store/useInventoryStore";
import { Order } from "@/api/types";

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'pending_review':
      return 'destructive';
    case 'approved':
      return 'secondary';
    case 'fulfilled':
      return 'success';
    case 'cancelled':
      return 'outline';
    default:
      return 'default';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending_review':
      return 'Pending Review';
    case 'approved':
      return 'Approved';
    case 'fulfilled':
      return 'Fulfilled';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};

const formatDate = (date: string | Date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const OrdersTable = () => {
  const {
    orders,
    currentPage,
    totalPages,
    totalItems,
    isLoading,
    error,
    fetchOrders,
    setPage,
    setPageSize,
    setFilters
  } = useOrderStore();

  // Get the current filters from the inventory store
  const { filters: inventoryFilters } = useInventoryStore();

  const [pageSize] = useState(10);

  useEffect(() => {
    // Set the page size in the store and fetch orders with filters
    setPageSize(pageSize);

    // Convert inventory filters to order filters
    const orderFilters = {
      region: inventoryFilters.region,
      // Add more filters as needed
    };

    fetchOrders(orderFilters, 1, pageSize);
  }, [fetchOrders, pageSize, setPageSize, inventoryFilters.region]);

  const handlePageChange = (newPage: number) => {
    // Convert inventory filters to order filters
    const orderFilters = {
      region: inventoryFilters.region,
    };

    // Update the order store filters before changing page
    setFilters(orderFilters);

    setPage(newPage);
  };

  const renderMobileCard = (order: Order) => (
    <div key={order.order_id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-gray-900">#{order.order_number}</p>
          <p className="text-sm text-gray-600">{order.product_name}</p>
        </div>
        <Badge variant={getStatusBadgeVariant(order.order_status)}>
          {getStatusText(order.order_status)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-400" />
          <span>{order.quantity_cases} cases</span>
        </div>
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-gray-400" />
          <span>{order.to_store_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" />
          <span>{order.requester_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span>{formatDate(order.order_date)}</span>
        </div>
      </div>
    </div>
  );

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p className="font-medium">Error loading orders</p>
            <p className="text-sm text-gray-600 mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>
              Recent Orders
              {inventoryFilters.region && inventoryFilters.region !== 'all' && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({inventoryFilters.region})
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {totalItems} total orders
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading orders...</span>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Order #</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Product</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Quantity</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">To Store</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Requested By</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.order_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-blue-600">#{order.order_number}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{order.product_name}</p>
                          <p className="text-sm text-gray-600">{order.brand} • {order.category}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{order.quantity_cases}</span>
                        <span className="text-gray-600 ml-1">cases</span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{order.to_store_name}</p>
                          <p className="text-sm text-gray-600">{order.to_store_region}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-900">{order.requester_name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-600">{formatDate(order.order_date)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadgeVariant(order.order_status)}>
                          {getStatusText(order.order_status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {orders.map(renderMobileCard)}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {orders.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No orders found</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}; 