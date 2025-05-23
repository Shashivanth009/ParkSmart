
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
import { Card, CardHeader, CardContent } from '@/components/ui/card';
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
        initialActiveCenter = { lat, lng }; 
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

    if (urlLocation || initialActiveCenter) {
      setSearchAttempted(true); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const performAiSearch = useCallback(async (
    locationQuery: string,
    radius: number,
    features: ParkingFeature[],
    contextualSearchCenter: { lat: number; lng: number } | null 
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
          setMapCenterForView(results[0].facilityCoordinates);
          setActiveSearchCenter(results[0].facilityCoordinates); 
          setZoomForView(FOCUSED_MAP_ZOOM);
        }
      }
      
    } catch (error) {
      console.error("Error fetching parking slots from AI:", error);
      setRawAiSpaces([]); // Clear spaces on error
    } finally {
      setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    const locationToSearch = searchQuery.trim();
    if (userSetFilters && (locationToSearch || activeSearchCenter || (searchAttempted && !locationToSearch && !activeSearchCenter))) {
      const searchRadius = radiusOverride ?? userSetFilters.distanceMax;
      const desiredFeaturesForAI = userSetFilters.features;
      
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
  }, [searchQuery, activeSearchCenter, userSetFilters, radiusOverride, searchAttempted]);


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
            let matches = true;
            if (hasEvFeature && slot.slotType !== 'ev-charging') matches = false;
            if (hasAccessibleFeature && slot.slotType !== 'accessible') matches = false;
            // If neither specific type is requested, standard slots are okay
            // If both are requested, slot must be one or the other (current AI doesn't combine, maybe standard if that's the fallback)
            // This logic might need AI to generate slots that are BOTH if such a filter is applied.
            // For now, if EV is checked, only EV slots (or standard if that's the implicit fallback). If Accessible, only Accessible.
            // If "standard" slots should also pass if specific types are checked, this logic might need to be broader.
            // The current AI prompt is asked to include slots of desired type if requested.
            return matches || slot.slotType === 'standard'; // Allow standard if it doesn't conflict with a specific request.
         });
      }
    }
    setDisplayedSpaces(filtered);
  }, [rawAiSpaces, userSetFilters, activeSearchCenter, radiusOverride]);


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchAttempted(true);
    setRadiusOverride(null);

    if (!searchQuery.trim() && !activeSearchCenter) {
      setRawAiSpaces([]);
      return;
    }

    // If activeSearchCenter is set, it means a place was likely selected via autocomplete.
    // The searchQuery is the name of that place. We want to search based on this.
    // If activeSearchCenter is NOT set, it's a pure text search. AI will try to find it.
    
    const urlParams = new URLSearchParams();
    if (searchQuery.trim()) {
        urlParams.set('location', searchQuery.trim());
    }
    if (activeSearchCenter) { // If center is known (e.g. from autocomplete)
        urlParams.set('lat', activeSearchCenter.lat.toString());
        urlParams.set('lng', activeSearchCenter.lng.toString());
    }
    router.push(`/search?${urlParams.toString()}`, { scroll: false });

    // Trigger AI search, performAiSearch useEffect will pick up changes to searchQuery or activeSearchCenter.
    // If they haven't changed but user clicked search again, explicitly call:
     if (userSetFilters) {
        performAiSearch(
            searchQuery.trim(),
            radiusOverride ?? userSetFilters.distanceMax,
            userSetFilters.features,
            activeSearchCenter // Pass current activeSearchCenter
        );
    }
  };

  const handleApplyFilters = useCallback((filters: ParkingFilters) => {
    setUserSetFilters(filters);
    setRadiusOverride(null); 
    setSearchAttempted(true); 
  }, []);

  const handleMarkerClick = useCallback((markerId: string) => {
    const clickedSlot = rawAiSpaces.find(s => s.id === markerId);
    if (clickedSlot && clickedSlot.facilityCoordinates) {
      setSearchQuery(clickedSlot.facilityName || clickedSlot.facilityAddress || clickedSlot.slotLabel); 
      setActiveSearchCenter(clickedSlot.facilityCoordinates);
      setMapCenterForView(clickedSlot.facilityCoordinates);
      setZoomForView(FOCUSED_MAP_ZOOM + 2); // Zoom in a bit more on specific facility
      setRadiusOverride(1); // Trigger AI search for 1km radius around this specific facility pin
      setSearchAttempted(true);
      if (mainSearchInputRef.current) {
        mainSearchInputRef.current.focus();
         window.scrollTo({ top: mainSearchInputRef.current.offsetTop - 20, behavior: 'smooth' });
      }
    }
  }, [rawAiSpaces]);

  const handleMapIdle = useCallback((center: { lat: number; lng: number }, newZoom: number) => {
    if (!activeSearchCenter || 
        Math.abs(activeSearchCenter.lat - center.lat) > 0.005 || // Increased threshold for map idle trigger
        Math.abs(activeSearchCenter.lng - center.lng) > 0.005 || 
        zoomForView !== newZoom ) {
        
        setActiveSearchCenter(center); 
        setMapCenterForView(center); 
        setZoomForView(newZoom);
        setRadiusOverride(null); 
        setSearchAttempted(true);
        // setSearchQuery(''); // Clearing query on map move makes it map-centric
    }
  }, [activeSearchCenter, zoomForView]);

  const handlePlaceSelectedOnMapOrInput = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const newCenter = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      const newSearchQuery = place.name || place.formatted_address || `${newCenter.lat.toFixed(4)},${newCenter.lng.toFixed(4)}`;

      setSearchQuery(newSearchQuery); 
      setActiveSearchCenter(newCenter); 
      setMapCenterForView(newCenter); 
      setZoomForView(FOCUSED_MAP_ZOOM); 
      
      setRadiusOverride(null); 
      setSearchAttempted(true);
      
      const urlParams = new URLSearchParams();
      urlParams.set('location', newSearchQuery);
      urlParams.set('lat', newCenter.lat.toString());
      urlParams.set('lng', newCenter.lng.toString());
      router.push(`/search?${urlParams.toString()}`, { scroll: false });
    }
  }, [router]);

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
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="pl-10 pr-4 py-3 h-12 text-base w-full"
            />
          </div>
          <Button type="submit" size="lg" className="h-12 shrink-0">
            <SearchIcon className="mr-2 h-5 w-5" /> Search
          </Button>
        </form>
        
        <div className="mb-8 h-[400px] md:h-[500px] rounded-lg overflow-hidden shadow-xl">
            <MapComponent
                markers={displayedSpaces.map(s => ({ 
                    id: s.id, 
                    lat: s.facilityCoordinates.lat, 
                    lng: s.facilityCoordinates.lng, 
                    label: `${s.slotLabel} @ ${s.facilityName}` 
                }))}
                center={mapCenterForView}
                zoom={zoomForView}
                onMarkerClick={handleMarkerClick}
                interactive={true}
                showSearchInput={true} // Enable map's internal search
                autocompleteInputRef={mainSearchInputRef} 
                showMyLocationButton={true}
                onPlaceSelected={handlePlaceSelectedOnMapOrInput}
                onMapIdle={handleMapIdle}
            />
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
                {isLoading ? 'AI is Searching for Slots...' : `${displayedSpaces.length} Parking Slots Found`}
              </h2>
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
