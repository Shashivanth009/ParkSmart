
"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from 'next/link';

// Declare Google Maps global object for TypeScript
declare global {
  interface Window {
    google?: typeof google;
    initMapComponent?: () => void; // For the Google Maps callback
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

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const MapComponent: React.FC<MapComponentProps> = ({
  markers = [],
  className,
  interactive = true,
  onMarkerClick,
  zoom = 12,
  center = { lat: 17.3850, lng: 78.4867 } // Default to Hyderabad, India
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const activeMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [apiKeyMissingOrScriptsFailed, setApiKeyMissingOrScriptsFailed] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);

  const loadGoogleMapsScript = useCallback((apiKey: string) => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        console.log("Google Maps SDK already loaded.");
        resolve(true);
        return;
      }
      if (document.getElementById('google-maps-sdk')) {
        console.log("Google Maps SDK script tag already present, waiting for load.");
        // If script tag exists but not google.maps, it might be loading
        // We rely on the initMapComponent callback or a timeout.
        // For simplicity, if initMapComponent is already set, we assume it will be called.
        if ((window as any).initMapComponentCallbackSet) {
             // We'll let the existing callback attempt to resolve.
        } else {
            (window as any).initMapComponentCallbackSet = true;
            (window as any).initMapComponent = () => {
                console.log("Google Maps SDK loaded via existing script and new callback.");
                delete (window as any).initMapComponent;
                delete (window as any).initMapComponentCallbackSet;
                resolve(true);
            };
        }
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-sdk';
      // Ensure `marker` library is loaded for AdvancedMarkerElement
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&loading=async&callback=initMapComponent`;
      script.async = true;
      script.defer = true;

      (window as any).initMapComponentCallbackSet = true;
      (window as any).initMapComponent = () => {
        console.log("Google Maps SDK loaded via callback.");
        delete (window as any).initMapComponent;
        delete (window as any).initMapComponentCallbackSet;
        resolve(true);
      };

      script.onerror = (error) => {
        console.error("Google Maps SDK failed to load:", error);
        delete (window as any).initMapComponent;
        delete (window as any).initMapComponentCallbackSet;
        reject(new Error("Failed to load Google Maps SDK."));
      };
      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      console.error("MapComponent: Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) is not configured.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false);
      return;
    }
    setApiKeyMissingOrScriptsFailed(false);

    console.log("MapComponent: Initializing with Google Maps API Key from env:", GOOGLE_MAPS_API_KEY ? GOOGLE_MAPS_API_KEY.substring(0, 8) + "..." : "Not found");

    loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
      .then(() => {
        console.log("MapComponent: Google Maps SDK script reported as loaded.");
        setScriptsLoaded(true);
        setApiKeyMissingOrScriptsFailed(false);
      })
      .catch((error) => {
        console.error("MapComponent: Critical failure loading Google Maps SDK.", error);
        setApiKeyMissingOrScriptsFailed(true);
        setIsMapLoading(false);
        setScriptsLoaded(false);
      });
  }, [loadGoogleMapsScript]);

  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current || !window.google || !window.google.maps || !window.google.maps.Map) {
      if (scriptsLoaded && (!window.google || !window.google.maps || !window.google.maps.Map)) {
        console.error("MapComponent: Google Maps SDK seems loaded but google.maps.Map object is not available.");
        setApiKeyMissingOrScriptsFailed(true);
        setIsMapLoading(false);
      }
      if (apiKeyMissingOrScriptsFailed || !scriptsLoaded) {
        setIsMapLoading(false);
      }
      return;
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(center);
      mapInstanceRef.current.setZoom(zoom);
      return;
    }

    setIsMapLoading(true);
    setMapLoadTimedOut(false);

    const loadTimeoutTimer = setTimeout(() => {
      if (mapContainerRef.current && !mapInstanceRef.current?.getCenter()) {
        console.error("MapComponent: Google Map did not fully initialize within timeout period (20s).");
        setIsMapLoading(false);
        setMapLoadTimedOut(true);
      }
    }, 20000);

    try {
      console.log("MapComponent: Attempting to initialize Google Map instance.");
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        mapId: "PARKSMART_MAP_ID", // Optional: For cloud-based map styling
        disableDefaultUI: !interactive,
        zoomControl: interactive,
        streetViewControl: interactive,
        mapTypeControl: interactive,
        fullscreenControl: interactive,
        scrollwheel: interactive,
        gestureHandling: interactive ? 'auto' : 'none',
      });
      mapInstanceRef.current = map;

      // Google Maps 'idle' event is a good indicator that the map has loaded and is ready.
      const idleListener = map.addListener('idle', () => {
        clearTimeout(loadTimeoutTimer);
        console.log("MapComponent: Google Map 'idle' event fired. Map should be visible and ready.");
        setIsMapLoading(false);
        setMapLoadTimedOut(false);
        google.maps.event.removeListener(idleListener); // Remove listener after first fire
      });

      // Fallback for 'tilesloaded' as 'idle' might not fire if map is not interacted with
      const tilesLoadedListener = map.addListener('tilesloaded', () => {
        if (isMapLoading) { // Only if still in loading state
            clearTimeout(loadTimeoutTimer);
            console.log("MapComponent: Google Map 'tilesloaded' event fired.");
            setIsMapLoading(false);
            setMapLoadTimedOut(false);
        }
      });
      
      // Clean up tilesloaded listener if idle fires first or on unmount
      const cleanupListeners = () => {
        if (tilesLoadedListener) google.maps.event.removeListener(tilesLoadedListener);
      };
      map.addListener('idle', cleanupListeners);


    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("MapComponent: Exception caught during Google Map instance initialization:", error);
      setIsMapLoading(false);
      setMapLoadTimedOut(true);
    }

    return () => {
      clearTimeout(loadTimeoutTimer);
      // Clean up Google Maps listeners if they exist
       if (mapInstanceRef.current) {
           google.maps.event.clearInstanceListeners(mapInstanceRef.current);
       }
      // Note: Google Maps doesn't have a direct 'remove' or 'destroy' method on the map instance.
      // Setting ref to null and letting GC handle it is typical.
      mapInstanceRef.current = null;
      console.log("MapComponent: Cleaned up Google Map instance ref on component unmount.");
    };
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, center, zoom, interactive, isMapLoading]);


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapInstanceRef.current || !window.google || !window.google.maps.marker || isMapLoading || mapLoadTimedOut) {
      return;
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    activeMarkersRef.current.forEach(marker => {
      marker.map = null; // Or marker.setMap(null) for older marker types
    });
    activeMarkersRef.current = [];

    markers.forEach(markerData => {
      try {
        const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat: markerData.lat, lng: markerData.lng },
          map: map,
          title: markerData.label,
        });

        if (onMarkerClick) {
          advancedMarker.addListener('click', () => {
            onMarkerClick(markerData.id);
          });
        }
        activeMarkersRef.current.push(advancedMarker);
      } catch (e) {
        console.error("MapComponent: Error creating Google Maps AdvancedMarkerElement:", e, markerData);
      }
    });

    if (markers.length > 0 && interactive) {
      if (markers.length > 1) {
        const bounds = new window.google.maps.LatLngBounds();
        markers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
        try {
          map.fitBounds(bounds);
          // Google Maps often over-zooms with fitBounds. Check and adjust if needed.
          const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
            if (map.getZoom()! > 16) map.setZoom(16); // Example: Don't zoom in more than level 16
          });
        } catch (e) {
          console.error("MapComponent: Error fitting Google Maps bounds: ", e);
          map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
          map.setZoom(zoom > 14 ? zoom : 14);
        }
      } else if (markers.length === 1) {
        map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
        map.setZoom(zoom > 14 ? zoom : 14); // Zoom in a bit for a single marker
      }
    } else if (markers.length === 0 && map?.setCenter) {
      map.setCenter(center);
      map.setZoom(zoom);
    }

  }, [markers, scriptsLoaded, apiKeyMissingOrScriptsFailed, onMarkerClick, interactive, zoom, center, isMapLoading, mapLoadTimedOut]);


  if (apiKeyMissingOrScriptsFailed) {
    return (
      <Card className={cn("flex items-center justify-center aspect-video bg-muted/50 border-destructive/50", className)} data-ai-hint="map error state">
        <CardContent className="text-center p-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-destructive">Google Maps Configuration or Loading Error</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The Google Maps API key (<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>) might be missing, incorrectly configured in your <code>.env.local</code> file,
            or the Google Maps script could not be loaded. This can happen due to network issues, an invalid/restricted API key, or incorrect API key permissions on the Google Cloud Console.
          </p>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border space-y-2">
            <p className="font-semibold mb-1">Troubleshooting Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Environment Variable File:</strong> Ensure a file named <code className="bg-card p-0.5 rounded">.env.local</code> exists in your project's **absolute root directory** (same level as <code>package.json</code>).</li>
              <li><strong>API Key Value:</strong> Inside <code className="bg-card p-0.5 rounded">.env.local</code>, confirm the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE</code>. Ensure no extra spaces or quotes.</li>
              <li><strong>Restart Server:</strong> **CRITICAL STEP:** After creating or modifying <code className="bg-card p-0.5 rounded">.env.local</code>, you **MUST** restart your Next.js development server (e.g., stop with Ctrl+C, then run <code>npm run dev</code>).</li>
              <li><strong>Google Cloud Console:</strong> Verify your API key is active and has the "Maps JavaScript API" enabled. Check for any API key restrictions (e.g., HTTP referrers, IP addresses, API restrictions) that might prevent it from working on your domain (e.g., <code>localhost</code> or your deployment URL).</li>
              <li><strong>Billing:</strong> Ensure billing is enabled for your Google Cloud project, as the Maps JavaScript API requires it.</li>
              <li><strong>Network & Browser Console:</strong> Check your internet connection and look for more specific errors in your browser's Network tab or Console (F12 Developer Tools).</li>
            </ol>
            <p className="mt-2">For details on Next.js environment variables, see the <Link href="https://nextjs.org/docs/app/building-your-application/configuring/environment-variables" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Next.js Documentation</Link>.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("aspect-video relative overflow-hidden shadow-md rounded-lg", className)} data-interactive={interactive}>
      <div ref={mapContainerRef} className="w-full h-full bg-muted" data-ai-hint="interactive map placeholder" />
      {isMapLoading && !mapLoadTimedOut && (
        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading Google Map...</p>
        </div>
      )}
      {mapLoadTimedOut && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center z-10 p-4 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mb-2" />
          <p className="text-md font-semibold text-destructive">Google Map Timed Out or Failed to Load</p>
          <p className="text-sm text-muted-foreground">The map took too long to load or encountered an error. Please check your internet connection, ensure the API key is correct and active on the Google Cloud Console (with billing enabled and "Maps JavaScript API" enabled), or try again later.</p>
        </div>
      )}
    </Card>
  );
};

export default MapComponent;
