import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Package, MapPin, Plus, Minus, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProductStore } from "@/store/useProductStore";
import { useStoreStore } from "@/store/useStoreStore";
import { useInventoryStore } from "@/store/useInventoryStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useUserStore } from "@/store/useUserStore";
import { useDarkModeStore } from "@/store/useDarkModeStore";
import { Product as ApiProduct, OrderCreate } from "@/api/types";

interface PlaceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OrderItem {
  product: ApiProduct;
  quantity: number;
  storeId?: number;
  availableStock: number;
}

interface StoreInventory {
  storeId: number;
  storeName: string;
  quantityCases: number;
  reservedCases: number;
  availableCases: number;
}

// Custom hook for debounced search
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Helper functions for formatting
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const PlaceOrderModal = ({ isOpen, onClose }: PlaceOrderModalProps) => {
  const [searchInput, setSearchInput] = useState("");
  const [selectedToStore, setSelectedToStore] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const { toast } = useToast();

  // Get dark mode state
  const { isDarkMode } = useDarkModeStore();

  // Debounce search input to avoid API exhaustion
  const debouncedSearchTerm = useDebounce(searchInput, 500);

  // Get data from stores
  const { products, fetchProducts, isLoading: isLoadingProducts, error: productError } = useProductStore();
  const { regionOptions, stores, storeOptions, fetchRegionOptions, fetchStores, fetchStoreOptions, isLoading: isLoadingStores } = useStoreStore();
  const { inventory, fetchWarehouseInventory } = useInventoryStore();
  const { createOrder, isCreatingOrder, fetchOrderStatusSummary, refreshOrders } = useOrderStore();
  const { currentUser, setCurrentUser, currentRegionalManager } = useUserStore();

  // Fetch initial data
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      fetchWarehouseInventory(); // Fetch initial warehouse inventory
      fetchStoreOptions(); // Fetch all available stores for delivery
    }
  }, [isOpen, fetchProducts, fetchWarehouseInventory, fetchStoreOptions]);

  // Initialize current user (separate useEffect to avoid race condition)
  useEffect(() => {
    if (isOpen && !currentUser) {
      setCurrentUser({
        user_id: 1,
        username: "store_manager",
        email: "manager@store.com",
        first_name: "Store",
        last_name: "Manager",
        role: "store_manager",
        store_id: 1,
        region: "Northeast",
        created_at: new Date()
      });
    }
  }, [isOpen, currentUser, setCurrentUser]);

  // Update warehouse inventory when debounced search term changes
  useEffect(() => {
    if (isOpen) {
      // Always fetch inventory when search changes (including when cleared)
      const searchFilter = debouncedSearchTerm ? { search: debouncedSearchTerm } : {};
      fetchWarehouseInventory(searchFilter);
    }
  }, [debouncedSearchTerm, fetchWarehouseInventory, isOpen]);

  // Get all products from warehouse inventory response (includes products with 0 stock)
  const availableProducts = inventory || [];

  // Get stock information for a product from warehouse
  const getProductStock = (productId: number) => {
    if (!inventory) return { available: 0, total: 0 };

    // Find the aggregated inventory item for this product
    const productInventory = inventory.find(item =>
      item.product_id === productId
    );

    if (!productInventory) return { available: 0, total: 0 };

    // Use aggregated values from the warehouse endpoint
    const availableStock = productInventory.available_cases || 0;
    const totalStock = productInventory.total_quantity_cases || 0;

    return { available: availableStock, total: totalStock };
  };

  const addToOrder = (inventoryItem: any, quantityToAdd: number = 1) => {
    // Convert inventory item to product format for compatibility
    const product: ApiProduct = {
      product_id: inventoryItem.product_id,
      product_name: inventoryItem.product_name,
      brand: inventoryItem.brand,
      category: inventoryItem.category,
      unit_price: inventoryItem.unit_price,
      package_size: inventoryItem.package_size,
      created_at: new Date()
    };

    const stock = getProductStock(product.product_id);
    const existingItem = orderItems.find(item =>
      item.product.product_id === product.product_id
    );

    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newTotalQuantity = currentQuantity + quantityToAdd;

    // Check 10,000 unit limit per product
    if (newTotalQuantity > 10000) {
      const maxCanAdd = 10000 - currentQuantity;
      toast({
        title: "Quantity limit exceeded",
        description: `Maximum 10,000 units per product. You already have ${currentQuantity} in cart, can add ${maxCanAdd} more.`,
        variant: "destructive"
      });
      return;
    }

    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item === existingItem
          ? { ...item, quantity: newTotalQuantity }
          : item
      ));
    } else {
      setOrderItems([...orderItems, {
        product,
        quantity: quantityToAdd,
        storeId: selectedToStore ? parseInt(selectedToStore) : undefined,
        availableStock: stock.available
      }]);
    }

    toast({
      title: "Added to cart",
      description: `${quantityToAdd} units of ${product.product_name} added to cart.`,
      variant: "default"
    });
  };

  const updateQuantity = (item: OrderItem, newQuantity: number) => {
    if (newQuantity <= 0) {
      setOrderItems(orderItems.filter(orderItem => orderItem !== item));
      return;
    }

    if (newQuantity > 10000) {
      toast({
        title: "Quantity limit exceeded",
        description: "Maximum 10,000 units per product.",
        variant: "destructive"
      });
      return;
    }

    setOrderItems(orderItems.map(orderItem =>
      orderItem === item
        ? { ...orderItem, quantity: newQuantity }
        : orderItem
    ));
  };

  const removeFromOrder = (item: OrderItem) => {
    setOrderItems(orderItems.filter(orderItem => orderItem !== item));
    toast({
      title: "Item removed",
      description: `${item.product.product_name} removed from cart.`,
      variant: "default"
    });
  };

  const getTotalValue = () => {
    return orderItems.reduce((total, item) =>
      total + (item.product.unit_price * item.quantity), 0
    );
  };

  const submitOrder = async () => {
    if (orderItems.length === 0) {
      toast({
        title: "No items in order",
        description: "Please add items to your order before submitting.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedToStore) {
      toast({
        title: "No delivery store selected",
        description: "Please select a target store for delivery.",
        variant: "destructive"
      });
      return;
    }

    if (!currentUser) {
      toast({
        title: "User not found",
        description: "Please refresh the page and try again.",
        variant: "destructive"
      });
      return;
    }

    try {
      // For now, create orders one by one (could be optimized to batch)
      for (const item of orderItems) {
        console.log('Creating order for item:', item);
        console.log('Current user:', currentUser);
        console.log('Current regional manager:', currentRegionalManager);

        // Ensure all numeric values are actually numbers
        const orderPayload = {
          fromStoreId: 1, // Always order from main warehouse (store ID 1)
          toStoreId: parseInt(selectedToStore),
          productId: Number(item.product.product_id),
          quantityCases: Number(item.quantity),
          requestedBy: Number(currentUser.user_id),
          approvedBy: currentRegionalManager?.user_id ? Number(currentRegionalManager.user_id) : 26,
          notes: `Order placed via dashboard for ${item.product.product_name} - Delivery to ${storeOptions.find(s => s.value === parseInt(selectedToStore))?.label || 'selected store'}`
        };

        console.log('Order payload being sent:', orderPayload);

        const result = await createOrder(orderPayload);

        if (!result) {
          throw new Error('Order creation returned false');
        }
      }

      const selectedStoreName = storeOptions.find(s => s.value === parseInt(selectedToStore))?.label || 'selected store';
      toast({
        title: "Orders submitted successfully!",
        description: `${orderItems.length} orders totaling ${formatCurrency(getTotalValue())} have been submitted for delivery to ${selectedStoreName}.`
      });

      // Refresh the analytics cards to show updated counts
      await fetchOrderStatusSummary();

      // Refresh the orders table to show the new orders immediately
      await refreshOrders();

      setOrderItems([]);
      setSearchInput("");
      setSelectedToStore("");
      onClose();
    } catch (error) {
      console.error('Order submission error:', error);
      let errorMessage = "Please try again later.";

      // Extract meaningful error message
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast({
        title: "Order submission failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const getStockLevel = (availableStock: number) => {
    if (availableStock <= 0) return { level: "Out of Stock", color: "bg-red-500" };
    if (availableStock < 1000) return { level: "Critical", color: "bg-red-500" };
    if (availableStock < 2500) return { level: "Low", color: "bg-yellow-500" };
    return { level: "Good", color: "bg-green-500" };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-7xl h-[95vh] flex flex-col ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''
        }`}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-3 text-2xl font-bold ${isDarkMode ? 'text-white' : ''
            }`}>
            <Package className="h-7 w-7" />
            Place New Order
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden">
          {/* Product Search and Selection */}
          <div className="lg:col-span-2 space-y-4 flex flex-col min-h-0">
            <div className="flex gap-4 flex-shrink-0">
              <div className="flex-1 px-1">
                <Label htmlFor="search" className={`mb-3 block ${isDarkMode ? 'text-gray-300' : ''
                  }`}>Search Products</Label>
                <div className="relative">
                  <Search className={`absolute left-3 top-3 h-4 w-4 z-10 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'
                    }`} />
                  <Input
                    id="search"
                    placeholder="Search by product name or SKU..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className={`pl-10 focus-visible:ring-offset-0 focus-visible:ring-2 ${isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus-visible:ring-blue-500 focus-visible:border-blue-500'
                      : ''
                      }`}
                  />
                </div>
              </div>
            </div>

            {/* Separator line */}
            <div className={`border-b flex-shrink-0 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}></div>

            {/* Product List */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full overflow-y-auto space-y-3 pr-2">
                {isLoadingProducts ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className={`h-6 w-6 animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-400'
                      }`} />
                    <span className={`ml-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>Loading products...</span>
                  </div>
                ) : availableProducts.length === 0 ? (
                  <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                    {searchInput ? "No products found matching your search" : "No products available"}
                  </div>
                ) : (
                  availableProducts.map((inventoryItem) => {
                    const stock = getProductStock(inventoryItem.product_id);
                    const stockInfo = getStockLevel(stock.available);

                    return (
                      <Card key={inventoryItem.product_id} className={`hover:shadow-md transition-shadow ${isDarkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-650' : ''
                        }`}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className={`font-semibold ${isDarkMode ? 'text-white' : ''
                                  }`}>{inventoryItem.product_name}</h3>
                                <Badge
                                  variant="outline"
                                  className={isDarkMode ? 'border-gray-500 text-white' : ''}
                                >
                                  #{inventoryItem.product_id}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className={isDarkMode ? 'bg-gray-700 border-blue-500 text-blue-400' : ''}
                                >
                                  {inventoryItem.category}
                                </Badge>
                              </div>
                              <div className={`flex items-center gap-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                <span className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  Warehouse Stock
                                </span>
                                <div className="flex items-center gap-1">
                                  <div className={`w-2 h-2 rounded-full ${stockInfo.color}`}></div>
                                  {stockInfo.level}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-semibold ${isDarkMode ? 'text-white' : ''
                                }`}>${inventoryItem.unit_price}</div>
                              <div className="flex items-center gap-2 mt-2">
                                <Input
                                  type="number"
                                  min="1"
                                  max="10000"
                                  defaultValue="1"
                                  className={`w-20 h-8 text-center ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : ''
                                    }`}
                                  id={`quantity-${inventoryItem.product_id}`}
                                  onKeyDown={(e) => {
                                    // Prevent negative signs, decimals, and 'e' (scientific notation)
                                    if (e.key === '-' || e.key === '.' || e.key === 'e' || e.key === 'E') {
                                      e.preventDefault();
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const quantityInput = document.getElementById(`quantity-${inventoryItem.product_id}`) as HTMLInputElement;
                                    const inputValue = parseInt(quantityInput.value) || 1;

                                    // Validate quantity range
                                    if (inputValue < 1) {
                                      toast({
                                        title: "Invalid quantity",
                                        description: "Quantity must be at least 1.",
                                        variant: "destructive"
                                      });
                                      quantityInput.value = "1";
                                      return;
                                    }

                                    if (inputValue > 10000) {
                                      toast({
                                        title: "Invalid quantity",
                                        description: "Maximum quantity per add is 10,000 units.",
                                        variant: "destructive"
                                      });
                                      quantityInput.value = "10000";
                                      return;
                                    }

                                    // Add the specified quantity at once
                                    addToOrder(inventoryItem, inputValue);

                                    // Reset input
                                    quantityInput.value = "1";
                                  }}
                                  className={`whitespace-nowrap ${isDarkMode
                                    ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white'
                                    : ''
                                    }`}
                                >
                                  Add to Cart
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="space-y-4 flex flex-col min-h-0">
            <Card className={`flex-1 flex flex-col min-h-0 ${isDarkMode ? 'bg-gray-700 border-gray-600' : ''
              }`}>
              <CardHeader className="flex-shrink-0">
                <CardTitle className={`text-lg ${isDarkMode ? 'text-white' : ''
                  }`}>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
                {/* Order Items */}
                {orderItems.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>No items in order</p>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <div className="h-full overflow-y-auto space-y-3 pr-2">
                        {orderItems.map((item, index) => (
                          <div key={`${item.product.product_id}-${index}`} className={`border-b pb-3 ${isDarkMode ? 'border-gray-600' : ''
                            }`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className={`font-medium text-sm ${isDarkMode ? 'text-white' : ''
                                  }`}>{item.product.product_name}</div>
                                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                  }`}>
                                  {item.product.brand} • {item.product.category}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeFromOrder(item)}
                                className={`h-6 w-6 p-0 text-red-500 hover:text-red-700 ${isDarkMode ? 'hover:bg-red-900/20' : 'hover:bg-red-50'
                                  }`}
                                title="Remove item"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateQuantity(item, item.quantity - 1)}
                                  className={`h-6 w-6 p-0 ${isDarkMode
                                    ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white'
                                    : ''
                                    }`}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className={`text-sm w-12 text-center ${isDarkMode ? 'text-white' : ''
                                  }`}>{formatNumber(item.quantity)}</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateQuantity(item, item.quantity + 1)}
                                  className={`h-6 w-6 p-0 ${isDarkMode
                                    ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white'
                                    : ''
                                    }`}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <span className={`font-medium text-sm ${isDarkMode ? 'text-white' : ''
                                }`}>
                                {formatCurrency(item.product.unit_price * item.quantity)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={`border-t pt-3 flex-shrink-0 ${isDarkMode ? 'border-gray-600' : ''
                      }`}>
                      <div className={`flex justify-between items-center font-semibold ${isDarkMode ? 'text-white' : ''
                        }`}>
                        <span>Total:</span>
                        <span>{formatCurrency(getTotalValue())}</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Store Selection - moved here, below total */}
                <div className="flex-shrink-0">
                  <Label htmlFor="target-store" className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : ''
                    }`}>
                    Delivery Store
                  </Label>
                  <Select value={selectedToStore} onValueChange={setSelectedToStore}>
                    <SelectTrigger className={`w-full mt-1 ${!selectedToStore && orderItems.length > 0
                      ? (isDarkMode ? 'border-orange-500 bg-orange-900/20 text-white' : 'border-orange-300 bg-orange-50')
                      : (isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : '')
                      }`}>
                      <SelectValue placeholder={isLoadingStores ? "Loading stores..." : "Select delivery store"} />
                    </SelectTrigger>
                    <SelectContent className={isDarkMode ? 'bg-gray-700 border-gray-600' : ''}>
                      {storeOptions.map((store) => (
                        <SelectItem
                          key={store.value}
                          value={store.value.toString()}
                          className={isDarkMode
                            ? 'text-white hover:bg-gray-600 focus:bg-gray-600 hover:text-white focus:text-white'
                            : ''}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{store.label}</span>
                            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>{store.region}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedToStore ? (
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                      <MapPin className="h-3 w-3 inline mr-1" />
                      Orders will be shipped from Main Warehouse to selected store
                    </p>
                  ) : orderItems.length > 0 ? (
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'
                      }`}>
                      Please select a delivery store to continue
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 flex-shrink-0">
                  <Button
                    onClick={submitOrder}
                    className={`w-full font-medium ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    disabled={orderItems.length === 0 || !selectedToStore || isCreatingOrder}
                  >
                    {isCreatingOrder ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Submitting Orders...
                      </>
                    ) : orderItems.length === 0 ? (
                      'Add items to continue'
                    ) : !selectedToStore ? (
                      'Select delivery store to submit'
                    ) : (
                      `Submit Order (${orderItems.length} items)`
                    )}
                  </Button>
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className={`w-full ${isDarkMode
                      ? 'bg-gray-700 border-blue-500 text-blue-400 hover:bg-gray-600 hover:text-white'
                      : ''
                      }`}
                    disabled={isCreatingOrder}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
