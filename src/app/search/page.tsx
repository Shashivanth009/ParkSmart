
"use client";
import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import MapComponent from '@/components/map/MapComponent';
import { ParkingSlotCard } from '@/components/parking/ParkingSlotCard';
import type { ParkingSpace, ParkingFeature } from '@/types';
import { ParkingPreferenceFilter, type ParkingFilters } from '@/components/booking/ParkingPreferenceFilter';
import { PageTitle } from '@/components/core/PageTitle';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { Card, CardHeader, CardContent } from '@/components/ui/card'; // Keep Card imports if needed by skeleton or other elements
import { ListFilter, Map, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { findParkingSpots, type FindParkingInput } from '@/ai/flows/find-parking-flow';
import { getDistanceFromLatLonInKm } from '@/lib/geoUtils';


const DEFAULT_MAP_CENTER_HYD = { lat: 17.3850, lng: 78.4867 };
const DEFAULT_MAP_ZOOM = 12;
const FOCUSED_MAP_ZOOM = 15;

function SearchPageComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState(''); // Still used to display current search context
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
          const radiusNum = parseFloat(urlRadius);
          if (!isNaN(radiusNum) && radiusNum > 0) {
            initialRadiusOverride = radiusNum;
          }
        }
      }
    }
    
    setMapCenterForView(initialCenter);
    setZoomForView(initialZoom);
    if (initialActiveCenter) setActiveSearchCenter(initialActiveCenter);
    if (initialRadiusOverride) setRadiusOverride(initialRadiusOverride);
    setSearchQuery(urlLocation); // Keep setting searchQuery for display and context

    if (urlLocation || initialActiveCenter) {
      setSearchAttempted(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed searchParams from dependencies to avoid re-triggering on every router.push

  const performAiSearch = useCallback(async (
    locationQueryForDisplay: string, // This is mostly for the AI's context if no coords are given
    radius: number,
    features: ParkingFeature[],
    contextualSearchCenter: { lat: number; lng: number } | null
  ) => {
    // If no text query AND no map center to search around, don't search.
    if (!locationQueryForDisplay.trim() && !contextualSearchCenter) {
      setRawAiSpaces([]);
      setIsLoading(false);
      setSearchAttempted(true); // Mark that a "search" (or lack thereof) was attempted
      return;
    }

    setIsLoading(true);
    setSearchAttempted(true);
    const effectiveLocationForAI = locationQueryForDisplay.trim() || (contextualSearchCenter ? `area around ${contextualSearchCenter.lat.toFixed(4)}, ${contextualSearchCenter.lng.toFixed(4)}` : "current map view");
    console.log(`Performing AI Slot Search for: ${effectiveLocationForAI}, Radius: ${radius}km, Features: ${features.join(', ')}`);

    try {
      const aiInput: FindParkingInput = {
        locationName: effectiveLocationForAI,
        searchRadiusKm: radius,
        desiredFeatures: features.length > 0 ? features : undefined,
      };
      const results = await findParkingSpots(aiInput);
      setRawAiSpaces(results);

      // If this search was triggered by a text query (locationQueryForDisplay was present and no specific contextualSearchCenter was used to guide it),
      // and AI returned results, then update map view to the first result's facility.
      if (locationQueryForDisplay.trim() && !contextualSearchCenter && results.length > 0 && results[0]?.facilityCoordinates) {
          setMapCenterForView(results[0].facilityCoordinates);
          setActiveSearchCenter(results[0].facilityCoordinates); // Also set this as the active geographic filter point
          setZoomForView(FOCUSED_MAP_ZOOM);
      } else if (contextualSearchCenter) {
        // If search was guided by map, ensure map view remains consistent with that
        setMapCenterForView(contextualSearchCenter);
        setZoomForView(zoomForView); // Keep current or a reasonable zoom
      }
    } catch (error) {
      console.error("Error fetching parking slots from AI:", error);
      setRawAiSpaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [zoomForView]); // Added zoomForView dependency


  useEffect(() => {
    // This effect triggers the AI search when relevant states change.
    const locationToSearchForDisplay = searchQuery.trim();

    if (userSetFilters && (locationToSearchForDisplay || activeSearchCenter || (searchAttempted && !locationToSearchForDisplay && !activeSearchCenter))) {
      const searchRadiusToUse = radiusOverride ?? userSetFilters.distanceMax;
      const desiredFeaturesForAI = userSetFilters.features;
      
      // Prioritize activeSearchCenter for geographic context if available.
      // If not, let AI try to geocode based on locationToSearchForDisplay.
      const geographicContext = activeSearchCenter;

      performAiSearch(
        locationToSearchForDisplay,
        searchRadiusToUse,
        desiredFeaturesForAI,
        geographicContext 
      );
      if (radiusOverride) {
        setRadiusOverride(null); // Consume radius override after use
      }
    } else if (userSetFilters && !locationToSearchForDisplay && !activeSearchCenter && searchAttempted) {
        setRawAiSpaces([]); // Clear results if no search criteria but filters are set and search was attempted
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeSearchCenter, userSetFilters, radiusOverride, searchAttempted]); //performAiSearch is memoized


  useEffect(() => {
    // This effect filters the raw AI spaces based on client-side criteria
    let filtered = [...rawAiSpaces];

    // Geographic filter based on activeSearchCenter (if set) and distanceMax from filters
    if (activeSearchCenter && userSetFilters && !radiusOverride) { // Don't apply client distance filter if a radiusOverride was just used for AI search
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

    // Other client-side filters (price, rating, specific slot types based on features)
    if (userSetFilters) {
      filtered = filtered.filter(slot =>
        (slot.pricePerHour === undefined || (slot.pricePerHour >= userSetFilters.priceRange[0] && slot.pricePerHour <= userSetFilters.priceRange[1])) &&
        (slot.facilityRating === undefined || slot.facilityRating >= userSetFilters.ratingMin)
      );

      const hasEvFeature = userSetFilters.features.includes('ev-charging');
      const hasAccessibleFeature = userSetFilters.features.includes('disabled-access');

      if (hasEvFeature || hasAccessibleFeature) {
         filtered = filtered.filter(slot => {
            if (hasEvFeature && slot.slotType === 'ev-charging') return true;
            if (hasAccessibleFeature && slot.slotType === 'accessible') return true;
            // If a specific type is requested, only allow that type or if no specific type features are selected then allow standard.
            // This logic needs to ensure that if ONLY EV is checked, standard slots are filtered out.
            if ((hasEvFeature && slot.slotType !== 'ev-charging') || (hasAccessibleFeature && slot.slotType !== 'accessible')) {
                return false; // If specific type requested and slot doesn't match, filter out.
            }
            return true; // If no specific types requested or it matches.
         });
      }
    }
    setDisplayedSpaces(filtered);
  }, [rawAiSpaces, userSetFilters, activeSearchCenter, radiusOverride]);


  const handleApplyFilters = useCallback((filters: ParkingFilters) => {
    setUserSetFilters(filters);
    setRadiusOverride(null); // Clear any temporary radius override when applying new general filters
    setSearchAttempted(true); // Applying filters implies a search attempt
  }, []);

  const handleMarkerClick = useCallback((markerId: string) => {
    // This function is called when a ParkingSlotCard's marker (pin) on the map is clicked.
    const clickedSlot = rawAiSpaces.find(s => s.id === markerId);
    if (clickedSlot && clickedSlot.facilityCoordinates) {
      const newSearchQuery = clickedSlot.facilityName || clickedSlot.facilityAddress || clickedSlot.slotLabel;
      setSearchQuery(newSearchQuery); // Update display query
      setActiveSearchCenter(clickedSlot.facilityCoordinates);
      setMapCenterForView(clickedSlot.facilityCoordinates);
      setZoomForView(FOCUSED_MAP_ZOOM + 1); // Zoom in a bit more on specific pin
      setRadiusOverride(1); // Trigger AI search for 1km radius around this specific facility pin
      setSearchAttempted(true);

      // Update URL
      const urlParams = new URLSearchParams();
      urlParams.set('location', newSearchQuery);
      urlParams.set('lat', clickedSlot.facilityCoordinates.lat.toString());
      urlParams.set('lng', clickedSlot.facilityCoordinates.lng.toString());
      urlParams.set('radius', '1');
      router.push(`/search?${urlParams.toString()}`, { scroll: false });
    }
  }, [rawAiSpaces, router]);

  const handleMapIdle = useCallback((center: { lat: number; lng: number }, newZoom: number) => {
    // Called when map finishes panning or zooming.
    const distanceMovedThreshold = 0.5; //公里
    const distanceMoved = activeSearchCenter ? getDistanceFromLatLonInKm(activeSearchCenter.lat, activeSearchCenter.lng, center.lat, center.lng) : Infinity;
    
    if (!activeSearchCenter || distanceMoved > distanceMovedThreshold || zoomForView !== newZoom ) {
        setSearchQuery(''); // Clear text query when map interaction drives search
        setActiveSearchCenter(center);
        setMapCenterForView(center); // Keep visual center aligned
        setZoomForView(newZoom);
        setRadiusOverride(null); // Use default radius from filters for map idle searches
        setSearchAttempted(true);

        // Update URL
        const urlParams = new URLSearchParams();
        urlParams.set('lat', center.lat.toString());
        urlParams.set('lng', center.lng.toString());
        // Optionally add radius from filters if filters are set
        if (userSetFilters) {
            urlParams.set('radius', userSetFilters.distanceMax.toString());
        }
        router.push(`/search?${urlParams.toString()}`, { scroll: false });
    }
  }, [activeSearchCenter, zoomForView, router, userSetFilters]);

  const handlePlaceSelectedOnMapOrInput = useCallback((place: google.maps.places.PlaceResult) => {
    // Called when a place is selected from map's internal search input.
    if (place.geometry?.location) {
      const newCenter = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      const newSearchQuery = place.name || place.formatted_address || `${newCenter.lat.toFixed(4)},${newCenter.lng.toFixed(4)}`;

      setSearchQuery(newSearchQuery); // Update display query
      setActiveSearchCenter(newCenter);
      setMapCenterForView(newCenter);
      setZoomForView(FOCUSED_MAP_ZOOM);
      setRadiusOverride(null); // Use default radius from filters
      setSearchAttempted(true);

      const urlParams = new URLSearchParams();
      urlParams.set('location', newSearchQuery);
      urlParams.set('lat', newCenter.lat.toString());
      urlParams.set('lng', newCenter.lng.toString());
      if (userSetFilters) {
        urlParams.set('radius', userSetFilters.distanceMax.toString());
      }
      router.push(`/search?${urlParams.toString()}`, { scroll: false });
    }
  }, [router, userSetFilters]);

  const noResultsMessage = () => {
    if (!searchQuery.trim() && !activeSearchCenter && !searchAttempted && !userSetFilters) {
      return (
        <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
          <Info className="mx-auto h-12 w-12 mb-4 text-primary" />
          <p className="text-lg font-medium text-foreground">Find Parking Slots</p>
          <p className="text-sm">Use the map search or apply filters to find AI-generated parking slots.</p>
        </div>
      );
    }
    return (
      <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
        <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-accent" />
        <p className="text-lg font-medium text-foreground">No Parking Slots Found by AI</p>
        <p className="text-sm">Try adjusting your map location or filters. Our AI generates fictional slots based on your query.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <PageTitle 
            title="AI Parking Slot Finder" 
            description={searchQuery ? `Showing results for "${searchQuery}"` : "Search by map and filter preferences. Our AI will generate fictional parking slots!"}
        />
        
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
                showSearchInput={true} 
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
                {isLoading ? 'AI is Generating Parking Slots...' : `${displayedSpaces.length} Parking Slots Found`}
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

