"use client";
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MapComponent from '@/components/map/MapComponent';
import { ParkingCard } from '@/components/parking/ParkingCard';
import type { ParkingSpace } from '@/types';
import { ParkingPreferenceFilter, type ParkingFilters } from '@/components/booking/ParkingPreferenceFilter';
import { PageTitle } from '@/components/core/PageTitle';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon, ListFilter, Map, Loader2, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Mock data for parking spaces
const allMockSpaces: ParkingSpace[] = [
  { id: 'ps1', name: 'City Center Parking', address: '123 Main St, Anytown', availability: 'high', pricePerHour: 2.5, features: ['covered', 'ev-charging', 'cctv'], coordinates: { lat: 28.6139, lng: 77.2090 }, rating: 4.5, distance: '0.5 km', availableSpots: 50, totalSpots: 100, imageUrl: 'https://placehold.co/600x400.png' },
  { id: 'ps2', name: 'Downtown Garage', address: '456 Oak Ave, Anytown', availability: 'medium', pricePerHour: 3.0, features: ['cctv', 'secure'], coordinates: { lat: 28.6150, lng: 77.2100 }, rating: 4.2, distance: '1.2 km', availableSpots: 20, totalSpots: 80, imageUrl: 'https://placehold.co/600x400.png' },
  { id: 'ps3', name: 'Airport Long Term', address: '789 Pine Ln, Anytown', availability: 'low', pricePerHour: 1.8, features: ['covered', 'secure', 'well-lit'], coordinates: { lat: 28.6100, lng: 77.2000 }, rating: 4.0, distance: '5.5 km', availableSpots: 5, totalSpots: 150, imageUrl: 'https://placehold.co/600x400.png' },
  { id: 'ps4', name: 'Suburbia Park & Ride', address: '100 Suburbia Dr, Anytown', availability: 'high', pricePerHour: 1.0, features: ['well-lit'], coordinates: { lat: 28.6000, lng: 77.1900 }, rating: 3.8, distance: '8.0 km', availableSpots: 100, totalSpots: 200, imageUrl: 'https://placehold.co/600x400.png' },
  { id: 'ps5', name: 'Tech Park Tower A', address: '200 Innovation Rd, Anytown', availability: 'full', pricePerHour: 4.0, features: ['covered', 'ev-charging', 'secure'], coordinates: { lat: 28.6050, lng: 77.2150 }, rating: 4.8, distance: '2.1 km', availableSpots: 0, totalSpots: 75, imageUrl: 'https://placehold.co/600x400.png' },
];

function SearchPageComponent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('location') || '';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [displayedSpaces, setDisplayedSpaces] = useState<ParkingSpace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list'); // Default to list view
  const [mapCenter, setMapCenter] = useState({ lat: 28.6139, lng: 77.2090 }); // Default center
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);


  useEffect(() => {
    // Simulate fetching and filtering data
    setIsLoading(true);
    setTimeout(() => {
      // Basic search query filter (name or address)
      let filtered = allMockSpaces.filter(space => 
        space.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        space.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
      // TODO: Apply advanced filters from ParkingPreferenceFilter
      setDisplayedSpaces(filtered);
      if (filtered.length > 0) {
        setMapCenter(filtered[0].coordinates);
      }
      setIsLoading(false);
    }, 1500);
  }, [searchQuery]);


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Trigger re-fetch/re-filter, already handled by searchQuery state change
    // For a real app, you might push to router here to update URL params
  };

  const handleApplyFilters = (filters: ParkingFilters) => {
    setIsLoading(true);
    console.log("Applying filters:", filters);
    // Simulate filtering based on preferences
    setTimeout(() => {
      let filtered = allMockSpaces.filter(space => 
        (space.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
         space.address.toLowerCase().includes(searchQuery.toLowerCase())) &&
        space.pricePerHour >= filters.priceRange[0] &&
        space.pricePerHour <= filters.priceRange[1] &&
        (filters.features.length === 0 || filters.features.every(feat => space.features.includes(feat))) &&
        (parseFloat(space.distance?.split(' ')[0] || '0') <= filters.distanceMax) &&
        (space.rating || 0) >= filters.ratingMin
      );
      setDisplayedSpaces(filtered);
      if (filtered.length > 0) {
        setMapCenter(filtered[0].coordinates);
      }
      setIsLoading(false);
    }, 1000);
  };
  
  const handleMarkerClick = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    setViewMode('list'); // Switch to list view and scroll to the card
    const element = document.getElementById(`space-card-${spaceId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Highlight the card
    element?.classList.add('ring-2', 'ring-primary', 'shadow-2xl');
    setTimeout(() => element?.classList.remove('ring-2', 'ring-primary', 'shadow-2xl'), 2000);
  };


  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <PageTitle title="Find Your Perfect Parking Spot" description="Search by location and filter by your preferences." />

        <form onSubmit={handleSearchSubmit} className="mb-8 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-grow">
             <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground icon-glow" />
            <Input
              type="text"
              placeholder="Enter address, landmark, or zip code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-3 h-12 text-base w-full"
            />
          </div>
          <Button type="submit" size="lg" className="h-12 shrink-0">
            <SearchIcon className="mr-2 h-5 w-5" /> Search
          </Button>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Filters Column */}
          <div className="lg:col-span-4 xl:col-span-3">
             <div className="sticky top-20"> {/* top-20 to account for header height + some padding */}
                <ParkingPreferenceFilter onApplyFilters={handleApplyFilters} />
             </div>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {isLoading ? 'Searching...' : `${displayedSpaces.length} Parking Spots Found`}
              </h2>
              <div className="flex gap-2">
                <Button variant={viewMode === 'list' ? 'secondary' : 'outline'} size="icon" onClick={() => setViewMode('list')} title="List View">
                  <ListFilter className="h-5 w-5" />
                </Button>
                <Button variant={viewMode === 'map' ? 'secondary' : 'outline'} size="icon" onClick={() => setViewMode('map')} title="Map View">
                  <Map className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {viewMode === 'map' && (
              <div className="mb-6 h-[600px] rounded-lg overflow-hidden shadow-xl">
                 <MapComponent 
                    markers={displayedSpaces.map(s => ({ id: s.id, lat: s.coordinates.lat, lng: s.coordinates.lng, label: s.name }))} 
                    center={mapCenter}
                    onMarkerClick={handleMarkerClick}
                    interactive={true}
                />
              </div>
            )}

            {isLoading ? (
              <div className={`grid grid-cols-1 ${viewMode === 'list' ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6`}>
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="w-full">
                    <Skeleton className="h-48 w-full" />
                    <CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2 mt-1" /></CardHeader>
                    <CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent>
                    <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                  </Card>
                ))}
              </div>
            ) : displayedSpaces.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow">
                <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-gray-500" />
                <p className="text-lg font-medium">No Parking Spots Found</p>
                <p className="text-sm">Try adjusting your search query or filters.</p>
              </div>
            ) : (
               viewMode === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {displayedSpaces.map(space => (
                    <div key={space.id} id={`space-card-${space.id}`}>
                        <ParkingCard space={space} />
                    </div>
                    ))}
                </div>
               )
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

//This page uses useSearchParams, so it needs to be wrapped in Suspense
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <SearchPageComponent />
    </Suspense>
  );
}

