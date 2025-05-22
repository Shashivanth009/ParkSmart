
"use client";
import { useEffect, useState, Suspense, useCallback, useRef } from 'react'; 
import { useSearchParams, useRouter } from 'next/navigation';
import MapComponent from '@/components/map/MapComponent';
import { ParkingCard } from '@/components/parking/ParkingCard';
import type { ParkingSpace, ParkingFeature } from '@/types';
import { ParkingPreferenceFilter, type ParkingFilters } from '@/components/booking/ParkingPreferenceFilter';
import { PageTitle } from '@/components/core/PageTitle';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Search as SearchIcon, ListFilter, Map, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getDistanceFromLatLonInKm } from '@/lib/geoUtils';
import { findParkingSpots, type FindParkingInput } from '@/ai/flows/find-parking-flow';

const DEFAULT_MAP_CENTER_HYD = { lat: 17.3850, lng: 78.4867 }; // Hyderabad

function SearchPageComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialLocationQuery = searchParams.get('location') || '';
  const mainSearchInputRef = useRef<HTMLInputElement>(null); 

  const [searchQuery, setSearchQuery] = useState(initialLocationQuery);
  
  const [rawAiSpaces, setRawAiSpaces] = useState<ParkingSpace[]>([]);
  const [displayedSpaces, setDisplayedSpaces] = useState<ParkingSpace[]>([]);
  
  const [isLoading, setIsLoading] = useState(false); // For AI call and initial filtering
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  
  const [mapCenterForView, setMapCenterForView] = useState<{ lat: number; lng: number } | null>(null);
  const [activeSearchCenter, setActiveSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [userSetFilters, setUserSetFilters] = useState<ParkingFilters | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  // Effect for setting initial map center based on URL query
  useEffect(() => {
    if (initialLocationQuery) {
      // If we had geocoding, we'd geocode initialLocationQuery here to get lat/lng
      // For now, we'll just set the text and let the user initiate search or map interaction
      // Or, if we want to auto-search on load if URL has query:
      // performAiSearch(initialLocationQuery, userSetFilters?.distanceMax || 5, userSetFilters?.features || []);
      setMapCenterForView(DEFAULT_MAP_CENTER_HYD); // Default, AI will refine if search is triggered
    } else {
      setMapCenterForView(DEFAULT_MAP_CENTER_HYD);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on initial load for URL param

  const performAiSearch = useCallback(async (location: string, radius: number, features: ParkingFeature[]) => {
    if (!location.trim()) {
      setRawAiSpaces([]);
      setDisplayedSpaces([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setSearchAttempted(true);
    console.log(`Performing AI Search for: ${location}, Radius: ${radius}km, Features: ${features.join(', ')}`);

    try {
      const aiInput: FindParkingInput = {
        locationName: location,
        searchRadiusKm: radius,
        desiredFeatures: features.length > 0 ? features : undefined,
      };
      const results = await findParkingSpots(aiInput);
      setRawAiSpaces(results);
      if (results.length > 0 && !activeSearchCenter) { // If AI returns results, try to center map on first result if no active map center
        setMapCenterForView(results[0].coordinates);
        // setActiveSearchCenter(results[0].coordinates); // Or let map idle set this
      } else if (results.length === 0 && activeSearchCenter) {
        setMapCenterForView(activeSearchCenter);
      } else if (results.length === 0 && !activeSearchCenter) {
        setMapCenterForView(DEFAULT_MAP_CENTER_HYD);
      }
    } catch (error) {
      console.error("Error fetching parking spots from AI:", error);
      setRawAiSpaces([]);
      // Potentially show a toast error here
    } finally {
      setIsLoading(false);
    }
  }, [activeSearchCenter]);

  // Effect to trigger AI search when relevant parameters change
  useEffect(() => {
    const locationToSearch = searchQuery.trim();
    // Only search if a query exists or an active map area is defined, and filters are available
    if ((locationToSearch || activeSearchCenter) && userSetFilters) {
      performAiSearch(
        locationToSearch || `area around ${activeSearchCenter?.lat.toFixed(4)}, ${activeSearchCenter?.lng.toFixed(4)}`, // Use search query or a description of map center
        userSetFilters.distanceMax, 
        userSetFilters.features
      );
    } else if (userSetFilters && !locationToSearch && !activeSearchCenter) {
        // If filters are set but no location, clear results or prompt for location
        setRawAiSpaces([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeSearchCenter, userSetFilters?.features, userSetFilters?.distanceMax]); // Dependencies carefully chosen


  // Effect for client-side filtering of AI results (price, rating, etc.)
  useEffect(() => {
    let filtered = [...rawAiSpaces]; // Start with AI results

    // Apply userSetFilters for price and rating
    if (userSetFilters) {
      filtered = filtered.filter(space =>
        space.pricePerHour >= userSetFilters.priceRange[0] &&
        space.pricePerHour <= userSetFilters.priceRange[1] &&
        (space.rating || 0) >= userSetFilters.ratingMin
      );
    }
    
    // Further text filtering if needed (AI might have returned broader results)
    if (searchQuery.trim()) {
        filtered = filtered.filter(space =>
          space.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          space.address.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    setDisplayedSpaces(filtered);
    
    // Update map center for view if needed and results exist
    if (filtered.length > 0 && !mapCenterForView && !activeSearchCenter) {
      setMapCenterForView(filtered[0].coordinates);
    } else if (activeSearchCenter) {
      setMapCenterForView(activeSearchCenter);
    }

  }, [rawAiSpaces, userSetFilters, searchQuery, mapCenterForView, activeSearchCenter]);


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/search?location=${encodeURIComponent(searchQuery)}`, { scroll: false });
    // The useEffect watching searchQuery will trigger the AI search
    setSearchAttempted(true); 
  };

  const handleApplyFilters = useCallback((filters: ParkingFilters) => {
    setUserSetFilters(filters);
    // The useEffect watching userSetFilters will trigger the AI search if a location is also set
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
    setActiveSearchCenter(center);
    // The useEffect watching activeSearchCenter will trigger the AI search if filters are also set
  }, []);

  const handlePlaceSelectedOnMapOrInput = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const newCenter = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      const newSearchQuery = place.name || place.formatted_address || `${newCenter.lat},${newCenter.lng}`;
      
      setSearchQuery(newSearchQuery); 
      setMapCenterForView(newCenter); 
      setActiveSearchCenter(newCenter); 
      
      router.push(`/search?location=${encodeURIComponent(newSearchQuery)}`, { scroll: false });
      // The useEffect watching searchQuery and activeSearchCenter will trigger AI search
    }
  }, [router]); 

  const noResultsMessage = () => {
    if (!searchQuery.trim() && !activeSearchCenter && !searchAttempted) {
      return (
        <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
          <Info className="mx-auto h-12 w-12 mb-4 text-primary" />
          <p className="text-lg font-medium text-foreground">Find Parking Near You</p>
          <p className="text-sm">Enter a location in the search bar above or pan the map to an area of interest. Parking spots will appear here.</p>
        </div>
      );
    }
    return (
      <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
        <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-accent" />
        <p className="text-lg font-medium text-foreground">No Parking Spots Found</p>
        <p className="text-sm">Try adjusting your search term, filters, or map location.</p>
        <p className="text-xs mt-1">Note: AI generates fictional spots based on your query. If results are empty, try a broader search or different terms.</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <PageTitle title="AI-Powered Parking Finder" description="Search by location and filter by your preferences. Our AI will find fictional spots for you!" />

        <form onSubmit={handleSearchSubmit} className="mb-8 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-grow">
             <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground icon-glow" />
            <Input
              ref={mainSearchInputRef} 
              type="text"
              placeholder="Enter address, landmark, or area..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchAttempted(false); }} // Reset searchAttempted on new typing
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
                {isLoading ? 'AI is Searching...' : `${displayedSpaces.length} Parking Spots Found`}
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
            
            <div className={`mb-6 h-[600px] rounded-lg overflow-hidden shadow-xl ${viewMode === 'map' ? '' : 'hidden lg:block'}`}>
                 <MapComponent 
                    markers={displayedSpaces.map(s => ({ id: s.id, lat: s.coordinates.lat, lng: s.coordinates.lng, label: s.name }))} 
                    center={mapCenterForView}
                    onMarkerClick={handleMarkerClick}
                    interactive={true}
                    showSearchInput={true} 
                    autocompleteInputRef={mainSearchInputRef} 
                    showMyLocationButton={true} 
                    onPlaceSelected={handlePlaceSelectedOnMapOrInput}
                    onMapIdle={handleMapIdle}
                />
            </div>

            {isLoading ? (
              <div className={`grid grid-cols-1 ${viewMode === 'list' ? 'md:grid-cols-2' : 'hidden'} gap-6`}>
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
              <div className={`${viewMode === 'list' ? '' : 'hidden'}`}>
                {noResultsMessage()}
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
            {/* Ensure list view is shown on smaller screens if map view is active */}
            {viewMode === 'map' && displayedSpaces.length > 0 && (
                 <div className="lg:hidden mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {displayedSpaces.slice(0,4).map(space => ( // Show a few results below map on mobile
                    <div key={space.id} id={`space-card-mobile-${space.id}`}>
                        <ParkingCard space={space} />
                    </div>
                    ))}
                </div>
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
