
"use client";

import type { ParkingSpace } from '@/types';
import { slotTypeIcons } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Car, CarFront, Accessibility, Zap, Navigation, CalendarPlus } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ParkingSlotCardProps {
  space: ParkingSpace;
}

export function ParkingSlotCard({ space }: ParkingSlotCardProps) {
  const SlotTypeIcon = slotTypeIcons[space.slotType] || CarFront;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const isFallbackSlot = space.id.startsWith('fallback-slot-');
  // Determine if it's one of the hardcoded mock slots that have actual static pages
  const isStaticMockSlot = space.id === 'ps1' || space.id === 'ps2'; 
  const isBookable = !isFallbackSlot && !space.isOccupied;

  const cardBgColor = space.isOccupied ? 'bg-red-500/10 hover:bg-red-500/20' : 'bg-green-500/10 hover:bg-green-500/20';
  const borderColor = space.isOccupied ? 'border-red-500/30' : 'border-green-500/30';
  const textColor = space.isOccupied ? 'text-red-400' : 'text-green-400';
  const iconColor = space.isOccupied ? 'text-red-500/80' : 'text-green-500/80';

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (space.facilityCoordinates) {
      const { lat, lng } = space.facilityCoordinates;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    }
  };

  const handleBookNowClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click if button itself handles it.

    if (isFallbackSlot) {
        toast({ title: "Demo Slot", description: "Fallback slots are for demonstration and cannot be booked.", variant: "default" });
        return;
    }
    if (space.isOccupied) {
         toast({ title: "Slot Occupied", description: "This slot is currently occupied and cannot be booked.", variant: "default" });
        return;
    }

    let redirectUrl = `/booking/${isStaticMockSlot ? space.id : 'ps_ai_slot_booking'}`;
    const queryParams = new URLSearchParams();

    if (!isStaticMockSlot) { // It's an AI-generated slot, pass details
        queryParams.set('id', space.id);
        queryParams.set('slotLabel', space.slotLabel);
        queryParams.set('floorLevel', space.floorLevel);
        queryParams.set('slotType', space.slotType);
        queryParams.set('facilityName', space.facilityName);
        queryParams.set('facilityAddress', space.facilityAddress);
        if (space.facilityCoordinates) {
            queryParams.set('lat', String(space.facilityCoordinates.lat));
            queryParams.set('lng', String(space.facilityCoordinates.lng));
        }
        if (space.pricePerHour !== undefined) {
            queryParams.set('price', String(space.pricePerHour));
        }
        if (space.imageUrl) queryParams.set('imageUrl', space.imageUrl);
        if (space.dataAiHint) queryParams.set('dataAiHint', space.dataAiHint);
        if (space.facilityRating !== undefined) queryParams.set('rating', String(space.facilityRating));
    }
    
    const queryString = queryParams.toString();
    if (queryString) {
        redirectUrl += `?${queryString}`;
    }
    
    if (!isAuthenticated && !authLoading) {
      toast({ title: "Login Required", description: "Please log in to book a parking slot.", variant: "destructive" });
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }
    
    // If authenticated, Link component will handle navigation for static mocks,
    // or router.push for AI slots using the generic page.
    if (isStaticMockSlot) {
        // Link component will handle this case
    } else {
        router.push(redirectUrl);
    }
  };

  const bookNowButtonContent = (
    <>
      <CalendarPlus className="mr-1.5 h-3.5 w-3.5" /> Book Now
    </>
  );

  const renderBookButton = () => {
    if (isFallbackSlot) {
      return (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="default" size="sm" className="w-full mt-2 text-xs h-8" disabled={true} onClick={handleBookNowClick} >
                {bookNowButtonContent}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Fallback slots are for demo and cannot be booked.</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (space.isOccupied) {
      return (
        <Button variant="default" size="sm" className="w-full mt-2 text-xs h-8" disabled={true} onClick={handleBookNowClick} >
          {bookNowButtonContent}
        </Button>
      );
    }

    // Available and not fallback:
    if (isStaticMockSlot) { // For ps1, ps2, use direct Link
        return (
            <Button variant="default" size="sm" className="w-full mt-2 text-xs h-8" asChild
                onClick={(e) => { 
                    if (!isAuthenticated && !authLoading) {
                        e.preventDefault(); 
                        handleBookNowClick(e); 
                    }
                }}
            >
                <Link href={`/booking/${space.id}`}>
                    {bookNowButtonContent}
                </Link>
            </Button>
        );
    } else { // For AI-generated slots, button calls handleBookNowClick which uses router.push
        return (
            <Button variant="default" size="sm" className="w-full mt-2 text-xs h-8" onClick={handleBookNowClick}>
                {bookNowButtonContent}
            </Button>
        );
    }
  };
  
  const cardContent = (
    <CardContent className="p-3 sm:p-4 flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-start mb-1">
          <div className="font-bold text-sm sm:text-base text-foreground truncate" title={space.slotLabel + (space.floorLevel ? ` - ${space.floorLevel}` : '') + (space.facilityName ? ` at ${space.facilityName}`: '')}>
            {space.slotLabel}
          </div>
          <SlotTypeIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${iconColor} icon-glow`} />
        </div>
        
        <div className="text-xs text-muted-foreground mb-0.5 truncate" title={space.floorLevel ? `Floor: ${space.floorLevel}` : ''}>{space.floorLevel}</div>
        <div className="text-xs text-muted-foreground mb-1 truncate" title={space.facilityName ? `Facility: ${space.facilityName}` : ''}>{space.facilityName}</div>
      </div>

      {space.isOccupied ? (
        <div className="mt-auto space-y-1 text-center pt-1">
          <Car className={`h-5 w-5 sm:h-6 sm:w-6 mx-auto ${iconColor} mb-0.5`} />
          {space.vehicleIdOccupying && (
            <div className="text-xs text-foreground truncate" title={space.vehicleIdOccupying}>
              {space.vehicleIdOccupying}
            </div>
          )}
          {space.occupiedSince && (
            <div className="text-xs text-muted-foreground truncate" title={space.occupiedSince}>
              {space.occupiedSince}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-auto text-center pt-1">
          <SlotTypeIcon className={`h-6 w-6 sm:h-8 sm:w-8 mx-auto ${iconColor} opacity-60`} />
          <p className={`mt-1 text-sm font-semibold ${textColor}`}>Available</p>
          {space.pricePerHour !== undefined && <p className="text-xs text-muted-foreground">${space.pricePerHour.toFixed(2)}/hr</p>}
          
          {renderBookButton()}
        </div>
      )}
      
      {space.facilityCoordinates && (
          <Button
              variant="outline"
              size="icon"
              className="absolute bottom-2 right-2 h-7 w-7 z-10 border-primary/50 hover:bg-primary/10"
              title={`Navigate to ${space.facilityName || 'parking'}`}
              onClick={handleNavigate}
          >
              <Navigation className="h-3.5 w-3.5 text-primary icon-glow-primary" />
          </Button>
      )}
    </CardContent>
  );
  
  return (
    <Card className={`w-full shadow-md hover:shadow-lg transition-shadow duration-200 rounded-lg ${cardBgColor} ${borderColor} border relative`}>
        {cardContent}
    </Card>
  );
}
