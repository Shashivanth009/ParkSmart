"use client";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { MapPin } from "lucide-react";

interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  id: string;
}
interface MapComponentProps {
  markers?: MapMarker[];
  className?: string;
  interactive?: boolean; // To differentiate between static display and interactive map
  onMarkerClick?: (markerId: string) => void;
  zoom?: number;
  center?: { lat: number; lng: number };
}

const MapComponent: React.FC<MapComponentProps> = ({ 
  markers, 
  className, 
  interactive = true, 
  onMarkerClick,
  zoom = 12,
  center = { lat: 28.6139, lng: 77.2090 } // Default to Delhi, India
}) => {
  // In a real app, this would initialize Mappls map.
  return (
    <Card className={className} data-interactive={interactive}>
      <CardContent className="p-0 aspect-video relative bg-muted flex items-center justify-center overflow-hidden rounded-lg shadow-md">
        <Image
          src={`https://placehold.co/1200x675.png`}
          alt="Map placeholder showing city streets"
          layout="fill"
          objectFit="cover"
          data-ai-hint="map city aerial"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex flex-col items-center justify-center p-4">
          <MapPin className="w-12 h-12 text-primary mb-2 drop-shadow-glow-primary" />
          <h3 className="text-xl font-semibold text-white text-center">
            {interactive ? "Interactive Parking Map" : "Parking Area Overview"}
          </h3>
          <p className="text-sm text-gray-200 text-center">
            {interactive ? "Explore available parking spots." : "Map view of the selected area."}
          </p>
        </div>
        {markers && markers.length > 0 && (
          <div className="absolute top-2 left-2 bg-background/80 p-2 rounded-md shadow-lg max-h-32 overflow-y-auto">
            <h4 className="text-xs font-semibold mb-1">Markers:</h4>
            <ul className="text-xs space-y-0.5">
            {markers.map(m => (
              <li key={m.id} 
                  className={`cursor-pointer hover:text-primary ${interactive ? '' : 'pointer-events-none'}`}
                  onClick={() => interactive && onMarkerClick && onMarkerClick(m.id)}
              >
                {m.label}
              </li>
            ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MapComponent;
