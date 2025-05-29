import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Package, MapPin, Plus, Minus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProductStore } from "@/store/useProductStore";
import { useStoreStore } from "@/store/useStoreStore";
import { useInventoryStore } from "@/store/useInventoryStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useUserStore } from "@/store/useUserStore";
import { Product as ApiProduct } from "@/api/types";

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

export const PlaceOrderModal = ({ isOpen, onClose }: PlaceOrderModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedToStore, setSelectedToStore] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const { toast } = useToast();

  // Get data from stores
  const { products, fetchProducts, isLoading: isLoadingProducts, error: productError } = useProductStore();
  const { regionOptions, stores, fetchRegionOptions, fetchStores, fetchStoreOptions } = useStoreStore();
  const { inventory, fetchInventory } = useInventoryStore();
  const { createOrder, isCreatingOrder } = useOrderStore();
  const { currentUser, setCurrentUser } = useUserStore();

  // Fetch initial data
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      fetchRegionOptions();
      fetchStores();
    }
  }, [isOpen, fetchProducts, fetchRegionOptions, fetchStores]);

  // Initialize current user (separate useEffect to avoid race condition)
  useEffect(() => {
    if (isOpen && !currentUser) {
      setCurrentUser({
        userId: 1,
        username: "store_manager",
        email: "manager@store.com",
        firstName: "Store",
        lastName: "Manager",
        role: "store_manager",
        storeId: 1,
        region: "Northeast",
        createdAt: new Date()
      });
    }
  }, [isOpen, currentUser, setCurrentUser]);

  // Set default region when region options are loaded
  useEffect(() => {
    if (regionOptions && regionOptions.length > 0 && !selectedRegion) {
      setSelectedRegion(regionOptions[0].value);
    }
  }, [regionOptions]); // Separate useEffect for setting default region

  // Fetch inventory when region changes
  useEffect(() => {
    if (selectedRegion) {
      // Fetch inventory for the selected region, or all regions if "all" is selected
      const regionFilter = selectedRegion === "all" ? undefined : selectedRegion;
      fetchInventory({ region: regionFilter });
    }
  }, [selectedRegion, fetchInventory]);

  // Filter products based on search term
  const filteredProducts = (products || []).filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get stock information for a product in the selected region
  const getProductStock = (productId: number) => {
    if (!inventory || !selectedRegion) return { available: 0, total: 0 };

    // Filter inventory items for this product
    const productInventory = inventory.filter(item =>
      item.product_id === productId
    );

    // Aggregate stock across all stores for this product
    const totalStock = productInventory.reduce((sum, item) => sum + item.quantity_cases, 0);
    const reservedStock = productInventory.reduce((sum, item) => sum + item.reserved_cases, 0);
    const availableStock = totalStock - reservedStock;

    return { available: availableStock, total: totalStock };
  };

  const addToOrder = (product: ApiProduct) => {
    const stock = getProductStock(product.product_id);
    const existingItem = orderItems.find(item =>
      item.product.product_id === product.product_id
    );

    if (stock.available <= 0) {
      toast({
        title: "Out of stock",
        description: "This product is not available in the selected region.",
        variant: "destructive"
      });
      return;
    }

    if (existingItem) {
      if (existingItem.quantity >= stock.available) {
        toast({
          title: "Insufficient stock",
          description: `Only ${stock.available} cases available.`,
          variant: "destructive"
        });
        return;
      }

      setOrderItems(orderItems.map(item =>
        item === existingItem
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems([...orderItems, {
        product,
        quantity: 1,
        storeId: selectedToStore ? parseInt(selectedToStore) : undefined,
        availableStock: stock.available
      }]);
    }
  };

  const updateQuantity = (item: OrderItem, newQuantity: number) => {
    if (newQuantity <= 0) {
      setOrderItems(orderItems.filter(orderItem => orderItem !== item));
    } else if (newQuantity > item.availableStock) {
      toast({
        title: "Insufficient stock",
        description: `Only ${item.availableStock} cases available.`,
        variant: "destructive"
      });
    } else {
      setOrderItems(orderItems.map(orderItem =>
        orderItem === item
          ? { ...orderItem, quantity: newQuantity }
          : orderItem
      ));
    }
  };

  const getTotalValue = () => {
    return orderItems.reduce((total, item) =>
      total + (item.product.unit_price * item.quantity), 0
    ).toFixed(2);
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
        await createOrder({
          from_store_id: null, // or currentUser.storeId if needed
          to_store_id: selectedToStore ? parseInt(selectedToStore) : currentUser.storeId || 1,
          product_id: item.product.product_id,
          quantity_cases: item.quantity,
          requested_by: currentUser.userId,
          notes: `Order placed via dashboard for ${item.product.product_name}`
        });
      }

      toast({
        title: "Orders submitted successfully!",
        description: `${orderItems.length} orders totaling $${getTotalValue()} have been submitted.`
      });

      setOrderItems([]);
      setSearchTerm("");
      onClose();
    } catch (error) {
      toast({
        title: "Order submission failed",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  const getStockLevel = (availableStock: number) => {
    if (availableStock <= 0) return { level: "Out of Stock", color: "bg-red-500" };
    if (availableStock < 10) return { level: "Critical", color: "bg-red-500" };
    if (availableStock < 50) return { level: "Low", color: "bg-yellow-500" };
    return { level: "Good", color: "bg-green-500" };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Place New Order
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Search and Selection */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Search Products</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search by product name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="region">Region</Label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regionOptions?.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {isLoadingProducts ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-600">Loading products...</span>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? "No products found matching your search" : "No products available"}
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const stock = getProductStock(product.product_id);
                  const stockInfo = getStockLevel(stock.available);

                  return (
                    <Card key={product.product_id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">{product.product_name}</h3>
                              <Badge variant="outline">#{product.product_id}</Badge>
                              <Badge variant="secondary">{product.category}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {regionOptions?.find(r => r.value === selectedRegion)?.label || selectedRegion}
                              </span>
                              <span>Available: {stock.available} cases</span>
                              <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${stockInfo.color}`}></div>
                                {stockInfo.level}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">${product.unit_price}</div>
                            <Button
                              size="sm"
                              onClick={() => addToOrder(product)}
                              className="mt-2"
                            >
                              Add to Order
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No items in order</p>
                ) : (
                  <>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {orderItems.map((item, index) => (
                        <div key={`${item.product.product_id}-${index}`} className="border-b pb-3">
                          <div className="font-medium text-sm">{item.product.product_name}</div>
                          <div className="text-xs text-gray-500 mb-2">
                            {item.product.brand} • {item.product.category}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item, item.quantity - 1)}
                                className="h-6 w-6 p-0"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-sm w-8 text-center">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item, item.quantity + 1)}
                                className="h-6 w-6 p-0"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <span className="font-medium text-sm">
                              ${(item.product.unit_price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center font-semibold">
                        <span>Total:</span>
                        <span>${getTotalValue()}</span>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Button
                    onClick={submitOrder}
                    className="w-full"
                    disabled={orderItems.length === 0}
                  >
                    Submit Order
                  </Button>
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="w-full"
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
