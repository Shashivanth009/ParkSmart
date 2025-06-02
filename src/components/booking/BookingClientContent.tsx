
"use client";
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Removed useParams as spaceId is now a prop
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { PageTitle } from '@/components/core/PageTitle';
import { BookingForm } from '@/components/booking/BookingForm';
import type { ParkingSpace, ParkingFeature } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { MapPin, DollarSign, Users, Star, Car as CarIconLucide, Loader2 } from 'lucide-react'; // Renamed Car to avoid conflict
import { featureIcons, featureLabels } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

// Mock data needed for fetchSpaceDetails within this client component
const mockSpacesData: ParkingSpace[] = [
    { id: 'ps1', facilityName: 'City Center Parking', facilityAddress: '123 Main St, Anytown', availability: 'high', pricePerHour: 2.5, features: ['covered', 'ev-charging', 'cctv'], facilityCoordinates: { lat: 28.6139, lng: 77.2090 }, facilityRating: 4.5, availableSpots: 50, totalSpots: 100, imageUrl: 'https://placehold.co/800x450.png', slotLabel: 'N/A', floorLevel: 'N/A', isOccupied: false, slotType: 'standard', dataAiHint: "parking garage entrance"},
    { id: 'ps2', facilityName: 'Downtown Garage', facilityAddress: '456 Oak Ave, Anytown', availability: 'medium', pricePerHour: 3.0, features: ['cctv', 'secure'], facilityCoordinates: { lat: 28.6150, lng: 77.2100 }, facilityRating: 4.2, availableSpots: 20, totalSpots: 80, imageUrl: 'https://placehold.co/800x450.png', slotLabel: 'N/A', floorLevel: 'N/A', isOccupied: false, slotType: 'standard', dataAiHint: "modern parking structure" },
];

// fetchSpaceDetails remains here as it's used by client-side logic
const fetchSpaceDetails = async (spaceId: string): Promise<ParkingSpace | null> => {
  console.log("Fetching details for space:", spaceId);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockSpacesData.find(s => s.id === spaceId) || null;
};

const FeatureDisplay = ({ feature }: { feature: ParkingFeature }) => {
  const Icon = featureIcons[feature] || CarIconLucide;
  const label = featureLabels[feature] || feature.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
      <Icon className="w-5 h-5 text-primary icon-glow-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
};

interface BookingClientContentProps {
  spaceIdFromParams: string;
}

export function BookingClientContent({ spaceIdFromParams }: BookingClientContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const spaceId = spaceIdFromParams; 

  const [space, setSpace] = useState<ParkingSpace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userDefaultVehiclePlate, setUserDefaultVehiclePlate] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({ title: "Login Required", description: "Please log in to book a parking space.", variant: "destructive" });
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isAuthenticated && spaceId) { 
      setIsLoading(true);
      fetchSpaceDetails(spaceId)
        .then(data => {
          setSpace(data);
        })
        .catch(err => {
          console.error("Failed to fetch space details:", err);
          toast({title: "Error", description: "Could not load parking space details.", variant: "destructive"});
        }).finally(() => {
            setIsLoading(false);
        });
    } else if (!spaceId) { 
        setIsLoading(false);
        toast({title: "Invalid Space", description: "No parking space ID provided.", variant: "destructive"});
        router.push('/search');
    }
    
    if(user && user.profile?.preferences) {
        setUserDefaultVehiclePlate(user.profile.preferences.defaultVehiclePlate);
    }

  }, [spaceId, isAuthenticated, authLoading, router, user, pathname]);

  const handleBookingSubmit = (formData: any, totalCost: number, endTime: Date) => {
    if (!space) {
        toast({title: "Booking Error", description: "Parking space details are missing.", variant: "destructive"});
        return;
    }
    console.log("Booking form submitted, proceeding to payment:", { ...formData, spaceId, totalCost, endTime });
    toast({ title: "Proceeding to Payment", description: `Review your booking for ${space.facilityName}. Total: $${totalCost.toFixed(2)}` });
    
    const mockBookingId = `bk_${Date.now()}`; // This is a temporary mock ID
    
    // Construct query parameters for the payment page
    const paymentQueryParams = new URLSearchParams();
    paymentQueryParams.set('facilityName', space.facilityName);
    paymentQueryParams.set('facilityAddress', space.facilityAddress);
    paymentQueryParams.set('startTime', formData.date.toISOString()); 
    paymentQueryParams.set('endTime', endTime.toISOString());
    paymentQueryParams.set('cost', totalCost.toString());
    if (formData.vehiclePlate) {
      paymentQueryParams.set('vehiclePlate', formData.vehiclePlate);
    }
    
    router.push(`/booking/payment/${mockBookingId}?${paymentQueryParams.toString()}`);
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

  if (!isAuthenticated) { 
     return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 md:px-6 py-8 flex items-center justify-center">
          <p>Redirecting to login...</p> <Loader2 className="ml-2 h-5 w-5 animate-spin text-primary" />
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
        <PageTitle title={`Book Parking at ${space.facilityName}`} />
        
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <Card className="shadow-xl overflow-hidden">
              {space.imageUrl && (
                <div className="relative w-full h-64 md:h-80">
                  <Image src={space.imageUrl} alt={space.facilityName || "Parking space image"} fill={true} className="object-cover" data-ai-hint={space.dataAiHint || "parking garage entrance"} priority/>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{space.facilityName}</CardTitle>
                <CardDescription className="flex items-center text-base pt-1">
                  <MapPin className="w-5 h-5 mr-2 text-muted-foreground icon-glow" />
                  {space.facilityAddress}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    {space.pricePerHour !== undefined && <div className="flex items-center"><DollarSign className="w-5 h-5 mr-2 text-primary icon-glow-primary" /> Price: <strong>${space.pricePerHour.toFixed(2)}/hr</strong></div>}
                    {space.availableSpots !== undefined && space.totalSpots !== undefined && <div className="flex items-center"><Users className="w-5 h-5 mr-2 text-primary icon-glow-primary" /> Capacity: <strong className={`ml-1 ${availabilityColor}`}>{space.availableSpots}/{space.totalSpots} free</strong></div>}
                    {space.facilityRating && <div className="flex items-center"><Star className="w-5 h-5 mr-2 text-yellow-400 icon-glow" /> Rating: <strong>{space.facilityRating.toFixed(1)}/5</strong></div>}
                </div>
                 {space.features && space.features.length > 0 && (
                    <>
                        <h4 className="text-md font-semibold pt-2">Available Features:</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {space.features.map(feature => <FeatureDisplay key={feature} feature={feature} />)}
                        </div>
                    </>
                 )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card className="shadow-xl sticky top-24">
              <CardHeader>
                <CardTitle className="text-xl">Select Your Booking Details</CardTitle>
                <CardDescription>Choose your date, time, and duration.</CardDescription>
              </CardHeader>
              <CardContent>
                <BookingForm space={space} onSubmit={handleBookingSubmit} defaultVehiclePlate={userDefaultVehiclePlate}/>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
