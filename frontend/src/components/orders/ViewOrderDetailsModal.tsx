import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Package,
  Store,
  User,
  Calendar,
  FileText,
  Hash,
  Building2,
  ShoppingCart,
  Loader2,
  AlertTriangle,
  Edit3,
  X,
  Save,
  Ban,
  Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrderStore } from "@/store/useOrderStore";
import { useUserStore } from "@/store/useUserStore";
import { useProductStore } from "@/store/useProductStore";
import { useDarkModeStore } from "@/store/useDarkModeStore";
import { Order, Product } from "@/api/types";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  getMaxOrderQuantity,
  getOrderExpiryDays,
  formatDate,
  formatCurrency
} from "@/lib/config";
import { useCurrentDate } from "@/utils/dateUtils";

interface ViewOrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

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

// Helper function to calculate days since order creation (for display only)
const getDaysExpired = (orderDate: string | Date, currentDate: Date) => {
  const orderDateTime = typeof orderDate === 'string' ? new Date(orderDate) : orderDate;
  const diffTime = currentDate.getTime() - orderDateTime.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24); // Don't floor this
  return diffDays;
};

export const ViewOrderDetailsModal = ({ isOpen, onClose, order }: ViewOrderDetailsModalProps) => {
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const { toast } = useToast();
  const { isUpdatingOrder, updateOrder, cancelOrder, refreshOrders } = useOrderStore();
  const { currentRegionalManager, initializeCurrentRegionalManager, isLoadingRegionalManager } = useUserStore();
  const { currentProduct, isLoadingCurrentProduct, fetchProductById, getProductFromCache } = useProductStore();
  const { isDarkMode } = useDarkModeStore();
  const currentDate = useCurrentDate();

  // Fetch product details when order changes - check cache first for instant access
  useEffect(() => {
    if (isOpen && order?.product_id) {
      console.log('Loading product details for product_id:', order.product_id);

      // First check cache for instant access
      const cachedProduct = getProductFromCache(order.product_id);
      if (cachedProduct) {
        console.log('✅ Product found in cache (instant access):', cachedProduct.product_name);
        // fetchProductById will handle setting currentProduct from cache
        fetchProductById(order.product_id);
      } else {
        console.log('⏳ Product not in cache, fetching from API');
        fetchProductById(order.product_id);
      }
    }
  }, [isOpen, order?.product_id, fetchProductById, getProductFromCache]);

  // Debug log when currentProduct changes
  useEffect(() => {
    if (currentProduct) {
      console.log('📦 Current product updated:', currentProduct.product_name, '- Price:', currentProduct.unit_price);
    }
    console.log('Is loading current product:', isLoadingCurrentProduct);
  }, [currentProduct, isLoadingCurrentProduct]);

  // Initialize form values when order changes
  useEffect(() => {
    if (order) {
      setQuantity(order.quantity_cases);
      setNotes(order.notes || '');
      setIsEditing(false);
      setShowCancelModal(false);
      setCancellationReason('');
    }
  }, [order]);

  // Fetch regional manager when modal opens
  useEffect(() => {
    if (isOpen && !currentRegionalManager) {
      initializeCurrentRegionalManager();
    }
  }, [isOpen, currentRegionalManager, initializeCurrentRegionalManager]);

  // Determine if the order can be modified
  const canModify = order && (order.order_status === 'pending_review' || order.order_status === 'approved');
  const isViewOnly = !canModify;

  // Determine modal title based on mode
  const getModalTitle = () => {
    if (!order) return "Order Details";

    if (isViewOnly) {
      return `View Order ${order.order_number}`;
    } else {
      return `Modify Order ${order.order_number}`;
    }
  };

  const handleModifyOrder = async () => {
    if (!order || !canModify) return;

    // Validate quantity
    if (quantity <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Quantity must be greater than 0.",
        variant: "destructive"
      });
      return;
    }

    const maxQuantity = getMaxOrderQuantity();
    if (quantity > maxQuantity) {
      toast({
        title: "Invalid quantity",
        description: `Maximum quantity is ${maxQuantity.toLocaleString()} cases.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const success = await updateOrder(order.order_id, {
        quantity_cases: quantity,
        notes: notes.trim()
      });

      if (success) {
        toast({
          title: "Order updated",
          description: `Order ${order.order_number} has been successfully updated.`,
          variant: "default"
        });

        setIsEditing(false);

        // Refresh orders list
        await refreshOrders();

        // Close the modal after successful update
        onClose();
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update the order. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCancelOrder = async () => {
    if (!order || !cancellationReason.trim()) {
      toast({
        title: "Cancellation reason required",
        description: "Please provide a reason for cancelling this order.",
        variant: "destructive"
      });
      return;
    }

    try {
      const success = await cancelOrder(order.order_id, cancellationReason.trim());

      if (success) {
        toast({
          title: "Order cancelled",
          description: `Order ${order.order_number} has been cancelled.`,
          variant: "default"
        });

        setShowCancelModal(false);
        onClose();

        // Refresh orders list
        await refreshOrders();
      }
    } catch (error) {
      toast({
        title: "Cancellation failed",
        description: "Failed to cancel the order. Please try again.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    if (order) {
      setQuantity(order.quantity_cases);
      setNotes(order.notes || '');
    }
    setIsEditing(false);
  };

  const hasChanges = order && (
    quantity !== order.quantity_cases ||
    notes.trim() !== (order.notes || '').trim()
  );

  if (!order) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''
          }`}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-3 text-2xl font-bold ${isDarkMode ? 'text-white' : ''
              }`}>
              {isViewOnly ? <Eye className="h-6 w-6" /> : <Edit3 className="h-6 w-6" />}
              {getModalTitle()}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Order Status Banner */}
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={getStatusBadgeVariant(order.order_status)} className="text-sm flex-shrink-0">
                    {order.order_status === 'pending_review' && getDaysExpired(order.order_date, currentDate) > getOrderExpiryDays() && (
                      <AlertTriangle className={`h-3 w-3 mr-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                    )}
                    {getStatusText(order.order_status)}
                  </Badge>
                  {order.order_status === 'pending_review' && getDaysExpired(order.order_date, currentDate) > getOrderExpiryDays() && (
                    <span className={`text-xs whitespace-nowrap flex-shrink-0 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                      {Math.max(0, Math.ceil(getDaysExpired(order.order_date, currentDate) - getOrderExpiryDays()))} days overdue
                    </span>
                  )}
                  <span className={`text-sm whitespace-nowrap flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                    Version {order.version}
                  </span>
                  {isViewOnly && (
                    <Alert className={`inline-flex items-center py-1 px-2 whitespace-nowrap flex-1 ml-2 ${isDarkMode
                      ? 'border-blue-700 bg-blue-900/20'
                      : 'border-blue-200 bg-blue-50'
                      }`}>
                      <AlertDescription className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-700'
                        }`}>
                        This order is in view-only mode
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                {!canModify && !isViewOnly && (
                  <Alert className={`inline-flex items-center py-2 px-3 ${isDarkMode
                    ? 'border-orange-700 bg-orange-900/20'
                    : 'border-orange-200 bg-orange-50'
                    }`}>
                    <AlertTriangle className={`h-4 w-4 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'
                      }`} />
                    <AlertDescription className={`ml-2 text-sm ${isDarkMode ? 'text-orange-300' : 'text-orange-700'
                      }`}>
                      Only pending and approved orders can be modified
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* Order Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Order Details */}
              <Card className={isDarkMode ? 'bg-gray-700 border-gray-600' : ''}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 text-lg ${isDarkMode ? 'text-white' : ''
                    }`}>
                    <Package className="h-6 w-6" />
                    Order Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Hash className={`h-8 w-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`} />
                      <div>
                        <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>Order Number</div>
                        <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                          {order.order_number}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className={`h-8 w-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`} />
                      <div>
                        <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>Order Date</div>
                        <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                          {formatDate(order.order_date)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <UserAvatar
                        avatarUrl={order.requester_avatar_url}
                        firstName={order.requester_name?.split(' ')[0]}
                        lastName={order.requester_name?.split(' ')[1]}
                        size="md"
                      />
                      <div>
                        <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>Requested By</div>
                        <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                          {order.requester_name}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {order.approved_by && order.approver_name ? (
                        <>
                          <UserAvatar
                            firstName={order.approver_name.split(' ')[0] || ''}
                            lastName={order.approver_name.split(' ')[1] || ''}
                            avatarUrl={order.approver_avatar_url}
                            size="md"
                          />
                          <div>
                            <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                              {order.order_status === 'approved' ? 'Approved By' : 'Assigned Approver'}
                            </div>
                            <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {order.approver_name}
                            </div>
                          </div>
                        </>
                      ) : order.order_status === 'pending_review' ? (
                        <>
                          <UserAvatar
                            firstName=""
                            lastName=""
                            avatarUrl=""
                            size="md"
                          />
                          <div>
                            <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>Assigned Approver</div>
                            <div className={`italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>Unassigned</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <UserAvatar
                            firstName=""
                            lastName=""
                            avatarUrl=""
                            size="md"
                          />
                          <div>
                            <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>Approver</div>
                            <div className={`italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>Not Required</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Total Order Value - Full Width Row */}
                  <div className={`pt-4 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>Total Order Value</div>
                      <div className={`text-lg font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'
                        }`}>
                        {isLoadingCurrentProduct ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Loading...</span>
                          </div>
                        ) : currentProduct?.unit_price ? (
                          formatCurrency(order.quantity_cases * currentProduct.unit_price)
                        ) : (
                          'Price not available'
                        )}
                      </div>
                    </div>
                    <div className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                      {isLoadingCurrentProduct ? (
                        `${order.quantity_cases.toLocaleString()} cases`
                      ) : currentProduct?.unit_price ? (
                        `${order.quantity_cases.toLocaleString()} cases × ${formatCurrency(currentProduct.unit_price)} per case`
                      ) : (
                        `${order.quantity_cases.toLocaleString()} cases`
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Right Column - Product & Store Info */}
              <Card className={isDarkMode ? 'bg-gray-700 border-gray-600' : ''}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 text-lg ${isDarkMode ? 'text-white' : ''
                    }`}>
                    <ShoppingCart className="h-6 w-6" />
                    Product & Delivery
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className={`font-medium mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>{order.product_name}</div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>{order.brand} • {order.category}</div>
                    <div className={`text-sm mt-1 font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      }`}>
                      {isLoadingCurrentProduct ? (
                        <div className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-xs">Loading price...</span>
                        </div>
                      ) : currentProduct?.unit_price ? (
                        formatCurrency(currentProduct.unit_price) + ' per case'
                      ) : (
                        'Price not available'
                      )}
                    </div>
                  </div>

                  <div className={`border-t pt-4 ${isDarkMode ? 'border-gray-600' : ''
                    }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Store className={`h-8 w-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`} />
                      <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>Delivery Store</span>
                    </div>
                    <div>
                      <div className={`font-medium ${isDarkMode ? 'text-white' : ''
                        }`}>{order.to_store_name}</div>
                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>{order.to_store_region}</div>
                    </div>
                  </div>

                  {order.from_store_name && (
                    <div className={`border-t pt-4 ${isDarkMode ? 'border-gray-600' : ''
                      }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className={`h-8 w-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
                          }`} />
                        <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>Source Store</span>
                      </div>
                      <div className={`font-medium ${isDarkMode ? 'text-white' : ''
                        }`}>{order.from_store_name}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Editable/View Fields */}
            <Card className={isDarkMode ? 'bg-gray-700 border-gray-600' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className={`flex items-center gap-2 text-lg ${isDarkMode ? 'text-white' : ''
                    }`}>
                    {isViewOnly ? <Eye className="h-6 w-6" /> : <Edit3 className="h-6 w-6" />}
                    {isViewOnly ? 'Order Information' : 'Order Modifications'}
                  </span>
                  {canModify && !isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className={isDarkMode
                        ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white'
                        : ''}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit Order
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quantity Field */}
                <div>
                  <Label htmlFor="quantity" className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : ''
                    }`}>
                    Quantity (Cases)
                  </Label>
                  <div className="mt-1">
                    {isEditing && canModify ? (
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max={getMaxOrderQuantity()}
                        value={quantity === 0 ? '' : quantity}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            setQuantity(0);
                          } else {
                            const numValue = parseInt(value);
                            if (!isNaN(numValue) && numValue >= 0) {
                              setQuantity(numValue);
                            }
                          }
                        }}
                        className={`w-full ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : ''
                          }`}
                        onKeyDown={(e) => {
                          if (e.key === '-' || e.key === '.' || e.key === 'e' || e.key === 'E') {
                            e.preventDefault();
                          }
                        }}
                      />
                    ) : (
                      <div className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                        {order.quantity_cases.toLocaleString()} cases
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes Field */}
                <div>
                  <Label htmlFor="notes" className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : ''
                    }`}>
                    Order Notes
                  </Label>
                  <div className="mt-1">
                    {isEditing && canModify ? (
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className={`w-full ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' : ''
                          }`}
                        rows={3}
                        placeholder="Add any special instructions or notes for this order..."
                      />
                    ) : (
                      <div className={`min-h-[60px] p-3 rounded-md ${isDarkMode ? 'bg-gray-600 text-white' : 'bg-gray-50 text-gray-900'
                        }`}>
                        {order.notes || (
                          <span className={`italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>No notes provided</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons - Only show when editing */}
                {isEditing && canModify && (
                  <div className={`flex items-center gap-3 pt-4 border-t ${isDarkMode ? 'border-gray-600' : ''
                    }`}>
                    <Button
                      onClick={handleModifyOrder}
                      disabled={isUpdatingOrder || !hasChanges}
                      className={isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}
                    >
                      {isUpdatingOrder ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetForm}
                      disabled={isUpdatingOrder}
                      className={isDarkMode
                        ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white'
                        : ''}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className={`flex items-center justify-between pt-4 border-t ${isDarkMode ? 'border-gray-700' : ''
              }`}>
              <div>
                {canModify && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowCancelModal(true)}
                    disabled={isUpdatingOrder}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Cancel Order
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isUpdatingOrder}
                className={isDarkMode
                  ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white'
                  : ''}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Confirmation Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className={`max-w-md ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''
          }`}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 text-xl text-red-600 ${isDarkMode ? 'text-red-400' : ''
              }`}>
              <Ban className="h-5 w-5" />
              Cancel Order
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className={isDarkMode
              ? 'border-red-700 bg-red-900/20'
              : 'border-red-200 bg-red-50'
            }>
              <AlertTriangle className={`h-4 w-4 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                }`} />
              <AlertDescription className={isDarkMode ? 'text-red-300' : 'text-red-700'}>
                This will cancel order {order?.order_number}. This action cannot be undone.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="cancellation-reason" className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : ''
                }`}>
                Reason for cancellation *
              </Label>
              <Textarea
                id="cancellation-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className={`w-full mt-1 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : ''
                  }`}
                rows={3}
                placeholder="Please provide a reason for cancelling this order..."
                required
              />
            </div>

            <div className={`flex items-center gap-3 pt-4 border-t ${isDarkMode ? 'border-gray-700' : ''
              }`}>
              <Button
                variant="destructive"
                onClick={handleCancelOrder}
                disabled={isUpdatingOrder || !cancellationReason.trim()}
              >
                {isUpdatingOrder ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Confirm Cancellation
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancellationReason('');
                }}
                disabled={isUpdatingOrder}
                className={isDarkMode
                  ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white'
                  : ''}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}; 