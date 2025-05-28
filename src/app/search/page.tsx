
"use client";
import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
// MapComponent is temporarily removed
// import MapComponent from '@/components/map/MapComponent';
import { ParkingSlotCard } from '@/components/parking/ParkingSlotCard';
import type { ParkingSpace, ParkingFeature } from '@/types';
import { ParkingPreferenceFilter, type ParkingFilters } from '@/components/booking/ParkingPreferenceFilter';
import { PageTitle } from '@/components/core/PageTitle';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { Card, CardContent } from '@/components/ui/card'; // Added CardContent
import { Input } from '@/components/ui/input'; // Added Input
import { Button } from '@/components/ui/button'; // Added Button
import { ListFilter, MapPin as MapPinIcon, Loader2, AlertTriangle, Info, ServerCrash, Search } from 'lucide-react'; // Renamed MapPin to MapPinIcon
import { Skeleton } from '@/components/ui/skeleton';
import { findParkingSpots, type FindParkingInput } from '@/ai/flows/find-parking-flow';
import { getDistanceFromLatLonInKm } from '@/lib/geoUtils';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth

const DEFAULT_MAP_CENTER_HYD = { lat: 17.3850, lng: 78.4867 };
const DEFAULT_MAP_ZOOM = 12;
const FOCUSED_MAP_ZOOM = 15;

function SearchPageComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth(); // Get auth state

  const [searchQuery, setSearchQuery] = useState('');
  const [rawAiSpaces, setRawAiSpaces] = useState<ParkingSpace[]>([]);
  const [displayedSpaces, setDisplayedSpaces] = useState<ParkingSpace[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [aiSearchPerformed, setAiSearchPerformed] = useState(false);

  const [mapCenterForView, setMapCenterForView] = useState<{ lat: number; lng: number }>(DEFAULT_MAP_CENTER_HYD);
  const [zoomForView, setZoomForView] = useState<number>(DEFAULT_MAP_ZOOM);
  const [activeSearchCenter, setActiveSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [userSetFilters, setUserSetFilters] = useState<ParkingFilters | null>(null);
  const [radiusOverride, setRadiusOverride] = useState<number | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Effect for initial query parameter processing
  useEffect(() => {
    const urlLocation = searchParams.get('location') || '';
    const urlLat = searchParams.get('lat');
    const urlLng = searchParams.get('lng');
    const urlRadius = searchParams.get('radius');

    let initialCenter = DEFAULT_MAP_CENTER_HYD;
    let initialZoom = DEFAULT_MAP_ZOOM;
    let initialActiveCenter: { lat: number; lng: number } | null = null;
    let initialRadiusOverride: number | null = null;

    if (urlLat && urlLng) {
      const lat = parseFloat(urlLat);
      const lng = parseFloat(urlLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        initialCenter = { lat, lng };
        initialActiveCenter = { lat, lng };
        initialZoom = FOCUSED_MAP_ZOOM;
        if (urlRadius) {
          const radiusNum = parseFloat(urlRadius);
          if (!isNaN(radiusNum) && radiusNum > 0) initialRadiusOverride = radiusNum;
        }
      }
    }
    
    setMapCenterForView(initialCenter);
    setZoomForView(initialZoom);
    if (initialActiveCenter) setActiveSearchCenter(initialActiveCenter);
    if (initialRadiusOverride) setRadiusOverride(initialRadiusOverride);
    setSearchQuery(urlLocation); 

    if (urlLocation || initialActiveCenter) {
      setSearchAttempted(true); // Mark that an initial search based on URL was intended
    }
    setIsInitialLoad(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  const performAiSearch = useCallback(async (
    locationQueryForDisplay: string, 
    radius: number,
    features: ParkingFeature[],
    contextualSearchCenter: { lat: number; lng: number } | null
  ) => {
    if (!isAuthenticated && !authLoading) {
      toast({title: "Login Required", description: "Please log in to search for parking.", variant: "destructive"});
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!locationQueryForDisplay && !contextualSearchCenter) {
      setRawAiSpaces([]);
      setDisplayedSpaces([]);
      setIsLoading(false);
      setAiSearchPerformed(true); // A search was attempted (even if empty)
      toast({title: "Search Empty", description:"Please enter a location or use the map to search.", variant: "default"});
      return;
    }

    setIsLoading(true);
    setAiSearchPerformed(true);
    try {
      const searchInput: FindParkingInput = {
        locationName: locationQueryForDisplay || (contextualSearchCenter ? `area around ${contextualSearchCenter.lat.toFixed(3)},${contextualSearchCenter.lng.toFixed(3)}` : 'general area'),
        searchRadiusKm: radius,
        desiredFeatures: features.length > 0 ? features : undefined,
      };
      const results = await findParkingSpots(searchInput);
      setRawAiSpaces(results);
      if (results.length > 0 && !contextualSearchCenter && !activeSearchCenter) {
        // If text search yields results and map wasn't pre-centered, center on first result
        setMapCenterForView(results[0].facilityCoordinates);
        setActiveSearchCenter(results[0].facilityCoordinates);
        setZoomForView(FOCUSED_MAP_ZOOM);
      } else if (contextualSearchCenter && !activeSearchCenter) {
        // If search was map-based, ensure activeSearchCenter reflects that for filtering
        setActiveSearchCenter(contextualSearchCenter);
      }
    } catch (error: any) {
      console.error("AI search failed:", error);
      toast({title: "AI Search Error", description: error.message || "Could not fetch parking spots.", variant: "destructive"});
      setRawAiSpaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authLoading, router, activeSearchCenter]); // Added activeSearchCenter


  useEffect(() => {
    if (isInitialLoad || !userSetFilters || !searchAttempted) return;

    const locationToSearchForDisplay = searchQuery.trim();
    const geographicContext = activeSearchCenter;
    
    const searchRadiusToUse = radiusOverride ?? userSetFilters.distanceMax;
    const desiredFeaturesForAI = userSetFilters.features;
    
    performAiSearch(
      locationToSearchForDisplay,
      searchRadiusToUse,
      desiredFeaturesForAI,
      geographicContext 
    );
    
    if (radiusOverride) {
      setRadiusOverride(null); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSetFilters, searchAttempted, isInitialLoad]); // Dependencies carefully chosen

  useEffect(() => {
    if (isInitialLoad) return; 
    if (userSetFilters && (searchQuery.trim() || activeSearchCenter)) { 
      setSearchAttempted(true); 
    }
  }, [searchQuery, activeSearchCenter, userSetFilters, isInitialLoad]);


  useEffect(() => {
    let filtered = [...rawAiSpaces];
    if (activeSearchCenter && userSetFilters && !radiusOverride) { 
      const filterRadius = userSetFilters.distanceMax;
      filtered = filtered.filter(slot => {
        if (!slot.facilityCoordinates) return false;
        const distance = getDistanceFromLatLonInKm(
          activeSearchCenter.lat,
          activeSearchCenter.lng,
          slot.facilityCoordinates.lat,
          slot.facilityCoordinates.lng
        );
        return distance <= filterRadius;
      });
    }

    if (userSetFilters) {
      filtered = filtered.filter(slot =>
        (slot.pricePerHour === undefined || (slot.pricePerHour >= userSetFilters.priceRange[0] && slot.pricePerHour <= userSetFilters.priceRange[1])) &&
        (slot.facilityRating === undefined || slot.facilityRating >= userSetFilters.ratingMin)
      );

      const hasEvFeature = userSetFilters.features.includes('ev-charging');
      const hasAccessibleFeature = userSetFilters.features.includes('disabled-access');

      if (hasEvFeature || hasAccessibleFeature) {
         filtered = filtered.filter(slot => {
            let matchesType = false;
            if (hasEvFeature && slot.slotType === 'ev-charging') matchesType = true;
            if (hasAccessibleFeature && slot.slotType === 'accessible') matchesType = true;
            
            // If a specific type filter is active, the slot MUST match one of them.
            // If neither is active, then slot type doesn't exclude it.
            if (!hasEvFeature && !hasAccessibleFeature) return true; // No type filter active
            return matchesType; 
         });
      }
    }
    setDisplayedSpaces(filtered);
  }, [rawAiSpaces, userSetFilters, activeSearchCenter, radiusOverride]);


  const handleApplyFilters = useCallback((filters: ParkingFilters) => {
    setUserSetFilters(filters);
    setRadiusOverride(null); 
    setSearchAttempted(true); 
  }, []);
  
  const handleSearchSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!isAuthenticated && !authLoading) {
      toast({title: "Login Required", description: "Please log in to search for parking.", variant: "destructive"});
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    // If activeSearchCenter is set (e.g. from autocomplete), keep it.
    // Otherwise, clear it so AI search centers on text query results.
    if (!searchQuery.trim() && !activeSearchCenter) {
       toast({title: "Search Empty", description:"Please enter a location to search.", variant: "default"});
       return;
    }
    
    // If search query comes from text input without autocomplete, clear activeSearchCenter initially
    // to let AI results dictate the map center.
    // Autocomplete already sets activeSearchCenter.
    // setActiveSearchCenter(null); This might be too aggressive, let's see.

    setSearchAttempted(true); // Trigger AI search via useEffect

    // Update URL
    const urlParams = new URLSearchParams();
    if(searchQuery.trim()) urlParams.set('location', searchQuery.trim());
    if(activeSearchCenter) { // If set by autocomplete prior to submit
      urlParams.set('lat', activeSearchCenter.lat.toString());
      urlParams.set('lng', activeSearchCenter.lng.toString());
      if(userSetFilters) urlParams.set('radius', userSetFilters.distanceMax.toString());
    }
    router.push(`/search?${urlParams.toString()}`, { scroll: false });
  };


  // Map related handlers (stubs for now as MapComponent is removed)
  const handleMarkerClick = useCallback((markerId: string) => {
    const clickedSlot = rawAiSpaces.find(s => s.id === markerId);
    if (clickedSlot && clickedSlot.facilityCoordinates) {
      setSearchQuery(clickedSlot.facilityName || clickedSlot.facilityAddress || clickedSlot.slotLabel); 
      setActiveSearchCenter(clickedSlot.facilityCoordinates);
      setMapCenterForView(clickedSlot.facilityCoordinates);
      setZoomForView(FOCUSED_MAP_ZOOM + 2); // More zoom on click
      setRadiusOverride(0.5); // Search very close to the pin: 0.5 km
      setSearchAttempted(true);

      const urlParams = new URLSearchParams();
      urlParams.set('location', clickedSlot.facilityName || clickedSlot.facilityAddress || clickedSlot.slotLabel);
      urlParams.set('lat', clickedSlot.facilityCoordinates.lat.toString());
      urlParams.set('lng', clickedSlot.facilityCoordinates.lng.toString());
      urlParams.set('radius', '0.5');
      router.push(`/search?${urlParams.toString()}`, { scroll: false });
    }
  }, [rawAiSpaces, router]);

  const handleMapIdle = useCallback((center: { lat: number; lng: number }, newZoom: number) => {
    // Logic for when map interaction stops
  }, []);

  const handlePlaceSelectedOnMapOrInput = useCallback((place: any /* google.maps.places.PlaceResult */) => {
    // Logic for when a place is selected from map's autocomplete
  }, []);


  const noResultsMessage = () => {
    if (!aiSearchPerformed && !searchQuery.trim() && !activeSearchCenter) {
      return (
        <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
          <Info className="mx-auto h-12 w-12 mb-4 text-primary" />
          <p className="text-lg font-medium text-foreground">Find Your Perfect Parking Slot</p>
          <p className="text-sm">Enter a location above or use filters to start your AI-powered parking search.</p>
        </div>
      );
    }
    return (
      <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
        <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-accent" />
        <p className="text-lg font-medium text-foreground">No Parking Slots Found by AI</p>
        <p className="text-sm">Try adjusting your search location or filters. Our AI generates fictional slots based on your query.</p>
      </div>
    );
  }

  if (authLoading && isInitialLoad) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (!isAuthenticated && !authLoading) { // Redirect if not authenticated and not loading
    // This might be too early if initial load checks are still pending.
    // The performAiSearch function also handles this, which might be better.
    // For now, let's rely on performAiSearch to redirect.
  }


  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <PageTitle 
            title="AI Parking Slot Finder" 
            description={searchQuery ? `Showing results for "${searchQuery}"` : "Search by location and filter preferences."}
        />
        
        <form onSubmit={handleSearchSubmit} className="mb-6 flex items-center gap-2">
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground icon-glow" />
                <Input
                    type="text"
                    placeholder="Enter location, e.g., 'Restaurant near Charminar'"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2.5 h-11 text-base"
                />
            </div>
            <Button type="submit" size="lg" className="h-11 shrink-0">
                <Search className="mr-2 h-5 w-5" /> Search
            </Button>
        </form>
        
        {/* Placeholder for MapComponent */}
        <div className="mb-8 h-[300px] md:h-[400px] rounded-lg overflow-hidden shadow-xl bg-muted flex items-center justify-center">
            <div className="text-center p-4">
                <MapPinIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Map view is temporarily unavailable.</p>
                <p className="text-xs text-muted-foreground">Search results will appear below.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 xl:col-span-3">
             <div className="sticky top-20"> 
                <ParkingPreferenceFilter onApplyFilters={handleApplyFilters} />
             </div>
          </div>

          <div className="lg:col-span-8 xl:col-span-9">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {isLoading ? 'Loading Parking Slots...' : `${displayedSpaces.length} Parking Slots Found`}
              </h2>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {[...Array(10)].map((_, i) => (
                  <Card key={i} className="w-full aspect-[3/4] sm:aspect-[2/3]">
                    <CardContent className="p-2 sm:p-3 flex flex-col justify-center items-center h-full">
                      <Skeleton className="h-5 w-1/2 mb-1" />
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-8 w-8 rounded-full mb-2" />
                      <Skeleton className="h-6 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : displayedSpaces.length === 0 && aiSearchPerformed ? (
                noResultsMessage()
            ) : displayedSpaces.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                    {displayedSpaces.map(slot => (
                        <ParkingSlotCard key={slot.id} space={slot} />
                    ))}
                </div>
            ) : ( // Initial state before any search or if !aiSearchPerformed
                 <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
                    <Info className="mx-auto h-12 w-12 mb-4 text-primary" />
                    <p className="text-lg font-medium text-foreground">Ready to Park?</p>
                    <p className="text-sm">Enter a location above and apply filters to find AI-generated parking suggestions.</p>
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
