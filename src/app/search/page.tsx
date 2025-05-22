
"use client";
import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import MapComponent from '@/components/map/MapComponent';
import { ParkingCard } from '@/components/parking/ParkingCard';
import type { ParkingSpace } from '@/types';
import { ParkingPreferenceFilter, type ParkingFilters } from '@/components/booking/ParkingPreferenceFilter';
import { PageTitle } from '@/components/core/PageTitle';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Search as SearchIcon, ListFilter, Map, Loader2, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getDistanceFromLatLonInKm } from '@/lib/geoUtils';

// Mock data for parking spaces - Removed 'distance' property
const allMockSpaces: ParkingSpace[] = [
  { id: 'ps1', name: 'Charminar Parking Plaza', address: 'Near Charminar, Hyderabad', availability: 'high', pricePerHour: 2.5, features: ['covered', 'ev-charging', 'cctv'], coordinates: { lat: 17.3616, lng: 78.4747 }, rating: 4.5, availableSpots: 50, totalSpots: 100, imageUrl: 'https://placehold.co/600x400.png' },
  { id: 'ps2', name: 'Hitech City Secure Park', address: 'Mindspace Circle, Hyderabad', availability: 'medium', pricePerHour: 3.0, features: ['cctv', 'secure'], coordinates: { lat: 17.4474, lng: 78.3762 }, rating: 4.2, availableSpots: 20, totalSpots: 80, imageUrl: 'https://placehold.co/600x400.png' },
  { id: 'ps3', name: 'Gachibowli Stadium Lot', address: 'Old Mumbai Hwy, Hyderabad', availability: 'low', pricePerHour: 1.8, features: ['covered', 'secure', 'well-lit'], coordinates: { lat: 17.4417, lng: 78.3498 }, rating: 4.0, availableSpots: 5, totalSpots: 150, imageUrl: 'https://placehold.co/600x400.png' },
  { id: 'ps4', name: 'Banjara Hills Valet', address: 'Rd Number 1, Hyderabad', availability: 'high', pricePerHour: 4.0, features: ['well-lit', 'covered'], coordinates: { lat: 17.4150, lng: 78.4499 }, rating: 3.8, availableSpots: 100, totalSpots: 200, imageUrl: 'https://placehold.co/600x400.png' },
  { id: 'ps5', name: 'Secunderabad Station Park', address: 'Railway Station Rd, Secunderabad', availability: 'full', pricePerHour: 2.0, features: ['covered', 'ev-charging', 'secure'], coordinates: { lat: 17.4362, lng: 78.4990 }, rating: 4.8, availableSpots: 0, totalSpots: 75, imageUrl: 'https://placehold.co/600x400.png' },
];

const DEFAULT_MAP_CENTER = { lat: 17.3850, lng: 78.4867 }; // Hyderabad

function SearchPageComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialLocationQuery = searchParams.get('location') || '';

  const [searchQuery, setSearchQuery] = useState(initialLocationQuery);
  const [displayedSpaces, setDisplayedSpaces] = useState<ParkingSpace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  
  const [mapCenterForView, setMapCenterForView] = useState<{ lat: number; lng: number } | null>(null);
  const [activeSearchCenter, setActiveSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [userSetFilters, setUserSetFilters] = useState<ParkingFilters | null>(null);

  // Effect for initial centering based on URL query
  useEffect(() => {
    if (initialLocationQuery) {
      const matchedSpace = allMockSpaces.find(s =>
        s.name.toLowerCase().includes(initialLocationQuery.toLowerCase()) ||
        s.address.toLowerCase().includes(initialLocationQuery.toLowerCase())
      );
      if (matchedSpace) {
        setMapCenterForView(matchedSpace.coordinates);
        setActiveSearchCenter(matchedSpace.coordinates); 
      } else {
        setMapCenterForView(DEFAULT_MAP_CENTER);
        // Optionally, you could try to geocode initialLocationQuery here if you had a geocoding service
        // For now, if no direct match, we don't set activeSearchCenter from query text alone
      }
    } else {
      setMapCenterForView(DEFAULT_MAP_CENTER);
      // setActiveSearchCenter(DEFAULT_MAP_CENTER); // Uncomment to show spots around Hyderabad by default
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount based on initial query


  // Main data filtering useEffect
  useEffect(() => {
    setIsLoading(true);
    // console.log("Filtering with: searchQuery:", searchQuery, "activeSearchCenter:", activeSearchCenter, "userSetFilters:", userSetFilters);
    
    setTimeout(() => { // Simulate API delay
      let filtered = allMockSpaces;

      // 1. Text search (if searchQuery is present)
      if (searchQuery.trim()) {
        filtered = filtered.filter(space =>
          space.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          space.address.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // 2. Location-based search (if activeSearchCenter is set)
      if (activeSearchCenter) {
        const searchRadiusKm = userSetFilters?.distanceMax !== undefined && userSetFilters.distanceMax > 0 
                               ? userSetFilters.distanceMax 
                               : 1; // Default to 1km if not set by filter
        
        // console.log(`Filtering by location: center=${JSON.stringify(activeSearchCenter)}, radius=${searchRadiusKm}km`);
        
        filtered = filtered.filter(space => {
          const distance = getDistanceFromLatLonInKm(
            activeSearchCenter.lat, activeSearchCenter.lng,
            space.coordinates.lat, space.coordinates.lng
          );
          // console.log(`Space: ${space.name}, Distance: ${distance}km`);
          return distance <= searchRadiusKm;
        });
      } else if (!searchQuery.trim() && !userSetFilters) {
         // If no search query, no active search center, and no filters, show no results or a message
         // This state means the user hasn't specified any criteria yet.
         // filtered = []; // Option 1: Show nothing until search/interaction
      }

      // 3. Preference filters (if userSetFilters is present)
      if (userSetFilters) {
        filtered = filtered.filter(space =>
          space.pricePerHour >= userSetFilters.priceRange[0] &&
          space.pricePerHour <= userSetFilters.priceRange[1] &&
          (userSetFilters.features.length === 0 || userSetFilters.features.every(feat => space.features.includes(feat))) &&
          (space.rating || 0) >= userSetFilters.ratingMin
        );
      }

      setDisplayedSpaces(filtered);
      
      // Smart map centering update:
      if (filtered.length > 0) {
        if (activeSearchCenter) {
            // If there was an active search center, keep the map centered there if results are found for it
            setMapCenterForView(activeSearchCenter);
        } else if (searchQuery.trim()) {
            // If search was by text and found results, center map on first result
            setMapCenterForView(filtered[0].coordinates);
        }
        // If no activeSearchCenter and no searchQuery, mapCenterForView remains at its default or last explicit setting
      } else if (activeSearchCenter) {
         // No results, but there was an active search center, keep map centered there
         setMapCenterForView(activeSearchCenter);
      }
      // If no results and no activeSearchCenter, mapCenterForView is already default.

      setIsLoading(false);
    }, 500); 
  }, [searchQuery, activeSearchCenter, userSetFilters]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This will update the URL, and the main useEffect will pick up 'searchQuery'.
    // True geocoding of 'searchQuery' to set 'activeSearchCenter' would be an enhancement.
    router.push(`/search?location=${encodeURIComponent(searchQuery)}`, { scroll: false });
    // For now, manual map interaction or selecting from map search is primary way to set activeSearchCenter.
    // Or if URL param matches a known space name/address.
    const matchedSpace = allMockSpaces.find(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    if (matchedSpace) {
        setActiveSearchCenter(matchedSpace.coordinates); // Trigger search around this if text matches
        setMapCenterForView(matchedSpace.coordinates);
    } else {
        // setActiveSearchCenter(null); // Or try to geocode with an external service
        // For simplicity, if no direct match, we rely on map interaction or existing activeSearchCenter.
    }
  };

  const handleApplyFilters = useCallback((filters: ParkingFilters) => {
    setUserSetFilters(filters);
  }, []);
  
  const handleMarkerClick = useCallback((spaceId: string) => {
    setSelectedSpaceId(spaceId);
    setViewMode('list'); 
    const element = document.getElementById(`space-card-${spaceId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.classList.add('ring-2', 'ring-primary', 'shadow-2xl');
    setTimeout(() => element?.classList.remove('ring-2', 'ring-primary', 'shadow-2xl'), 2000);
  }, []);

  const handleMapIdle = useCallback((center: { lat: number; lng: number }) => {
    // console.log("Map idle, new center:", center);
    setActiveSearchCenter(center);
    setMapCenterForView(center); 
  }, []);

  const handlePlaceSelectedOnMap = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const newCenter = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      setMapCenterForView(newCenter); 
      setActiveSearchCenter(newCenter); 
      if (place.name) {
        setSearchQuery(place.name); 
      }
      // router.push(`/search?location=${encodeURIComponent(place.name || '')}`, { scroll: false }); // Optional: update URL on map search too
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ ]); // router, setSearchQuery can cause re-renders, manage carefully

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
          <div className="lg:col-span-4 xl:col-span-3">
             <div className="sticky top-20"> 
                <ParkingPreferenceFilter onApplyFilters={handleApplyFilters} />
             </div>
          </div>

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
                    center={mapCenterForView}
                    onMarkerClick={handleMarkerClick}
                    interactive={true}
                    showSearchInput={true} 
                    showMyLocationButton={true} 
                    onPlaceSelected={handlePlaceSelectedOnMap}
                    onMapIdle={handleMapIdle}
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
              <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
                <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-accent" />
                <p className="text-lg font-medium text-foreground">No Parking Spots Found</p>
                <p className="text-sm">Try adjusting your search, filters, or map location.</p>
                 <p className="text-xs mt-1">Note: Parking spots are shown within a {userSetFilters?.distanceMax || 1}km radius of the current map search center.</p>
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

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <SearchPageComponent />
    </Suspense>
  );
}

