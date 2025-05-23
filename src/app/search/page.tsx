
"use client";
import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import MapComponent from '@/components/map/MapComponent';
import { ParkingSlotCard } from '@/components/parking/ParkingSlotCard';
import type { ParkingSpace, ParkingFeature } from '@/types';
import { ParkingPreferenceFilter, type ParkingFilters } from '@/components/booking/ParkingPreferenceFilter';
import { PageTitle } from '@/components/core/PageTitle';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'; // Added Card imports
import { Search as SearchIcon, ListFilter, Map, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { findParkingSpots, type FindParkingInput } from '@/ai/flows/find-parking-flow';
import { getDistanceFromLatLonInKm } from '@/lib/geoUtils';


const DEFAULT_MAP_CENTER_HYD = { lat: 17.3850, lng: 78.4867 }; // Hyderabad
const DEFAULT_MAP_ZOOM = 12;
const FOCUSED_MAP_ZOOM = 15;

function SearchPageComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mainSearchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [rawAiSpaces, setRawAiSpaces] = useState<ParkingSpace[]>([]);
  const [displayedSpaces, setDisplayedSpaces] = useState<ParkingSpace[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  // const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null); // Keep if direct selection features are added

  const [mapCenterForView, setMapCenterForView] = useState<{ lat: number; lng: number }>(DEFAULT_MAP_CENTER_HYD);
  const [zoomForView, setZoomForView] = useState<number>(DEFAULT_MAP_ZOOM);
  const [activeSearchCenter, setActiveSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [userSetFilters, setUserSetFilters] = useState<ParkingFilters | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [radiusOverride, setRadiusOverride] = useState<number | null>(null);


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
        initialActiveCenter = { lat, lng }; // Set active center if lat/lng are in URL
        initialZoom = FOCUSED_MAP_ZOOM; 
        if (urlRadius) {
          const radius = parseFloat(urlRadius);
          if (!isNaN(radius) && radius > 0) {
            initialRadiusOverride = radius;
          }
        }
      }
    }
    
    setMapCenterForView(initialCenter);
    setZoomForView(initialZoom);
    if (initialActiveCenter) setActiveSearchCenter(initialActiveCenter);
    if (initialRadiusOverride) setRadiusOverride(initialRadiusOverride);
    setSearchQuery(urlLocation);

    // If location or active center from URL, consider search as "attempted" for initial AI call
    if (urlLocation || initialActiveCenter) {
      setSearchAttempted(true); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount to parse URL params

  const performAiSearch = useCallback(async (
    locationQuery: string,
    radius: number,
    features: ParkingFeature[],
    contextualSearchCenter: { lat: number; lng: number } | null // Center that triggered this specific AI search
  ) => {
    if (!locationQuery.trim() && !contextualSearchCenter) { 
      setRawAiSpaces([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSearchAttempted(true);
    const effectiveLocationForAI = locationQuery.trim() || (contextualSearchCenter ? `area around ${contextualSearchCenter.lat.toFixed(4)}, ${contextualSearchCenter.lng.toFixed(4)}` : "current map view");
    console.log(`Performing AI Slot Search for: ${effectiveLocationForAI}, Radius: ${radius}km, Features: ${features.join(', ')}`);

    try {
      const aiInput: FindParkingInput = {
        locationName: effectiveLocationForAI,
        searchRadiusKm: radius,
        desiredFeatures: features.length > 0 ? features : undefined,
      };
      const results = await findParkingSpots(aiInput);
      setRawAiSpaces(results);

      if (results.length > 0) {
        const isFreshTextSearch = locationQuery.trim() && !contextualSearchCenter;
        if (isFreshTextSearch) {
          // This was a new text search, center map on first AI result and set it as active search center.
          setMapCenterForView(results[0].facilityCoordinates);
          setActiveSearchCenter(results[0].facilityCoordinates); // Update the active center based on AI's result
          setZoomForView(FOCUSED_MAP_ZOOM);
        }
        // If contextualSearchCenter was provided (map idle/click/autocomplete), map is already centered appropriately.
        // If no locationQuery and no contextualSearchCenter (e.g. filter change on initial load), also center on first result.
        else if (!locationQuery.trim() && !contextualSearchCenter) {
            setMapCenterForView(results[0].facilityCoordinates);
            setActiveSearchCenter(results[0].facilityCoordinates);
            setZoomForView(FOCUSED_MAP_ZOOM);
        }
      }
      
    } catch (error) {
      console.error("Error fetching parking slots from AI:", error);
      setRawAiSpaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [setRawAiSpaces, setIsLoading, setSearchAttempted, setMapCenterForView, setActiveSearchCenter, setZoomForView]);


  useEffect(() => {
    const locationToSearch = searchQuery.trim();
    // Trigger AI search if filters are set AND (there's a text query OR an active map center OR a search was previously attempted which implies context)
    if (userSetFilters && (locationToSearch || activeSearchCenter || (searchAttempted && !locationToSearch && !activeSearchCenter))) {
      const searchRadius = radiusOverride ?? userSetFilters.distanceMax;
      const desiredFeaturesForAI = userSetFilters.features;
      
      // Pass the current activeSearchCenter as the context for this AI call
      performAiSearch(
        locationToSearch,
        searchRadius,
        desiredFeaturesForAI,
        activeSearchCenter 
      );
      if (radiusOverride) {
        setRadiusOverride(null); 
      }
    } else if (userSetFilters && !locationToSearch && !activeSearchCenter && searchAttempted) {
        setRawAiSpaces([]); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeSearchCenter, userSetFilters, radiusOverride, searchAttempted, performAiSearch]);


  useEffect(() => {
    let filtered = [...rawAiSpaces];
    
    // Distance filter based on activeSearchCenter (if set and not overridden by a specific marker click radius)
    if (activeSearchCenter && !radiusOverride) { 
      const filterRadius = userSetFilters?.distanceMax || 1; 
      filtered = filtered.filter(slot => {
        const distance = getDistanceFromLatLonInKm(
          activeSearchCenter.lat,
          activeSearchCenter.lng,
          slot.facilityCoordinates.lat,
          slot.facilityCoordinates.lng
        );
        return distance <= filterRadius;
      });
    }

    // Other client-side filters (price, rating, type)
    if (userSetFilters) {
      filtered = filtered.filter(slot =>
        (slot.pricePerHour === undefined || (slot.pricePerHour >= userSetFilters.priceRange[0] && slot.pricePerHour <= userSetFilters.priceRange[1])) &&
        (slot.facilityRating === undefined || slot.facilityRating >= userSetFilters.ratingMin)
      );

      const hasEvFeature = userSetFilters.features.includes('ev-charging');
      const hasAccessibleFeature = userSetFilters.features.includes('disabled-access');

      if (hasEvFeature && !hasAccessibleFeature) {
        filtered = filtered.filter(slot => slot.slotType === 'ev-charging' || slot.slotType === 'standard');
      } else if (hasAccessibleFeature && !hasEvFeature) {
         filtered = filtered.filter(slot => slot.slotType === 'accessible' || slot.slotType === 'standard');
      }
    }
    setDisplayedSpaces(filtered);
  }, [rawAiSpaces, userSetFilters, activeSearchCenter, radiusOverride]);


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For a direct text submission, reset activeSearchCenter.
    // The performAiSearch (triggered by useEffect on searchQuery change)
    // will then use the AI results to set a new activeSearchCenter and map view.
    setActiveSearchCenter(null); 
    setMapCenterForView(DEFAULT_MAP_CENTER_HYD); // Reset map visually, AI results will re-center
    setZoomForView(DEFAULT_MAP_ZOOM);

    router.push(`/search?location=${encodeURIComponent(searchQuery)}`, { scroll: false });
    // searchQuery state is already managed by the input's onChange.
    // The useEffect watching searchQuery will trigger performAiSearch.
    setRadiusOverride(null); 
    setSearchAttempted(true);
  };

  const handleApplyFilters = useCallback((filters: ParkingFilters) => {
    setUserSetFilters(filters);
    setRadiusOverride(null); 
    setSearchAttempted(true); 
  }, []);

  const handleMarkerClick = useCallback((markerId: string) => {
    const clickedSlot = rawAiSpaces.find(s => s.id === markerId);
    if (clickedSlot) {
      // setSelectedSpaceId(markerId); // Keep if needed for other features
      setSearchQuery(clickedSlot.facilityName); 
      setActiveSearchCenter(clickedSlot.facilityCoordinates);
      setMapCenterForView(clickedSlot.facilityCoordinates);
      setZoomForView(FOCUSED_MAP_ZOOM + 1); 
      setRadiusOverride(1); // Trigger AI search for 1km radius around this specific facility pin
      setSearchAttempted(true);
      window.scrollTo({ top: mainSearchInputRef.current?.offsetTop || 0, behavior: 'smooth' });
    }
  }, [rawAiSpaces]);

  const handleMapIdle = useCallback((center: { lat: number; lng: number }, newZoom: number) => {
    // Only trigger new search if map moved significantly or zoom changed
    if (!activeSearchCenter || 
        Math.abs(activeSearchCenter.lat - center.lat) > 0.001 || 
        Math.abs(activeSearchCenter.lng - center.lng) > 0.001 || 
        zoomForView !== newZoom ) {
        
        setActiveSearchCenter(center); // This will trigger performAiSearch via useEffect
        setMapCenterForView(center); 
        setZoomForView(newZoom);
        setRadiusOverride(null); // New map view, use filter radius
        setSearchAttempted(true);
        setSearchQuery(''); // Clear text search when map is moved, focus on map area
    }
  }, [activeSearchCenter, zoomForView, setActiveSearchCenter, setMapCenterForView, setZoomForView, setSearchQuery]);

  const handlePlaceSelectedOnMapOrInput = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const newCenter = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      const newSearchQuery = place.name || place.formatted_address || `${newCenter.lat.toFixed(4)},${newCenter.lng.toFixed(4)}`;

      setSearchQuery(newSearchQuery); // This will trigger performAiSearch via useEffect
      setActiveSearchCenter(newCenter); // Set active center immediately for performAiSearch context
      setMapCenterForView(newCenter); // Update map view
      setZoomForView(FOCUSED_MAP_ZOOM); 
      
      setRadiusOverride(null); 
      setSearchAttempted(true);
      // Update URL to reflect the selected place
      router.push(`/search?location=${encodeURIComponent(newSearchQuery)}&lat=${newCenter.lat}&lng=${newCenter.lng}`, { scroll: false });
    }
  }, [router, setActiveSearchCenter, setMapCenterForView, setZoomForView, setSearchQuery]);

  const noResultsMessage = () => {
    if (!searchQuery.trim() && !activeSearchCenter && !searchAttempted && !userSetFilters) {
      return (
        <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
          <Info className="mx-auto h-12 w-12 mb-4 text-primary" />
          <p className="text-lg font-medium text-foreground">Find Parking Slots</p>
          <p className="text-sm">Enter a location or interact with the map. AI-generated parking slots will appear here.</p>
        </div>
      );
    }
    return (
      <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
        <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-accent" />
        <p className="text-lg font-medium text-foreground">No Parking Slots Found by AI</p>
        <p className="text-sm">Try adjusting your search term, filters, or map location. Our AI generates fictional slots based on your query.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <PageTitle title="AI Parking Slot Finder" description="Search by location and filter preferences. Our AI will generate fictional parking slots for you!" />

        <form onSubmit={handleSearchSubmit} className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-grow">
             <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground icon-glow" />
            <Input
              ref={mainSearchInputRef}
              type="text"
              placeholder="Enter address, landmark, or area..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); }} 
              className="pl-10 pr-4 py-3 h-12 text-base w-full"
            />
          </div>
          <Button type="submit" size="lg" className="h-12 shrink-0">
            <SearchIcon className="mr-2 h-5 w-5" /> Search
          </Button>
        </form>
        
        <div className="mb-8 h-[400px] md:h-[500px] rounded-lg overflow-hidden shadow-xl">
            <MapComponent
                markers={displayedSpaces.map(s => ({ id: s.id, lat: s.facilityCoordinates.lat, lng: s.facilityCoordinates.lng, label: s.slotLabel + ' @ ' + s.facilityName }))}
                center={mapCenterForView}
                zoom={zoomForView}
                onMarkerClick={handleMarkerClick}
                interactive={true}
                showSearchInput={false} // Search input inside map removed
                autocompleteInputRef={mainSearchInputRef} // Main search bar used for autocomplete
                showMyLocationButton={true}
                onPlaceSelected={handlePlaceSelectedOnMapOrInput}
                onMapIdle={handleMapIdle}
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 xl:col-span-3">
             <div className="sticky top-20"> {/* Adjust top if header height changes */}
                <ParkingPreferenceFilter onApplyFilters={handleApplyFilters} />
             </div>
          </div>

          <div className="lg:col-span-8 xl:col-span-9">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {isLoading ? 'AI is Searching for Slots...' : `${displayedSpaces.length} Parking Slots Found`}
              </h2>
              {/* View mode toggle can be added here if desired */}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {[...Array(10)].map((_, i) => ( 
                  <Card key={i} className="w-full aspect-[3/4]"> 
                    <CardContent className="p-2 sm:p-3 flex flex-col justify-center items-center h-full">
                      <Skeleton className="h-5 w-1/2 mb-1" />
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-8 w-8 rounded-full mb-2" />
                      <Skeleton className="h-6 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : displayedSpaces.length === 0 ? (
                noResultsMessage()
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                    {displayedSpaces.map(slot => (
                        <ParkingSlotCard key={slot.id} space={slot} />
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
    

    
