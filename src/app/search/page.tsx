
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
// import { getDistanceFromLatLonInKm } from '@/lib/geoUtils'; // Not directly used here, AI handles distance logic
import { findParkingSpots, type FindParkingInput } from '@/ai/flows/find-parking-flow';

const DEFAULT_MAP_CENTER_HYD = { lat: 17.3850, lng: 78.4867 }; // Hyderabad

function SearchPageComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mainSearchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [rawAiSpaces, setRawAiSpaces] = useState<ParkingSpace[]>([]);
  const [displayedSpaces, setDisplayedSpaces] = useState<ParkingSpace[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const [mapCenterForView, setMapCenterForView] = useState<{ lat: number; lng: number } | null>(null);
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
    let initialActiveCenter: { lat: number; lng: number } | null = null;

    if (urlLat && urlLng) {
      const lat = parseFloat(urlLat);
      const lng = parseFloat(urlLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        initialCenter = { lat, lng };
        initialActiveCenter = { lat, lng };
        if (urlRadius) {
          const radius = parseFloat(urlRadius);
          if (!isNaN(radius) && radius > 0) {
            setRadiusOverride(radius);
          }
        }
      }
    }

    setMapCenterForView(initialCenter);
    if (initialActiveCenter) {
      setActiveSearchCenter(initialActiveCenter);
    }
    setSearchQuery(urlLocation);
    if (urlLocation || initialActiveCenter) {
      setSearchAttempted(true); // If URL provides search params, consider it an attempt
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Parse URL params on initial mount

  const performAiSearch = useCallback(async (location: string, radius: number, features: ParkingFeature[]) => {
    if (!location.trim() && !activeSearchCenter) { // Require either a location string or an active map center
      setRawAiSpaces([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSearchAttempted(true);
    const effectiveLocation = location.trim() || (activeSearchCenter ? `area around ${activeSearchCenter.lat.toFixed(4)}, ${activeSearchCenter.lng.toFixed(4)}` : "current map view");
    console.log(`Performing AI Search for: ${effectiveLocation}, Radius: ${radius}km, Features: ${features.join(', ')}`);

    try {
      const aiInput: FindParkingInput = {
        locationName: effectiveLocation,
        searchRadiusKm: radius,
        desiredFeatures: features.length > 0 ? features : undefined,
      };
      const results = await findParkingSpots(aiInput);
      setRawAiSpaces(results);

      // If AI returns results and no specific map center is set by user interaction,
      // try to center map on first result OR keep activeSearchCenter if it exists.
      if (results.length > 0) {
        if (!activeSearchCenter && !mapCenterForView) { // Only if no center is set at all
           setMapCenterForView(results[0].coordinates);
        } else if (activeSearchCenter) {
            setMapCenterForView(activeSearchCenter); // Prefer map interaction center
        }
      } else if (activeSearchCenter) {
        setMapCenterForView(activeSearchCenter);
      } else if (!mapCenterForView) { // No results, no active center, no view center yet
        setMapCenterForView(DEFAULT_MAP_CENTER_HYD);
      }

    } catch (error) {
      console.error("Error fetching parking spots from AI:", error);
      setRawAiSpaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeSearchCenter, mapCenterForView]);


  useEffect(() => {
    const locationToSearch = searchQuery.trim();
    if (userSetFilters && (locationToSearch || activeSearchCenter)) {
      const searchRadius = radiusOverride ?? userSetFilters.distanceMax;
      performAiSearch(
        locationToSearch,
        searchRadius,
        userSetFilters.features
      );
      if (radiusOverride) {
        setRadiusOverride(null); // Reset override after use
      }
    } else if (userSetFilters && !locationToSearch && !activeSearchCenter) {
        setRawAiSpaces([]);
    }
  }, [searchQuery, activeSearchCenter, userSetFilters, radiusOverride, performAiSearch]);


  useEffect(() => {
    let filtered = [...rawAiSpaces];
    if (userSetFilters) {
      filtered = filtered.filter(space =>
        space.pricePerHour >= userSetFilters.priceRange[0] &&
        space.pricePerHour <= userSetFilters.priceRange[1] &&
        (space.rating || 0) >= userSetFilters.ratingMin
      );
    }
    // Text filtering is now implicitly handled by AI if searchQuery is primary input
    // If AI returns broader results, this could be re-added:
    // if (searchQuery.trim()) {
    //     filtered = filtered.filter(space =>
    //       space.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    //       space.address.toLowerCase().includes(searchQuery.toLowerCase())
    //     );
    // }
    setDisplayedSpaces(filtered);
  }, [rawAiSpaces, userSetFilters]);


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Update URL, AI search will be triggered by useEffect watching searchQuery
    router.push(`/search?location=${encodeURIComponent(searchQuery)}`, { scroll: false });
    setSearchAttempted(true);
    setRadiusOverride(null); // Clear any specific radius override when doing a new manual search
    // setActiveSearchCenter(null); // Optionally clear active map center to prioritize text query
  };

  const handleApplyFilters = useCallback((filters: ParkingFilters) => {
    setUserSetFilters(filters);
    setRadiusOverride(null); // Applying filters should use the filter's distance, not an override
    setSearchAttempted(true);
  }, []);

  const handleMarkerClick = useCallback((spaceId: string) => {
    setSelectedSpaceId(spaceId);
    setViewMode('list');
    const element = document.getElementById(`space-card-${spaceId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.classList.add('ring-2', 'ring-primary', 'shadow-2xl');
    setTimeout(() => element?.classList.remove('ring-2', 'ring-primary', 'shadow-2xl'), 2000);

    const clickedSpace = displayedSpaces.find(s => s.id === spaceId);
    if (clickedSpace) {
      setSearchQuery(clickedSpace.name);
      setActiveSearchCenter(clickedSpace.coordinates);
      setMapCenterForView(clickedSpace.coordinates);
      setRadiusOverride(1); // Trigger search within 1km of this clicked pin
    }
  }, [displayedSpaces]);

  const handleMapIdle = useCallback((center: { lat: number; lng: number }) => {
    setActiveSearchCenter(center);
    setMapCenterForView(center); // Keep map view synced
    setRadiusOverride(null); // Panning/zooming should use general filters, not specific override
    setSearchAttempted(true);
  }, []);

  const handlePlaceSelectedOnMapOrInput = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const newCenter = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      const newSearchQuery = place.name || place.formatted_address || `${newCenter.lat},${newCenter.lng}`;

      setSearchQuery(newSearchQuery);
      setMapCenterForView(newCenter);
      setActiveSearchCenter(newCenter);
      setRadiusOverride(null); // New place selection uses general filters or a default like 2km from homepage
      setSearchAttempted(true);
      router.push(`/search?location=${encodeURIComponent(newSearchQuery)}&lat=${newCenter.lat}&lng=${newCenter.lng}`, { scroll: false });
    }
  }, [router]);

  const noResultsMessage = () => {
    if (!searchQuery.trim() && !activeSearchCenter && !searchAttempted && !userSetFilters) {
      return (
        <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
          <Info className="mx-auto h-12 w-12 mb-4 text-primary" />
          <p className="text-lg font-medium text-foreground">Find Parking Near You</p>
          <p className="text-sm">Enter a location in the search bar, apply filters, or pan the map. Parking spots generated by AI will appear here.</p>
        </div>
      );
    }
    return (
      <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
        <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-accent" />
        <p className="text-lg font-medium text-foreground">No Parking Spots Found by AI</p>
        <p className="text-sm">Try adjusting your search term, filters, or map location. Our AI generates fictional spots based on your query.</p>
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
              onChange={(e) => { setSearchQuery(e.target.value); setSearchAttempted(false); }}
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

            <div className={`mb-6 h-[600px] rounded-lg overflow-hidden shadow-xl ${viewMode === 'map' || displayedSpaces.length === 0 ? '' : 'hidden lg:block'}`}>
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
              <div className={`${viewMode === 'list' ? '' : 'hidden lg:hidden'}`}> {/* Hide message if map is primary and has content, or always show below map on mobile */}
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
            {viewMode === 'map' && displayedSpaces.length > 0 && (
                 <div className="lg:hidden mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {displayedSpaces.slice(0,4).map(space => (
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

    