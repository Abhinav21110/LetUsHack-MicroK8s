import { LegalBanner } from "@/components/LegalBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const menuItems = [
  {
    category: "Appetizers",
    items: [
      { name: "Caesar Salad", description: "Fresh romaine, parmesan, croutons", price: "$8.99" },
      { name: "Bruschetta", description: "Tomatoes, basil, garlic on toasted bread", price: "$7.99" },
      { name: "Buffalo Wings", description: "Spicy chicken wings with ranch", price: "$11.99" },
    ],
  },
  {
    category: "Main Courses",
    items: [
      { name: "Grilled Salmon", description: "Atlantic salmon with seasonal vegetables", price: "$22.99" },
      { name: "Ribeye Steak", description: "12oz ribeye with mashed potatoes", price: "$29.99" },
      { name: "Chicken Alfredo", description: "Fettuccine pasta in creamy alfredo sauce", price: "$16.99" },
      { name: "Vegetarian Lasagna", description: "Layers of pasta, cheese, and vegetables", price: "$14.99" },
    ],
  },
  {
    category: "Desserts",
    items: [
      { name: "Tiramisu", description: "Classic Italian coffee-flavored dessert", price: "$7.99" },
      { name: "Cheesecake", description: "New York style with berry compote", price: "$8.99" },
    ],
  },
];

const Menu = () => {
  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <LegalBanner />
      
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Our Menu</h1>
        <p className="text-muted-foreground">
          Explore our selection of professionally prepared dishes. (Static training data only)
        </p>
      </div>

      <div className="space-y-8">
        {menuItems.map((category) => (
          <div key={category.category}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              {category.category}
              <Badge variant="secondary" className="text-xs">
                {category.items.length} items
              </Badge>
            </h2>
            <div className="grid gap-4">
              {category.items.map((item) => (
                <Card key={item.name}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        <CardDescription>{item.description}</CardDescription>
                      </div>
                      <span className="text-lg font-bold text-primary">{item.price}</span>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Menu;
