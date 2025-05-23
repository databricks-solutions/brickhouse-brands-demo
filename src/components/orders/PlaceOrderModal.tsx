
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Package, MapPin, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlaceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: number;
  inventory: {
    northeast: number;
    southeast: number;
    midwest: number;
    west: number;
  };
}

interface OrderItem {
  product: Product;
  quantity: number;
  region: string;
}

export const PlaceOrderModal = ({ isOpen, onClose }: PlaceOrderModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("northeast");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const { toast } = useToast();

  // Mock product data
  const products: Product[] = [
    {
      id: "1",
      name: "Premium Cola 12pk",
      sku: "PC12-001",
      category: "Beverages",
      unitPrice: 8.99,
      inventory: { northeast: 1250, southeast: 980, midwest: 1100, west: 850 }
    },
    {
      id: "2",
      name: "Organic Chips",
      sku: "OC-002",
      category: "Snacks",
      unitPrice: 4.49,
      inventory: { northeast: 925, southeast: 1200, midwest: 800, west: 1050 }
    },
    {
      id: "3",
      name: "Greek Yogurt",
      sku: "GY-003",
      category: "Dairy",
      unitPrice: 1.99,
      inventory: { northeast: 2100, southeast: 1800, midwest: 2200, west: 1950 }
    },
    {
      id: "4",
      name: "Frozen Pizza",
      sku: "FP-004",
      category: "Frozen",
      unitPrice: 6.99,
      inventory: { northeast: 450, southeast: 520, midwest: 380, west: 480 }
    },
    {
      id: "5",
      name: "Energy Drink",
      sku: "ED-005",
      category: "Beverages",
      unitPrice: 2.99,
      inventory: { northeast: 3200, southeast: 2800, midwest: 3100, west: 2900 }
    }
  ];

  const regions = [
    { value: "northeast", label: "Northeast Region" },
    { value: "southeast", label: "Southeast Region" },
    { value: "midwest", label: "Midwest Region" },
    { value: "west", label: "West Region" }
  ];

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToOrder = (product: Product) => {
    const existingItem = orderItems.find(item => 
      item.product.id === product.id && item.region === selectedRegion
    );

    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item === existingItem 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems([...orderItems, { product, quantity: 1, region: selectedRegion }]);
    }
  };

  const updateQuantity = (item: OrderItem, newQuantity: number) => {
    if (newQuantity <= 0) {
      setOrderItems(orderItems.filter(orderItem => orderItem !== item));
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
      total + (item.product.unitPrice * item.quantity), 0
    ).toFixed(2);
  };

  const submitOrder = () => {
    if (orderItems.length === 0) {
      toast({
        title: "No items in order",
        description: "Please add items to your order before submitting.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Order submitted successfully!",
      description: `Order for ${orderItems.length} items totaling $${getTotalValue()} has been submitted.`
    });

    setOrderItems([]);
    setSearchTerm("");
    onClose();
  };

  const getStockLevel = (product: Product, region: string) => {
    const stock = product.inventory[region as keyof typeof product.inventory];
    if (stock < 100) return { level: "Low", color: "bg-red-500" };
    if (stock < 500) return { level: "Medium", color: "bg-yellow-500" };
    return { level: "High", color: "bg-green-500" };
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
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
              {filteredProducts.map((product) => {
                const stockInfo = getStockLevel(product, selectedRegion);
                const currentStock = product.inventory[selectedRegion as keyof typeof product.inventory];
                
                return (
                  <Card key={product.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">{product.name}</h3>
                            <Badge variant="outline">{product.sku}</Badge>
                            <Badge variant="secondary">{product.category}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {regions.find(r => r.value === selectedRegion)?.label}
                            </span>
                            <span>Stock: {currentStock.toLocaleString()}</span>
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${stockInfo.color}`}></div>
                              {stockInfo.level}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${product.unitPrice}</div>
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
              })}
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
                        <div key={`${item.product.id}-${item.region}-${index}`} className="border-b pb-3">
                          <div className="font-medium text-sm">{item.product.name}</div>
                          <div className="text-xs text-gray-500 mb-2">
                            {regions.find(r => r.value === item.region)?.label}
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
                              ${(item.product.unitPrice * item.quantity).toFixed(2)}
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
