import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Loader2, ChevronLeft, ChevronRight, Package, Store, User, Calendar, Edit3, AlertTriangle } from "lucide-react";
import { useOrderStore } from "@/store/useOrderStore";
import { useInventoryStore } from "@/store/useInventoryStore";
import { useDarkModeStore } from "@/store/useDarkModeStore";
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

// Helper function to check if expired SLA filter is active
const isExpiredSlaFilterActive = (orderFilters: any) => {
  return orderFilters.expiredSlaOnly === true;
};

// Helper function to calculate days since order creation (for display only)
const getDaysExpired = (orderDate: string | Date) => {
  const orderDateTime = typeof orderDate === 'string' ? new Date(orderDate) : orderDate;
  const currentDate = new Date();
  const diffTime = currentDate.getTime() - orderDateTime.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24); // Don't floor this
  return diffDays;
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
    filters // All filters now centralized in order store
  } = useOrderStore();

  // Get dark mode state
  const { isDarkMode } = useDarkModeStore();

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

  // Simple effect - just fetch when filters change (debouncing handled in store)
  useEffect(() => {
    fetchOrders(filters, 1, pageSize);
  }, [fetchOrders, filters, pageSize]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const renderMobileCard = (order: Order) => (
    <div key={order.order_id} className={`rounded-lg border p-4 space-y-3 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
      <div className="flex justify-between items-start">
        <div>
          <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{order.order_number}</p>
          <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{order.product_name}</p>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1">
            <Badge variant={getStatusBadgeVariant(order.order_status)}>
              {order.order_status === 'pending_review' && getDaysExpired(order.order_date) > 2 && (
                <AlertTriangle className={`h-3 w-3 mr-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
              )}
              {getStatusText(order.order_status)}
            </Badge>
          </div>
          {order.order_status === 'pending_review' && getDaysExpired(order.order_date) > 2 && (
            <div className={`text-xs mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
              {Math.max(0, Math.ceil(getDaysExpired(order.order_date) - 2))} days overdue
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Package className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
          <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{order.quantity_cases} cases</span>
        </div>
        <div className="flex items-center gap-2">
          <Store className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
          <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{order.to_store_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <UserAvatar
            avatarUrl={order.requester_avatar_url}
            firstName={order.requester_name?.split(' ')[0]}
            lastName={order.requester_name?.split(' ')[1]}
            size="md"
          />
          <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{order.requester_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
          <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{formatDate(order.order_date)}</span>
        </div>
      </div>
    </div >
  );

  const renderSkeletonRow = () => (
    <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
      <td className="py-3 px-4">
        <div className={`h-4 rounded animate-pulse w-20 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
      </td>
      <td className="py-3 px-4">
        <div className="space-y-2">
          <div className={`h-4 rounded animate-pulse w-32 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
          <div className={`h-3 rounded animate-pulse w-24 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className={`h-4 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
      </td>
      <td className="py-3 px-4">
        <div className="space-y-2">
          <div className={`h-4 rounded animate-pulse w-28 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
          <div className={`h-3 rounded animate-pulse w-20 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className={`h-4 rounded animate-pulse w-24 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
      </td>
      <td className="py-3 px-4">
        <div className={`h-4 rounded animate-pulse w-20 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
      </td>
      <td className="py-3 px-4">
        <div className={`h-6 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
      </td>
      <td className="py-3 px-4 text-center">
        <div className="flex justify-center">
          <div className={`h-6 rounded animate-pulse w-20 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
        </div>
      </td>
      <td className="py-3 px-4 text-center">
        <div className="flex justify-center">
          <div className={`h-6 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
        </div>
      </td>
    </tr>
  );

  const renderEmptyRow = () => (
    <tr className="">
      <td className="py-3 px-4"></td>
      <td className="py-3 px-4"></td>
      <td className="py-3 px-4"></td>
      <td className="py-3 px-4"></td>
      <td className="py-3 px-4"></td>
      <td className="py-3 px-4"></td>
      <td className="py-3 px-4 text-center"></td>
      <td className="py-3 px-4 text-center"></td>
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
          <tr key={order.order_id} className={`border-b ${isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'
            }`}>
            <td className="py-3 px-4">
              <span className={`font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{order.order_number}</span>
            </td>
            <td className="py-3 px-4">
              <div>
                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{order.product_name}</p>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{order.brand} • {order.category}</p>
              </div>
            </td>
            <td className="py-3 px-4">
              <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{order.quantity_cases}</span>
              <span className={`ml-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>cases</span>
            </td>
            <td className="py-3 px-4">
              <div>
                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{order.to_store_name}</p>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{order.to_store_region}</p>
              </div>
            </td>
            <td className="py-3 px-4">
              <div className="flex items-center gap-2">
                <UserAvatar
                  avatarUrl={order.requester_avatar_url}
                  firstName={order.requester_name?.split(' ')[0]}
                  lastName={order.requester_name?.split(' ')[1]}
                  size="md"
                />
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{order.requester_name}</span>
              </div>
            </td>
            <td className="py-3 px-4">
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{formatDate(order.order_date)}</span>
            </td>
            <td className="py-3 px-4 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1">
                  <Badge variant={getStatusBadgeVariant(order.order_status)} className="min-w-[100px] justify-center">
                    {order.order_status === 'pending_review' && getDaysExpired(order.order_date) > 2 && (
                      <AlertTriangle className={`h-3 w-3 mr-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                    )}
                    {getStatusText(order.order_status)}
                  </Badge>
                </div>
                {order.order_status === 'pending_review' && getDaysExpired(order.order_date) > 2 && (
                  <div className={`text-xs mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                    {Math.max(0, Math.ceil(getDaysExpired(order.order_date) - 2))} days overdue
                  </div>
                )}
              </div>
            </td>
            <td className="py-3 px-4 text-center">
              <div className="flex justify-center">
                {canModifyOrder(order) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleModifyOrder(order)}
                    className={`${isDarkMode
                      ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white'
                      : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                      }`}
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Modify
                  </Button>
                ) : (
                  <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>-</span>
                )}
              </div>
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
      <div className={`text-center py-8 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
        <p className="font-medium">Error loading orders</p>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
      {/* Add a subtle loading bar when filtering */}
      {isLoading && (
        <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div className="h-full bg-blue-500 animate-pulse" style={{ width: '30%' }}></div>
        </div>
      )}

      {/* Mobile view */}
      <div className="lg:hidden">
        <div className="p-4 space-y-4">
          {isLoading ? (
            // Mobile skeleton loading
            Array.from({ length: pageSize }).map((_, index) => (
              <div
                key={`mobile-skeleton-${index}`}
                className={`rounded-lg border p-4 space-y-3 animate-pulse ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className={`h-4 w-24 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                    <div className={`h-3 w-32 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                  </div>
                  <div className={`h-6 w-20 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`h-4 w-16 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                  <div className={`h-4 w-20 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                  <div className={`h-4 w-24 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                  <div className={`h-4 w-18 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                </div>
              </div>
            ))
          ) : orders.length === 0 ? (
            <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <Package className={`mx-auto h-12 w-12 mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
              <p className="font-medium">No orders found</p>
              <p className="text-sm mt-1">Try adjusting your filters or search criteria</p>
            </div>
          ) : (
            orders.map(renderMobileCard)
          )}
        </div>
      </div>

      {/* Desktop Table - Always show structure */}
      <div className="hidden md:block overflow-x-auto relative">
        {/* Loading overlay for desktop */}
        {isLoading && (
          <div className={`absolute inset-0 bg-opacity-75 flex items-center justify-center z-10 ${isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
            <div className="flex items-center">
              <Loader2 className={`h-6 w-6 animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
              <span className={`ml-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading...</span>
            </div>
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <th className={`text-left py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Order #</th>
              <th className={`text-left py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Product</th>
              <th className={`text-left py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Quantity</th>
              <th className={`text-left py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>To Store</th>
              <th className={`text-left py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Requested By</th>
              <th className={`text-left py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Order Date</th>
              <th className={`text-left py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Status</th>
              <th className={`text-left py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {getTableRows()}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={`flex items-center justify-between mt-6 pt-4 px-6 pb-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
          <div className={`flex items-center gap-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
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
              className={isDarkMode ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white' : ''}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isLoading}
              className={isDarkMode ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white' : ''}
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
          <Package className={`h-12 w-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>No orders found</p>
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