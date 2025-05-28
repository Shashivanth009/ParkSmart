
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
    google?: typeof google;
    initMapComponentGlobal?: () => void;
    gm_authFailure?: () => void; // Standard Google Maps auth failure callback
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

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
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
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const activeMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  
  const internalSearchInputRef = useRef<HTMLInputElement>(null);
  const internalAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [apiKeyMissingOrScriptsFailed, setApiKeyMissingOrScriptsFailed] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);

  const effectiveCenter = center || { lat: 17.3850, lng: 78.4867 }; // Default to Hyderabad

  const loadGoogleMapsScript = useCallback((apiKey: string) => {
    return new Promise<void>((resolve, reject) => {
      if (window.google?.maps?.places && window.google?.maps?.marker) {
        console.log("MapComponent: Google Maps API already available.");
        resolve();
        return;
      }

      const scriptId = 'google-maps-sdk';
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        console.log("MapComponent: Removing potentially stale Google Maps script tag.");
        existingScript.remove();
      }
      
      console.log("MapComponent: Attempting to load Google Maps SDK script. API Key found in env:", !!apiKey);
      const script = document.createElement('script');
      script.id = scriptId;
      // Construct the Google Maps API URL
      const scriptSrc = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker,places&loading=async&callback=initMapComponentGlobal`;
      script.src = scriptSrc;
      script.async = true;
      script.defer = true;

      (window as any).initMapComponentGlobalCallbackSet = true;
      window.initMapComponentGlobal = () => {
        console.log("MapComponent: initMapComponentGlobal called, Google Maps SDK ready.");
        delete window.initMapComponentGlobal;
        delete (window as any).initMapComponentGlobalCallbackSet;
        resolve();
      };
      
      script.onerror = (event) => {
        let errorMsg = `MapComponent: Google Maps SDK script failed to load. Check browser's Network tab for specific HTTP errors (e.g., 403, 404, CORS). URL: ${scriptSrc}`;
        console.error(errorMsg, event instanceof Event ? { type: event.type } : event);
        
        if (document.getElementById(scriptId) === script) { 
          script.remove();
        }

        if ((window as any).initMapComponentGlobalCallbackSet) {
          delete window.initMapComponentGlobal;
          delete (window as any).initMapComponentGlobalCallbackSet;
        }
        setApiKeyMissingOrScriptsFailed(true);
        setIsMapLoading(false);
        reject(new Error(`Failed to load script: ${scriptSrc}`));
      };
      document.head.appendChild(script);
    });
  }, []);
  
  useEffect(() => {
    console.log("MapComponent: Initializing. Google Maps API Key from env:", GOOGLE_MAPS_API_KEY ? "Exists" : "Not found");
    if (!GOOGLE_MAPS_API_KEY) {
      console.error("MapComponent: Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) is not configured.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false); 
      return;
    }
    setApiKeyMissingOrScriptsFailed(false); 

    window.gm_authFailure = () => {
      console.error("MapComponent: Detected gm_authFailure. This indicates an API key issue with Google Maps (billing, quota, invalid key, or API not enabled). Check Google Cloud Console.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false);
    };

    loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
      .then(() => {
        console.log("MapComponent: Google Maps script loaded successfully state flag set.");
        setScriptsLoaded(true);
        setApiKeyMissingOrScriptsFailed(false);
      })
      .catch((error) => {
        console.error("MapComponent: Critical failure loading Google Maps resources.", error);
        if (!apiKeyMissingOrScriptsFailed) setApiKeyMissingOrScriptsFailed(true);
        if (isMapLoading) setIsMapLoading(false);
        setScriptsLoaded(false); 
      });
    
    return () => {
        delete window.gm_authFailure;
        if ((window as any).initMapComponentGlobalCallbackSet) {
            console.log("MapComponent: Cleaning up initMapComponentGlobal due to unmount.");
            delete window.initMapComponentGlobal;
            delete (window as any).initMapComponentGlobalCallbackSet;
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadGoogleMapsScript]);


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current || !window.google?.maps?.Map) {
      if (isMapLoading && (apiKeyMissingOrScriptsFailed || (scriptsLoaded && !window.google?.maps?.Map))) {
        setIsMapLoading(false); 
      }
      return;
    }
    
    const mapAlreadyInitialized = !!mapInstanceRef.current;

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
    
    if (!isMapLoading) setIsMapLoading(true); 
    setMapLoadTimedOut(false);

    const loadTimeoutTimer = setTimeout(() => {
      if (isMapLoading && (!mapInstanceRef.current || !mapInstanceRef.current.getCenter()) ) {
        console.warn("MapComponent: Map did not fully initialize within timeout period (20s). Tiles might not have loaded or Google Maps service unavailable.");
        if (isMapLoading) setIsMapLoading(false);
        setMapLoadTimedOut(true);
      } else if (isMapLoading && mapInstanceRef.current?.getCenter()) {
        if (isMapLoading) setIsMapLoading(false); 
        setMapLoadTimedOut(false);
      }
    }, 20000); 

    try {
      console.log("MapComponent: Creating new Google Maps instance with center:", effectiveCenter, "zoom:", zoom);
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: effectiveCenter,
        zoom: zoom,
        mapId: "PARKSMART_MAP_ID", // You can define a Map ID in Google Cloud Console for custom styling
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

      const cleanupListeners = () => {
        if (idleListener && window.google?.maps?.event) google.maps.event.removeListener(idleListener);
        if (tilesLoadedListener && window.google?.maps?.event) google.maps.event.removeListener(tilesLoadedListener);
      };
      
      const onMapActuallyReady = () => {
        console.log("MapComponent: Google Map considered ready (idle or tilesloaded).");
        clearTimeout(loadTimeoutTimer); 
        if (isMapLoading) { 
            setIsMapLoading(false);
        }
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


      if (showSearchInput && internalSearchInputRef.current && window.google.maps.places) {
        console.log("MapComponent: Setting up Google Places Autocomplete for internal search input.");
        internalAutocompleteRef.current = new window.google.maps.places.Autocomplete(internalSearchInputRef.current, {
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
        console.log("MapComponent: Cleaning up Google Maps instance and listeners.");
        cleanupListeners();
        clearTimeout(loadTimeoutTimer);
        if (mapInstanceRef.current && window.google?.maps?.event) {
           google.maps.event.clearInstanceListeners(mapInstanceRef.current);
        }
        if (internalAutocompleteRef.current && window.google?.maps?.event) {
            google.maps.event.clearInstanceListeners(internalAutocompleteRef.current);
        }
      };

    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("MapComponent: Exception caught during Google Maps instance initialization:", error);
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
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapInstanceRef.current || !window.google?.maps?.marker || isMapLoading || mapLoadTimedOut) {
      return;
    }

    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;

    activeMarkersRef.current.forEach(marker => { marker.map = null; });
    activeMarkersRef.current = [];

    markers.forEach(markerData => {
      try {
        const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat: markerData.lat, lng: markerData.lng },
          map: map,
          title: markerData.label,
        });

        advancedMarker.addListener('click', () => {
          if (infoWindow) {
            infoWindow.setContent(`<div style="padding: 8px; font-size: 14px; color: #333;"><strong>${markerData.label}</strong><br><a href="/booking/${markerData.id}" style="color: hsl(var(--primary)); text-decoration: none;">Book Now</a></div>`);
            infoWindow.open(map, advancedMarker);
          }
          if (onMarkerClick) {
            onMarkerClick(markerData.id);
          }
        });
        activeMarkersRef.current.push(advancedMarker);
      } catch (e) {
        console.error("MapComponent: Error creating Google Maps AdvancedMarkerElement:", e, markerData);
      }
    });
    
    if (markers.length > 0 && interactive && window.google?.maps?.LatLngBounds && !center && activeMarkersRef.current.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      activeMarkersRef.current.forEach(m => {
        if(m.position) bounds.extend(m.position as google.maps.LatLngLiteral);
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 100);
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
                  <li>Inside <code className="bg-card p-0.5 rounded">.env.local</code>, confirm the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE</code> (replace <code className="bg-card p-0.5 rounded">YOUR_API_KEY_HERE</code> with your actual key, e.g., <code className="bg-card p-0.5 rounded">AlzaSySBj6K...</code>).</li>
                  <li>**CRITICAL:** After creating or modifying <code className="bg-card p-0.5 rounded">.env.local</code>, you **MUST restart your Next.js development server** (e.g., via <code className="bg-card p-0.5 rounded">npm run dev</code>).</li>
                </ul>
              </li>
              <li><strong>Google Cloud Console:</strong>
                <ul className="list-disc list-inside pl-4">
                  <li>Verify your API key (<code className="bg-card p-0.5 rounded">{GOOGLE_MAPS_API_KEY ? `${GOOGLE_MAPS_API_KEY.substring(0,10)}...` : 'Not Found'}</code>) is active.</li>
                  <li>Ensure the **Maps JavaScript API** and **Places API** are enabled for your project.</li>
                  <li>Confirm **billing is enabled** on the associated Google Cloud Project.</li>
                  <li>Ensure your current domain (e.g., <code className="bg-card p-0.5 rounded">localhost:PORT</code> or your deployment URL) is **whitelisted** in the API key restrictions (API restrictions & Application restrictions). Or, ensure it's unrestricted for testing.</li>
                  <li>Check for quota issues (e.g., `OverQuotaMapError`).</li>
                </ul>
              </li>
              <li><strong>Network & Browser Console:</strong>
                <ul className="list-disc list-inside pl-4">
                  <li>Check your internet connection. Ensure no firewalls, proxies, or VPNs are blocking access to <code className="bg-card p-0.5 rounded">maps.googleapis.com</code>.</li>
                  <li>Open your browser's Developer Tools (F12), go to the **Network tab**, and refresh the page. Look for failed requests (often red) to map scripts. The HTTP status code (e.g., 403, 404, CORS error) will provide crucial clues.</li>
                </ul>
              </li>
            </ol>
            <p className="mt-2">For details on Next.js environment variables, see the <Link href="https://nextjs.org/docs/app/building-your-application/configuring/environment-variables" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Next.js Documentation</Link>.</p>
             <p className="mt-2">For Google Maps API key issues, refer to the <Link href="https://developers.google.com/maps/documentation/javascript/error-messages" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Maps Error Messages Guide</Link>.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("aspect-video relative overflow-hidden shadow-md rounded-lg", className)} data-interactive={interactive}>
      <div ref={mapContainerRef} className="w-full h-full bg-muted" data-ai-hint="interactive google map placeholder" />
      {showSearchInput && scriptsLoaded && window.google?.maps?.places && (
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
          <p className="text-sm text-muted-foreground">The map took too long to load or encountered an error. Please check your internet connection or try again later. Verify API key status, domain whitelisting, and service entitlements on your Google Cloud Console. Check the browser's Network tab for specific errors.</p>
        </div>
      )}
    </Card>
  );
};

export default MapComponent;

    