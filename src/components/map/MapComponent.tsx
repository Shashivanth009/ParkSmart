
"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from 'next/link'; // Import Link for the anchor tag

// Declare Mappls global object for TypeScript
declare global {
  interface Window {
    mappls?: any;
  }
}

interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  id: string;
}
interface MapComponentProps {
  markers?: MapMarker[];
  className?: string;
  interactive?: boolean;
  onMarkerClick?: (markerId: string) => void;
  zoom?: number;
  center?: { lat: number; lng: number };
}

const MAPPPLS_API_KEY = process.env.NEXT_PUBLIC_MAPPPLS_API_KEY;

const MapComponent: React.FC<MapComponentProps> = ({
  markers = [],
  className,
  interactive = true,
  onMarkerClick,
  zoom = 12,
  center = { lat: 17.3850, lng: 78.4867 } // Default to Hyderabad, India
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const activeMarkersRef = useRef<any[]>([]);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  useEffect(() => {
    if (!MAPPPLS_API_KEY) {
      console.error("Mappls API key is not configured. Please set NEXT_PUBLIC_MAPPPLS_API_KEY environment variable.");
      setApiKeyMissing(true);
      setIsMapLoading(false);
      return;
    }
    setApiKeyMissing(false);

    const loadScript = (src: string, id: string) => {
      return new Promise((resolve, reject) => {
        if (document.getElementById(id)) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      });
    };

    const loadCss = (href: string, id: string) => {
      return new Promise((resolve, reject) => {
        if (document.getElementById(id)) {
          resolve(true);
          return;
        }
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve(true);
        link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
        document.head.appendChild(link);
      });
    };

    const initializeMapSDK = async () => {
      try {
        // Order might matter: CSS first, then JS.
        await loadCss(`https://apis.mappls.com/advancedmaps/api/${MAPPPLS_API_KEY}/map_sdk_css?v=3.0`, 'mappls-css');
        await loadScript(`https://apis.mappls.com/advancedmaps/api/${MAPPPLS_API_KEY}/map_sdk?layer=vector&v=3.0&libraries=services`, 'mappls-sdk');
        setScriptsLoaded(true);
      } catch (error) {
        console.error("Error loading Mappls SDK:", error);
        setIsMapLoading(false);
      }
    };

    if (typeof window !== 'undefined') {
      initializeMapSDK();
    }
  }, []);


  useEffect(() => {
    if (apiKeyMissing || !scriptsLoaded || !mapContainerRef.current || !window.mappls || !window.mappls.Map) {
      return;
    }

    if (mapInstanceRef.current) { // If map already exists, just update center/zoom
        mapInstanceRef.current.setCenter({lat: center.lat, lng: center.lng});
        mapInstanceRef.current.setZoom(zoom);
        // Marker updates are handled in their own effect
        return;
    }
    
    setIsMapLoading(true);
    try {
      const map = new window.mappls.Map(mapContainerRef.current, {
        center: { lat: center.lat, lng: center.lng },
        zoom: zoom,
        zoomControl: interactive,
        scrollWheelZoom: interactive,
        dragging: interactive,
        clickableIcons: interactive, // Make default POIs clickable or not
      });
      mapInstanceRef.current = map;

      map.on('load', () => {
        console.log("Mappls map loaded.");
        setIsMapLoading(false);
      });

      map.on('error', (e: any) => {
        console.error("Mappls map error:", e);
        setIsMapLoading(false);
      });

    } catch (error) {
      console.error("Error initializing Mappls map:", error);
      setIsMapLoading(false);
    }

    return () => {
      if (mapInstanceRef.current && typeof mapInstanceRef.current.remove === 'function') {
        activeMarkersRef.current.forEach(m => m.remove());
        activeMarkersRef.current = [];
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [scriptsLoaded, apiKeyMissing, center, zoom, interactive]);


  useEffect(() => {
    if (apiKeyMissing || !scriptsLoaded || !mapInstanceRef.current || !window.mappls || isMapLoading) {
      return;
    }

    const map = mapInstanceRef.current;

    // Clear previous markers
    activeMarkersRef.current.forEach(m => m.remove());
    activeMarkersRef.current = [];

    markers.forEach(markerData => {
      try {
        const mapplsMarker = new window.mappls.Marker({
          position: { lat: markerData.lat, lng: markerData.lng },
          map: map,
          title: markerData.label,
          fitbounds: false, // We'll handle fitbounds manually if needed
          // icon_url: 'path_to_custom_icon.png' // Optional custom icon
        });
        
        if (onMarkerClick) {
          mapplsMarker.on('click', () => {
            onMarkerClick(markerData.id);
          });
        }
        activeMarkersRef.current.push(mapplsMarker);
      } catch(e) {
        console.error("Error creating Mappls marker:", e, markerData);
      }
    });

    if (markers.length > 0 && interactive) {
      if (markers.length > 1) {
        const bounds = new window.mappls.LngLatBounds();
        markers.forEach(m => bounds.extend({lat: m.lat, lng: m.lng}));
         // Check if bounds are valid before fitting
        if (bounds.getSouthWest() && bounds.getNorthEast()) {
            try {
              map.fitBounds(bounds, { padding: 50, duration: 500 });
            } catch (e) {
                console.error("Error fitting bounds: ", e);
                // Fallback to setting center of the first marker
                map.setCenter({lat: markers[0].lat, lng: markers[0].lng});
                map.setZoom(zoom > 14 ? zoom : 14);
            }
        } else if (markers.length === 1) {
            // Single marker, center on it
            map.setCenter({lat: markers[0].lat, lng: markers[0].lng});
            map.setZoom(zoom > 14 ? zoom : 14);
        }

      } else if (markers.length === 1) {
        map.setCenter({lat: markers[0].lat, lng: markers[0].lng});
        map.setZoom(zoom > 14 ? zoom : 14);
      }
    } else if (markers.length === 0) {
        // No markers, just use the default center and zoom
        map.setCenter({lat: center.lat, lng: center.lng});
        map.setZoom(zoom);
    }

  }, [markers, scriptsLoaded, apiKeyMissing, onMarkerClick, interactive, zoom, isMapLoading, center]);


  if (apiKeyMissing) {
    return (
      <Card className={cn("flex items-center justify-center aspect-video bg-muted/50 border-destructive/50", className)} data-ai-hint="map error state">
        <CardContent className="text-center p-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-destructive">Map Configuration Error</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The Mappls API key (<code>NEXT_PUBLIC_MAPPPLS_API_KEY</code>) is missing or not configured correctly.
          </p>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border">
            <p className="font-semibold mb-1">To fix this:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Create a file named <code className="bg-card p-0.5 rounded">.env.local</code> in your project's root directory (next to <code className="bg-card p-0.5 rounded">package.json</code>).</li>
              <li>Add the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_MAPPPLS_API_KEY=YOUR_API_KEY_HERE</code> (replace with your actual key).</li>
              <li><strong>Important: Restart your Next.js development server</strong> (stop it with Ctrl+C and run `npm run dev` again).</li>
            </ol>
             <p className="mt-2">For more details, see the <Link href="https://nextjs.org/docs/app/building-your-application/configuring/environment-variables" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Next.js Environment Variables documentation</Link>.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("aspect-video relative overflow-hidden shadow-md rounded-lg", className)} data-interactive={interactive}>
      <div ref={mapContainerRef} className="w-full h-full bg-muted" data-ai-hint="interactive map placeholder" />
      {isMapLoading && (
        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading Map...</p>
        </div>
      )}
    </Card>
  );
};

export default MapComponent;
    
