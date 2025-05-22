
"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from 'next/link';

// Declare GoMaps Pro/Google Maps global object for TypeScript
declare global {
  interface Window {
    google?: typeof google;
    initMapComponent?: () => void;
    gm_authFailure?: () => void; // For Google Maps authentication errors
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

  const loadCss = useCallback((id: string, href: string) => {
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
      link.onerror = () => {
        console.error(`MapComponent: Specific failure loading CSS with ID '${id}' from href: ${href}`);
        reject(new Error(`Failed to load CSS: ${href}`));
      }
      document.head.appendChild(link);
    });
  }, []);

  const loadGoMapsProScript = useCallback((apiKey: string) => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        console.log("MapComponent: GoMaps Pro SDK (or compatible Google Maps SDK) already loaded.");
        resolve(true);
        return;
      }
      if (document.getElementById('gomaps-pro-sdk')) {
        console.log("MapComponent: GoMaps Pro SDK script tag already present, waiting for load.");
        // If a callback is already set, let it handle resolution.
        // If not, set one.
        if (!(window as any).initMapComponentCallbackSet) {
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
        console.error("MapComponent: GoMaps Pro SDK script failed to load:", error);
        delete (window as any).initMapComponent;
        delete (window as any).initMapComponentCallbackSet;
        reject(new Error("Failed to load GoMaps Pro SDK script."));
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
    setApiKeyMissingOrScriptsFailed(false); // Reset if key is found
    console.log("MapComponent: Initializing with GoMaps Pro API Key from env:", GOMAPS_PRO_API_KEY ? GOMAPS_PRO_API_KEY.substring(0, 8) + "..." : "Not found");

    // Define gm_authFailure here as it's specific to Google's auth flow,
    // which might be triggered if GoMapsPro uses Google services or if the key is a Google key.
    window.gm_authFailure = () => {
      console.error("MapComponent: Detected gm_authFailure. This often indicates an API key issue (billing, quota, invalid key) with Google Maps Platform, even if using GoMaps Pro URLs. Check your Google Cloud Console.");
      setApiKeyMissingOrScriptsFailed(true); // Trigger the main error display
      setIsMapLoading(false);
    };

    Promise.all([
      // GoMaps Pro generally doesn't require a separate CSS from a different domain like Mappls.
      // The main JS SDK should include necessary styles or load them.
      // If GoMaps Pro has a specific CSS URL, it should be added here.
      // For now, assuming `maps.gomaps.pro/maps/api/js` handles styling.
      // Example: loadCss('gomaps-pro-styles', 'https://maps.gomaps.pro/maps/api/css'), // If GoMaps Pro provides a separate CSS link
      loadGoMapsProScript(GOMAPS_PRO_API_KEY)
    ])
      .then(() => {
        console.log("MapComponent: GoMaps Pro scripts reported as loaded/attempted.");
        setScriptsLoaded(true);
        setApiKeyMissingOrScriptsFailed(false); // Ensure this is false if scripts load
      })
      .catch((error) => {
        console.error("MapComponent: Critical failure loading GoMaps Pro resources.", error);
        setApiKeyMissingOrScriptsFailed(true);
        setIsMapLoading(false);
        setScriptsLoaded(false); // Ensure scriptsLoaded is false on critical failure
      });
    
    return () => {
        delete window.gm_authFailure; // Clean up global function on unmount
    }
  }, [loadCss, loadGoMapsProScript]);


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current || !window.google || !window.google.maps || !window.google.maps.Map) {
      if (scriptsLoaded && (!window.google || !window.google.maps || !window.google.maps.Map)) {
        console.error("MapComponent: GoMaps Pro SDK seems loaded but google.maps.Map object is not available. This could indicate an issue with the GoMaps Pro SDK itself or an incomplete load.");
        setApiKeyMissingOrScriptsFailed(true); // Treat as a script failure
        setIsMapLoading(false);
      } else if (apiKeyMissingOrScriptsFailed || !scriptsLoaded) {
          // If API key is missing OR scripts haven't loaded (and it's not the above case)
          setIsMapLoading(false); // Stop loading if prerequisites aren't met
      }
      return;
    }

    // If map instance already exists, just update center/zoom.
    if (mapInstanceRef.current) {
        try {
            mapInstanceRef.current.setCenter(center);
            mapInstanceRef.current.setZoom(zoom);
        } catch (e) {
            console.warn("MapComponent: Error updating existing map instance:", e);
        }
        // Map already initialized, ensure loading is false if it was stuck
        if (isMapLoading) setIsMapLoading(false);
        return; 
    }
    

    setIsMapLoading(true); // Start loading map visually
    setMapLoadTimedOut(false); // Reset timeout flag

    const loadTimeoutTimer = setTimeout(() => {
      // Check if map instance is still not there or not properly initialized
      if (mapContainerRef.current && (!mapInstanceRef.current || !mapInstanceRef.current.getCenter())) {
        console.error("MapComponent: Map did not fully initialize within timeout period (20s). This might be due to network issues, script errors post-load, or problems with the map provider's service.");
        setIsMapLoading(false);
        setMapLoadTimedOut(true);
      }
    }, 20000); // 20 seconds timeout

    try {
      console.log("MapComponent: Attempting to initialize Map instance with GoMaps Pro.");
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        mapId: "GOMAPS_PRO_MAP_ID", // A generic ID or one specific to GoMaps Pro if they use map IDs
        disableDefaultUI: !interactive,
        zoomControl: interactive,
        streetViewControl: interactive, 
        mapTypeControl: interactive,   
        fullscreenControl: interactive,
        scrollwheel: interactive,
        gestureHandling: interactive ? 'auto' : 'none',
      });
      mapInstanceRef.current = map;

      let idleListener: google.maps.MapsEventListener | null = null;
      let tilesLoadedListener: google.maps.MapsEventListener | null = null;

      const cleanupListeners = () => {
        if (idleListener) google.maps.event.removeListener(idleListener);
        if (tilesLoadedListener) google.maps.event.removeListener(tilesLoadedListener);
        idleListener = null;
        tilesLoadedListener = null;
      };
      
      const onMapReady = () => {
        clearTimeout(loadTimeoutTimer);
        if(isMapLoading){ 
            setIsMapLoading(false);
        }
        setMapLoadTimedOut(false); 
      };

      idleListener = map.addListener('idle', () => {
        console.log("MapComponent: Map 'idle' event fired. Map should be visible and ready.");
        onMapReady();
      });

      tilesLoadedListener = map.addListener('tilesloaded', () => {
        console.log("MapComponent: Map 'tilesloaded' event fired.");
        onMapReady();
      });
      
      // Fallback in case neither idle nor tilesloaded fire quickly for some reason with GoMaps Pro
      // after basic map object creation.
      if (map.getCenter()) { // Basic check that map object exists
          setTimeout(onMapReady, 500); // Give it a slight delay for rendering
      }

      return () => {
        cleanupListeners();
        clearTimeout(loadTimeoutTimer);
        if (mapInstanceRef.current) {
           google.maps.event.clearInstanceListeners(mapInstanceRef.current);
        }
        console.log("MapComponent: Cleaned up map instance ref and listeners on component unmount.");
      };


    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("MapComponent: Exception caught during GoMaps Pro Map instance initialization:", error);
      setIsMapLoading(false);
      setMapLoadTimedOut(true); // Indicate a problem with map init itself
    }

  // Dependencies for map initialization
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, center, zoom, interactive]);


  useEffect(() => {
    // Effect for updating markers
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapInstanceRef.current || !window.google || !window.google.maps.marker || isMapLoading || mapLoadTimedOut) {
      return;
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    activeMarkersRef.current.forEach(marker => {
      try {
        marker.map = null; // Remove marker from map
      } catch (e) {
        console.warn("MapComponent: Error removing marker:", e);
      }
    });
    activeMarkersRef.current = [];

    // Add new markers
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
        console.error("MapComponent: Error creating AdvancedMarkerElement for GoMaps Pro:", e, markerData);
      }
    });

    if (markers.length > 0 && interactive) {
      if (markers.length > 1) {
        const bounds = new window.google.maps.LatLngBounds();
        markers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
        try {
          map.fitBounds(bounds);
          const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
             if (map.getZoom() && map.getZoom()! > 16) map.setZoom(16); 
          });
        } catch (e) {
          console.error("MapComponent: Error fitting bounds for GoMaps Pro: ", e);
          if (markers[0]) {
            map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
            map.setZoom(zoom > 14 ? zoom : 14); 
          }
        }
      } else if (markers.length === 1 && markers[0]) {
        map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
        map.setZoom(zoom > 14 ? zoom : 14); 
      }
    } else if (markers.length === 0 && map?.setCenter) {
       try {
        map.setCenter(center);
        map.setZoom(zoom);
       } catch (e) {
        console.warn("MapComponent: Error setting default center/zoom for GoMaps Pro:", e);
       }
    }

  }, [markers, scriptsLoaded, apiKeyMissingOrScriptsFailed, onMarkerClick, interactive, zoom, center, isMapLoading, mapLoadTimedOut]);


  if (apiKeyMissingOrScriptsFailed) {
    return (
      <Card className={cn("flex items-center justify-center aspect-video bg-muted/50 border-destructive/50", className)} data-ai-hint="map error state">
        <CardContent className="text-center p-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-destructive">Map Configuration or Loading Error</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The GoMaps Pro API key (<code>NEXT_PUBLIC_GOMAPS_PRO_API_KEY</code>) might be missing, incorrectly configured in your <code>.env.local</code> file,
            or the map scripts/styles could not be loaded from GoMaps Pro servers. This can happen due to network issues, an invalid API key, or incorrect API key permissions on the GoMaps Pro or Google Cloud dashboard (if your key is a Google key).
          </p>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border space-y-2">
            <p className="font-semibold mb-1">Troubleshooting Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Environment Variable File:</strong> Ensure a file named <code className="bg-card p-0.5 rounded">.env.local</code> exists in your project's **absolute root directory** (same level as <code>package.json</code>).</li>
              <li><strong>API Key Value:</strong> Inside <code className="bg-card p-0.5 rounded">.env.local</code>, confirm the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_GOMAPS_PRO_API_KEY=YOUR_API_KEY_HERE</code> (replace with your actual key, e.g., AlzaSyxap6A_EcHW72khGw8I6awbRRUcv8sYmbG).</li>
              <li><strong>Restart Server:</strong> **CRITICAL STEP:** After creating or modifying <code className="bg-card p-0.5 rounded">.env.local</code>, you **MUST** restart your Next.js development server (e.g., stop with Ctrl+C, then run <code>npm run dev</code>).</li>
              <li><strong>API Key Provider Dashboard:</strong> 
                If using a GoMaps Pro key, verify its status and permissions on the GoMaps Pro Dashboard.
                If you see "OverQuotaMapError" or other Google-specific errors in the console, your key might be a Google Maps key. In that case, check the Google Cloud Console: ensure the Maps JavaScript API is enabled, billing is active for your project, and quotas are sufficient.
              </li>
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
          <p className="text-sm text-muted-foreground">Loading Map...</p>
        </div>
      )}
      {mapLoadTimedOut && !apiKeyMissingOrScriptsFailed && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center z-10 p-4 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mb-2" />
          <p className="text-md font-semibold text-destructive">Map Timed Out or Failed to Load</p>
          <p className="text-sm text-muted-foreground">The map took too long to load or encountered an error. Please check your internet connection or try again later. If you see Google-specific errors in console (like 'OverQuotaMapError'), check your Google Cloud Console for API key billing/quota issues.</p>
        </div>
      )}
    </Card>
  );
};

export default MapComponent;
    
