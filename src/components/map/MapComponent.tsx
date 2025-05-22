
"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle, Search, LocateFixed } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from 'next/link';

// Declare GoMaps Pro/Google Maps global object for TypeScript
declare global {
  interface Window {
    google?: typeof google;
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
  autocompleteInputRef?: React.RefObject<HTMLInputElement>; // For external search input
  showMyLocationButton?: boolean;
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void;
  onMapIdle?: (center: { lat: number; lng: number }) => void;
}

const GOMAPS_PRO_API_KEY = process.env.NEXT_PUBLIC_GOMAPS_PRO_API_KEY;

const MapComponent: React.FC<MapComponentProps> = ({
  markers = [],
  className,
  interactive = true,
  onMarkerClick,
  zoom = 12,
  center = { lat: 17.3850, lng: 78.4867 }, // Default to Hyderabad
  showSearchInput = false,
  autocompleteInputRef,
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
  const externalAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);


  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [apiKeyMissingOrScriptsFailed, setApiKeyMissingOrScriptsFailed] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);

  const loadGoMapsProScript = useCallback((apiKey: string) => {
    return new Promise<void>((resolve, reject) => {
      if (window.google?.maps?.places && window.google?.maps?.marker) {
        console.log("MapComponent: GoMaps Pro SDK (with Places & Marker) already loaded.");
        resolve();
        return;
      }
      const existingScript = document.getElementById('gomaps-pro-sdk');
      if (existingScript) {
        // Script tag exists, wait for window.google.maps to be ready
        let checks = 0;
        const interval = setInterval(() => {
          checks++;
          if (window.google?.maps?.places && window.google?.maps?.marker) {
            clearInterval(interval);
            resolve();
          } else if (checks > 20) { // Wait for 2 seconds
            clearInterval(interval);
            console.warn("MapComponent: Existing GoMaps script did not make SDK available quickly.");
            // Attempt to resolve anyway, initialization will fail if SDK not truly there
            resolve(); 
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'gomaps-pro-sdk';
      // Ensure "places" library is requested for Autocomplete
      script.src = `https://maps.gomaps.pro/maps/api/js?key=${apiKey}&libraries=marker,places&loading=async&callback=initMapComponentGlobal`;
      script.async = true;
      script.defer = true;

      (window as any).initMapComponentGlobalCallbackSet = true; // Flag to track callback setup
      window.initMapComponentGlobal = () => {
        console.log("MapComponent: GoMaps Pro SDK loaded via global callback.");
        delete window.initMapComponentGlobal; // Clean up global callback
        delete (window as any).initMapComponentGlobalCallbackSet;
        resolve();
      };
      
      script.onerror = (error) => {
        console.error("MapComponent: GoMaps Pro SDK script failed to load:", error);
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
    setApiKeyMissingOrScriptsFailed(false); // Reset if key is found

    window.gm_authFailure = () => {
      console.error("MapComponent: Detected gm_authFailure. This often indicates an API key issue (billing, quota, invalid key, or API not enabled). For Google Maps, check Google Cloud Console. For GoMaps Pro, check their dashboard or if it proxies Google errors.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false);
    };

    loadGoMapsProScript(GOMAPS_PRO_API_KEY)
      .then(() => {
        setScriptsLoaded(true);
        setApiKeyMissingOrScriptsFailed(false);
      })
      .catch((error) => {
        console.error("MapComponent: Critical failure loading GoMaps Pro resources.", error);
        setApiKeyMissingOrScriptsFailed(true);
        setIsMapLoading(false);
        setScriptsLoaded(false); // Ensure scriptsLoaded is false on failure
      });
    
    return () => {
        delete window.gm_authFailure;
        if ((window as any).initMapComponentGlobalCallbackSet) {
            delete window.initMapComponentGlobal;
            delete (window as any).initMapComponentGlobalCallbackSet;
        }
    }
  }, [loadGoMapsProScript]);


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current || !window.google?.maps?.Map || !center) {
      if (isMapLoading && (apiKeyMissingOrScriptsFailed || (scriptsLoaded && (!window.google?.maps?.Map || !center)))) {
        setIsMapLoading(false); // Turn off loader if essential pre-requisites are missing
      }
      return;
    }
    
    const mapAlreadyInitialized = !!mapInstanceRef.current;

    if (mapAlreadyInitialized && mapInstanceRef.current) {
      // Map exists, just update center/zoom if they changed
      const currentMapCenter = mapInstanceRef.current.getCenter();
      if (currentMapCenter && center && (currentMapCenter.lat() !== center.lat || currentMapCenter.lng() !== center.lng)) {
        mapInstanceRef.current.setCenter(center);
      }
      if (mapInstanceRef.current.getZoom() !== zoom) {
          mapInstanceRef.current.setZoom(zoom);
      }
      if (isMapLoading) setIsMapLoading(false); // Ensure loader is off if map is considered initialized
      return;
    }
    
    if (mapAlreadyInitialized) return; 

    setMapLoadTimedOut(false);
    setIsMapLoading(true); 

    const loadTimeoutTimer = setTimeout(() => {
      if (mapContainerRef.current && isMapLoading && (!mapInstanceRef.current || !mapInstanceRef.current.getCenter()) ) {
        console.error("MapComponent: Map did not fully initialize within timeout period (20s).");
        setIsMapLoading(false); 
        setMapLoadTimedOut(true);
      } else if (isMapLoading && mapInstanceRef.current?.getCenter()) {
        // Map seems ready but loader is still on, timeout forcing it off.
        setIsMapLoading(false);
        setMapLoadTimedOut(false);
      }
    }, 20000);

    try {
      console.log("MapComponent: Attempting to initialize Map instance with center:", center);
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        mapId: "GOMAPS_PRO_MAP_ID", // Use a generic ID or configure one if GoMaps Pro supports it
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
        idleListener = null;
        tilesLoadedListener = null;
      };
      
      const onMapActuallyReady = () => {
        clearTimeout(loadTimeoutTimer); // Clear the main timeout
        if (isMapLoading) { 
            setIsMapLoading(false);
        }
        setMapLoadTimedOut(false); 
      };

      idleListener = map.addListener('idle', () => {
        onMapActuallyReady();
        if (interactive && onMapIdle) {
          const currentCenter = map.getCenter();
          if (currentCenter) {
            onMapIdle({ lat: currentCenter.lat(), lng: currentCenter.lng() });
          }
        }
      });
      tilesLoadedListener = map.addListener('tilesloaded', onMapActuallyReady);
      
      // If map seems ready very quickly
      if (map.getCenter() && isMapLoading) {
          setTimeout(onMapActuallyReady, 750); // Give it a bit more time just in case
      } else if (map.getCenter() && !isMapLoading) { // Map was ready, but timeout still running
          clearTimeout(loadTimeoutTimer);
          setMapLoadTimedOut(false);
      }

      // Setup Autocomplete for internal search input
      if (showSearchInput && internalSearchInputRef.current && window.google.maps.places) {
        internalAutocompleteRef.current = new window.google.maps.places.Autocomplete(internalSearchInputRef.current, {
          types: ['geocode'], // Can be adjusted (e.g., 'address', 'establishment')
        });
        internalAutocompleteRef.current.bindTo('bounds', map); // Bias to map viewport
        internalAutocompleteRef.current.addListener('place_changed', () => {
          const place = internalAutocompleteRef.current?.getPlace();
          if (place?.geometry?.location) {
            map.setCenter(place.geometry.location);
            map.setZoom(15); // Zoom in on selected place
            if (onPlaceSelected) {
              onPlaceSelected(place);
            }
             // The 'idle' event will then fire, triggering onMapIdle if map view changed
          } else {
            console.log("Internal Autocomplete: Place not found or no geometry.");
          }
        });
      }
      
      // Setup Autocomplete for external search input (if ref provided)
      if (autocompleteInputRef?.current && window.google.maps.places) {
        externalAutocompleteRef.current = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
            types: ['geocode'],
        });
        externalAutocompleteRef.current.bindTo('bounds', map);
        externalAutocompleteRef.current.addListener('place_changed', () => {
            const place = externalAutocompleteRef.current?.getPlace();
            if (place?.geometry?.location) {
                if (onPlaceSelected) {
                    onPlaceSelected(place); // Parent component handles map centering for external input
                }
            } else {
                console.log("External Autocomplete: Place not found or no geometry.");
            }
        });
      }


      return () => {
        cleanupListeners();
        clearTimeout(loadTimeoutTimer);
        if (mapInstanceRef.current && window.google?.maps?.event) {
           google.maps.event.clearInstanceListeners(mapInstanceRef.current);
        }
        if (internalAutocompleteRef.current && window.google?.maps?.event) {
            google.maps.event.clearInstanceListeners(internalAutocompleteRef.current);
        }
        if (externalAutocompleteRef.current && window.google?.maps?.event) {
            google.maps.event.clearInstanceListeners(externalAutocompleteRef.current);
        }
        // Do not destroy mapInstanceRef.current as it might be reused if props change quickly
      };

    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("MapComponent: Exception caught during GoMaps Pro Map instance initialization:", error);
      if (isMapLoading) setIsMapLoading(false);
      setMapLoadTimedOut(true); // Indicate a failure to init map properly
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, interactive, showSearchInput, autocompleteInputRef, onPlaceSelected, onMapIdle, zoom]);
  // Center prop is handled in a separate effect to avoid re-initializing map on pan/zoom via prop change.


  // Effect for setting map center and zoom when props change AFTER map is initialized
  useEffect(() => {
    if (mapInstanceRef.current && center) {
        const currentMapCenter = mapInstanceRef.current.getCenter();
        // Check if center actually changed to avoid unnecessary map movements
        if (currentMapCenter && (Math.abs(currentMapCenter.lat() - center.lat) > 0.00001 || Math.abs(currentMapCenter.lng() - center.lng) > 0.00001)) {
            mapInstanceRef.current.setCenter(center);
        }
        if (mapInstanceRef.current.getZoom() !== zoom) {
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

    activeMarkersRef.current.forEach(marker => marker.map = null); // Clear existing markers
    activeMarkersRef.current = [];

    markers.forEach(markerData => {
      try {
        const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat: markerData.lat, lng: markerData.lng },
          map: map,
          title: markerData.label,
          // content: Customizable HTML element for marker (optional)
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
    
    if (markers.length > 0 && interactive && window.google?.maps?.LatLngBounds && !center) {
      // If no explicit center prop, fit bounds to markers
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
      map.fitBounds(bounds, 100); // 100px padding
    } else if (center) {
      // If center is provided (e.g., by user search or default), use it.
      map.setCenter(center);
      map.setZoom(zoom);
    }


  }, [markers, scriptsLoaded, apiKeyMissingOrScriptsFailed, onMarkerClick, interactive, zoom, isMapLoading, mapLoadTimedOut, center]);


  const handleMyLocation = () => {
    if (navigator.geolocation && mapInstanceRef.current) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          mapInstanceRef.current?.setCenter(userLocation);
          mapInstanceRef.current?.setZoom(15);
          if (onMapIdle) { // Trigger map idle as location has changed
            onMapIdle(userLocation);
          }
        },
        (error) => {
          console.error("Error getting user location:", error);
          alert("Could not get your location. Please ensure location services are enabled.");
        }
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
            or the map scripts could not be loaded from GoMaps Pro servers. This can happen due to network issues, an invalid API key, or incorrect API key permissions on the GoMaps Pro / Google Cloud dashboard.
            Google Maps specific errors (like 'OverQuotaMapError') also indicate issues with the API key setup, often related to billing or quotas on Google Cloud Console.
          </p>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border space-y-2">
            <p className="font-semibold mb-1">Troubleshooting Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Environment Variable File:</strong> Ensure a file named <code className="bg-card p-0.5 rounded">.env.local</code> exists in your project's **absolute root directory** (same level as <code>package.json</code>).</li>
              <li><strong>API Key Value:</strong> Inside <code className="bg-card p-0.5 rounded">.env.local</code>, confirm the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_GOMAPS_PRO_API_KEY=YOUR_API_KEY_HERE</code> (replace YOUR_API_KEY_HERE with your actual key, e.g., AlzaSyxap6A_EcHW72khGw8I6awbRRUcv8sYmbG).</li>
              <li><strong>Restart Server:</strong> **CRITICAL STEP:** After creating or modifying <code className="bg-card p-0.5 rounded">.env.local</code>, you **MUST** restart your Next.js development server (e.g., stop with Ctrl+C, then run <code>npm run dev</code>).</li>
              <li><strong>API Provider Dashboard:</strong> 
                For GoMaps Pro, verify your key's status on their dashboard. If you suspect it's a Google key or GoMaps Pro proxies to Google,
                verify your key's status on the Google Cloud Console. Ensure relevant APIs (Maps JavaScript API, Places API) are enabled. Check billing and quotas.
              </li>
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
      {showSearchInput && scriptsLoaded && window.google?.maps?.places && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-full max-w-sm px-4 sm:max-w-md md:max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={internalSearchInputRef}
              type="text"
              placeholder="Search map location..."
              className="w-full pl-10 pr-3 py-2 shadow-lg rounded-md border-gray-300 focus:border-primary focus:ring-primary"
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
        >
            <LocateFixed className="h-5 w-5" />
        </Button>
      )}
      {isMapLoading && !mapLoadTimedOut && ( // Show loader only if not timed out
        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading Map...</p>
        </div>
      )}
      {mapLoadTimedOut && !apiKeyMissingOrScriptsFailed && ( // Show timeout error only if API key was not the primary issue
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
