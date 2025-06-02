
"use client";

import React, { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';
import type { Coordinate } from 'ol/coordinate';
import type { MapBrowserEvent } from 'ol';

// Imports for marker functionality
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Style, Circle as OlCircle, Fill, Stroke } from 'ol/style';

interface OpenLayersMapProps {
  centerCoordinates?: [number, number]; // Expecting [longitude, latitude]
  zoomLevel?: number;
  className?: string;
  markerCoordinates?: [number, number] | null; // [longitude, latitude] for the marker or null to hide
  onMapClick?: (coords: { lon: number, lat: number }) => void;
}

const markerStyle = new Style({
  image: new OlCircle({
    radius: 7,
    fill: new Fill({ color: 'rgba(255, 0, 0, 0.7)' }), // Red fill
    stroke: new Stroke({ color: 'white', width: 2 }),
  }),
});

export function OpenLayersMap({
  centerCoordinates = [78.4867, 17.3850],
  zoomLevel = 12,
  className = "w-full h-full",
  markerCoordinates = null,
  onMapClick,
}: OpenLayersMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const markerLayerRef = useRef<VectorLayer<VectorSource<Point>> | null>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const mapId = React.useId();

  useEffect(() => {
    if (mapElementRef.current && !mapInstanceRef.current) {
      console.log(`OpenLayersMap (${mapId}): Initializing map.`);
      
      const initialMarkerLayer = new VectorLayer({
        source: new VectorSource(),
        style: markerStyle, // Default style for features in this layer
      });
      markerLayerRef.current = initialMarkerLayer;

      const map = new Map({
        target: mapElementRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
          initialMarkerLayer, // Add marker layer to map
        ],
        view: new View({
          center: fromLonLat(centerCoordinates),
          zoom: zoomLevel,
          minZoom: 2,
          maxZoom: 19,
        }),
        controls: defaultControls({ attributionOptions: { collapsible: true } }),
      });

      map.on('singleclick', (event: MapBrowserEvent<UIEvent>) => {
        if (onMapClickRef.current) {
          const clickedCoordinate = event.coordinate;
          const lonLat = toLonLat(clickedCoordinate);
          onMapClickRef.current({ lon: lonLat[0], lat: lonLat[1] });
        }
      });
      
      mapInstanceRef.current = map;
      setIsMapInitialized(true);
    }

    return () => {
      if (mapInstanceRef.current) {
        console.log(`OpenLayersMap (${mapId}): Disposing map instance.`);
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current.dispose();
        mapInstanceRef.current = null;
        markerLayerRef.current = null;
      }
      setIsMapInitialized(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]); // Only re-run if mapId changes (which it shouldn't for a given component instance)

  useEffect(() => {
    if (mapInstanceRef.current && isMapInitialized) {
      const view = mapInstanceRef.current.getView();
      if (view) {
        const currentCenterOL = view.getCenter();
        const currentZoom = view.getZoom();
        const newCenterOL = fromLonLat(centerCoordinates);

        let viewChanged = false;
        if (currentCenterOL && (Math.abs(currentCenterOL[0] - newCenterOL[0]) > 1e-6 || Math.abs(currentCenterOL[1] - newCenterOL[1]) > 1e-6 )) {
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

  // Effect to update marker
  useEffect(() => {
    if (!isMapInitialized || !mapInstanceRef.current || !markerLayerRef.current) {
      return;
    }
    const currentMarkerLayer = markerLayerRef.current;
    const source = currentMarkerLayer.getSource();

    if (source) {
      source.clear(); // Clear previous markers
      if (markerCoordinates) {
        const markerFeature = new Feature({
          geometry: new Point(fromLonLat(markerCoordinates)),
        });
        // The layer's style will apply, or set individually: markerFeature.setStyle(markerStyle);
        source.addFeature(markerFeature);
        console.log(`OpenLayersMap (${mapId}): Marker updated to ${markerCoordinates}`);
      } else {
        console.log(`OpenLayersMap (${mapId}): Marker cleared.`);
      }
    }
  }, [markerCoordinates, isMapInitialized, mapId]);


  return <div ref={mapElementRef} className={className} id={mapId} tabIndex={0} />;
}
