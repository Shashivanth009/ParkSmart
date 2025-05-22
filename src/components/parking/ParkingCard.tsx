
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ParkingSpace, ParkingFeature } from '@/types';
import { MapPin, Users, Star } from 'lucide-react'; // Removed unused icons, added Users
import { featureIcons, featureLabels } from '@/types';


interface ParkingCardProps {
  space: ParkingSpace;
}

const FeatureIconDisplay = ({ feature }: { feature: ParkingFeature }) => {
  const IconComponent = featureIcons[feature] || require('lucide-react').Car; // Default to Car icon if not found
  const label = featureLabels[feature] || feature;
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={label}>
      <IconComponent className="w-3.5 h-3.5 icon-glow" />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
};


export function ParkingCard({ space }: ParkingCardProps) {
  const availabilityColor = 
    space.availability === 'high' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
    space.availability === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
    space.availability === 'low' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
    'bg-red-500/20 text-red-400 border-red-500/30';

  return (
    <Card className="w-full overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1">
      {space.imageUrl && (
        <div className="relative w-full h-48">
          <Image
            src={space.imageUrl}
            alt={`Parking at ${space.name}`}
            layout="fill"
            objectFit="cover"
            data-ai-hint="parking lot exterior"
          />
           {space.rating && (
            <Badge variant="default" className="absolute top-2 right-2 bg-black/70 text-white border-none">
              <Star className="w-3.5 h-3.5 mr-1 text-yellow-400" /> {space.rating.toFixed(1)}
            </Badge>
          )}
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-xl">{space.name}</CardTitle>
        <CardDescription className="flex items-center text-sm">
          <MapPin className="w-4 h-4 mr-1.5 text-muted-foreground icon-glow" />
          {space.address}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <Badge className={`${availabilityColor} px-2.5 py-1 text-xs font-medium`}>
            {space.availability.toUpperCase()}
          </Badge>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">${space.pricePerHour.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">per hour</p>
          </div>
        </div>
        
        { (space.availableSpots !== undefined && space.totalSpots !== undefined) &&
            <div className="flex items-center text-sm text-muted-foreground">
                <Users className="w-4 h-4 mr-1.5 icon-glow" />
                {space.availableSpots} / {space.totalSpots} spots available
            </div>
        }

        {/* Removed static distance display
        {space.distance && (
          <p className="text-sm text-muted-foreground">Distance: {space.distance}</p>
        )}
        */}

        <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
          {space.features.slice(0, 3).map(feature => ( // Show max 3 features initially
            <FeatureIconDisplay key={feature} feature={feature} />
          ))}
          {space.features.length > 3 && (
            <Badge variant="outline" className="text-xs">+ {space.features.length - 3} more</Badge>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" asChild>
          <Link href={`/booking/${space.id}`}>
            View Details & Book
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

