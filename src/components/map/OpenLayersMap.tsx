
"use client";

import React, { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';
import type { Coordinate } from 'ol/coordinate';

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
  const mapRef = useRef<Map | null>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  useEffect(() => {
    if (mapElementRef.current && !isMapInitialized) {
      const map = new Map({
        target: mapElementRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: fromLonLat(centerCoordinates),
          zoom: zoomLevel,
          minZoom: 2,
          maxZoom: 19,
        }),
        controls: defaultControls({attributionOptions: {collapsible: true}}),
      });

      if (onMapClick) {
        map.on('singleclick', (event) => {
          const clickedCoordinate = event.coordinate;
          const lonLat = toLonLat(clickedCoordinate);
          onMapClick({ lon: lonLat[0], lat: lonLat[1] });
        });
      }
      
      mapRef.current = map;
      setIsMapInitialized(true);

      return () => {
        if (mapRef.current) {
          mapRef.current.setTarget(undefined);
          mapRef.current = null;
        }
        setIsMapInitialized(false);
      };
    }
  }, [isMapInitialized]); // Only re-run if isMapInitialized changes (for initial setup)

  // Effect to update map view if props change after initialization
  useEffect(() => {
    if (mapRef.current && isMapInitialized) {
      mapRef.current.getView().setCenter(fromLonLat(centerCoordinates));
      mapRef.current.getView().setZoom(zoomLevel);
    }
  }, [centerCoordinates, zoomLevel, isMapInitialized]);

  // Placeholder for adding markers in the future
  // useEffect(() => {
  //   if (mapRef.current && isMapInitialized && parkingSpots.length > 0) {
  //     // Logic to create/update marker layer
  //   }
  // }, [parkingSpots, isMapInitialized]);

  return <div ref={mapElementRef} className={className} id={`ol-map-${React.useId()}`} tabIndex={0} />;
}

