
"use client";

import React, { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';
import type { Coordinate } from 'ol/coordinate';
import type { MapBrowserEvent } from 'ol'; // Import for type safety

// TODO: Potentially add marker feature in the future
// import Feature from 'ol/Feature';
// import Point from 'ol/geom/Point';
// import { Vector as VectorLayer } from 'ol/layer';
// import { Vector as VectorSource } from 'ol/source';
// import { Style, Icon } from 'ol/style';

interface OpenLayersMapProps {
  centerCoordinates?: [number, number]; // Expecting [longitude, latitude]
  zoomLevel?: number;
  className?: string;
  parkingSpots?: Array<{ id: string, coordinates: [number, number], name: string }>; // For future marker display
  onMapClick?: (coords: { lon: number, lat: number }) => void;
}

export function OpenLayersMap({
  centerCoordinates = [78.4867, 17.3850], // Default to Hyderabad
  zoomLevel = 12,
  className = "w-full h-full",
  // parkingSpots = [], // Uncomment for future use
  onMapClick,
}: OpenLayersMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null); // Renamed for clarity
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const onMapClickRef = useRef(onMapClick); // Ref to store the latest onMapClick

  // Update the ref if the onMapClick prop changes
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const mapId = React.useId(); // Generate a stable unique ID for the map target

  useEffect(() => {
    // This effect runs only once on mount to initialize the map
    if (mapElementRef.current && !mapInstanceRef.current) {
      console.log(`OpenLayersMap (${mapId}): Initializing map.`);
      const map = new Map({
        target: mapElementRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: fromLonLat(centerCoordinates), // Use initial props
          zoom: zoomLevel, // Use initial props
          minZoom: 2,
          maxZoom: 19,
        }),
        controls: defaultControls({ attributionOptions: { collapsible: true } }),
      });

      // Attach event listener using the ref
      map.on('singleclick', (event: MapBrowserEvent<UIEvent>) => {
        if (onMapClickRef.current) {
          const clickedCoordinate = event.coordinate;
          const lonLat = toLonLat(clickedCoordinate);
          onMapClickRef.current({ lon: lonLat[0], lat: lonLat[1] });
        }
      });
      
      mapInstanceRef.current = map;
      setIsMapInitialized(true); // Signal that map is ready
    }

    // Cleanup function: This runs when the component unmounts.
    return () => {
      if (mapInstanceRef.current) {
        console.log(`OpenLayersMap (${mapId}): Disposing map instance.`);
        mapInstanceRef.current.setTarget(undefined); // Detach map from DOM element
        mapInstanceRef.current.dispose(); // Dispose of the map instance and its resources
        mapInstanceRef.current = null; // Clear the ref
      }
      setIsMapInitialized(false); // Reset initialization state on unmount
    };
  }, [mapId, centerCoordinates, zoomLevel]); // Effect depends on mapId (stable) and initial view props

  // Effect to update map view if centerCoordinates or zoomLevel props change AFTER initialization
  useEffect(() => {
    if (mapInstanceRef.current && isMapInitialized) {
      const view = mapInstanceRef.current.getView();
      if (view) {
        const currentCenterOL = view.getCenter();
        const currentZoom = view.getZoom();
        const newCenterOL = fromLonLat(centerCoordinates);

        let viewChanged = false;
        if (currentCenterOL && (currentCenterOL[0] !== newCenterOL[0] || currentCenterOL[1] !== newCenterOL[1])) {
          view.setCenter(newCenterOL);
          viewChanged = true;
        }
        if (currentZoom !== zoomLevel) {
          view.setZoom(zoomLevel);
          viewChanged = true;
        }
        if(viewChanged) {
            console.log(`OpenLayersMap (${mapId}): View updated - Center: ${centerCoordinates}, Zoom: ${zoomLevel}`);
        }
      }
    }
  }, [centerCoordinates, zoomLevel, isMapInitialized, mapId]);

  // Placeholder for adding markers in the future
  // useEffect(() => {
  //   if (mapInstanceRef.current && isMapInitialized && parkingSpots.length > 0) {
  //     // Logic to create/update marker layer
  //   }
  // }, [parkingSpots, isMapInitialized]);

  return <div ref={mapElementRef} className={className} id={mapId} tabIndex={0} />;
}
