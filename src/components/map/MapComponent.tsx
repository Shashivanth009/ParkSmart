
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
    mappls?: any; 
    google?: any; 
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

  const effectiveCenter = center || { lat: 17.3850, lng: 78.4867 }; 

  const loadGoMapsProScript = useCallback((apiKey: string) => {
    return new Promise<void>((resolve, reject) => {
      const MapProviderCheck = window.mappls?.maps?.Map || window.google?.maps?.Map;
      const PlacesProviderCheck = window.mappls?.maps?.places || window.google?.maps?.places;

      if (MapProviderCheck && PlacesProviderCheck) {
        console.log("MapComponent: GoMaps Pro compatible SDK already available.");
        resolve();
        return;
      }

      const scriptId = 'gomaps-pro-sdk';
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        console.log("MapComponent: Removing potentially stale GoMaps Pro script tag before reloading.");
        existingScript.remove();
      }
      
      console.log("MapComponent: Attempting to load GoMaps Pro SDK script. API Key being used (first 10 chars):", apiKey ? `${apiKey.substring(0, 10)}...` : "None provided to function");
      const script = document.createElement('script');
      script.id = scriptId;
      const scriptSrc = `https://maps.gomaps.pro/maps/api/js?key=${apiKey}&libraries=marker,places&loading=async&callback=initMapComponentGlobal`;
      script.src = scriptSrc;
      script.async = true;
      script.defer = true;

      (window as any).initMapComponentGlobalCallbackSet = true;
      window.initMapComponentGlobal = () => {
        console.log("MapComponent: initMapComponentGlobal called, GoMaps Pro SDK ready.");
        delete window.initMapComponentGlobal;
        delete (window as any).initMapComponentGlobalCallbackSet;
        resolve();
      };
      
      script.onerror = (event) => {
        let errorMsg = `MapComponent: GoMaps Pro SDK script failed to load. Check browser's Network tab for specific HTTP errors (e.g., 403, 404, CORS). URL: ${scriptSrc}`;
        console.error(errorMsg, event instanceof Event ? { type: event.type } : event);
        
        if (document.getElementById(scriptId) === script) { 
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
    console.log("MapComponent: Initializing. API Key from env (first 10 chars):", GOMAPS_PRO_API_KEY ? `${GOMAPS_PRO_API_KEY.substring(0,10)}...` : "Not found");
    if (!GOMAPS_PRO_API_KEY) {
      console.error("MapComponent: GoMaps Pro API key (NEXT_PUBLIC_GOMAPS_PRO_API_KEY) is not configured.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false); 
      return;
    }
    setApiKeyMissingOrScriptsFailed(false); 

    loadGoMapsProScript(GOMAPS_PRO_API_KEY)
      .then(() => {
        console.log("MapComponent: GoMaps Pro script loaded successfully state flag set.");
        setScriptsLoaded(true);
        setApiKeyMissingOrScriptsFailed(false); // Ensure this is false on success
      })
      .catch((error) => {
        console.error(
            "MapComponent: Script loading for GoMaps Pro failed. Setting error state for UI. Details:",
            error.message || error
        );
        if (!apiKeyMissingOrScriptsFailed) {
            setApiKeyMissingOrScriptsFailed(true);
        }
        if (isMapLoading) {
            setIsMapLoading(false);
        }
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
  }, [loadGoMapsProScript, GOMAPS_PRO_API_KEY]);


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current) {
      if (isMapLoading && (apiKeyMissingOrScriptsFailed || (scriptsLoaded && (!window.mappls?.maps?.Map && !window.google?.maps?.Map)))) {
        setIsMapLoading(false); 
      }
      return;
    }
    
    const mapAlreadyInitialized = !!mapInstanceRef.current;
    const MapProvider = window.mappls?.maps?.Map || window.google?.maps?.Map;
    const PlacesProvider = window.mappls?.maps?.places || window.google?.maps?.places;
    const MarkerProvider = window.mappls?.maps?.Marker || window.google?.maps?.marker?.AdvancedMarkerElement || window.google?.maps?.Marker;
    const InfoWindowProvider = window.mappls?.maps?.InfoWindow || window.google?.maps?.InfoWindow;

    if (!MapProvider || !PlacesProvider || !MarkerProvider || !InfoWindowProvider) {
        console.warn("MapComponent: One or more GoMaps Pro (or compatible Google) map providers are not available on window object. Map cannot be initialized.");
        if (isMapLoading) setIsMapLoading(false);
        if (!apiKeyMissingOrScriptsFailed) setApiKeyMissingOrScriptsFailed(true); 
        return;
    }


    if (mapAlreadyInitialized && mapInstanceRef.current) {
      const currentMapCenter = mapInstanceRef.current.getCenter();
      const currentZoom = mapInstanceRef.current.getZoom();
      let centerChanged = false;
      let zoomChanged = false;

      if (currentMapCenter && effectiveCenter && (Math.abs(currentMapCenter.lat() - effectiveCenter.lat) > 0.00001 || Math.abs(currentMapCenter.lng() - effectiveCenter.lng) > 0.00001)) {
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
    
    if (!isMapLoading) { // Only set to true if not already loading
        setIsMapLoading(true); 
    }
    setMapLoadTimedOut(false);

    const loadTimeoutTimer = setTimeout(() => {
      if (isMapLoading && (!mapInstanceRef.current || !mapInstanceRef.current.getCenter()) ) {
        console.warn("MapComponent: Map did not fully initialize within timeout period (20s). Tiles might not have loaded or GoMaps Pro service unavailable.");
        if (isMapLoading) setIsMapLoading(false);
        setMapLoadTimedOut(true);
      } else if (isMapLoading && mapInstanceRef.current?.getCenter()) {
        if (isMapLoading) setIsMapLoading(false); 
        setMapLoadTimedOut(false);
      }
    }, 20000); 

    try {
      console.log("MapComponent: Creating new GoMaps Pro (or compatible) instance with center:", effectiveCenter, "zoom:", zoom);
      const mapOptions: google.maps.MapOptions = {
        center: effectiveCenter,
        zoom: zoom,
        mapId: "PARKSMART_GOMAPS_PRO_ID", 
        disableDefaultUI: false, 
        zoomControl: interactive,
        streetViewControl: interactive,
        mapTypeControl: interactive,
        fullscreenControl: interactive,
        scrollwheel: interactive,
        gestureHandling: interactive ? 'auto' : 'none',
      };
      
      const map = new MapProvider(mapContainerRef.current!, mapOptions);
      mapInstanceRef.current = map;
      infoWindowRef.current = new InfoWindowProvider();

      let idleListener: any | null = null; 
      let tilesLoadedListener: any | null = null;

      const cleanupListeners = () => {
        const eventProvider = window.mappls?.maps?.event || window.google?.maps?.event;
        if (idleListener && eventProvider) eventProvider.removeListener(idleListener);
        if (tilesLoadedListener && eventProvider) eventProvider.removeListener(tilesLoadedListener);
      };
      
      const onMapActuallyReady = () => {
        console.log("MapComponent: GoMaps Pro Map considered ready (idle or tilesloaded).");
        clearTimeout(loadTimeoutTimer); 
        if (isMapLoading) setIsMapLoading(false);
        setMapLoadTimedOut(false);
      };

      idleListener = map.addListener('idle', () => {
        onMapActuallyReady();
        if (interactive && onMapIdle && mapInstanceRef.current) { 
          const currentCenter = mapInstanceRef.current.getCenter();
          const currentZoom = mapInstanceRef.current.getZoom();
          if (currentCenter && currentZoom !== undefined) {
            onMapIdle({ lat: currentCenter.lat(), lng: currentCenter.lng() }, currentZoom);
          }
        }
      });
      tilesLoadedListener = map.addListener('tilesloaded', onMapActuallyReady);
      
      if (map.getCenter() && isMapLoading) {
          setTimeout(onMapActuallyReady, 750); 
      } else if (map.getCenter() && !isMapLoading) { 
          clearTimeout(loadTimeoutTimer);
          setMapLoadTimedOut(false);
      }


      if (showSearchInput && internalSearchInputRef.current && PlacesProvider) {
        console.log("MapComponent: Setting up Places Autocomplete for internal search input (GoMaps Pro compatible).");
        const AutocompleteProvider = window.google?.maps?.places?.Autocomplete || PlacesProvider.Autocomplete;
        internalAutocompleteRef.current = new AutocompleteProvider(internalSearchInputRef.current, {
          types: ['geocode'], 
        });
        internalAutocompleteRef.current.bindTo('bounds', map); 
        internalAutocompleteRef.current.addListener('place_changed', () => {
          const place = internalAutocompleteRef.current?.getPlace();
          if (place?.geometry?.location) {
            console.log("MapComponent: Place selected from internal autocomplete:", place.name);
            if (onPlaceSelected) {
              onPlaceSelected(place);
            }
          }
        });
      }
      
      return () => {
        console.log("MapComponent: Cleaning up GoMaps Pro instance and listeners.");
        cleanupListeners();
        clearTimeout(loadTimeoutTimer);
        const eventProvider = window.mappls?.maps?.event || window.google?.maps?.event;
        if (mapInstanceRef.current && eventProvider) {
           eventProvider.clearInstanceListeners(mapInstanceRef.current);
        }
        if (internalAutocompleteRef.current && eventProvider) {
            eventProvider.clearInstanceListeners(internalAutocompleteRef.current);
        }
      };

    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("MapComponent: Exception caught during GoMaps Pro instance initialization:", error);
      if (isMapLoading) setIsMapLoading(false);
      setMapLoadTimedOut(true); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, interactive, showSearchInput, onPlaceSelected, onMapIdle]);


  useEffect(() => {
    if (mapInstanceRef.current && effectiveCenter) {
        const currentMapCenter = mapInstanceRef.current.getCenter();
        if (currentMapCenter && (Math.abs(currentMapCenter.lat() - effectiveCenter.lat) > 0.00001 || Math.abs(currentMapCenter.lng() - effectiveCenter.lng) > 0.00001)) {
            mapInstanceRef.current.setCenter(effectiveCenter);
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
    
    const MarkerProvider = window.mappls?.maps?.Marker || window.google?.maps?.marker?.AdvancedMarkerElement || window.google?.maps?.Marker;
    if (!MarkerProvider) {
        console.warn("MapComponent: Marker provider (Mappls or Google) not available for rendering markers.");
        return;
    }

    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;

    activeMarkersRef.current.forEach(marker => { 
        if (typeof marker.setMap === 'function') marker.setMap(null); 
        else if (marker.map) marker.map = null; 
    });
    activeMarkersRef.current = [];

    markers.forEach(markerData => {
      try {
        let markerInstance;
        if (MarkerProvider === window.google?.maps?.marker?.AdvancedMarkerElement) {
            const pinElement = document.createElement('div');
            pinElement.className = 'bg-primary rounded-full w-3 h-3 border-2 border-white shadow-md';
            const content = document.createElement('div');
            content.appendChild(pinElement);

            markerInstance = new MarkerProvider({
                position: { lat: markerData.lat, lng: markerData.lng },
                map: map,
                title: markerData.label,
                content: content, 
            });
        } else { 
            markerInstance = new MarkerProvider({
                position: { lat: markerData.lat, lng: markerData.lng },
                map: map,
                title: markerData.label,
            });
        }

        const eventProvider = window.mappls?.maps?.event || window.google?.maps?.event;
        if(eventProvider) {
            eventProvider.addListener(markerInstance, 'click', () => {
              if (infoWindow) {
                infoWindow.setContent(`<div style="padding: 8px; font-size: 14px; color: #333;"><strong>${markerData.label}</strong><br><a href="/booking/${markerData.id}" style="color: hsl(var(--primary)); text-decoration: none;">Book Now</a></div>`);
                infoWindow.open({anchor: markerInstance, map});
              }
              if (onMarkerClick) {
                onMarkerClick(markerData.id);
              }
            });
        }
        activeMarkersRef.current.push(markerInstance);
      } catch (e) {
        console.error("MapComponent: Error creating marker (GoMaps Pro compatible):", e, markerData);
      }
    });
    
    if (markers.length > 0 && interactive && !center && activeMarkersRef.current.length > 0) {
      const LatLngBoundsProvider = window.mappls?.maps?.LatLngBounds || window.google?.maps?.LatLngBounds;
      if (LatLngBoundsProvider) {
        const bounds = new LatLngBoundsProvider();
        activeMarkersRef.current.forEach(m => {
            const position = m.getPosition ? m.getPosition() : m.position;
            if (position) bounds.extend(position);
        });
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 100); 
        }
      }
    } else if (effectiveCenter) {
      map.setCenter(effectiveCenter);
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
            currentMap.setCenter(userLocation);
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
          <h3 className="text-lg font-semibold text-destructive">Map Configuration or Loading Error</h3>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border space-y-2">
            <p className="font-semibold mb-1">The map cannot be displayed. Please check the following:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Environment Variable Setup:</strong>
                <ul className="list-disc list-inside pl-4">
                  <li>Ensure a file named <code className="bg-card p-0.5 rounded">.env.local</code> exists in your project's **absolute root directory**.</li>
                  <li>Inside <code className="bg-card p-0.5 rounded">.env.local</code>, confirm the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_GOMAPS_PRO_API_KEY=YOUR_API_KEY_HERE</code> (current key starts with: <code className="bg-card p-0.5 rounded">{GOMAPS_PRO_API_KEY ? `${GOMAPS_PRO_API_KEY.substring(0,10)}...` : 'Not Found'}</code>).</li>
                  <li>**CRITICAL:** After creating or modifying <code className="bg-card p-0.5 rounded">.env.local</code>, you **MUST restart your Next.js development server** (e.g., via <code className="bg-card p-0.5 rounded">npm run dev</code>).</li>
                </ul>
              </li>
              <li><strong>GoMaps Pro Dashboard / Relevant Map Provider Dashboard:</strong>
                 <ul className="list-disc list-inside pl-4">
                    <li>Verify your API key (<code className="bg-card p-0.5 rounded">{GOMAPS_PRO_API_KEY ? `${GOMAPS_PRO_API_KEY.substring(0,10)}...` : 'Not Found'}</code>) is active and has permissions for the necessary Map SDKs (e.g., Maps JavaScript API, Places API if GoMaps Pro is a wrapper).</li>
                    <li>Ensure your current domain (e.g., <code className="bg-card p-0.5 rounded">localhost:PORT</code> or your deployment URL) is **whitelisted** in the API key restrictions on your map provider's dashboard.</li>
                    <li>If using Google services via GoMaps Pro, ensure billing is enabled on the associated Google Cloud Project and check for quota issues.</li>
                </ul>
              </li>
              <li><strong>Network & Browser Console:</strong>
                <ul className="list-disc list-inside pl-4">
                  <li>Check your internet connection. Ensure no firewalls, proxies, or VPNs are blocking access to <code className="bg-card p-0.5 rounded">maps.gomaps.pro</code> or relevant Google domains.</li>
                  <li>Open your browser's Developer Tools (F12), go to the **Network tab**, and refresh the page. Look for failed requests (often red) to map scripts (like <code className="bg-card p-0.5 rounded">maps.gomaps.pro/maps/api/js?...</code>). The HTTP status code (e.g., 403, 404, CORS error) will provide crucial clues.</li>
                </ul>
              </li>
            </ol>
            <p className="mt-2">For details on Next.js environment variables, see the <Link href="https://nextjs.org/docs/app/building-your-application/configuring/environment-variables" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Next.js Documentation</Link>.</p>
            <p className="mt-2">Consult your map provider's documentation (GoMaps Pro or Google Maps) for API key and SDK setup.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("aspect-video relative overflow-hidden shadow-md rounded-lg", className)} data-interactive={interactive}>
      <div ref={mapContainerRef} className="w-full h-full bg-muted" data-ai-hint="interactive map placeholder" />
      {showSearchInput && scriptsLoaded && (window.mappls?.maps?.places || window.google?.maps?.places) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-full max-w-sm px-4 sm:max-w-md md:max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={internalSearchInputRef}
              type="text"
              placeholder="Search map location..."
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
          <p className="text-sm text-muted-foreground">Loading Map...</p>
        </div>
      )}
      {mapLoadTimedOut && !apiKeyMissingOrScriptsFailed && ( 
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center z-10 p-4 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mb-2" />
          <p className="text-md font-semibold text-destructive">Map Timed Out or Failed to Load</p>
          <p className="text-sm text-muted-foreground">The map took too long to load or encountered an error. Please check your internet connection or try again later. Verify API key status, domain whitelisting, and service entitlements on your map provider's dashboard. Check the browser's Network tab for specific errors.</p>
        </div>
      )}
    </Card>
  );
};

export default MapComponent;
