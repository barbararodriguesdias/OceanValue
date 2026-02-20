import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as climateDataService from '../../services/climateDataService';
import type { SnapshotData, SpatialBounds } from '../../services/climateDataService';
import './ClimateDataViewer.css';

interface ClimateDataViewerProps {
  map: mapboxgl.Map | null;
  isVisible: boolean;
}

export const ClimateDataViewer: React.FC<ClimateDataViewerProps> = ({ map, isVisible }) => {
  const [selectedVariable, setSelectedVariable] = useState<string>('u10');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.7);
  
  // Spatial bounds (default: Campos do Sudeste - Santos a Campos)
  const [latMin, setLatMin] = useState(-25.0);
  const [latMax, setLatMax] = useState(-20.0);
  const [lonMin, setLonMin] = useState(-45.0);
  const [lonMax, setLonMax] = useState(-39.0);
  
  const heatmapLayerId = 'climate-heatmap';
  const heatmapSourceId = 'climate-heatmap-source';

  // Load available variables on mount
  useEffect(() => {
    const loadVariables = async () => {
      try {
        const data = await climateDataService.getVariables();
        setVariables(data.descriptions);
      } catch (err) {
        setError(`Failed to load variables: ${err}`);
      }
    };
    loadVariables();
  }, []);

  // Fetch and display heatmap when variable or date changes
  useEffect(() => {
    if (!map || !isVisible) return;

    const fetchAndDisplayHeatmap = async () => {
      setLoading(true);
      setError(null);

      try {
        const bounds: SpatialBounds = {
          lat_min: latMin,
          lat_max: latMax,
          lon_min: lonMin,
          lon_max: lonMax
        };

        // Get grid data for selected date and variable
        const gridData = await climateDataService.getSnapshot(
          selectedVariable,
          `${selectedDate}T00:00:00`,
          bounds
        );

        // Get statistics
        try {
          const stats = await climateDataService.getStatistics(
            selectedVariable,
            selectedDate,
            selectedDate,
            bounds
          );
          setStatistics(stats);
        } catch (err) {
          console.warn('Statistics not available:', err);
          setStatistics(null);
        }

        // Create GeoJSON from grid data
        const features = createHeatmapFeatures(gridData);
        const geojson = {
          type: 'FeatureCollection' as const,
          features,
        };

        // Add or update source
        if (map.getSource(heatmapSourceId)) {
          (map.getSource(heatmapSourceId) as mapboxgl.GeoJSONSource).setData(geojson);
        } else {
          map.addSource(heatmapSourceId, {
            type: 'geojson',
            data: geojson,
          });

          // Calculate min/max from data
          const values = features.map(f => f.properties.value).filter(v => v !== null && !isNaN(v));
          const dataMin = Math.min(...values);
          const dataMax = Math.max(...values);

          // Add heatmap layer
          map.addLayer(
            {
              id: heatmapLayerId,
              type: 'heatmap',
              source: heatmapSourceId,
              paint: {
                'heatmap-weight': [
                  'interpolate',
                  ['linear'],
                  ['get', 'value'],
                  dataMin,
                  0,
                  dataMax,
                  1,
                ],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
                'heatmap-color': [
                  'interpolate',
                  ['linear'],
                  ['heatmap-density'],
                  0,
                  'rgba(0, 0, 255, 0)',
                  0.2,
                  '#419bf9',
                  0.4,
                  '#19e3f5',
                  0.6,
                  '#76ee00',
                  0.8,
                  '#f5a900',
                  1,
                  '#ff0000',
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
                'heatmap-opacity': opacity,
              },
            },
            'water'
          );
        }

        // Update layer opacity
        map.setPaintProperty(heatmapLayerId, 'heatmap-opacity', opacity);
      } catch (err) {
        setError(`Failed to load heatmap: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAndDisplayHeatmap();
  }, [map, isVisible, selectedVariable, selectedDate, opacity, latMin, latMax, lonMin, lonMax]);

  const createHeatmapFeatures = (gridData: SnapshotData) => {
    const features = [];
    const { lat, lon, values } = gridData;

    for (let i = 0; i < lat.length; i++) {
      for (let j = 0; j < lon.length; j++) {
        if (values[i] && values[i][j] !== null && values[i][j] !== undefined && !isNaN(values[i][j])) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lon[j], lat[i]],
            },
            properties: {
              value: values[i][j],
            },
          });
        }
      }
    }

    return features;
  };

  const toggleHeatmap = () => {
    if (!map) return;
    const visibility = map.getLayoutProperty(heatmapLayerId, 'visibility');
    map.setLayoutProperty(
      heatmapLayerId,
      'visibility',
      visibility === 'none' ? 'visible' : 'none'
    );
  };

  if (!isVisible) return null;

  return (
    <div className="climate-viewer">
      <div className="climate-header">
        <h3>Climate Data Viewer</h3>
        <button onClick={toggleHeatmap} className="toggle-btn">
          Toggle Heatmap
        </button>
      </div>

      <div className="climate-controls">
        <div className="control-group">
          <label>Variable</label>
          <select
            value={selectedVariable}
            onChange={(e) => setSelectedVariable(e.target.value)}
            disabled={loading}
          >
            {Object.entries(variables).map(([key, desc]) => (
              <option key={key} value={key}>
                {key} - {desc}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={loading}
            min="1979-01-01"
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="spatial-bounds">
          <h4>Região de Interesse</h4>
          <div className="bounds-grid">
            <div className="bound-input">
              <label>Lat Min</label>
              <input
                type="number"
                value={latMin}
                onChange={(e) => setLatMin(parseFloat(e.target.value))}
                step="0.1"
                disabled={loading}
              />
            </div>
            <div className="bound-input">
              <label>Lat Max</label>
              <input
                type="number"
                value={latMax}
                onChange={(e) => setLatMax(parseFloat(e.target.value))}
                step="0.1"
                disabled={loading}
              />
            </div>
            <div className="bound-input">
              <label>Lon Min</label>
              <input
                type="number"
                value={lonMin}
                onChange={(e) => setLonMin(parseFloat(e.target.value))}
                step="0.1"
                disabled={loading}
              />
            </div>
            <div className="bound-input">
              <label>Lon Max</label>
              <input
                type="number"
                value={lonMax}
                onChange={(e) => setLonMax(parseFloat(e.target.value))}
                step="0.1"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="control-group">
          <label>Opacity ({(opacity * 100).toFixed(0)}%)</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
          />
        </div>
      </div>

      {loading && <div className="loading">Loading data...</div>}

      {error && <div className="error-msg">{error}</div>}

      {statistics && (
        <div className="statistics">
          <h4>Statistics</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Mean</span>
              <span className="stat-value">{statistics.mean.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Min</span>
              <span className="stat-value">{statistics.min.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Max</span>
              <span className="stat-value">{statistics.max.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Std</span>
              <span className="stat-value">{statistics.std.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="legend">
        <h4>Legend</h4>
        <div className="color-bar">
          <div className="color-item" style={{ backgroundColor: '#419bf9' }}>Low</div>
          <div className="color-item" style={{ backgroundColor: '#19e3f5' }}></div>
          <div className="color-item" style={{ backgroundColor: '#76ee00' }}>Mid</div>
          <div className="color-item" style={{ backgroundColor: '#f5a900' }}></div>
          <div className="color-item" style={{ backgroundColor: '#ff0000' }}>High</div>
        </div>
      </div>
    </div>
  );
};