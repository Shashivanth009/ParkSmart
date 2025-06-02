
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
    e.stopPropagation();
    if (isFallbackSlot) {
        // This click handler might not even be reached if button is truly disabled,
        // but good for clarity. Tooltip is primary feedback.
        toast({
            title: "Demo Slot",
            description: "Fallback slots are for demonstration and cannot be booked.",
            variant: "default"
        });
        return;
    }
    if (!isAuthenticated && !authLoading) {
      toast({
        title: "Login Required",
        description: "Please log in to book a parking slot.",
        variant: "destructive"
      });
      router.push(`/login?redirect=/booking/${space.id}`);
      return;
    }
    // If authenticated, navigation is handled by the Link component
  };

  const bookNowButton = (
    <Button
      variant="default"
      size="sm"
      className="w-full mt-2 text-xs h-8"
      onClick={handleBookNowClick}
      disabled={isFallbackSlot || space.isOccupied}
      asChild={!isFallbackSlot && !space.isOccupied} // Only use asChild if not disabled
    >
      {isFallbackSlot || space.isOccupied ? (
        <span className="flex items-center">
          <CalendarPlus className="mr-1.5 h-3.5 w-3.5" /> Book Now
        </span>
      ) : (
        <Link href={`/booking/${space.id}`}>
            <CalendarPlus className="mr-1.5 h-3.5 w-3.5" /> Book Now
        </Link>
      )}
    </Button>
  );

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
          
          {isFallbackSlot ? (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>{bookNowButton}</TooltipTrigger>
                <TooltipContent>
                  <p>Fallback slots are for demo and cannot be booked.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            bookNowButton
          )}
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
