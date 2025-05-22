
"use client";

import type { ParkingSpace } from '@/types';
import { slotTypeIcons } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Car, CarFront, Accessibility, Zap } from 'lucide-react'; // Ensure all needed icons are imported

interface ParkingSlotCardProps {
  space: ParkingSpace;
}

export function ParkingSlotCard({ space }: ParkingSlotCardProps) {
  const SlotTypeIcon = slotTypeIcons[space.slotType] || CarFront; // Default to CarFront for standard

  const cardBgColor = space.isOccupied ? 'bg-red-500/10 hover:bg-red-500/20' : 'bg-green-500/10 hover:bg-green-500/20';
  const borderColor = space.isOccupied ? 'border-red-500/30' : 'border-green-500/30';
  const textColor = space.isOccupied ? 'text-red-400' : 'text-green-400';
  const iconColor = space.isOccupied ? 'text-red-500/80' : 'text-green-500/80';


  return (
    <Card className={`w-full shadow-md hover:shadow-lg transition-shadow duration-200 rounded-lg ${cardBgColor} ${borderColor} border`}>
      <CardContent className="p-3 sm:p-4 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-2">
          <div className="font-bold text-sm sm:text-base text-foreground truncate" title={space.slotLabel + (space.floorLevel ? ` - ${space.floorLevel}` : '')}>
            {space.slotLabel}
          </div>
          <SlotTypeIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${iconColor} icon-glow`} />
        </div>
        
        <div className="text-xs text-muted-foreground mb-1 truncate">{space.floorLevel}</div>

        {space.isOccupied ? (
          <div className="mt-auto space-y-1 text-center">
            <Car className={`h-6 w-6 mx-auto ${iconColor} mb-1`} />
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
            <Button variant="destructive" size="sm" className="w-full mt-2 text-xs h-7">
              Release Slot
            </Button>
          </div>
        ) : (
          <div className="mt-auto text-center">
             {/* Content for available slot - could be price, or just an icon */}
            <SlotTypeIcon className={`h-8 w-8 mx-auto ${iconColor} opacity-60`} />
            <p className={`mt-1 text-sm font-semibold ${textColor}`}>Available</p>
            {space.pricePerHour && <p className="text-xs text-muted-foreground">${space.pricePerHour.toFixed(2)}/hr</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
