
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
    mappls?: any; // Mappls SDK global object
    L?: any; // Leaflet if Mappls uses it under the hood
    // For GoMaps Pro (Google Maps compatible)
    google?: typeof google;
    initMapComponentGlobal?: () => void;
    gm_authFailure?: () => void; // Google Maps specific auth failure callback
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
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void; // For Google Places Autocomplete
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
  center = { lat: 17.3850, lng: 78.4867 }, // Default to Hyderabad
  showSearchInput = false,
  showMyLocationButton = false,
  onPlaceSelected,
  onMapIdle,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null); // For Google Maps compatible
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
      if (window.google?.maps?.places && window.google?.maps?.marker) {
        console.log("MapComponent: GoMaps Pro compatible API (Google Maps) already available.");
        resolve();
        return;
      }

      const existingScript = document.getElementById('gomaps-pro-sdk');
      if (existingScript) {
        let checks = 0;
        const interval = setInterval(() => {
          checks++;
          if (window.google?.maps?.places && window.google?.maps?.marker) {
            clearInterval(interval);
            resolve();
          } else if (checks > 20) { // ~2 seconds timeout
            clearInterval(interval);
            console.warn("MapComponent: Existing GoMaps Pro script did not load in time. Will attempt to proceed.");
            resolve(); 
          }
        }, 100);
        return;
      }
      
      console.log("MapComponent: Attempting to load GoMaps Pro SDK script with key:", apiKey ? "Present" : "MISSING!");
      const script = document.createElement('script');
      script.id = 'gomaps-pro-sdk';
      script.src = `https://maps.gomaps.pro/maps/api/js?key=${apiKey}&libraries=marker,places&loading=async&callback=initMapComponentGlobal`;
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
        let errorMsg = `MapComponent: GoMaps Pro SDK script failed to load. Check browser's Network tab for specific HTTP errors (e.g., 403, 404, CORS). Event type: ${event instanceof Event ? event.type : 'unknown'}.`;
        // Log more details if available in the event object, though 'error' events for scripts are often not very descriptive.
        console.error(errorMsg, event instanceof Event ? { type: event.type, target: event.target } : event);
        if ((window as any).initMapComponentGlobalCallbackSet) {
          delete window.initMapComponentGlobal;
          delete (window as any).initMapComponentGlobalCallbackSet;
        }
        setApiKeyMissingOrScriptsFailed(true); // Ensure UI updates
        setIsMapLoading(false);               // Stop loader
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

    window.gm_authFailure = () => {
      console.error("MapComponent: Detected gm_authFailure. This indicates an API key issue (billing, quota, invalid key, or API not enabled). For Google Maps, check Google Cloud Console. For GoMaps Pro, check their dashboard or if it proxies Google errors.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false);
    };

    loadGoMapsProScript(GOMAPS_PRO_API_KEY)
      .then(() => {
        console.log("MapComponent: GoMaps Pro script loaded successfully state flag set.");
        setScriptsLoaded(true);
        setApiKeyMissingOrScriptsFailed(false);
      })
      .catch((error) => {
        console.error("MapComponent: Critical failure loading GoMaps Pro resources.", error);
        // setApiKeyMissingOrScriptsFailed is likely already true from loadGoMapsProScript's reject
        if (!apiKeyMissingOrScriptsFailed) setApiKeyMissingOrScriptsFailed(true);
        setIsMapLoading(false);
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
  }, [loadGoMapsProScript, apiKeyMissingOrScriptsFailed]); // Added apiKeyMissingOrScriptsFailed to dependencies


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current || !window.google?.maps?.Map || !center) {
      if (isMapLoading && (apiKeyMissingOrScriptsFailed || (scriptsLoaded && (!window.google?.maps?.Map || !center)))) {
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

      if (currentMapCenter && center && (Math.abs(currentMapCenter.lat() - center.lat) > 0.00001 || Math.abs(currentMapCenter.lng() - center.lng) > 0.00001)) {
        mapInstanceRef.current.setCenter(center);
        centerChanged = true;
      }
      if (currentZoom !== undefined && zoom !== undefined && currentZoom !== zoom) {
          mapInstanceRef.current.setZoom(zoom);
          zoomChanged = true;
      }
      if (isMapLoading && !centerChanged && !zoomChanged) setIsMapLoading(false); 
      return;
    }
    
    if (mapAlreadyInitialized) return;

    if (!isMapLoading) setIsMapLoading(true); 
    setMapLoadTimedOut(false);

    const loadTimeoutTimer = setTimeout(() => {
      if (isMapLoading && (!mapInstanceRef.current || !mapInstanceRef.current.getCenter()) ) {
        console.error("MapComponent: Map did not fully initialize within timeout period (20s). Tiles might not have loaded or map service unavailable.");
        if (isMapLoading) setIsMapLoading(false);
        setMapLoadTimedOut(true);
      } else if (isMapLoading && mapInstanceRef.current?.getCenter()) {
        if (isMapLoading) setIsMapLoading(false);
        setMapLoadTimedOut(false);
      }
    }, 20000); 

    try {
      console.log("MapComponent: Creating new Map instance with center:", center, "zoom:", zoom);
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        mapId: "GOMAPS_PRO_MAP_ID_OR_GOOGLE_MAP_ID", 
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
        console.log("MapComponent: Map considered ready (idle or tilesloaded).");
        clearTimeout(loadTimeoutTimer); 
        if (isMapLoading) {
            setIsMapLoading(false);
        }
        setMapLoadTimedOut(false);
      };

      idleListener = map.addListener('idle', () => {
        onMapActuallyReady();
        if (interactive && onMapIdle && mapInstanceRef.current) { // Ensure mapInstanceRef.current exists
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
        console.log("MapComponent: Setting up Autocomplete for internal search input.");
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
        console.log("MapComponent: Cleaning up map instance and listeners.");
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
      console.error("MapComponent: Exception caught during GoMaps Pro Map instance initialization:", error);
      if (isMapLoading) setIsMapLoading(false);
      setMapLoadTimedOut(true);
    }
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, interactive, showSearchInput, onPlaceSelected, onMapIdle, center, zoom, isMapLoading]);


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
  }, [center, zoom]); 


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapInstanceRef.current || !window.google?.maps?.marker || isMapLoading || mapLoadTimedOut) {
      return;
    }

    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;

    activeMarkersRef.current.forEach(marker => marker.map = null);
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
        console.error("MapComponent: Error creating AdvancedMarkerElement:", e, markerData);
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
    } else if (center) {
      map.setCenter(center);
      map.setZoom(zoom);
    }
  }, [markers, scriptsLoaded, apiKeyMissingOrScriptsFailed, onMarkerClick, interactive, zoom, isMapLoading, mapLoadTimedOut, center]); // Added center to re-evaluate markers if center prop changes with no auto-fit


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
          <p className="text-sm text-muted-foreground mt-1">
            The GoMaps Pro API key (<code>NEXT_PUBLIC_GOMAPS_PRO_API_KEY</code>) might be missing or incorrectly configured in your <code>.env.local</code> file.
            Alternatively, the map scripts/styles could not be loaded from GoMaps Pro servers. This can happen due to network issues, an invalid API key, or incorrect API key permissions
            on the GoMaps Pro dashboard (e.g., domain not whitelisted). If you see Google-specific errors in the console (like 'OverQuotaMapError'),
            check your Google Cloud Console for API key billing/quota issues, as GoMaps Pro might use Google services.
          </p>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border space-y-2">
            <p className="font-semibold mb-1">Troubleshooting Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Environment Variable File:</strong> Ensure a file named <code className="bg-card p-0.5 rounded">.env.local</code> exists in your project's **absolute root directory**.</li>
              <li><strong>API Key Value:</strong> Inside <code className="bg-card p-0.5 rounded">.env.local</code>, confirm the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_GOMAPS_PRO_API_KEY=YOUR_API_KEY_HERE</code> (replace with your actual key, e.g., AlzaSyxap6A_EcHW72khGw8I6awbRRUcv8sYmbG).</li>
              <li><strong>Restart Server:</strong> **CRITICAL STEP:** After creating or modifying <code className="bg-card p-0.5 rounded">.env.local</code>, you **MUST** restart your Next.js development server.</li>
              <li><strong>API Provider Dashboard:</strong> For GoMaps Pro, verify your key's status, permissions, and **domain whitelisting**. If using a Google key or if GoMaps Pro proxies Google, check Google Cloud Console (Maps JavaScript API & Places API enabled, billing active, quotas fine, domain whitelisted).</li>
              <li><strong>Network & Browser Console:</strong> Check your internet connection. Look for specific HTTP errors in your browser's Network tab (F12 Developer Tools) for requests to <code className="bg-card p-0.5 rounded">maps.gomaps.pro</code>.</li>
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
          <p className="text-sm text-muted-foreground">The map took too long to load or encountered an error. Please check your internet connection or try again later. For GoMaps Pro, also verify your API key status, domain whitelisting and service entitlements on their dashboard. If you see Google-specific errors in console (like 'OverQuotaMapError'), check your Google Cloud Console for API key billing/quota issues.</p>
        </div>
      )}
    </Card>
  );
};

export default MapComponent;
