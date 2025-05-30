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
  Ban
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrderStore } from "@/store/useOrderStore";
import { Order } from "@/api/types";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface ModifyOrderModalProps {
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

const formatDate = (date: string | Date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const ModifyOrderModal = ({ isOpen, onClose, order }: ModifyOrderModalProps) => {
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const { toast } = useToast();
  const { isUpdatingOrder, updateOrder, cancelOrder, refreshOrders } = useOrderStore();

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

  const canModify = order && (order.order_status === 'pending_review' || order.order_status === 'approved');

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

    if (quantity > 10000) {
      toast({
        title: "Invalid quantity",
        description: "Maximum quantity is 10,000 cases.",
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
          description: `Order #${order.order_number} has been successfully updated.`,
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
          description: `Order #${order.order_number} has been cancelled.`,
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
              <Edit3 className="h-6 w-6" />
              Modify Order #{order.order_number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Order Status Banner */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Badge variant={getStatusBadgeVariant(order.order_status)} className="text-sm">
                  {getStatusText(order.order_status)}
                </Badge>
                <span className="text-sm text-gray-600">
                  Version {order.version}
                </span>
              </div>
              {!canModify && (
                <Alert className="inline-flex items-center py-2 px-3 border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-700 ml-2 text-sm">
                    Only pending and approved orders can be modified
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Order Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Order Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5" />
                    Order Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">Order Number</div>
                        <div className="text-gray-600">#{order.order_number}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">Order Date</div>
                        <div className="text-gray-600">{formatDate(order.order_date)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <UserAvatar
                        avatarUrl={order.requester_avatar_url}
                        firstName={order.requester_name?.split(' ')[0]}
                        lastName={order.requester_name?.split(' ')[1]}
                        size="sm"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Requested By</div>
                        <div className="text-gray-600">{order.requester_name}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {order.approved_by && order.approver_name ? (
                        <>
                          <UserAvatar
                            avatarUrl={order.approver_avatar_url}
                            firstName={order.approver_name?.split(' ')[0]}
                            lastName={order.approver_name?.split(' ')[1]}
                            size="sm"
                          />
                          <div>
                            <div className="font-medium text-gray-900">
                              {order.order_status === 'approved' ? 'Approved By' : 'Assigned Approver'}
                            </div>
                            <div className="text-gray-600">{order.approver_name}</div>
                            {order.approved_date && (
                              <div className="text-xs text-gray-500">{formatDate(order.approved_date)}</div>
                            )}
                          </div>
                        </>
                      ) : order.order_status === 'pending_review' && !order.approved_by ? (
                        <>
                          <User className="h-4 w-4 text-orange-400" />
                          <div>
                            <div className="font-medium text-gray-900">Approver</div>
                            <div className="text-orange-600 italic">Pending</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-gray-900">Approved By</div>
                            <div className="text-gray-500 italic">Unassigned</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Right Column - Product & Store Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShoppingCart className="h-5 w-5" />
                    Product & Delivery
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="font-medium text-gray-900 mb-1">{order.product_name}</div>
                    <div className="text-sm text-gray-600">{order.brand} • {order.category}</div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">Delivery Store</span>
                    </div>
                    <div>
                      <div className="font-medium">{order.to_store_name}</div>
                      <div className="text-sm text-gray-600">{order.to_store_region}</div>
                    </div>
                  </div>

                  {order.from_store_name && (
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">Source Store</span>
                      </div>
                      <div className="font-medium">{order.from_store_name}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Editable Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-lg">
                    <Edit3 className="h-5 w-5" />
                    Order Modifications
                  </span>
                  {canModify && !isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
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
                  <Label htmlFor="quantity" className="text-sm font-medium">
                    Quantity (Cases)
                  </Label>
                  <div className="mt-1">
                    {isEditing ? (
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max="10000"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                        className="w-full"
                        onKeyDown={(e) => {
                          if (e.key === '-' || e.key === '.' || e.key === 'e' || e.key === 'E') {
                            e.preventDefault();
                          }
                        }}
                      />
                    ) : (
                      <div className="text-lg font-semibold text-gray-900">
                        {order.quantity_cases.toLocaleString()} cases
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes Field */}
                <div>
                  <Label htmlFor="notes" className="text-sm font-medium">
                    Order Notes
                  </Label>
                  <div className="mt-1">
                    {isEditing ? (
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full"
                        rows={3}
                        placeholder="Add any special instructions or notes for this order..."
                      />
                    ) : (
                      <div className="min-h-[60px] p-3 bg-gray-50 rounded-md text-gray-900">
                        {order.notes || (
                          <span className="text-gray-500 italic">No notes provided</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons - Only show when editing */}
                {isEditing && (
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <Button
                      onClick={handleModifyOrder}
                      disabled={isUpdatingOrder || !hasChanges}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
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
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
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
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Confirmation Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-red-600">
              <Ban className="h-5 w-5" />
              Cancel Order
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                This will cancel order #{order?.order_number}. This action cannot be undone.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="cancellation-reason" className="text-sm font-medium">
                Reason for cancellation *
              </Label>
              <Textarea
                id="cancellation-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full mt-1"
                rows={3}
                placeholder="Please provide a reason for cancelling this order..."
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
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