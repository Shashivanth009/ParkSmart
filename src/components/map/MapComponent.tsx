
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
  const [isMapLoading, setIsMapLoading] = useState(true); // Start true, as we attempt to load immediately
  const [apiKeyMissingOrScriptsFailed, setApiKeyMissingOrScriptsFailed] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);

  const loadCss = useCallback((id: string, href: string) => {
    return new Promise<void>((resolve, reject) => { // Changed to Promise<void> for consistency
      if (document.getElementById(id)) {
        resolve();
        return;
      }
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => {
        console.error(`MapComponent: Specific failure loading CSS with ID '${id}' from href: ${href}`);
        reject(new Error(`Failed to load CSS: ${href}`));
      }
      document.head.appendChild(link);
    });
  }, []);

  const loadGoMapsProScript = useCallback((apiKey: string) => {
    return new Promise<void>((resolve, reject) => { // Changed to Promise<void>
      if (window.google && window.google.maps) {
        console.log("MapComponent: GoMaps Pro SDK (or compatible Google Maps SDK) already loaded.");
        resolve();
        return;
      }
      const existingScript = document.getElementById('gomaps-pro-sdk');
      if (existingScript) {
        console.log("MapComponent: GoMaps Pro SDK script tag already present, assuming it will load or has loaded.");
        // Check if window.google.maps exists after a short delay, if script already there
        let checks = 0;
        const interval = setInterval(() => {
          checks++;
          if (window.google && window.google.maps) {
            clearInterval(interval);
            resolve();
          } else if (checks > 20) { // Wait up to 2 seconds
            clearInterval(interval);
            console.warn("MapComponent: Existing GoMaps script did not result in window.google.maps being available quickly.");
            // Potentially reject or just proceed hoping it loads later
            // For now, resolve and let the main init logic handle it
            resolve(); 
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'gomaps-pro-sdk';
      script.src = `https://maps.gomaps.pro/maps/api/js?key=${apiKey}&libraries=marker&loading=async&callback=initMapComponentGlobal`;
      script.async = true;
      script.defer = true;

      (window as any).initMapComponentGlobalCallbackSet = true; // Use a more unique name
      (window as any).initMapComponentGlobal = () => { // Use a more unique name
        console.log("MapComponent: GoMaps Pro SDK loaded via global callback.");
        delete (window as any).initMapComponentGlobal;
        delete (window as any).initMapComponentGlobalCallbackSet;
        resolve();
      };

      script.onerror = (error) => {
        console.error("MapComponent: GoMaps Pro SDK script failed to load:", error);
        delete (window as any).initMapComponentGlobal;
        delete (window as any).initMapComponentGlobalCallbackSet;
        reject(new Error("Failed to load GoMaps Pro SDK script."));
      };
      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    console.log("MapComponent: Initializing with GoMaps Pro API Key from env:", GOMAPS_PRO_API_KEY ? GOMAPS_PRO_API_KEY.substring(0, 8) + "..." : "Not found");
    if (!GOMAPS_PRO_API_KEY) {
      console.error("MapComponent: GoMaps Pro API key (NEXT_PUBLIC_GOMAPS_PRO_API_KEY) is not configured.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false); // Ensure loader is off if key is missing
      return;
    }
    setApiKeyMissingOrScriptsFailed(false);

    window.gm_authFailure = () => {
      console.error("MapComponent: Detected gm_authFailure. This often indicates an API key issue (billing, quota, invalid key) with Google Maps Platform, even if using GoMaps Pro URLs. Check your Google Cloud Console.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false); // Ensure loader is off on auth failure
    };

    Promise.all([
      // No separate CSS for GoMapsPro generally, script should handle it.
      loadGoMapsProScript(GOMAPS_PRO_API_KEY)
    ])
      .then(() => {
        console.log("MapComponent: GoMaps Pro scripts reported as loaded/attempted.");
        setScriptsLoaded(true);
        setApiKeyMissingOrScriptsFailed(false);
      })
      .catch((error) => {
        console.error("MapComponent: Critical failure loading GoMaps Pro resources.", error);
        setApiKeyMissingOrScriptsFailed(true);
        setIsMapLoading(false); // Ensure loader is off on critical script failure
        setScriptsLoaded(false);
      });
    
    return () => {
        delete window.gm_authFailure;
    }
  }, [loadGoMapsProScript]); // Removed loadCss as it's not used for GoMapsPro

  useEffect(() => {
    // Prerequisite checks
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current || !window.google || !window.google.maps || !window.google.maps.Map) {
      if (isMapLoading && (apiKeyMissingOrScriptsFailed || (scriptsLoaded && (!window.google || !window.google.maps.Map )) ) ) {
        // If prerequisites failed AFTER scripts were thought to be loaded, or API key is an issue.
        console.log("MapComponent: Prerequisites failed or API key issue, ensuring loader is off.");
        setIsMapLoading(false);
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
      if (isMapLoading) {
        console.log("MapComponent: Map instance already exists, ensuring loader is off.");
        setIsMapLoading(false); // Ensure loader is off if map already exists
      }
      return;
    }
    
    // Only set loading to true if we are about to create a NEW map instance
    if (!mapInstanceRef.current) {
        console.log("MapComponent: No map instance, setting isMapLoading to true.");
        setIsMapLoading(true);
    }
    setMapLoadTimedOut(false);

    const loadTimeoutTimer = setTimeout(() => {
      if (mapContainerRef.current && (!mapInstanceRef.current || !mapInstanceRef.current.getCenter())) {
        console.error("MapComponent: Map did not fully initialize within timeout period (20s). This might be due to network issues, script errors post-load, or problems with the map provider's service.");
        if (isMapLoading) setIsMapLoading(false);
        setMapLoadTimedOut(true);
      } else if (mapInstanceRef.current && isMapLoading) {
        console.log("MapComponent: Timeout fallback - map instance exists, forcing loader off.");
        setIsMapLoading(false);
        setMapLoadTimedOut(false);
      }
    }, 20000);

    try {
      console.log("MapComponent: Attempting to initialize Map instance with GoMaps Pro.");
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        mapId: "GOMAPS_PRO_MAP_ID",
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
        if (idleListener && window.google?.maps?.event) google.maps.event.removeListener(idleListener);
        if (tilesLoadedListener && window.google?.maps?.event) google.maps.event.removeListener(tilesLoadedListener);
        idleListener = null;
        tilesLoadedListener = null;
      };
      
      const onMapReady = () => {
        clearTimeout(loadTimeoutTimer);
        if (isMapLoading) {
            console.log("MapComponent: onMapReady called, setting isMapLoading to false.");
            setIsMapLoading(false);
        }
        setMapLoadTimedOut(false); 
      };

      idleListener = map.addListener('idle', () => {
        console.log("MapComponent: Map 'idle' event fired.");
        onMapReady();
      });

      tilesLoadedListener = map.addListener('tilesloaded', () => {
        console.log("MapComponent: Map 'tilesloaded' event fired.");
        onMapReady();
      });
      
      if (map.getCenter() && isMapLoading) {
          console.log("MapComponent: Map object getCenter() is valid, scheduling onMapReady fallback as loader is still on.");
          setTimeout(onMapReady, 750); 
      } else if (map.getCenter() && !isMapLoading) {
          clearTimeout(loadTimeoutTimer);
          setMapLoadTimedOut(false);
      }

      return () => {
        cleanupListeners();
        clearTimeout(loadTimeoutTimer);
        if (mapInstanceRef.current && window.google?.maps?.event) {
           google.maps.event.clearInstanceListeners(mapInstanceRef.current);
        }
        console.log("MapComponent: Cleaned up map event listeners on effect cleanup.");
      };

    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("MapComponent: Exception caught during GoMaps Pro Map instance initialization:", error);
      if (isMapLoading) setIsMapLoading(false);
      setMapLoadTimedOut(true);
    }
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, center, zoom, interactive]);


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapInstanceRef.current || !window.google?.maps?.marker || isMapLoading || mapLoadTimedOut) {
      return;
    }

    const map = mapInstanceRef.current;

    activeMarkersRef.current.forEach(marker => {
      try {
        marker.map = null;
      } catch (e) {
        console.warn("MapComponent: Error removing marker:", e);
      }
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
        console.error("MapComponent: Error creating AdvancedMarkerElement for GoMaps Pro:", e, markerData);
      }
    });

    if (markers.length > 0 && interactive && window.google?.maps?.LatLngBounds) {
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
    
