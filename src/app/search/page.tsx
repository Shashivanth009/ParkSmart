
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
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ListFilter, Map, Loader2, AlertTriangle, Info, ServerCrash } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
// import { findParkingSpots, type FindParkingInput } from '@/ai/flows/find-parking-flow'; // AI Flow will not work in static export
import { getDistanceFromLatLonInKm } from '@/lib/geoUtils';


const DEFAULT_MAP_CENTER_HYD = { lat: 17.3850, lng: 78.4867 };
const DEFAULT_MAP_ZOOM = 12;
const FOCUSED_MAP_ZOOM = 15;

function SearchPageComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [rawAiSpaces, setRawAiSpaces] = useState<ParkingSpace[]>([]);
  const [displayedSpaces, setDisplayedSpaces] = useState<ParkingSpace[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [aiSearchUnavailable, setAiSearchUnavailable] = useState(true); // Assume AI is unavailable for static export

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
    setSearchQuery(urlLocation); 

    if (urlLocation || initialActiveCenter) {
      setSearchAttempted(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const performAiSearch = useCallback(async (
    locationQueryForDisplay: string, 
    radius: number,
    features: ParkingFeature[],
    contextualSearchCenter: { lat: number; lng: number } | null
  ) => {
    // AI Search is disabled for static export on Spark plan
    setRawAiSpaces([]);
    setIsLoading(false);
    setSearchAttempted(true); 
    console.warn("AI parking search is unavailable in static export mode (Firebase Spark plan).");

    // If we had dummy data for static display, we could set it here.
    // For now, it will always show "AI Search Unavailable".

  }, []);


  useEffect(() => {
    let locationToSearchForDisplay = searchQuery.trim();
    let geographicContext = activeSearchCenter;

    if (searchAttempted && userSetFilters) {
        if (!locationToSearchForDisplay && !geographicContext) {
            // If no text query and no map center, but filters applied,
            // perhaps default to a very wide area if desired or do nothing.
            // For now, if both are empty, performAiSearch will handle it by doing nothing or showing "no query".
        }
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
    } else if (userSetFilters && !locationToSearchForDisplay && !activeSearchCenter && searchAttempted) {
        setRawAiSpaces([]); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSetFilters, searchAttempted]); // Removed searchQuery, activeSearchCenter, radiusOverride to avoid too many calls

  // Separate effect to trigger search when query/center changes IF filters are already set
   useEffect(() => {
    if (userSetFilters && (searchQuery.trim() || activeSearchCenter)) { // Only if filters already exist
      setSearchAttempted(true); // This will trigger the effect above
    }
  }, [searchQuery, activeSearchCenter, userSetFilters]);


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
            if (hasEvFeature && slot.slotType === 'ev-charging') return true;
            if (hasAccessibleFeature && slot.slotType === 'accessible') return true;
            if ((hasEvFeature && slot.slotType !== 'ev-charging') || (hasAccessibleFeature && slot.slotType !== 'accessible')) {
                return false; 
            }
            return true; 
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

  const handleMarkerClick = useCallback((markerId: string) => {
    const clickedSlot = rawAiSpaces.find(s => s.id === markerId);
    if (clickedSlot && clickedSlot.facilityCoordinates) {
      const newSearchQuery = clickedSlot.facilityName || clickedSlot.facilityAddress || clickedSlot.slotLabel;
      setSearchQuery(newSearchQuery); 
      setActiveSearchCenter(clickedSlot.facilityCoordinates);
      setMapCenterForView(clickedSlot.facilityCoordinates);
      setZoomForView(FOCUSED_MAP_ZOOM + 1); 
      setRadiusOverride(1); 
      setSearchAttempted(true);

      const urlParams = new URLSearchParams();
      urlParams.set('location', newSearchQuery);
      urlParams.set('lat', clickedSlot.facilityCoordinates.lat.toString());
      urlParams.set('lng', clickedSlot.facilityCoordinates.lng.toString());
      urlParams.set('radius', '1');
      router.push(`/search?${urlParams.toString()}`, { scroll: false });
    }
  }, [rawAiSpaces, router]);

  const handleMapIdle = useCallback((center: { lat: number; lng: number }, newZoom: number) => {
    const distanceMovedThreshold = 2; 
    const distanceMoved = activeSearchCenter ? getDistanceFromLatLonInKm(activeSearchCenter.lat, activeSearchCenter.lng, center.lat, center.lng) : Infinity;
    
    if (!activeSearchCenter || distanceMoved > distanceMovedThreshold || zoomForView !== newZoom ) {
        setSearchQuery(''); 
        setActiveSearchCenter(center);
        setMapCenterForView(center); 
        setZoomForView(newZoom);
        setRadiusOverride(null); 
        setSearchAttempted(true);

        const urlParams = new URLSearchParams();
        urlParams.set('lat', center.lat.toString());
        urlParams.set('lng', center.lng.toString());
        if (userSetFilters) {
            urlParams.set('radius', userSetFilters.distanceMax.toString());
        }
        router.push(`/search?${urlParams.toString()}`, { scroll: false });
    }
  }, [activeSearchCenter, zoomForView, router, userSetFilters]);

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
      if (userSetFilters) {
        urlParams.set('radius', userSetFilters.distanceMax.toString());
      }
      router.push(`/search?${urlParams.toString()}`, { scroll: false });
    }
  }, [router, userSetFilters]);

  const noResultsMessage = () => {
    if (aiSearchUnavailable) {
        return (
            <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
                <ServerCrash className="mx-auto h-12 w-12 mb-4 text-destructive" />
                <p className="text-lg font-medium text-foreground">AI-Powered Parking Search Unavailable</p>
                <p className="text-sm">This feature requires server-side capabilities not available on the current hosting plan. Static site content is displayed.</p>
            </div>
        );
    }
    if (!searchQuery.trim() && !activeSearchCenter && !searchAttempted && !userSetFilters) {
      return (
        <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
          <Info className="mx-auto h-12 w-12 mb-4 text-primary" />
          <p className="text-lg font-medium text-foreground">Find Parking Slots</p>
          <p className="text-sm">Use the map search or apply filters. Our AI will generate fictional parking slots!</p>
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
            description={searchQuery ? `Showing results for "${searchQuery}"` : "Search by map and filter preferences."}
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
             <div className="sticky top-20"> 
                <ParkingPreferenceFilter onApplyFilters={handleApplyFilters} />
             </div>
          </div>

          <div className="lg:col-span-8 xl:col-span-9">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {isLoading ? 'Loading Parking Slots...' : (aiSearchUnavailable ? 'AI Search Unavailable' : `${displayedSpaces.length} Parking Slots Found`)}
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
            ) : aiSearchUnavailable || displayedSpaces.length === 0 ? (
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
