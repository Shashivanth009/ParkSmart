
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
    mappls?: any; // Mappls specific object
    google?: any; // Keep for potential compatibility if Mappls SDK mirrors it
    initMapComponentGlobal?: () => void;
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
  onPlaceSelected?: (place: any) => void; // Mappls place result might differ from Google
  onMapIdle?: (center: { lat: number; lng: number }, zoom: number) => void;
}

const MAPPPLS_API_KEY = process.env.NEXT_PUBLIC_MAPPLS_API_KEY;
const DEFAULT_MAP_ZOOM = 12;
const FOCUSED_MAP_ZOOM = 15;

const MapComponent: React.FC<MapComponentProps> = ({
  markers = [],
  className,
  interactive = true,
  onMarkerClick,
  zoom = DEFAULT_MAP_ZOOM,
  center = null,
  showSearchInput = false,
  showMyLocationButton = false,
  onPlaceSelected,
  onMapIdle,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const activeMarkersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any | null>(null);
  
  const internalSearchInputRef = useRef<HTMLInputElement>(null);
  const internalAutocompleteRef = useRef<any | null>(null);

  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [apiKeyMissingOrScriptsFailed, setApiKeyMissingOrScriptsFailed] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);

  const effectiveCenter = center || { lat: 17.3850, lng: 78.4867 }; // Default to Hyderabad

  const loadMapplsScript = useCallback((apiKey: string) => {
    return new Promise<void>((resolve, reject) => {
      if (window.mappls && window.mappls.Map) {
        console.log("MapComponent: Mappls SDK already available.");
        resolve();
        return;
      }

      const scriptId = 'mappls-sdk';
      let existingScript = document.getElementById(scriptId);
      if (existingScript) {
        console.log("MapComponent: Removing potentially stale Mappls script tag before reloading.");
        existingScript.remove();
      }
      
      console.log("MapComponent: Attempting to load Mappls SDK script. API Key being used (first 10 chars):", apiKey ? `${apiKey.substring(0, 10)}...` : "None provided to function");
      const script = document.createElement('script');
      script.id = scriptId;
      // Standard Mappls SDK URL structure
      const scriptSrc = `https://apis.mappls.com/advancedmaps/api/${apiKey}/map_sdk?v=3.0&libraries=services,places&loading=async&callback=initMapComponentGlobal`;
      script.src = scriptSrc;
      script.async = true;
      script.defer = true; // defer might be more appropriate than async if callback is critical

      (window as any).initMapComponentGlobalCallbackSet = true;
      window.initMapComponentGlobal = () => {
        console.log("MapComponent: initMapComponentGlobal called, Mappls SDK ready.");
        delete window.initMapComponentGlobal; // Clean up global callback
        delete (window as any).initMapComponentGlobalCallbackSet;
        resolve();
      };
      
      script.onerror = (event) => {
        let errorMsg = `MapComponent: Mappls SDK script failed to load. Check browser's Network tab for specific HTTP errors (e.g., 403, 404, CORS). URL: ${scriptSrc}`;
        console.error(errorMsg, event instanceof Event ? { type: event.type } : event);
        
        existingScript = document.getElementById(scriptId); // Re-check before removing
        if (existingScript === script) { 
          script.remove();
        }

        if ((window as any).initMapComponentGlobalCallbackSet) {
          delete window.initMapComponentGlobal;
          delete (window as any).initMapComponentGlobalCallbackSet;
        }
        reject(new Error(`Failed to load script: ${scriptSrc}`));
      };
      document.head.appendChild(script);
    });
  }, []);
  
  useEffect(() => {
    console.log("MapComponent: Initializing Mappls. API Key from env (first 10 chars):", MAPPPLS_API_KEY ? `${MAPPPLS_API_KEY.substring(0,10)}...` : "Not found");
    if (!MAPPPLS_API_KEY) {
      console.error("MapComponent: Mappls API key (NEXT_PUBLIC_MAPPLS_API_KEY) is not configured.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false); 
      return;
    }
    setApiKeyMissingOrScriptsFailed(false); 

    loadMapplsScript(MAPPPLS_API_KEY)
      .then(() => {
        console.log("MapComponent: Mappls script loaded successfully state flag set.");
        setScriptsLoaded(true);
        setApiKeyMissingOrScriptsFailed(false);
      })
      .catch((error) => {
        console.error("MapComponent: Mappls script loading failed. Setting error state for UI. Details:", error.message || error);
        if (!apiKeyMissingOrScriptsFailed) setApiKeyMissingOrScriptsFailed(true);
        if (isMapLoading) setIsMapLoading(false);
        setScriptsLoaded(false); 
      });
    
    return () => {
        if ((window as any).initMapComponentGlobalCallbackSet) {
            console.log("MapComponent: Cleaning up initMapComponentGlobal due to unmount.");
            delete window.initMapComponentGlobal;
            delete (window as any).initMapComponentGlobalCallbackSet;
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMapplsScript]);


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current) {
      if (isMapLoading && (apiKeyMissingOrScriptsFailed || (scriptsLoaded && !window.mappls?.Map))) {
        setIsMapLoading(false); 
      }
      return;
    }
    
    const mapAlreadyInitialized = !!mapInstanceRef.current;
    const MapProvider = window.mappls?.Map; // Prioritize Mappls
    const PlacesProvider = window.mappls?.services?.place_search; // Mappls places might be under services
    const MarkerProvider = window.mappls?.Marker;
    const InfoWindowProvider = window.mappls?.InfoWindow;


    if (!MapProvider) {
        console.warn("MapComponent: Mappls Map provider (window.mappls.Map) is not available. Map cannot be initialized.");
        if (isMapLoading) setIsMapLoading(false);
        if (!apiKeyMissingOrScriptsFailed) setApiKeyMissingOrScriptsFailed(true); 
        return;
    }
    if (showSearchInput && !PlacesProvider) {
        console.warn("MapComponent: Mappls Places provider for search (window.mappls.services.place_search) not available. Search input might not work.");
    }


    if (mapAlreadyInitialized && mapInstanceRef.current) {
      const currentMapCenterObj = mapInstanceRef.current.getCenter();
      const currentMapCenter = currentMapCenterObj ? {lat: currentMapCenterObj.lat, lng: currentMapCenterObj.lng} : null;
      const currentZoom = mapInstanceRef.current.getZoom();
      let centerChanged = false;
      let zoomChanged = false;

      if (currentMapCenter && effectiveCenter && (Math.abs(currentMapCenter.lat - effectiveCenter.lat) > 0.00001 || Math.abs(currentMapCenter.lng - effectiveCenter.lng) > 0.00001)) {
        mapInstanceRef.current.setCenter(effectiveCenter);
        centerChanged = true;
      }
      if (currentZoom !== undefined && zoom !== undefined && currentZoom !== zoom) {
          mapInstanceRef.current.setZoom(zoom);
          zoomChanged = true;
      }
      if (isMapLoading && !centerChanged && !zoomChanged) setIsMapLoading(false); 
      return;
    }
    
    if (!isMapLoading) setIsMapLoading(true); 
    setMapLoadTimedOut(false);

    const loadTimeoutTimer = setTimeout(() => {
      if (isMapLoading && (!mapInstanceRef.current || !mapInstanceRef.current.getCenter()) ) {
        console.warn("MapComponent: Map did not fully initialize within timeout period (20s). Tiles might not have loaded or Mappls service unavailable.");
        if (isMapLoading) setIsMapLoading(false);
        setMapLoadTimedOut(true);
      } else if (isMapLoading && mapInstanceRef.current?.getCenter()) {
        if (isMapLoading) setIsMapLoading(false); 
        setMapLoadTimedOut(false);
      }
    }, 20000); 

    try {
      console.log("MapComponent: Creating new Mappls map instance with center:", effectiveCenter, "zoom:", zoom);
      const mapOptions = { // Mappls map options might differ slightly from Google's
        center: [effectiveCenter.lat, effectiveCenter.lng], // Mappls often takes [lat, lng] array
        zoom: zoom,
        // Mappls specific controls if needed, check their docs
        // Example: zoomControl: interactive, scrollWheel: interactive
      };
      
      const map = new MapProvider(mapContainerRef.current!, mapOptions);
      mapInstanceRef.current = map;
      if (InfoWindowProvider) infoWindowRef.current = new InfoWindowProvider();


      let idleListener: any | null = null; 
      let tilesLoadedListener: any | null = null; // Mappls might use 'load' or similar

      const cleanupListeners = () => {
        if (idleListener && mapInstanceRef.current?.removeListener) mapInstanceRef.current.removeListener(idleListener); // Mappls specific listener removal
        if (tilesLoadedListener && mapInstanceRef.current?.removeListener) mapInstanceRef.current.removeListener(tilesLoadedListener);
      };
      
      const onMapActuallyReady = () => {
        console.log("MapComponent: Mappls Map considered ready.");
        clearTimeout(loadTimeoutTimer); 
        if (isMapLoading) setIsMapLoading(false);
        setMapLoadTimedOut(false);
      };

      // Mappls event for map idle/ready might be 'load' or 'idle'
      idleListener = map.addListener('idle', () => { // Assuming 'idle' exists, check Mappls docs
        onMapActuallyReady();
        if (interactive && onMapIdle && mapInstanceRef.current) { 
          const currentCenterObj = mapInstanceRef.current.getCenter();
          const currentZoom = mapInstanceRef.current.getZoom();
          if (currentCenterObj && currentZoom !== undefined) {
            onMapIdle({ lat: currentCenterObj.lat, lng: currentCenterObj.lng }, currentZoom);
          }
        }
      });
      // Mappls might use 'load' event for when map is fully loaded
      tilesLoadedListener = map.addListener('load', onMapActuallyReady); 
      
      if (map.getCenter() && isMapLoading) {
          setTimeout(onMapActuallyReady, 750); 
      } else if (map.getCenter() && !isMapLoading) { 
          clearTimeout(loadTimeoutTimer);
          setMapLoadTimedOut(false);
      }


      if (showSearchInput && internalSearchInputRef.current && PlacesProvider) {
        console.log("MapComponent: Setting up Mappls Places Autocomplete for internal search input.");
        // Mappls Autocomplete setup - This is a MOCKUP. Check Mappls docs for actual implementation.
        // new mappls.services.place_search({ query: '', filter: '', callback: (data) => {} })
        // The Mappls equivalent of Google's Autocomplete needs specific integration.
        // For now, we'll log a warning if it's not a simple input bind.
        // It's likely an API call rather than binding to an input directly like Google's.
        // This part would need Mappls-specific code.
        // For this prototype, we'll assume a simpler text input for now.
        internalSearchInputRef.current.onchange = (e) => {
             const query = (e.target as HTMLInputElement).value;
             if (query.length > 2 && onPlaceSelected) { // Basic trigger
                // MOCK: In a real Mappls integration, you'd call their search API here
                // and then call onPlaceSelected with the results.
                // This is a placeholder, real Mappls search is more involved.
                console.warn("Mappls Autocomplete needs Mappls-specific API calls. This is a placeholder.");
                // Example: onPlaceSelected({ name: query, geometry: { location: map.getCenter() } });
             }
        }
      }
      
      return () => {
        console.log("MapComponent: Cleaning up Mappls instance and listeners.");
        cleanupListeners();
        clearTimeout(loadTimeoutTimer);
        // Mappls map removal/destroy if available: mapInstanceRef.current?.destroy?.();
      };

    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("MapComponent: Exception caught during Mappls instance initialization:", error);
      if (isMapLoading) setIsMapLoading(false);
      setMapLoadTimedOut(true); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, interactive, showSearchInput, onPlaceSelected, onMapIdle]);


  useEffect(() => {
    if (mapInstanceRef.current && effectiveCenter) {
        const currentMapCenterObj = mapInstanceRef.current.getCenter();
        const currentMapCenter = currentMapCenterObj ? {lat: currentMapCenterObj.lat, lng: currentMapCenterObj.lng} : null;

        if (currentMapCenter && (Math.abs(currentMapCenter.lat - effectiveCenter.lat) > 0.00001 || Math.abs(currentMapCenter.lng - effectiveCenter.lng) > 0.00001)) {
            mapInstanceRef.current.setCenter([effectiveCenter.lat, effectiveCenter.lng]); // Mappls format
        }
        const currentZoom = mapInstanceRef.current.getZoom();
        if (currentZoom !== undefined && zoom !== undefined && currentZoom !== zoom) {
             mapInstanceRef.current.setZoom(zoom);
        }
    }
  }, [effectiveCenter, zoom]); 


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapInstanceRef.current || isMapLoading || mapLoadTimedOut) {
      return;
    }
    
    const MarkerProvider = window.mappls?.Marker;
    if (!MarkerProvider) {
        console.warn("MapComponent: Mappls Marker provider not available.");
        return;
    }

    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;

    activeMarkersRef.current.forEach(marker => marker.remove()); // Mappls marker removal
    activeMarkersRef.current = [];

    markers.forEach(markerData => {
      try {
        const markerInstance = new MarkerProvider({
            position: [markerData.lat, markerData.lng], // Mappls format
            map: map,
            title: markerData.label,
            // Mappls icon customization if needed
        });

        markerInstance.addListener('click', () => { // Mappls listener
          if (infoWindow) {
            infoWindow.setOptions({ // Mappls InfoWindow options
                position: [markerData.lat, markerData.lng],
                content: `<div style="padding: 8px; font-size: 14px; color: #333;"><strong>${markerData.label}</strong><br><a href="/booking/${markerData.id}" style="color: hsl(var(--primary)); text-decoration: none;">Book Now</a></div>`
            });
            infoWindow.open(map);
          }
          if (onMarkerClick) {
            onMarkerClick(markerData.id);
          }
        });
        activeMarkersRef.current.push(markerInstance);
      } catch (e) {
        console.error("MapComponent: Error creating Mappls marker:", e, markerData);
      }
    });
    
    if (markers.length > 0 && interactive && !center && activeMarkersRef.current.length > 0 && window.mappls?.LngLatBounds) {
      const LatLngBoundsProvider = window.mappls.LngLatBounds;
      if (LatLngBoundsProvider) {
        const bounds = new LatLngBoundsProvider();
        activeMarkersRef.current.forEach(m => bounds.extend(m.getPosition())); // Mappls getPosition
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, {padding: 100}); // Mappls fitBounds
        }
      }
    } else if (effectiveCenter) {
      map.setCenter([effectiveCenter.lat, effectiveCenter.lng]);
      map.setZoom(zoom);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, scriptsLoaded, apiKeyMissingOrScriptsFailed, onMarkerClick, interactive, zoom, isMapLoading, mapLoadTimedOut]);


  const handleMyLocation = () => {
    if (navigator.geolocation && mapInstanceRef.current) {
      setIsMapLoading(true); 
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          const currentMap = mapInstanceRef.current;
          if (currentMap) {
            currentMap.setCenter([userLocation.lat, userLocation.lng]); // Mappls format
            currentMap.setZoom(FOCUSED_MAP_ZOOM);
          }
          if (onMapIdle) { 
             onMapIdle(userLocation, FOCUSED_MAP_ZOOM);
          }
          setIsMapLoading(false);
        },
        (error) => {
          console.error("Error getting user location:", error);
          alert("Could not get your location. Please ensure location services are enabled.");
          setIsMapLoading(false);
        },
        { timeout: 10000 } 
      );
    } else {
      alert("Geolocation is not supported or map not ready.");
    }
  };

  if (apiKeyMissingOrScriptsFailed) {
    return (
      <Card className={cn("flex items-center justify-center aspect-video bg-muted/50 border-destructive/50", className)} data-ai-hint="map error state">
        <CardContent className="text-center p-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-destructive">Mappls Map Configuration or Loading Error</h3>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border space-y-2">
            <p className="font-semibold mb-1">The map cannot be displayed. Please check the following:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Environment Variable:</strong> Ensure a file named <code className="bg-card p-0.5 rounded">.env.local</code> exists in your project's **absolute root directory**.</li>
              <li><strong>API Key Value:</strong> Inside <code className="bg-card p-0.5 rounded">.env.local</code>, confirm the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_MAPPLS_API_KEY=3f75ec6eb7d93e27fc884277be2715b3</code>. (Current key from env starts with: <code className="bg-card p-0.5 rounded">{MAPPPLS_API_KEY ? `${MAPPPLS_API_KEY.substring(0,10)}...` : 'Not Found'}</code>).</li>
              <li><strong>Restart Server:</strong> **Crucially, restart your Next.js development server** (e.g., via <code className="bg-card p-0.5 rounded">npm run dev</code>) after any changes to <code className="bg-card p-0.5 rounded">.env.local</code>.</li>
              <li><strong>Mappls Dashboard:</strong> Verify your API key (<code className="bg-card p-0.5 rounded">3f75ec6eb7d93e27fc884277be2715b3</code>) is active, has permissions for "Advanced Maps SDK" or similar, and that your current domain (e.g., <code className="bg-card p-0.5 rounded">localhost:PORT</code> or deployment URL) is **whitelisted** if required by Mappls.</li>
              <li><strong>Network & Browser Console:</strong> Check your internet connection. Open your browser's Developer Tools (F12), go to the **Network tab**, and refresh. Look for failed requests to Mappls scripts (e.g., <code className="bg-card p-0.5 rounded">apis.mappls.com/...</code>). The HTTP status code (e.g., 401, 403, 404, CORS error) provides clues.</li>
            </ol>
            <p className="mt-2">For Next.js environment variables, see the <Link href="https://nextjs.org/docs/app/building-your-application/configuring/environment-variables" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Next.js Documentation</Link>.</p>
            <p className="mt-2">Consult Mappls documentation for API key and SDK setup specifics.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("aspect-video relative overflow-hidden shadow-md rounded-lg", className)} data-interactive={interactive}>
      <div ref={mapContainerRef} className="w-full h-full bg-muted" data-ai-hint="interactive map placeholder" />
      {showSearchInput && scriptsLoaded && window.mappls?.services?.place_search && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-full max-w-sm px-4 sm:max-w-md md:max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={internalSearchInputRef}
              type="text"
              placeholder="Search Mappls location..."
              className="w-full pl-10 pr-3 py-2 shadow-lg rounded-md border-input focus:border-primary focus:ring-primary"
              disabled={!interactive || isMapLoading}
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
            disabled={isMapLoading}
        >
            <LocateFixed className="h-5 w-5" />
        </Button>
      )}
      {isMapLoading && !mapLoadTimedOut && !apiKeyMissingOrScriptsFailed && ( 
        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading Mappls Map...</p>
        </div>
      )}
      {mapLoadTimedOut && !apiKeyMissingOrScriptsFailed && ( 
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center z-10 p-4 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mb-2" />
          <p className="text-md font-semibold text-destructive">Mappls Map Timed Out or Failed to Load</p>
          <p className="text-sm text-muted-foreground">The map took too long to load or encountered an error. Please check your internet connection or try again later. Verify API key status, domain whitelisting, and service entitlements on the Mappls dashboard. Check the browser's Network tab for specific errors.</p>
        </div>
      )}
    </Card>
  );
};

export default MapComponent;
