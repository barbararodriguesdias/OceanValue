// Map Component
// OceanValue Interactive Map with Mapbox GL JS

import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import './Map.css';

interface MapProps {
  hazardType: string;
  filters: any;
}

const Map: React.FC<MapProps> = ({ hazardType, filters }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    // TODO: Set Mapbox token from environment
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || '';

    if (map.current) return; // Initialize map only once

    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-v9',
        center: [-44.0, -23.5], // Centered on Santos/Campos region
        zoom: 5,
        pitch: 0,
        bearing: 0,
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add fullscreen control
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    }

    return () => {
      // Cleanup
    };
  }, []);

  useEffect(() => {
    // Update map when hazard type or filters change
    if (map.current) {
      console.log(`Updating map with hazard: ${hazardType}`, filters);
      
      // TODO: 
      // 1. Load hazard layer based on hazardType
      // 2. Apply filters
      // 3. Animate if timeline data available
    }
  }, [hazardType, filters]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map" />
      <div className="map-overlay">
        <div className="layer-legend">
          <h3>Legenda</h3>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#0000FF' }}></div>
            <span>Risco Baixo</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#FFFF00' }}></div>
            <span>Risco Médio</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#FF0000' }}></div>
            <span>Risco Alto</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map;
