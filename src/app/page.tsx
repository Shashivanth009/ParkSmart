
"use client";

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import MapComponent from '@/components/map/MapComponent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, MapPin, CalendarCheck, Clock, Star, ShieldCheck, Zap, Car } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import type { ParkingSpace } from '@/types';

const mockFeaturedSpaces: ParkingSpace[] = [
  { id: 'ps1', name: 'Charminar Parking Plaza', address: 'Near Charminar, Hyderabad', availability: 'high', pricePerHour: 2.5, features: ['covered', 'ev-charging', 'cctv'], coordinates: { lat: 17.3616, lng: 78.4747 }, rating: 4.5, imageUrl: 'https://placehold.co/600x400.png', availableSpots: 50, totalSpots: 100, dataAiHint: "parking garage building" },
  { id: 'ps2', name: 'Hitech City Secure Park', address: 'Mindspace Circle, Hyderabad', availability: 'medium', pricePerHour: 3.0, features: ['cctv', 'secure'], coordinates: { lat: 17.4474, lng: 78.3762 }, rating: 4.2, imageUrl: 'https://placehold.co/600x400.png', availableSpots: 20, totalSpots: 80, dataAiHint: "parking garage building" },
  { id: 'ps3', name: 'Gachibowli Stadium Lot', address: 'Old Mumbai Hwy, Hyderabad', availability: 'low', pricePerHour: 1.8, features: ['covered', 'secure', 'well-lit'], coordinates: { lat: 17.4417, lng: 78.3498 }, rating: 4.0, imageUrl: 'https://placehold.co/600x400.png', availableSpots: 5, totalSpots: 150, dataAiHint: "parking garage building" },
];

const INITIAL_HOMEPAGE_MAP_CENTER = { lat: 17.3850, lng: 78.4867 }; // Hyderabad

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const heroSearchInputRef = useRef<HTMLInputElement>(null);
  const [mapCenter, setMapCenter] = useState(INITIAL_HOMEPAGE_MAP_CENTER);
  const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    let navUrl = '/search';
    const queryParams = new URLSearchParams();

    if (searchQuery.trim()) {
      queryParams.set('location', searchQuery.trim());
    }

    if (userInteractedWithMap) { // If user selected a specific place on the map
      queryParams.set('lat', mapCenter.lat.toString());
      queryParams.set('lng', mapCenter.lng.toString());
      queryParams.set('radius', '2'); // Default to 2km radius for map-initiated search from homepage
    }

    if (queryParams.toString()) {
      navUrl += `?${queryParams.toString()}`;
    }
    router.push(navUrl);
  };

  const handlePlaceSelected = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const newCenter = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      setMapCenter(newCenter);
      setUserInteractedWithMap(true);
      if (place.name) {
        setSearchQuery(place.name);
      } else if (place.formatted_address) {
        setSearchQuery(place.formatted_address);
      }
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 bg-gradient-to-br from-background to-primary/20">
          <div className="absolute inset-0 opacity-10">
          </div>
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
                  ref={heroSearchInputRef}
                  type="text"
                  placeholder="Enter location, e.g., 'Hitech City, Hyderabad'"
                  className="pl-10 pr-4 py-3 h-12 text-base w-full"
                  aria-label="Search for parking"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setUserInteractedWithMap(false); // Reset map interaction if user types manually
                  }}
                />
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto h-12 shrink-0">
                <Search className="mr-2 h-5 w-5" /> Find Parking
              </Button>
            </form>
          </div>
        </section>

        {/* Map Overview Section */}
        <section className="py-12 md:py-16 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-8 md:mb-12 text-foreground">
              Explore Parking Availability
            </h2>
            <MapComponent
              markers={mockFeaturedSpaces.map(s => ({ id: s.id, lat: s.coordinates.lat, lng: s.coordinates.lng, label: s.name }))}
              center={mapCenter}
              interactive={true}
              showMyLocationButton={true}
              className="rounded-xl shadow-2xl"
              onMarkerClick={(id) => router.push(`/booking/${id}`)}
              autocompleteInputRef={heroSearchInputRef}
              onPlaceSelected={handlePlaceSelected}
            />
            <div className="text-center mt-8">
              <Button size="lg" asChild>
                <Link href="/search">Explore All Parking Locations</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-12 md:py-16 bg-card/50">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-8 md:mb-12 text-foreground">How ParkSmart Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {[
                { icon: Search, title: "Search", description: "Enter your destination and find available parking spots generated by our AI." },
                { icon: CalendarCheck, title: "Book", description: "Select your preferred spot, choose your duration, and book instantly." },
                { icon: Car, title: "Park", description: "Navigate to your booked spot with in-app guidance and enjoy hassle-free parking." },
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

        {/* Features Section */}
        <section id="features" className="py-12 md:py-16 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-8 md:mb-12 text-foreground">Why Choose ParkSmart?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {[
                { icon: Clock, title: "AI-Powered Suggestions", description: "Get dynamically generated parking spot suggestions based on your query." },
                { icon: Star, title: "Favorite Locations", description: "Save your frequently visited parking spots for quick access." },
                { icon: ShieldCheck, title: "Secure Payments", description: "Multiple secure payment options with saved methods for convenience." },
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
          </div>
        </section>

        {/* Featured Parking Spaces Section */}
        <section className="py-12 md:py-16 bg-card/50">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-8 md:mb-12 text-foreground">Featured Parking Locations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {mockFeaturedSpaces.map(space => (
                <Card key={space.id} className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <Image
                    src={space.imageUrl!}
                    alt={space.name}
                    width={600}
                    height={400}
                    className="w-full h-48 object-cover"
                    data-ai-hint={space.dataAiHint || "parking garage building"} />
                  <CardHeader>
                    <CardTitle>{space.name}</CardTitle>
                    <CardDescription>{space.address}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center mb-2 text-sm">
                      <span className={`font-semibold ${space.availability === 'high' ? 'text-green-400' : space.availability === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}>
                        {space.availability.toUpperCase()}
                      </span>
                      <span className="text-lg font-bold text-primary">${space.pricePerHour.toFixed(2)}/hr</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{space.availableSpots} / {space.totalSpots} spots available</p>
                    <Button className="w-full mt-4" asChild>
                      <Link href={`/booking/${space.id}`}>Book Now</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}

    