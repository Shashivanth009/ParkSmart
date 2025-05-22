
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
  center?: { lat: number; lng: number };
  showSearchInput?: boolean;
  showMyLocationButton?: boolean;
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void;
}

const GOMAPS_PRO_API_KEY = process.env.NEXT_PUBLIC_GOMAPS_PRO_API_KEY;

const MapComponent: React.FC<MapComponentProps> = ({
  markers = [],
  className,
  interactive = true,
  onMarkerClick,
  zoom = 12,
  center = { lat: 17.3850, lng: 78.4867 }, // Default to Hyderabad, India
  showSearchInput = false,
  showMyLocationButton = false,
  onPlaceSelected,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const activeMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [apiKeyMissingOrScriptsFailed, setApiKeyMissingOrScriptsFailed] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);

  const loadGoMapsProScript = useCallback((apiKey: string) => {
    return new Promise<void>((resolve, reject) => {
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log("MapComponent: GoMaps Pro SDK (or compatible Google Maps SDK with Places) already loaded.");
        resolve();
        return;
      }
      const existingScript = document.getElementById('gomaps-pro-sdk');
      if (existingScript) {
        console.log("MapComponent: GoMaps Pro SDK script tag already present, assuming it will load or has loaded.");
        let checks = 0;
        const interval = setInterval(() => {
          checks++;
          if (window.google && window.google.maps && window.google.maps.places) {
            clearInterval(interval);
            resolve();
          } else if (checks > 20) { // Wait up to 2 seconds
            clearInterval(interval);
            console.warn("MapComponent: Existing GoMaps script did not result in window.google.maps.places being available quickly.");
            resolve(); 
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'gomaps-pro-sdk';
      // Added 'places' to libraries for Autocomplete
      script.src = `https://maps.gomaps.pro/maps/api/js?key=${apiKey}&libraries=marker,places&loading=async&callback=initMapComponentGlobal`;
      script.async = true;
      script.defer = true;

      (window as any).initMapComponentGlobalCallbackSet = true;
      (window as any).initMapComponentGlobal = () => {
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
      setIsMapLoading(false);
      return;
    }
    setApiKeyMissingOrScriptsFailed(false);

    window.gm_authFailure = () => {
      console.error("MapComponent: Detected gm_authFailure. This often indicates an API key issue (billing, quota, invalid key, or Maps JavaScript API / Places API not enabled) with Google Maps Platform. Check your Google Cloud Console.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false);
    };

    loadGoMapsProScript(GOMAPS_PRO_API_KEY)
      .then(() => {
        console.log("MapComponent: GoMaps Pro scripts reported as loaded/attempted.");
        setScriptsLoaded(true);
        setApiKeyMissingOrScriptsFailed(false);
      })
      .catch((error) => {
        console.error("MapComponent: Critical failure loading GoMaps Pro resources.", error);
        setApiKeyMissingOrScriptsFailed(true);
        setIsMapLoading(false);
        setScriptsLoaded(false);
      });
    
    return () => {
        delete window.gm_authFailure;
    }
  }, [loadGoMapsProScript]);

  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current || !window.google || !window.google.maps || !window.google.maps.Map) {
      if (isMapLoading && (apiKeyMissingOrScriptsFailed || (scriptsLoaded && (!window.google || !window.google.maps.Map )) ) ) {
        setIsMapLoading(false);
      }
      return;
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(center);
      mapInstanceRef.current.setZoom(zoom);
      if (isMapLoading) setIsMapLoading(false);
      return;
    }
    
    if (!mapInstanceRef.current && !isMapLoading) {
        // This case should not happen if logic is correct, but as a safe guard
        // If map is not there but we are not loading, means error or previous load finished
        // We should only set isMapLoading true if we are about to create a NEW map.
    } else if (!mapInstanceRef.current) {
        // Only set loading to true if we are about to create a NEW map instance
        // This was already true by default, or set by a previous failed attempt
        // console.log("MapComponent: No map instance, ensuring isMapLoading is true.");
        // setIsMapLoading(true); // No, it's true by default or on script load attempt
    }
    setMapLoadTimedOut(false);

    const loadTimeoutTimer = setTimeout(() => {
      if (mapContainerRef.current && (!mapInstanceRef.current || !mapInstanceRef.current.getCenter()) && isMapLoading) {
        console.error("MapComponent: Map did not fully initialize within timeout period (20s).");
        setIsMapLoading(false);
        setMapLoadTimedOut(true);
      } else if (mapInstanceRef.current && isMapLoading) {
        setIsMapLoading(false);
        setMapLoadTimedOut(false);
      }
    }, 20000);

    try {
      console.log("MapComponent: Attempting to initialize Map instance with GoMaps Pro.");
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        mapId: "GOMAPS_PRO_MAP_ID", // Ensure this mapId is configured in Google Cloud Console if using cloud-based styling
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
      
      const onMapReady = () => {
        clearTimeout(loadTimeoutTimer);
        if (isMapLoading) setIsMapLoading(false);
        setMapLoadTimedOut(false); 
      };

      idleListener = map.addListener('idle', onMapReady);
      tilesLoadedListener = map.addListener('tilesloaded', onMapReady);
      
      if (map.getCenter() && isMapLoading) {
          setTimeout(onMapReady, 750); 
      } else if (map.getCenter() && !isMapLoading) {
          clearTimeout(loadTimeoutTimer);
          setMapLoadTimedOut(false);
      }

      // Initialize Autocomplete
      if (showSearchInput && searchInputRef.current && window.google.maps.places) {
        autocompleteRef.current = new window.google.maps.places.Autocomplete(searchInputRef.current, {
          types: ['geocode'], // Can be 'address', 'establishment', '(regions)', '(cities)'
        });
        autocompleteRef.current.bindTo('bounds', map); // Bias search to map's viewport
        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (place?.geometry?.location) {
            map.setCenter(place.geometry.location);
            map.setZoom(15); // Zoom in on selected place
            if (onPlaceSelected) {
              onPlaceSelected(place);
            }
          } else {
            console.log("Autocomplete place not found or no geometry.");
            // Optionally: window.alert("No details available for input: '" + place?.name + "'");
          }
        });
      }

      return () => {
        cleanupListeners();
        clearTimeout(loadTimeoutTimer);
        if (mapInstanceRef.current && window.google?.maps?.event) {
           google.maps.event.clearInstanceListeners(mapInstanceRef.current);
        }
      };

    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("MapComponent: Exception caught during GoMaps Pro Map instance initialization:", error);
      if (isMapLoading) setIsMapLoading(false);
      setMapLoadTimedOut(true);
    }
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, center, zoom, interactive, showSearchInput, onPlaceSelected]);


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
            infoWindow.setContent(`<div style="color: #333; padding: 5px;"><strong>${markerData.label}</strong></div>`);
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
            or the map scripts could not be loaded. This can happen due to network issues, an invalid API key, incorrect API key permissions (e.g., Maps JavaScript API or Places API not enabled), or billing issues on the Google Cloud / GoMaps Pro dashboard.
          </p>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border space-y-2">
            <p className="font-semibold mb-1">Troubleshooting Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Environment Variable File:</strong> Ensure a file named <code className="bg-card p-0.5 rounded">.env.local</code> exists in your project's **absolute root directory** (same level as <code>package.json</code>).</li>
              <li><strong>API Key Value:</strong> Inside <code className="bg-card p-0.5 rounded">.env.local</code>, confirm the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_GOMAPS_PRO_API_KEY=YOUR_API_KEY_HERE</code> (replace YOUR_API_KEY_HERE with your actual key, e.g., AlzaSyxap6A_EcHW72khGw8I6awbRRUcv8sYmbG).</li>
              <li><strong>Restart Server:</strong> **CRITICAL STEP:** After creating or modifying <code className="bg-card p-0.5 rounded">.env.local</code>, you **MUST** restart your Next.js development server (e.g., stop with Ctrl+C, then run <code>npm run dev</code>).</li>
              <li><strong>API Provider Dashboard:</strong> 
                Verify your key's status on the GoMaps Pro Dashboard or Google Cloud Console. Ensure **Maps JavaScript API** and **Places API** are enabled. Check billing and quotas.
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
              ref={searchInputRef}
              type="text"
              placeholder="Search for a location..."
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
