
"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from 'next/link'; // Import Link for the anchor tag

// Declare Mappls global object for TypeScript
declare global {
  interface Window {
    mappls?: any;
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

const MAPPPLS_API_KEY = process.env.NEXT_PUBLIC_MAPPPLS_API_KEY;

const MapComponent: React.FC<MapComponentProps> = ({
  markers = [],
  className,
  interactive = true,
  onMarkerClick,
  zoom = 12,
  center = { lat: 17.3850, lng: 78.4867 } // Default to Hyderabad, India
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const activeMarkersRef = useRef<any[]>([]);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true); // True when attempting to load scripts OR initialize map
  const [apiKeyMissingOrScriptsFailed, setApiKeyMissingOrScriptsFailed] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);


  useEffect(() => {
    if (!MAPPPLS_API_KEY) {
      console.error("Mappls API key is not configured. Please set NEXT_PUBLIC_MAPPPLS_API_KEY environment variable.");
      setApiKeyMissingOrScriptsFailed(true);
      setIsMapLoading(false);
      return;
    }
    setApiKeyMissingOrScriptsFailed(false); // Reset if key is found

    const loadScript = (src: string, id: string) => {
      return new Promise((resolve, reject) => {
        if (document.getElementById(id)) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      });
    };

    const loadCss = (href: string, id: string) => {
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
        link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
        document.head.appendChild(link);
      });
    };

    const initializeMapSDK = async () => {
      setIsMapLoading(true); // Indicate script loading process
      try {
        await loadCss(`https://apis.mappls.com/advancedmaps/api/${MAPPPLS_API_KEY}/map_sdk_css?v=3.0`, 'mappls-css');
        await loadScript(`https://apis.mappls.com/advancedmaps/api/${MAPPPLS_API_KEY}/map_sdk?layer=vector&v=3.0&libraries=services`, 'mappls-sdk');
        setScriptsLoaded(true);
        // setIsMapLoading(false); // Map itself is not yet loaded, only scripts. isMapLoading true until map.on('load')
      } catch (error) {
        console.error("Error loading Mappls SDK:", error);
        setApiKeyMissingOrScriptsFailed(true); // Treat script load failure as a critical issue
        setIsMapLoading(false);
        setScriptsLoaded(false);
      }
    };

    if (typeof window !== 'undefined') {
      initializeMapSDK();
    }
  }, []);


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current || !window.mappls || !window.mappls.Map) {
      if (scriptsLoaded && (!window.mappls || !window.mappls.Map)) {
          // Scripts reported loaded, but Mappls object not available (should be rare if scriptsLoaded is true)
          console.error("Mappls SDK loaded but window.mappls.Map is not available.");
          setApiKeyMissingOrScriptsFailed(true); // Fallback to error state
          setIsMapLoading(false);
      }
      return;
    }

    if (mapInstanceRef.current) { 
        mapInstanceRef.current.setCenter({lat: center.lat, lng: center.lng});
        mapInstanceRef.current.setZoom(zoom);
        return;
    }
    
    setIsMapLoading(true); // Now truly for map initialization
    setMapLoadTimedOut(false); 

    const loadTimeoutTimer = setTimeout(() => {
        // Check if the map has loaded; Mappls SDK doesn't have a simple map.loaded() like some other SDKs prior to map instance.
        // We rely on the 'load' event. If it hasn't fired, mapInstanceRef.current might exist but not be fully "ready".
        // If map instance exists AND its 'load' event hasn't cleared this timer, consider it timed out.
         if (mapContainerRef.current && !mapInstanceRef.current?.getCenter()) { // getCenter is a basic check if map is usable
            console.error("Mappls map did not fully initialize within timeout period.");
            setIsMapLoading(false);
            setMapLoadTimedOut(true);
        }
    }, 20000); // 20 seconds timeout

    try {
      const map = new window.mappls.Map(mapContainerRef.current, {
        center: { lat: center.lat, lng: center.lng },
        zoom: zoom,
        zoomControl: interactive,
        scrollWheelZoom: interactive,
        dragging: interactive,
        clickableIcons: interactive, 
      });
      mapInstanceRef.current = map;

      map.on('load', () => {
        clearTimeout(loadTimeoutTimer);
        console.log("Mappls map loaded.");
        setIsMapLoading(false);
        setMapLoadTimedOut(false);
      });

      map.on('error', (e: any) => {
        clearTimeout(loadTimeoutTimer);
        console.error("Mappls map error:", e);
        setIsMapLoading(false);
        setMapLoadTimedOut(true); // Treat map error as a load failure for UI
      });

    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("Error initializing Mappls map:", error);
      setIsMapLoading(false);
      setMapLoadTimedOut(true); 
    }

    return () => {
      clearTimeout(loadTimeoutTimer);
      if (mapInstanceRef.current && typeof mapInstanceRef.current.remove === 'function') {
        activeMarkersRef.current.forEach(m => m.remove());
        activeMarkersRef.current = [];
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, center, zoom, interactive]); // Removed isMapLoading from deps


  useEffect(() => {
    // This effect should only run if map is initialized and not in an error state
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapInstanceRef.current || !window.mappls || isMapLoading || mapLoadTimedOut) {
      return;
    }

    const map = mapInstanceRef.current;

    activeMarkersRef.current.forEach(m => m.remove());
    activeMarkersRef.current = [];

    markers.forEach(markerData => {
      try {
        const mapplsMarker = new window.mappls.Marker({
          position: { lat: markerData.lat, lng: markerData.lng },
          map: map,
          title: markerData.label,
          fitbounds: false, 
        });
        
        if (onMarkerClick) {
          mapplsMarker.on('click', () => {
            onMarkerClick(markerData.id);
          });
        }
        activeMarkersRef.current.push(mapplsMarker);
      } catch(e) {
        console.error("Error creating Mappls marker:", e, markerData);
      }
    });

    if (markers.length > 0 && interactive) {
      if (markers.length > 1) {
        const bounds = new window.mappls.LngLatBounds();
        markers.forEach(m => bounds.extend({lat: m.lat, lng: m.lng}));
        if (bounds.getSouthWest() && bounds.getNorthEast()) {
            try {
              map.fitBounds(bounds, { padding: 50, duration: 500 });
            } catch (e) {
                console.error("Error fitting bounds: ", e);
                map.setCenter({lat: markers[0].lat, lng: markers[0].lng});
                map.setZoom(zoom > 14 ? zoom : 14);
            }
        } else if (markers.length === 1) {
            map.setCenter({lat: markers[0].lat, lng: markers[0].lng});
            map.setZoom(zoom > 14 ? zoom : 14);
        }
      } else if (markers.length === 1) {
        map.setCenter({lat: markers[0].lat, lng: markers[0].lng});
        map.setZoom(zoom > 14 ? zoom : 14);
      }
    } else if (markers.length === 0 && map?.setCenter) { // Check if map exists before calling setCenter
        map.setCenter({lat: center.lat, lng: center.lng});
        map.setZoom(zoom);
    }

  }, [markers, scriptsLoaded, apiKeyMissingOrScriptsFailed, onMarkerClick, interactive, zoom, center, isMapLoading, mapLoadTimedOut]);


  if (apiKeyMissingOrScriptsFailed) {
    return (
      <Card className={cn("flex items-center justify-center aspect-video bg-muted/50 border-destructive/50", className)} data-ai-hint="map error state">
        <CardContent className="text-center p-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-destructive">Map Configuration or Loading Error</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The Mappls API key (<code>NEXT_PUBLIC_MAPPPLS_API_KEY</code>) is missing, not configured correctly,
            or the map scripts could not be loaded.
          </p>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border space-y-2">
            <p className="font-semibold mb-1">Please ensure the following:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>A file named <code className="bg-card p-0.5 rounded">.env.local</code> exists in your project's root directory.</li>
              <li>It contains the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_MAPPPLS_API_KEY=YOUR_API_KEY_HERE</code> (with your actual key).</li>
              <li>You have **restarted your Next.js development server** after changes to <code className="bg-card p-0.5 rounded">.env.local</code>.</li>
            </ol>
            <p className="mt-2">
              If the API key is set and you recently restarted, also check:
              <ul className="list-disc list-inside pl-4 space-y-0.5">
                <li>Your internet connection.</li>
                <li>Browser console for more specific errors (e.g., network issues, Mappls server errors).</li>
                <li>The API key is valid and has permissions on the Mappls dashboard.</li>
                <li>No browser extensions are blocking scripts from <code>apis.mappls.com</code>.</li>
              </ul>
            </p>
             <p className="mt-2">For more details on environment variables, see the <Link href="https://nextjs.org/docs/app/building-your-application/configuring/environment-variables" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Next.js Documentation</Link>.</p>
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
      {mapLoadTimedOut && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center z-10 p-4 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mb-2" />
          <p className="text-md font-semibold text-destructive">Map Timed Out or Failed to Load</p>
          <p className="text-sm text-muted-foreground">The map took too long to load or encountered an error. Please check your internet connection, ensure the API key is correct and active, or try again later.</p>
        </div>
      )}
    </Card>
  );
};

export default MapComponent;

    