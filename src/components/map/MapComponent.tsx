
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
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [apiKeyMissingOrScriptsFailed, setApiKeyMissingOrScriptsFailed] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);


  useEffect(() => {
    if (!MAPPPLS_API_KEY) {
      console.error("MapComponent: Mappls API key (NEXT_PUBLIC_MAPPPLS_API_KEY) is not configured in environment variables.");
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
        script.onerror = () => {
          console.error(`MapComponent: Failed to load script with ID '${id}' from src: ${src}`);
          reject(new Error(`Failed to load script: ${src}`));
        }
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
        link.onerror = () => {
          console.error(`MapComponent: Specific failure loading CSS with ID '${id}' from href: ${href}`);
          reject(new Error(`Failed to load CSS: ${href}`));
        }
        document.head.appendChild(link);
      });
    };

    const initializeMapSDK = async () => {
      setIsMapLoading(true);
      console.log("MapComponent: Initializing with Mappls API Key from env:", MAPPPLS_API_KEY ? MAPPPLS_API_KEY.substring(0, 5) + "..." : "Not found");

      let cssLoadedSuccessfully = false;
      try {
        console.log("MapComponent: Attempting to load Mappls CSS with key:", MAPPPLS_API_KEY.substring(0,5) + "...");
        await loadCss(`https://apis.mappls.com/advancedmaps/api/${MAPPPLS_API_KEY}/map_sdk_css?v=3.0`, 'mappls-css');
        console.log("MapComponent: Mappls CSS loaded successfully.");
        cssLoadedSuccessfully = true;
      } catch (error) {
        console.error("MapComponent: Critical failure loading Mappls CSS. Map functionality will be impaired.", error);
        setApiKeyMissingOrScriptsFailed(true); // Trigger UI error display
        setIsMapLoading(false);
        setScriptsLoaded(false); // Ensure scriptsLoaded reflects CSS failure
        return; // Stop if CSS fails, as map won't render correctly
      }

      try {
        console.log("MapComponent: Attempting to load Mappls SDK script (JS) with key:", MAPPPLS_API_KEY.substring(0,5) + "...");
        await loadScript(`https://apis.mappls.com/advancedmaps/api/${MAPPPLS_API_KEY}/map_sdk?layer=vector&v=3.0&libraries=services`, 'mappls-sdk');
        console.log("MapComponent: Mappls SDK script (JS) loaded successfully.");
        setScriptsLoaded(true); // Both CSS and JS loaded successfully
        setApiKeyMissingOrScriptsFailed(false); // Clear any previous script/key error state
      } catch (error) {
        console.error("MapComponent: Critical failure loading Mappls SDK script (JS). Map functionality will be impaired.", error);
        setApiKeyMissingOrScriptsFailed(true); // Trigger UI error display
        setIsMapLoading(false);
        setScriptsLoaded(false); // JS failed, so scripts are not fully loaded
      }
    };

    if (typeof window !== 'undefined') {
      initializeMapSDK();
    }
  }, []);


  useEffect(() => {
    if (apiKeyMissingOrScriptsFailed || !scriptsLoaded || !mapContainerRef.current || !window.mappls || !window.mappls.Map) {
      if (scriptsLoaded && (!window.mappls || !window.mappls.Map)) {
          console.error("MapComponent: Mappls SDK seems loaded but window.mappls.Map object is not available. This might indicate an incomplete SDK load or an issue with the Mappls library itself.");
          setApiKeyMissingOrScriptsFailed(true);
          setIsMapLoading(false);
      }
      if (apiKeyMissingOrScriptsFailed || !scriptsLoaded) {
          setIsMapLoading(false);
      }
      return;
    }

    if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({lat: center.lat, lng: center.lng});
        mapInstanceRef.current.setZoom(zoom);
        return;
    }

    setIsMapLoading(true);
    setMapLoadTimedOut(false);

    const loadTimeoutTimer = setTimeout(() => {
         if (mapContainerRef.current && !mapInstanceRef.current?.getCenter()) {
            console.error("MapComponent: Mappls map did not fully initialize within timeout period (20s). Possible issues: slow network, Mappls service problems, or complex map setup.");
            setIsMapLoading(false);
            setMapLoadTimedOut(true);
        }
    }, 20000);

    try {
      console.log("MapComponent: Attempting to initialize Mappls map instance.");
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
        console.log("MapComponent: Mappls map 'load' event fired. Map should be visible.");
        setIsMapLoading(false);
        setMapLoadTimedOut(false);
      });

      map.on('error', (e: any) => {
        clearTimeout(loadTimeoutTimer);
        console.error("MapComponent: Mappls map instance emitted an 'error' event:", e);
        setIsMapLoading(false);
        setMapLoadTimedOut(true);
      });

    } catch (error) {
      clearTimeout(loadTimeoutTimer);
      console.error("MapComponent: Exception caught during Mappls map instance initialization:", error);
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
        console.log("MapComponent: Cleaned up Mappls map instance on component unmount.");
      }
    };
  }, [scriptsLoaded, apiKeyMissingOrScriptsFailed, center, zoom, interactive]);


  useEffect(() => {
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
        console.error("MapComponent: Error creating Mappls marker:", e, markerData);
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
                console.error("MapComponent: Error fitting bounds: ", e, ". Falling back to center and zoom.");
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
    } else if (markers.length === 0 && map?.setCenter) {
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
            The Mappls API key (<code>NEXT_PUBLIC_MAPPPLS_API_KEY</code>) might be missing, incorrectly configured in your <code>.env.local</code> file,
            or the map scripts/styles could not be loaded from Mappls servers. This can happen due to network issues, an invalid API key, or incorrect API key permissions on the Mappls dashboard.
          </p>
          <div className="mt-3 text-xs text-muted-foreground text-left bg-background/50 p-3 rounded-md border space-y-2">
            <p className="font-semibold mb-1">Troubleshooting Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Environment Variable File:</strong> Ensure a file named <code className="bg-card p-0.5 rounded">.env.local</code> exists in your project's **absolute root directory** (same level as <code>package.json</code>).</li>
              <li><strong>API Key Value:</strong> Inside <code className="bg-card p-0.5 rounded">.env.local</code>, confirm the line: <code className="bg-card p-0.5 rounded">NEXT_PUBLIC_MAPPPLS_API_KEY=YOUR_API_KEY_HERE</code> (e.g., <code className="bg-card p-0.5 rounded">3f75ec6eb7d93e27fc884277be2715b3</code>). Ensure no extra spaces or quotes.</li>
              <li><strong>Restart Server:</strong> **CRITICAL STEP:** After creating or modifying <code className="bg-card p-0.5 rounded">.env.local</code>, you **MUST** restart your Next.js development server (e.g., stop with Ctrl+C, then run <code>npm run dev</code>).</li>
              <li><strong>Mappls Dashboard:</strong> Verify your API key is active and has permissions for "Advanced Maps SDK" on the <Link href="https://apis.mappls.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mappls Dashboard</Link>. Check if your domain (e.g., <code>localhost</code> or your deployment URL) needs to be whitelisted.</li>
              <li><strong>Network & Browser Console:</strong> Check your internet connection and look for more specific errors in your browser's Network tab (F12 Developer Tools). Try accessing the script/CSS URLs (which might be shown in console errors from previous attempts) directly in your browser.</li>
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
      {mapLoadTimedOut && (
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center z-10 p-4 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mb-2" />
          <p className="text-md font-semibold text-destructive">Map Timed Out or Failed to Load</p>
          <p className="text-sm text-muted-foreground">The map took too long to load or encountered an error. Please check your internet connection, ensure the API key is correct and active on the Mappls dashboard, or try again later.</p>
        </div>
      )}
    </Card>
  );
};

export default MapComponent;
