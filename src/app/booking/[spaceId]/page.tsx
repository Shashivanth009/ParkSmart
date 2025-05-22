"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { PageTitle } from '@/components/core/PageTitle';
import { BookingForm } from '@/components/booking/BookingForm';
import type { ParkingSpace, ParkingFeature } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { MapPin, DollarSign, Users, Star, ShieldCheck, Zap, Car, Loader2 } from 'lucide-react';
import { featureIcons, featureLabels } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

// Mock data - replace with actual API call
const fetchSpaceDetails = async (spaceId: string): Promise<ParkingSpace | null> => {
  console.log("Fetching details for space:", spaceId);
  await new Promise(resolve => setTimeout(resolve, 1000));
  const mockSpaces: ParkingSpace[] = [
    { id: 'ps1', name: 'City Center Parking', address: '123 Main St, Anytown', availability: 'high', pricePerHour: 2.5, features: ['covered', 'ev-charging', 'cctv'], coordinates: { lat: 28.6139, lng: 77.2090 }, rating: 4.5, distance: '0.5 km', availableSpots: 50, totalSpots: 100, imageUrl: 'https://placehold.co/800x450.png' },
    { id: 'ps2', name: 'Downtown Garage', address: '456 Oak Ave, Anytown', availability: 'medium', pricePerHour: 3.0, features: ['cctv', 'secure'], coordinates: { lat: 28.6150, lng: 77.2100 }, rating: 4.2, distance: '1.2 km', availableSpots: 20, totalSpots: 80, imageUrl: 'https://placehold.co/800x450.png' },
    // Add other spaces from search page if needed for direct navigation
  ];
  return mockSpaces.find(s => s.id === spaceId) || null;
};

const FeatureDisplay = ({ feature }: { feature: ParkingFeature }) => {
  const Icon = featureIcons[feature] || Car;
  const label = featureLabels[feature] || feature.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
      <Icon className="w-5 h-5 text-primary icon-glow-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
};

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const spaceId = params.spaceId as string;

  const [space, setSpace] = useState<ParkingSpace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfilePreferences, setUserProfilePreferences] = useState<{defaultVehiclePlate?: string}>({});


  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      toast({ title: "Login Required", description: "Please log in to book a parking space.", variant: "destructive" });
      router.push(`/login?redirect=/booking/${spaceId}`);
      return;
    }

    if (spaceId) {
      fetchSpaceDetails(spaceId)
        .then(data => {
          setSpace(data);
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch space details:", err);
          setIsLoading(false);
          // Handle error, e.g., show a "not found" message
        });
    }
    
    // Simulate fetching user preferences (e.g., default vehicle plate)
    if(user) {
        // In a real app, fetch this from user's profile
        setUserProfilePreferences({ defaultVehiclePlate: 'XYZ 123' });
    }

  }, [spaceId, isAuthenticated, authLoading, router, user]);

  const handleBookingSubmit = (formData: any, totalCost: number, endTime: Date) => {
    console.log("Booking submitted:", { ...formData, spaceId, totalCost, endTime });
    // Simulate API call for booking
    toast({ title: "Booking Initiated", description: `Processing your booking for ${space?.name}. Total: $${totalCost.toFixed(2)}` });
    
    // Generate a mock booking ID
    const mockBookingId = `bk_${Date.now()}`;
    router.push(`/booking/confirmation/${mockBookingId}?spaceName=${encodeURIComponent(space?.name || '')}&address=${encodeURIComponent(space?.address || '')}&startTime=${encodeURIComponent(formData.date.toISOString())}&endTime=${encodeURIComponent(endTime.toISOString())}&cost=${totalCost}`);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 md:px-6 py-8 flex items-center justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 md:px-6 py-8 text-center">
          <PageTitle title="Parking Space Not Found" description="The requested parking space could not be found or is no longer available." />
          <Button onClick={() => router.push('/search')}>Back to Search</Button>
        </main>
        <Footer />
      </div>
    );
  }
  
  const availabilityColor = 
    space.availability === 'high' ? 'text-green-400' :
    space.availability === 'medium' ? 'text-yellow-400' :
    space.availability === 'low' ? 'text-orange-400' :
    'text-red-400';

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <PageTitle title={`Book Parking at ${space.name}`} />
        
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <Card className="shadow-xl overflow-hidden">
              {space.imageUrl && (
                <div className="relative w-full h-64 md:h-80">
                  <Image src={space.imageUrl} alt={space.name} layout="fill" objectFit="cover" data-ai-hint="parking garage entrance" priority/>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{space.name}</CardTitle>
                <CardDescription className="flex items-center text-base pt-1">
                  <MapPin className="w-5 h-5 mr-2 text-muted-foreground icon-glow" />
                  {space.address}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center"><DollarSign className="w-5 h-5 mr-2 text-primary icon-glow-primary" /> Price: <strong>${space.pricePerHour.toFixed(2)}/hr</strong></div>
                    <div className="flex items-center"><Users className="w-5 h-5 mr-2 text-primary icon-glow-primary" /> Capacity: <strong className={`ml-1 ${availabilityColor}`}>{space.availableSpots}/{space.totalSpots} free</strong></div>
                    {space.rating && <div className="flex items-center"><Star className="w-5 h-5 mr-2 text-yellow-400 icon-glow" /> Rating: <strong>{space.rating.toFixed(1)}/5</strong></div>}
                </div>
                 <h4 className="text-md font-semibold pt-2">Available Features:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {space.features.map(feature => <FeatureDisplay key={feature} feature={feature} />)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card className="shadow-xl sticky top-24"> {/* Sticky booking form */}
              <CardHeader>
                <CardTitle className="text-xl">Select Your Booking Details</CardTitle>
                <CardDescription>Choose your date, time, and duration.</CardDescription>
              </CardHeader>
              <CardContent>
                <BookingForm space={space} onSubmit={handleBookingSubmit} defaultVehiclePlate={userProfilePreferences.defaultVehiclePlate}/>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
