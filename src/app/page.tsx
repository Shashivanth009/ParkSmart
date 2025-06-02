
"use client";

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Search, MapPin, CalendarCheck, Clock, Star, ShieldCheck, Zap, Car, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image'; // Keep for other images if any, or remove if OpenLayersMap is the only "image" here
import { OpenLayersMap } from '@/components/map/OpenLayersMap'; // Import the map component
import type { ParkingSpace } from '@/types';
import { useAuth } from '@/hooks/useAuth';


export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAuthenticated && searchQuery.trim()) {
        router.push(`/login?redirect=${encodeURIComponent(`/search?location=${searchQuery}`)}`);
        return;
    }
    if (!isAuthenticated && !searchQuery.trim()) {
        router.push('/login');
        return;
    }

    let navUrl = '/search';
    const queryParams = new URLSearchParams();

    if (searchQuery.trim()) {
      queryParams.set('location', searchQuery.trim());
    }
    
    if (queryParams.toString()) {
      navUrl += `?${queryParams.toString()}`;
    }
    router.push(navUrl);
  };
  
  const handleHomePageMapClick = useCallback((coords: { lon: number, lat: number }) => {
    // For the homepage map, perhaps navigate to search page with these coords or a general location
    // For now, just focusing the search bar might be enough, or a toast message.
    console.log("Homepage map clicked at Lon:", coords.lon, "Lat:", coords.lat);
    const inputElement = document.querySelector('input[aria-label="Search for parking"]') as HTMLInputElement | null;
    if (inputElement) {
        inputElement.focus();
        // Optionally set search query based on reverse geocoded location if implemented
        // setSearchQuery(`Explore near ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`);
    }
  }, []);


  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <section className="relative py-20 md:py-32 bg-gradient-to-br from-background to-primary/20">
          <div className="container mx-auto px-4 md:px-6 text-center relative">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
              Smart Parking. Seamless Experience.
            </h1>
            <p className="mt-4 md:mt-6 max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground">
              Find, book, and pay for parking in just a few clicks. ParkSmart makes urban mobility easier.
            </p>
            <form
              onSubmit={handleSearchSubmit}
              className="mt-8 md:mt-10 max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-3 p-2 bg-card rounded-lg shadow-xl"
            >
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground icon-glow" />
                <Input
                  type="text"
                  placeholder="Enter location, e.g., 'Hitech City, Hyderabad'"
                  className="pl-10 pr-4 py-3 h-12 text-base w-full"
                  aria-label="Search for parking"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto h-12 shrink-0">
                <Search className="mr-2 h-5 w-5" /> Find Parking
              </Button>
            </form>
             {!isAuthenticated && (
                <p className="mt-4 text-sm text-accent">
                    <Link href={`/login?redirect=${encodeURIComponent(searchQuery ? `/search?location=${searchQuery}` : '/')}`} className="underline hover:text-accent/80">Log in</Link> or <Link href="/signup" className="underline hover:text-accent/80">Sign up</Link> to access all parking features.
                </p>
            )}
          </div>
        </section>

        <section className="py-12 md:py-16 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-8 md:mb-12 text-foreground">
              Explore Parking Areas
            </h2>
            <div className="aspect-[16/6] bg-muted/30 rounded-xl shadow-lg overflow-hidden relative">
                <OpenLayersMap 
                    centerCoordinates={[78.4867, 17.3850]} // Default to Hyderabad or a general overview
                    zoomLevel={11} // Slightly more zoomed out for an overview
                    onMapClick={handleHomePageMapClick}
                    className="w-full h-full"
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 bg-background/70 rounded-md text-xs text-muted-foreground backdrop-blur-sm">
                    Click on the map to explore or use the search above.
                </div>
            </div>
            <div className="text-center mt-8">
              <Button size="lg" onClick={() => document.querySelector('input[aria-label="Search for parking"]')?.focus()}>
                Search Locations
              </Button>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-12 md:py-16 bg-card/50">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-8 md:mb-12 text-foreground">How ParkSmart Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {[
                { icon: Search, title: "Search", description: "Enter your destination to find available parking spots." },
                { icon: CalendarCheck, title: "Book", description: "Select your preferred spot, choose your duration, and book instantly." },
                { icon: Car, title: "Park", description: "Navigate to your booked spot and enjoy hassle-free parking." },
              ].map((step, index) => (
                <Card key={index} className="text-center transform hover:scale-105 transition-transform duration-300 shadow-lg hover:shadow-xl">
                  <CardHeader>
                    <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                      <step.icon className="h-10 w-10 text-primary icon-glow-primary" />
                    </div>
                    <CardTitle className="text-xl font-semibold">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="py-12 md:py-16 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-8 md:mb-12 text-foreground">Why Choose ParkSmart?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {[
                { icon: Clock, title: "AI-Powered Suggestions", description: "Dynamically generated parking options based on your query." },
                { icon: Star, title: "Favorite Locations", description: "Save your frequently visited parking spots for quick access." },
                { icon: ShieldCheck, title: "Secure Payments", description: "Multiple secure payment options with saved methods." },
                { icon: Zap, title: "EV Charging Spots", description: "Easily find and book parking spots with EV charging facilities." },
                { icon: MapPin, title: "In-App Navigation", description: "Get guided directions straight to your reserved parking bay." },
                { icon: CalendarCheck, title: "Extend Parking Time", description: "Remotely extend your parking session if you need more time." },
              ].map((feature, index) => (
                <Card key={index} className="shadow-md hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <feature.icon className="h-8 w-8 text-accent icon-glow" />
                    <CardTitle className="text-lg font-semibold">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
             <div className="text-center mt-8">
                 <Button size="lg" asChild>
                    <Link href="/features">Explore All Features</Link>
                </Button>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
