import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, Package, Store, User, Calendar, Edit3 } from "lucide-react";
import { useOrderStore } from "@/store/useOrderStore";
import { useInventoryStore } from "@/store/useInventoryStore";
import { Order } from "@/api/types";
import { ModifyOrderModal } from "./ModifyOrderModal";

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'pending_review':
      return 'pending-review';
    case 'approved':
      return 'approved-order';
    case 'fulfilled':
      return 'fulfilled-order';
    case 'cancelled':
      return 'cancelled-order';
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
    setFilters,
    filters: orderFilters
  } = useOrderStore();

  // Get the current filters from the inventory store
  const { filters: inventoryFilters } = useInventoryStore();

  const [pageSize] = useState(10);
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [selectedOrderForModify, setSelectedOrderForModify] = useState<Order | null>(null);

  // Helper function to check if order can be modified
  const canModifyOrder = (order: Order) => {
    return order.order_status === 'pending_review' || order.order_status === 'approved';
  };

  const handleModifyOrder = (order: Order) => {
    setSelectedOrderForModify(order);
    setIsModifyModalOpen(true);
  };

  const handleCloseModifyModal = () => {
    setIsModifyModalOpen(false);
    setSelectedOrderForModify(null);
  };

  useEffect(() => {
    // Set the page size in the store
    setPageSize(pageSize);
  }, [setPageSize, pageSize]);

  useEffect(() => {
    // Combine inventory filters (region/category) with order filters (status)
    const combinedFilters = {
      region: inventoryFilters.region,
      status: orderFilters.status || 'all',
      // Add more filters as needed
    };

    fetchOrders(combinedFilters, 1, pageSize);
  }, [fetchOrders, pageSize, inventoryFilters.region, orderFilters.status]);

  const handlePageChange = (newPage: number) => {
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

  const renderSkeletonRow = () => (
    <tr className="border-b border-gray-100">
      <td className="py-3 px-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
      </td>
      <td className="py-3 px-4">
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
          <div className="h-3 bg-gray-200 rounded animate-pulse w-24"></div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
      </td>
      <td className="py-3 px-4">
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-28"></div>
          <div className="h-3 bg-gray-200 rounded animate-pulse w-20"></div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
      </td>
      <td className="py-3 px-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
      </td>
      <td className="py-3 px-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-16"></div>
      </td>
      <td className="py-3 px-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-24"></div>
      </td>
    </tr>
  );

  const renderEmptyRow = () => (
    <tr className="border-b border-gray-100">
      <td className="py-3 px-4">&nbsp;</td>
      <td className="py-3 px-4">&nbsp;</td>
      <td className="py-3 px-4">&nbsp;</td>
      <td className="py-3 px-4">&nbsp;</td>
      <td className="py-3 px-4">&nbsp;</td>
      <td className="py-3 px-4">&nbsp;</td>
      <td className="py-3 px-4">&nbsp;</td>
      <td className="py-3 px-4">&nbsp;</td>
    </tr>
  );

  // Create array of rows to ensure consistent count
  const getTableRows = () => {
    const rows = [];

    if (isLoading) {
      // Show skeleton rows while loading
      for (let i = 0; i < pageSize; i++) {
        rows.push(<div key={`skeleton-${i}`}>{renderSkeletonRow()}</div>);
      }
    } else {
      // Show actual order rows
      orders.forEach((order) => {
        rows.push(
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
            <td className="py-3 px-4">
              {canModifyOrder(order) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleModifyOrder(order)}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Modify
                </Button>
              ) : (
                <span className="text-gray-400 text-sm">-</span>
              )}
            </td>
          </tr>
        );
      });

      // Fill remaining rows with empty space to maintain consistent height
      const remainingRows = pageSize - orders.length;
      for (let i = 0; i < remainingRows; i++) {
        rows.push(<div key={`empty-${i}`}>{renderEmptyRow()}</div>);
      }
    }

    return rows;
  };

  if (error) {
    return (
      <div className="pt-6">
        <div className="text-center text-red-600">
          <p className="font-medium">Error loading orders</p>
          <p className="text-sm text-gray-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop Table - Always show structure */}
      <div className="hidden md:block overflow-x-auto relative">
        {/* Loading overlay for desktop */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="flex items-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Loading...</span>
            </div>
          </div>
        )}

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
              <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody style={{ minHeight: `${pageSize * 60}px` }}>
            {getTableRows()}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          // Show loading state for mobile
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading orders...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No orders found</p>
          </div>
        ) : (
          orders.map(renderMobileCard)
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Page {currentPage} of {totalPages}</span>
            <span>•</span>
            <span>{totalItems} total orders</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Empty state - only show when not loading and no orders */}
      {!isLoading && orders.length === 0 && (
        <div className="text-center py-12 hidden md:block">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No orders found</p>
        </div>
      )}

      {/* Modify Order Modal */}
      <ModifyOrderModal
        isOpen={isModifyModalOpen}
        onClose={handleCloseModifyModal}
        order={selectedOrderForModify}
      />
    </div>
  );
}; 