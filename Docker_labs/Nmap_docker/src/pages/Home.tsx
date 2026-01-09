import { LegalBanner } from "@/components/LegalBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UtensilsCrossed, Clock, Truck } from "lucide-react";

const Home = () => {
  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl">
      <LegalBanner />
      
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4 text-foreground">Welcome to FoodNow</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Your trusted partner for professional food delivery services. Fresh, fast, and reliable catering for businesses and events.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <Card>
          <CardHeader>
            <UtensilsCrossed className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Premium Quality</CardTitle>
            <CardDescription>
              Carefully curated menu items from top-rated restaurants and catering partners.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <Clock className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Fast Delivery</CardTitle>
            <CardDescription>
              Efficient delivery system ensuring your food arrives fresh and on time.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <Truck className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Professional Service</CardTitle>
            <CardDescription>
              Dedicated support team and reliable logistics for corporate catering needs.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl">About Our Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            FoodNow specializes in corporate food delivery and event catering. We partner with premium restaurants and culinary professionals to bring you exceptional dining experiences delivered right to your office or venue.
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Corporate lunch programs and office catering</li>
            <li>Special event and conference meal planning</li>
            <li>Flexible ordering and customizable menus</li>
            <li>Professional delivery and setup services</li>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-12 p-6 bg-muted rounded-lg">
        <h2 className="text-2xl font-bold mb-4">Why Choose FoodNow?</h2>
        <p className="text-muted-foreground mb-4">
          With years of experience in corporate food services, FoodNow understands the unique needs of businesses and organizations. Our streamlined ordering system, diverse menu options, and commitment to quality make us the preferred choice for professional catering solutions.
        </p>
        <p className="text-sm text-muted-foreground italic">
          Browse our menu and place your order today to experience the FoodNow difference.
        </p>
      </div>
    </div>
  );
};

export default Home;
