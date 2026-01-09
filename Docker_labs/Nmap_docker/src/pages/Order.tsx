import { LegalBanner } from "@/components/LegalBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

const Order = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    items: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Order Simulation",
      description: "This is a training environment. No real orders are processed.",
    });
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl">
      <LegalBanner />
      
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Place an Order</h1>
        <p className="text-muted-foreground">
          Order interface for training purposes only. No payment processing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
          <CardDescription>
            Fill out the form below to simulate an order placement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Delivery Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City, State 12345"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="items">Order Items</Label>
              <Textarea
                id="items"
                value={formData.items}
                onChange={(e) => setFormData({ ...formData, items: e.target.value })}
                placeholder="List the items you'd like to order..."
                required
              />
            </div>

            <Button type="submit" className="w-full">
              Submit Order (Simulation)
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Order;
