
"use client";
import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ParkingSlotCard } from '@/components/parking/ParkingSlotCard';
import type { ParkingSpace, ParkingFeature } from '@/types';
import { ParkingPreferenceFilter, type ParkingFilters } from '@/components/booking/ParkingPreferenceFilter';
import { PageTitle } from '@/components/core/PageTitle';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { ListFilter, MapPin as MapPinIcon, Loader2, AlertTriangle, Info, ServerCrash, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { findParkingSpots, type FindParkingInput } from '@/ai/flows/find-parking-flow';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

function SearchPageComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [rawAiSpaces, setRawAiSpaces] = useState<ParkingSpace[]>([]);
  const [displayedSpaces, setDisplayedSpaces] = useState<ParkingSpace[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [aiSearchPerformed, setAiSearchPerformed] = useState(false);
  const [aiSearchUnavailable, setAiSearchUnavailable] = useState(false); // For static export

  const [userSetFilters, setUserSetFilters] = useState<ParkingFilters | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    // This app is configured for static export, AI flows are not available.
    setAiSearchUnavailable(true); 
  }, []);

  // Initial query parameter processing (only location name from URL now)
  useEffect(() => {
    const urlLocation = searchParams.get('location') || '';
    setSearchQuery(urlLocation);
    if (urlLocation) {
      setSearchAttempted(true);
    }
    setIsInitialLoad(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  const performAiSearch = useCallback(async (
    locationQuery: string, 
    radius: number,
    features: ParkingFeature[]
  ) => {
    if (aiSearchUnavailable) {
      setIsLoading(false);
      setRawAiSpaces([]);
      setDisplayedSpaces([]);
      setAiSearchPerformed(true);
      console.warn("AI Search is unavailable in static export mode.");
      return;
    }

    if (!isAuthenticated && !authLoading) {
      toast({title: "Login Required", description: "Please log in to search for parking.", variant: "destructive"});
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!locationQuery) {
      setRawAiSpaces([]);
      setDisplayedSpaces([]);
      setIsLoading(false);
      setAiSearchPerformed(true); 
      toast({title: "Search Empty", description:"Please enter a location to search.", variant: "default"});
      return;
    }

    setIsLoading(true);
    setAiSearchPerformed(true);
    try {
      const searchInput: FindParkingInput = {
        locationName: locationQuery,
        searchRadiusKm: radius,
        desiredFeatures: features.length > 0 ? features : undefined,
      };
      const results = await findParkingSpots(searchInput);
      setRawAiSpaces(results);
    } catch (error: any) {
      console.error("AI search failed:", error);
      toast({title: "AI Search Error", description: error.message || "Could not fetch parking spots.", variant: "destructive"});
      setRawAiSpaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authLoading, router, aiSearchUnavailable]);


  useEffect(() => {
    if (isInitialLoad || !userSetFilters || !searchAttempted) return;
    if (aiSearchUnavailable) return;

    const locationToSearch = searchQuery.trim();
    const searchRadiusToUse = userSetFilters.distanceMax;
    const desiredFeaturesForAI = userSetFilters.features;
    
    performAiSearch(
      locationToSearch,
      searchRadiusToUse,
      desiredFeaturesForAI
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSetFilters, searchAttempted, isInitialLoad, aiSearchUnavailable]); // Added aiSearchUnavailable

  useEffect(() => {
    if (isInitialLoad || aiSearchUnavailable) return; 
    if (userSetFilters && searchQuery.trim()) { 
      setSearchAttempted(true); 
    }
  }, [searchQuery, userSetFilters, isInitialLoad, aiSearchUnavailable]);


  useEffect(() => {
    if (aiSearchUnavailable) {
      setDisplayedSpaces([]);
      return;
    }
    let filtered = [...rawAiSpaces];
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
            if (!hasEvFeature && !hasAccessibleFeature) return true;
            return matchesType; 
         });
      }
    }
    setDisplayedSpaces(filtered);
  }, [rawAiSpaces, userSetFilters, aiSearchUnavailable]);


  const handleApplyFilters = useCallback((filters: ParkingFilters) => {
    setUserSetFilters(filters);
    setSearchAttempted(true); 
  }, []);
  
  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleTextSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated && !authLoading && !aiSearchUnavailable) {
        toast({title: "Login Required", description: "Please log in to search for parking.", variant: "destructive"});
        router.push(`/login?redirect=${encodeURIComponent(`/search?location=${searchQuery}`)}`);
        return;
    }
    if (!searchQuery.trim() && !aiSearchUnavailable) {
       toast({title: "Search Empty", description:"Please enter a location to search.", variant: "default"});
       return;
    }
    
    setSearchAttempted(true); 

    const urlParams = new URLSearchParams();
    if(searchQuery.trim()) urlParams.set('location', searchQuery.trim());
    router.push(`/search?${urlParams.toString()}`, { scroll: false });
  };


  const noResultsMessage = () => {
    if (aiSearchUnavailable) {
        return (
            <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
            <ServerCrash className="mx-auto h-12 w-12 mb-4 text-destructive" />
            <p className="text-lg font-medium text-foreground">AI-Powered Parking Search Unavailable</p>
            <p className="text-sm">This feature is currently not available. Map-based search is also simplified.</p>
            </div>
        );
    }
    if (!aiSearchPerformed && !searchQuery.trim()) {
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

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <PageTitle 
            title="AI Parking Slot Finder" 
            description={searchQuery ? `Showing results for "${searchQuery}"` : "Search by location and filter preferences."}
        />
        
        <form onSubmit={handleTextSearchSubmit} className="mb-6 flex items-center gap-2">
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground icon-glow" />
                <Input
                    type="text"
                    placeholder="Enter location, e.g., 'Restaurant near Charminar'"
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    className="pl-10 pr-4 py-2.5 h-11 text-base"
                    aria-label="Search parking location"
                />
            </div>
            <Button type="submit" size="lg" className="h-11 shrink-0">
                <Search className="mr-2 h-5 w-5" /> Search
            </Button>
        </form>
        
        <div className="mb-8 h-[300px] md:h-[400px] rounded-lg overflow-hidden shadow-xl bg-muted flex items-center justify-center relative">
            <Image 
                src="https://placehold.co/1200x400.png" 
                alt="Map View Placeholder"
                fill={true}
                className="object-cover"
                data-ai-hint="city map illustration"
                priority
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="text-center p-4">
                    <MapPinIcon className="h-12 w-12 text-white/70 mx-auto mb-3" />
                    <p className="text-lg text-white/80">Map view is currently a placeholder.</p>
                    <p className="text-sm text-white/60">Search by location name using the bar above.</p>
                </div>
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
                {isLoading ? 'Loading Parking Slots...' : 
                 aiSearchUnavailable ? 'AI Search Unavailable' : 
                 `${displayedSpaces.length} Parking Slots Found`}
              </h2>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {[...Array(10)].map((_, i) => (
                  <Card key={i} className="w-full aspect-[3/4] sm:aspect-[2/3] shadow-md">
                    <CardContent className="p-2 sm:p-3 flex flex-col justify-center items-center h-full">
                      <Skeleton className="h-5 w-1/2 mb-1" />
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-8 w-8 rounded-full mb-2" />
                      <Skeleton className="h-6 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : displayedSpaces.length === 0 || aiSearchUnavailable ? (
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

    