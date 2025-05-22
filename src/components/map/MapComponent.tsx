
"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from 'next/link';

// Declare GoMaps Pro global object for TypeScript (assuming it mirrors Google Maps)
declare global {
  interface Window {
    google?: typeof google; // GoMaps Pro aims for compatibility with google.maps
    initMapComponent?: () => void; // For the GoMaps Pro callback
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

const GOMAPS_PRO_API_KEY = process.env.NEXT_PUBLIC_GOMAPS_PRO_API_KEY;

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

  const loadGoMapsProScript = useCallback((apiKey: string) => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        console.log("MapComponent: GoMaps Pro SDK (or compatible Google Maps SDK) already loaded.");
        resolve(true);
        return;
      }
      if (document.getElementById('gomaps-pro-sdk')) {
        console.log("MapComponent: GoMaps Pro SDK script tag already present, waiting for load.");
        if ((window as any).initMapComponentCallbackSet) {
             // Existing callback will attempt to resolve.
        } else {
            (window as any).initMapComponentCallbackSet = true;
            (window as any).initMapComponent = () => {
                console.log("MapComponent: GoMaps Pro SDK loaded via existing script and new callback.");
                delete (window as any).initMapComponent;
                delete (window as any).initMapComponentCallbackSet;
                resolve(true);
            };
        }
        return;
      }

      const script = document.createElement('script');
      script.id = 'gomaps-pro-sdk';
      // Update the script source to GoMaps Pro
      script.src = `https://maps.gomaps.pro/maps/api/js?key=${apiKey}&libraries=marker&loading=async&callback=initMapComponent`;
      script.async = true;
      script.defer = true;

      (window as any).initMapComponentCallbackSet = true;
      (window as any).initMapComponent = () => {
        console.log("MapComponent: GoMaps Pro SDK loaded via callback.");
        delete (window as any).initMapComponent;
        delete (window as any).initMapComponentCallbackSet;
        resolve(true);
      };

      script.onerror = (error) => {
        console.error("MapComponent: GoMaps Pro SDK failed to load:", error);
        delete (window as any).initMapComponent;
        delete (window as any).initMapComponentCallbackSet;
        reject(new Error("Failed to load GoMaps Pro SDK."));
      };
      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    if (!GOMAPS_PRO_API_KEY) {
      console.error("MapComponent: GoMaps Pro API key (NEXT_PUBLIC_GOMAPS_PRO_API_KEY) is not configured.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false);
      return;
    }
    setApiKeyMissingOrScriptsFailed(false);

    console.log("MapComponent: Initializing with GoMaps Pro API Key from env:", GOMAPS_PRO_API_KEY ? GOMAPS_PRO_API_KEY.substring(0, 8) + "..." : "Not found");

    loadGoMapsProScript(GOMAPS_PRO_API_KEY)
      .then(() => {
        console.log("MapComponent: GoMaps Pro SDK script reported as loaded.");
        setScriptsLoaded(true);
        setApiKeyMissingOrScriptsFailed(false);
      })
      .catch((error) => {
        console.error("MapComponent: Critical failure loading GoMaps Pro SDK.", error);
        setApiKeyMissingOrScriptsFailed(true);
        setIsMapLoading(false);
        setScriptsLoaded(false);
      });
  }, [loadGoMapsProScript]);

  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current || !window.google || !window.google.maps || !window.google.maps.Map) {
      if (scriptsLoaded && (!window.google || !window.google.maps || !window.google.maps.Map)) {
        console.error("MapComponent: GoMaps Pro SDK seems loaded but google.maps.Map object is not available.");
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
        console.error("MapComponent: GoMaps Pro Map did not fully initialize within timeout period (20s).");
        setIsMapLoading(false);
        setMapLoadTimedOut(true);
      }
    }, 20000);

    try {
      console.log("MapComponent: Attempting to initialize GoMaps Pro Map instance.");
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        mapId: "PARKSMART_GOMAPS_PRO_ID", // Using a generic ID, may not apply to GoMaps Pro directly
        disableDefaultUI: !interactive,
        zoomControl: interactive,
        streetViewControl: interactive,
        mapTypeControl: interactive,
        fullscreenControl: interactive,
        scrollwheel: interactive,
        gestureHandling: interactive ? 'auto' : 'none',
      });
      mapInstanceRef.current = map;

      const idleListener = map.addListener('idle', () => {
        clearTimeout(loadTimeoutTimer);
        console.log("MapComponent: GoMaps Pro Map 'idle' event fired. Map should be visible and ready.");
        setIsMapLoading(false);
        setMapLoadTimedOut(false);
        google.maps.event.removeListener(idleListener);
      });

      const tilesLoadedListener = map.addListener('tilesloaded', () => {
        if (isMapLoading) {
            clearTimeout(loadTimeoutTimer);
            console.log("MapComponent: GoMaps Pro Map 'tilesloaded' event fired.");
            setIsMapLoading(false);
            setMapLoadTimedOut(false);
        }
      });
      
      const cleanupListeners = () => {
        if (tilesLoadedListener) google.maps.event.removeListener(tilesLoadedListener);
      };
      map.addListener('idle', cleanupListeners);

    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("MapComponent: Exception caught during GoMaps Pro Map instance initialization:", error);
      setIsMapLoading(false);
      setMapLoadTimedOut(true);
    }

    return () => {
      clearTimeout(loadTimeoutTimer);
       if (mapInstanceRef.current) {
           google.maps.event.clearInstanceListeners(mapInstanceRef.current);
       }
      mapInstanceRef.current = null;
      console.log("MapComponent: Cleaned up GoMaps Pro Map instance ref on component unmount.");
    };
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, center, zoom, interactive, isMapLoading]);


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapInstanceRef.current || !window.google || !window.google.maps.marker || isMapLoading || mapLoadTimedOut) {
      return;
    }

    const map = mapInstanceRef.current;

    activeMarkersRef.current.forEach(marker => {
      marker.map = null;
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
        console.error("MapComponent: Error creating GoMaps Pro (via compatible API) AdvancedMarkerElement:", e, markerData);
      }
    });

    if (markers.length > 0 && interactive) {
      if (markers.length > 1) {
        const bounds = new window.google.maps.LatLngBounds();
        markers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
        try {
          map.fitBounds(bounds);
          const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
            if (map.getZoom()! > 16) map.setZoom(16);
          });
        } catch (e) {
          console.error("MapComponent: Error fitting GoMaps Pro bounds: ", e);
          map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
          map.setZoom(zoom > 14 ? zoom : 14);
        }
      } else if (markers.length === 1) {
        map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
        map.setZoom(zoom > 14 ? zoom : 14);
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
          <h3 className="text-lg font-semibold text-destructive">GoMaps Pro Configuration or Loading Error</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The GoMaps Pro API key (<code>NEXT_PUBLIC_GOMAPS_PRO_API_KEY</code>) might be missing, incorrectly configured in your <code>.env.local</code> file,
            or the map scripts/styles could not be loaded from GoMaps Pro servers. This can happen due to network issues, an invalid API key, or incorrect API key permissions.
          </p>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border space-y-2">
            <p className="font-semibold mb-1">Troubleshooting Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Environment Variable File:</strong> Ensure a file named <code className="bg-card p-0.5 rounded">.env.local</code> exists in your project's **absolute root directory** (same level as <code>package.json</code>).</li>
              <li><strong>API Key Value:</strong> Inside <code className="bg-card p-0.5 rounded">.env.local</code>, confirm the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_GOMAPS_PRO_API_KEY=YOUR_API_KEY_HERE</code> (e.g., <code className="bg-card p-0.5 rounded">AlzaSy...</code>). Ensure no extra spaces or quotes.</li>
              <li><strong>Restart Server:</strong> **CRITICAL STEP:** After creating or modifying <code className="bg-card p-0.5 rounded">.env.local</code>, you **MUST** restart your Next.js development server (e.g., stop with Ctrl+C, then run <code>npm run dev</code>).</li>
              <li><strong>GoMaps Pro Account/Dashboard:</strong> Verify your API key is active and has the necessary permissions for the SDK. Check if your current domain (e.g., <code>localhost</code> or your deployment URL) needs to be whitelisted for the key.</li>
              <li><strong>Network & Browser Console:</strong> Check your internet connection and look for more specific errors in your browser's Network tab or Console (F12 Developer Tools). Try accessing script/CSS URLs (if shown in console errors) directly.</li>
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
          <p className="text-sm text-muted-foreground">Loading GoMaps Pro Map...</p>
        </div>
      )}
      {mapLoadTimedOut && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center z-10 p-4 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mb-2" />
          <p className="text-md font-semibold text-destructive">GoMaps Pro Map Timed Out or Failed to Load</p>
          <p className="text-sm text-muted-foreground">The map took too long to load or encountered an error. Please check your internet connection, ensure the API key is correct and active, or try again later.</p>
        </div>
      )}
    </Card>
  );
};

export default MapComponent;

