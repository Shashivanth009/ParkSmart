
"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle, Search, LocateFixed } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from 'next/link';

declare global {
  interface Window {
    google?: typeof google; // GoMaps Pro is Google Maps compatible
    initMapComponentGlobal?: () => void;
    gm_authFailure?: () => void;
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
  center?: { lat: number; lng: number } | null;
  showSearchInput?: boolean;
  showMyLocationButton?: boolean;
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void;
  onMapIdle?: (center: { lat: number; lng: number }, zoom: number) => void;
}

const GOMAPS_PRO_API_KEY = process.env.NEXT_PUBLIC_GOMAPS_PRO_API_KEY;
const DEFAULT_MAP_ZOOM = 12;
const FOCUSED_MAP_ZOOM = 15;

const MapComponent: React.FC<MapComponentProps> = ({
  markers = [],
  className,
  interactive = true,
  onMarkerClick,
  zoom = DEFAULT_MAP_ZOOM,
  center = { lat: 17.3850, lng: 78.4867 }, 
  showSearchInput = false,
  showMyLocationButton = false,
  onPlaceSelected,
  onMapIdle,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const activeMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  
  const internalSearchInputRef = useRef<HTMLInputElement>(null);
  const internalAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [apiKeyMissingOrScriptsFailed, setApiKeyMissingOrScriptsFailed] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);

  const loadGoMapsProScript = useCallback((apiKey: string) => {
    return new Promise<void>((resolve, reject) => {
      // Check if Google Maps (or compatible API) is already loaded
      if (window.google?.maps?.places && window.google?.maps?.marker) {
        console.log("MapComponent: GoMaps Pro compatible API already available.");
        resolve();
        return;
      }

      // Check if script is already added
      const existingScript = document.getElementById('gomaps-pro-sdk');
      if (existingScript) {
        console.log("MapComponent: GoMaps Pro SDK script tag already exists. Waiting for it to load if necessary.");
        // If script exists, wait for it to load or resolve if already loaded
        let checks = 0;
        const interval = setInterval(() => {
          checks++;
          if (window.google?.maps?.places && window.google?.maps?.marker) {
            clearInterval(interval);
            resolve();
          } else if (checks > 20) { // ~2 seconds timeout
            clearInterval(interval);
            console.warn("MapComponent: Existing GoMaps Pro script did not load in time.");
            // Resolve anyway and let the map init logic handle it, or reject if preferred
            resolve(); 
          }
        }, 100);
        return;
      }

      console.log("MapComponent: Attempting to load GoMaps Pro SDK script.");
      const script = document.createElement('script');
      script.id = 'gomaps-pro-sdk';
      // Ensure "marker" and "places" libraries are requested
      script.src = `https://maps.gomaps.pro/maps/api/js?key=${apiKey}&libraries=marker,places&loading=async&callback=initMapComponentGlobal`;
      script.async = true;
      script.defer = true;

      // This global callback is important for the script to signal readiness
      (window as any).initMapComponentGlobalCallbackSet = true; 
      window.initMapComponentGlobal = () => {
        console.log("MapComponent: initMapComponentGlobal called, GoMaps Pro SDK ready.");
        delete window.initMapComponentGlobal; // Clean up
        delete (window as any).initMapComponentGlobalCallbackSet;
        resolve();
      };
      
      script.onerror = (event) => {
        let errorMsg = "MapComponent: GoMaps Pro SDK script failed to load.";
        if (event && typeof event === 'object' && 'type' in event) {
            errorMsg += ` Event type: ${event.type}.`;
        }
        // Check browser's Network tab for more specific HTTP errors on the script request.
        console.error(errorMsg, event instanceof Event ? { type: event.type, target: event.target } : event);
        if ((window as any).initMapComponentGlobalCallbackSet) {
          delete window.initMapComponentGlobal;
          delete (window as any).initMapComponentGlobalCallbackSet;
        }
        reject(new Error("Failed to load GoMaps Pro SDK script."));
      };
      document.head.appendChild(script);
    });
  }, []);
  
  useEffect(() => {
    console.log("MapComponent: Initializing. GoMaps Pro API Key from env:", GOMAPS_PRO_API_KEY ? "Exists" : "Not found");
    if (!GOMAPS_PRO_API_KEY) {
      console.error("MapComponent: GoMaps Pro API key (NEXT_PUBLIC_GOMAPS_PRO_API_KEY) is not configured.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false); 
      return;
    }
    setApiKeyMissingOrScriptsFailed(false); 

    // This callback handles Google Maps specific auth failures (like OverQuotaMapError)
    // if GoMaps Pro uses Google services under the hood or if the key is a Google key.
    window.gm_authFailure = () => {
      console.error("MapComponent: Detected gm_authFailure. This often indicates an API key issue (billing, quota, invalid key, or API not enabled). For Google Maps, check Google Cloud Console. For GoMaps Pro, check their dashboard or if it proxies Google errors.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false);
    };

    loadGoMapsProScript(GOMAPS_PRO_API_KEY)
      .then(() => {
        console.log("MapComponent: GoMaps Pro script loaded successfully state flag set.");
        setScriptsLoaded(true);
        setApiKeyMissingOrScriptsFailed(false); // Ensure this is false if script loads
      })
      .catch((error) => {
        console.error("MapComponent: Critical failure loading GoMaps Pro resources.", error);
        setApiKeyMissingOrScriptsFailed(true);
        setIsMapLoading(false);
        setScriptsLoaded(false); 
      });
    
    // Cleanup function for when the component unmounts
    return () => {
        delete window.gm_authFailure;
        // If the callback was set but component unmounts before it's called
        if ((window as any).initMapComponentGlobalCallbackSet) {
            console.log("MapComponent: Cleaning up initMapComponentGlobal due to unmount.");
            delete window.initMapComponentGlobal;
            delete (window as any).initMapComponentGlobalCallbackSet;
        }
    }
  }, [loadGoMapsProScript]); // loadGoMapsProScript is memoized, GOMAPS_PRO_API_KEY is constant after init


  // Effect for map instance initialization
  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current || !window.google?.maps?.Map || !center) {
      if (isMapLoading && (apiKeyMissingOrScriptsFailed || (scriptsLoaded && (!window.google?.maps?.Map || !center)))) {
        setIsMapLoading(false); 
      }
      return;
    }
    
    const mapAlreadyInitialized = !!mapInstanceRef.current;

    // If map is already there, just update center/zoom if props change
    if (mapAlreadyInitialized && mapInstanceRef.current) {
      const currentMapCenter = mapInstanceRef.current.getCenter();
      const currentZoom = mapInstanceRef.current.getZoom();
      let centerChanged = false;
      let zoomChanged = false;

      if (currentMapCenter && center && (Math.abs(currentMapCenter.lat() - center.lat) > 0.00001 || Math.abs(currentMapCenter.lng() - center.lng) > 0.00001)) {
        mapInstanceRef.current.setCenter(center);
        centerChanged = true;
      }
      if (currentZoom !== undefined && zoom !== undefined && currentZoom !== zoom) {
          mapInstanceRef.current.setZoom(zoom);
          zoomChanged = true;
      }
      // If map was already initialized and no significant prop changes, ensure loading is false.
      if (isMapLoading && !centerChanged && !zoomChanged) setIsMapLoading(false); 
      return;
    }
    
    // If map instance doesn't exist, and we are not already trying to load, start loading.
    if (mapAlreadyInitialized) return; // Should not happen if mapInstanceRef.current is null

    // Start loading map instance
    if (!isMapLoading) setIsMapLoading(true); 
    setMapLoadTimedOut(false); // Reset timeout flag for new attempt

    // Timeout for map initialization
    const loadTimeoutTimer = setTimeout(() => {
      if (isMapLoading && (!mapInstanceRef.current || !mapInstanceRef.current.getCenter()) ) {
        // Map didn't fully initialize (e.g. getCenter() is not available)
        console.error("MapComponent: Map did not fully initialize within timeout period (20s). Tiles might not have loaded or map service unavailable.");
        if (isMapLoading) setIsMapLoading(false); // Stop loading spinner
        setMapLoadTimedOut(true); // Show timeout message
      } else if (isMapLoading && mapInstanceRef.current?.getCenter()) {
        // Map seems initialized but loader might still be on.
        if (isMapLoading) setIsMapLoading(false);
        setMapLoadTimedOut(false);
      }
    }, 20000); // 20 seconds timeout

    try {
      console.log("MapComponent: Creating new Map instance with center:", center, "zoom:", zoom);
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        mapId: "GOMAPS_PRO_MAP_ID", // GoMaps Pro often uses a generic ID or allows specific ones.
        disableDefaultUI: !interactive,
        zoomControl: interactive,
        streetViewControl: interactive,
        mapTypeControl: interactive,
        fullscreenControl: interactive,
        scrollwheel: interactive,
        gestureHandling: interactive ? 'auto' : 'none',
      });
      mapInstanceRef.current = map;
      infoWindowRef.current = new window.google.maps.InfoWindow();

      let idleListener: google.maps.MapsEventListener | null = null;
      let tilesLoadedListener: google.maps.MapsEventListener | null = null;

      // Cleanup function for listeners
      const cleanupListeners = () => {
        if (idleListener && window.google?.maps?.event) google.maps.event.removeListener(idleListener);
        if (tilesLoadedListener && window.google?.maps?.event) google.maps.event.removeListener(tilesLoadedListener);
      };
      
      // Function to call when map is considered ready
      const onMapActuallyReady = () => {
        console.log("MapComponent: Map considered ready (idle or tilesloaded).");
        clearTimeout(loadTimeoutTimer); // Clear the initialization timeout
        if (isMapLoading) { // Only update if it's still in loading state
            setIsMapLoading(false);
        }
        setMapLoadTimedOut(false); // Reset timeout error state
      };

      // Listen for 'idle' (map has finished panning/zooming)
      idleListener = map.addListener('idle', () => {
        onMapActuallyReady();
        if (interactive && onMapIdle) {
          const currentCenter = map.getCenter();
          const currentZoom = map.getZoom();
          if (currentCenter && currentZoom !== undefined) {
            onMapIdle({ lat: currentCenter.lat(), lng: currentCenter.lng() }, currentZoom);
          }
        }
      });
      // Listen for 'tilesloaded' (all visible map tiles have loaded)
      tilesLoadedListener = map.addListener('tilesloaded', onMapActuallyReady);
      
      // Fallback: if the map has a center very quickly, assume it's basically ready
      if (map.getCenter() && isMapLoading) {
          // Wait a very short moment for initial tile render attempt
          setTimeout(onMapActuallyReady, 750); 
      } else if (map.getCenter() && !isMapLoading) { // Already loaded, clear timeout
          clearTimeout(loadTimeoutTimer);
          setMapLoadTimedOut(false);
      }


      // Setup Autocomplete for internal search input if enabled
      if (showSearchInput && internalSearchInputRef.current && window.google.maps.places) {
        console.log("MapComponent: Setting up Autocomplete for internal search input.");
        internalAutocompleteRef.current = new window.google.maps.places.Autocomplete(internalSearchInputRef.current, {
          types: ['geocode'], // Restrict to geocoding results (addresses, cities, etc.)
        });
        internalAutocompleteRef.current.bindTo('bounds', map); // Bias suggestions to map viewport
        internalAutocompleteRef.current.addListener('place_changed', () => {
          const place = internalAutocompleteRef.current?.getPlace();
          if (place?.geometry?.location) {
            console.log("MapComponent: Place selected from internal autocomplete:", place.name);
            // Parent component handles map centering/zooming via onPlaceSelected
            if (onPlaceSelected) {
              onPlaceSelected(place);
            }
          }
        });
      }
      
      // Cleanup for this effect
      return () => {
        console.log("MapComponent: Cleaning up map instance and listeners.");
        cleanupListeners();
        clearTimeout(loadTimeoutTimer);
        if (mapInstanceRef.current && window.google?.maps?.event) {
           // Clear all listeners on map instance. Important for preventing memory leaks.
           google.maps.event.clearInstanceListeners(mapInstanceRef.current);
        }
        // Also clear listeners from autocomplete instance if it exists
        if (internalAutocompleteRef.current && window.google?.maps?.event) {
            google.maps.event.clearInstanceListeners(internalAutocompleteRef.current);
        }
        // mapInstanceRef.current = null; // Potentially, if full re-init is desired on prop changes.
                                       // For now, we update existing map.
      };

    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("MapComponent: Exception caught during GoMaps Pro Map instance initialization:", error);
      if (isMapLoading) setIsMapLoading(false);
      setMapLoadTimedOut(true); // Indicate map failed to load properly
    }
  // Dependencies for map instance creation. Center/zoom are handled by a separate effect if map already exists.
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, interactive, showSearchInput, onPlaceSelected, onMapIdle, center, zoom]); // Added center and zoom as they are part of initial map options


  // Effect for updating map center/zoom when props change AFTER map is initialized
  useEffect(() => {
    if (mapInstanceRef.current && center) {
        const currentMapCenter = mapInstanceRef.current.getCenter();
        if (currentMapCenter && (Math.abs(currentMapCenter.lat() - center.lat) > 0.00001 || Math.abs(currentMapCenter.lng() - center.lng) > 0.00001)) {
            mapInstanceRef.current.setCenter(center);
        }
        const currentZoom = mapInstanceRef.current.getZoom();
        if (currentZoom !== undefined && zoom !== undefined && currentZoom !== zoom) {
             mapInstanceRef.current.setZoom(zoom);
        }
    }
  }, [center, zoom]); // Only re-run if center or zoom props change


  // Effect for updating markers
  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapInstanceRef.current || !window.google?.maps?.marker || isMapLoading || mapLoadTimedOut) {
      // Don't try to update markers if map isn't fully ready or there's an API/script issue
      return;
    }

    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;

    // Clear existing markers from map
    activeMarkersRef.current.forEach(marker => marker.map = null); // Required for AdvancedMarkerElement
    activeMarkersRef.current = []; // Reset the array

    markers.forEach(markerData => {
      try {
        const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat: markerData.lat, lng: markerData.lng },
          map: map,
          title: markerData.label,
          // content: customMarkerElement, // Can use custom HTML for marker appearance
        });

        advancedMarker.addListener('click', () => {
          if (infoWindow) {
            // Basic InfoWindow content. Can be customized with HTML.
            infoWindow.setContent(`<div style="padding: 8px; font-size: 14px; color: #333;"><strong>${markerData.label}</strong><br><a href="/booking/${markerData.id}" style="color: hsl(var(--primary)); text-decoration: none;">Book Now</a></div>`);
            infoWindow.open(map, advancedMarker);
          }
          if (onMarkerClick) {
            onMarkerClick(markerData.id);
          }
        });
        activeMarkersRef.current.push(advancedMarker);
      } catch (e) {
        console.error("MapComponent: Error creating AdvancedMarkerElement for GoMaps Pro:", e, markerData);
      }
    });
    
    // Auto-fit map to markers only if 'center' prop is not explicitly provided and map is interactive
    // And if there are markers to fit to
    if (markers.length > 0 && interactive && window.google?.maps?.LatLngBounds && !center && activeMarkersRef.current.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      activeMarkersRef.current.forEach(m => {
        if(m.position) bounds.extend(m.position as google.maps.LatLngLiteral); // Cast to LatLngLiteral if needed
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 100); // 100px padding
      }
    } else if (center) {
      // If center is provided, respect it. This allows parent to control map view.
      map.setCenter(center);
      map.setZoom(zoom);
    }

  // Marker update dependencies. `center` removed to prevent re-rendering markers if only center changes.
  // Parent should manage `markers` array if it wants markers to change based on `center`.
  }, [markers, scriptsLoaded, apiKeyMissingOrScriptsFailed, onMarkerClick, interactive, zoom, isMapLoading, mapLoadTimedOut]);


  const handleMyLocation = () => {
    if (navigator.geolocation && mapInstanceRef.current) {
      setIsMapLoading(true); // Show loader while getting location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          const currentMap = mapInstanceRef.current;
          if (currentMap) {
            // Map centering/zooming will trigger 'idle' event, which then calls onMapIdle
            // allowing parent component to update its state (like activeSearchCenter).
            currentMap.setCenter(userLocation);
            currentMap.setZoom(FOCUSED_MAP_ZOOM); // Zoom in on user's location
          }
          setIsMapLoading(false); // Hide loader
        },
        (error) => {
          console.error("Error getting user location:", error);
          alert("Could not get your location. Please ensure location services are enabled in your browser and for this site.");
          setIsMapLoading(false); // Hide loader
        },
        { timeout: 10000 } // Add timeout for geolocation
      );
    } else {
      alert("Geolocation is not supported by this browser or map not ready.");
    }
  };

  if (apiKeyMissingOrScriptsFailed) {
    return (
      <Card className={cn("flex items-center justify-center aspect-video bg-muted/50 border-destructive/50", className)} data-ai-hint="map error state">
        <CardContent className="text-center p-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-destructive">Map Configuration or Loading Error</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The GoMaps Pro API key (<code>NEXT_PUBLIC_GOMAPS_PRO_API_KEY</code>) might be missing, incorrectly configured in your <code>.env.local</code> file,
            or the map scripts could not be loaded from GoMaps Pro servers. This can happen due to network issues, an invalid API key, incorrect API key permissions (check GoMaps Pro dashboard),
            or if GoMaps Pro relies on Google services, issues on the Google Cloud Console (like 'OverQuotaMapError', billing, API enablement).
          </p>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border space-y-2">
            <p className="font-semibold mb-1">Troubleshooting Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Environment Variable File:</strong> Ensure a file named <code className="bg-card p-0.5 rounded">.env.local</code> exists in your project's **absolute root directory**.</li>
              <li><strong>API Key Value:</strong> Inside <code className="bg-card p-0.5 rounded">.env.local</code>, confirm the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_GOMAPS_PRO_API_KEY=YOUR_API_KEY_HERE</code> (replace with your actual key).</li>
              <li><strong>Restart Server:</strong> **CRITICAL STEP:** After creating or modifying <code className="bg-card p-0.5 rounded">.env.local</code>, you **MUST** restart your Next.js development server.</li>
              <li><strong>API Provider Dashboard:</strong> 
                For GoMaps Pro, verify your key's status and permissions. If you suspect it uses Google services, check your Google Cloud Console (ensure Maps JavaScript API & Places API are enabled, billing is active, and quotas are fine).
                Also, check if your current domain (e.g., localhost or your deployment URL) needs to be **whitelisted** for the key.
              </li>
              <li><strong>Network & Browser Console:</strong> Check your internet connection and look for more specific errors in your browser's Network tab or Console (F12 Developer Tools). Try accessing the script/CSS URLs (shown in console errors) directly in your browser.</li>
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
      {showSearchInput && scriptsLoaded && window.google?.maps?.places && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-full max-w-sm px-4 sm:max-w-md md:max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={internalSearchInputRef}
              type="text"
              placeholder="Search map location..."
              className="w-full pl-10 pr-3 py-2 shadow-lg rounded-md border-gray-300 focus:border-primary focus:ring-primary"
              disabled={!interactive || isMapLoading} // Disable if map not interactive or still loading
            />
          </div>
        </div>
      )}
      {showMyLocationButton && interactive && (
        <Button
            variant="outline"
            size="icon"
            onClick={handleMyLocation}
            className="absolute bottom-4 right-4 z-10 bg-background shadow-lg"
            title="My Location"
            disabled={isMapLoading} // Disable if map is loading
        >
            <LocateFixed className="h-5 w-5" />
        </Button>
      )}
      {isMapLoading && !mapLoadTimedOut && !apiKeyMissingOrScriptsFailed && ( 
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
