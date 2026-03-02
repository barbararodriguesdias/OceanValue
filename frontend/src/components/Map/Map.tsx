// Map Component
// OceanValue Interactive Map with Mapbox GL JS

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import * as shapefile from 'shapefile';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';
import 'mapbox-gl/dist/mapbox-gl.css';
import './Map.css';

interface MapProps {
  hazardType: string;
  filters: any;
  operationalMax?: number;
  attentionMax?: number;
  snapshotTime?: string;
  latMin?: number;
  latMax?: number;
  lonMin?: number;
  lonMax?: number;
  selectedPoint?: { lat: number; lon: number } | null;
  onPointSelect?: (point: { lat: number; lon: number }) => void;
  hideLayers?: boolean;
  initialZoom?: number;
  initialCenter?: [number, number];
  focusBounds?: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  } | null;
}

const Map: React.FC<MapProps> = ({
  hazardType,
  filters,
  operationalMax,
  attentionMax,
  snapshotTime,
  latMin,
  latMax,
  lonMin,
  lonMax,
  selectedPoint,
  onPointSelect,
  hideLayers,
  initialZoom,
  initialCenter,
  focusBounds,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const landMaskRef = useRef<any | null>(null);
  const selectedPointMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const layerHoverHandlersRef = useRef<Record<string, { move: (e: any) => void; leave: () => void }>>({});
  const windArrowLayerId = 'wind-arrow-layer';
  const windArrowSourceId = 'wind-arrow-source';

  const normalizeFieldKey = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();

  const sanitizeFieldValue = (value: unknown) => String(value ?? '').replace(/\u0000/g, '').trim();
  const hasLetters = (value: string) => /[A-Za-zÀ-ÿ]/.test(value);

  const getFeatureName = (properties: Record<string, any> | undefined, layerId: string) => {
    const candidates = [
      'NOME',
      'NOME_CAMPO',
      'NM_CAMPO',
      'CAMPO',
      'BLOCO',
      'NOME_BLOCO',
      'NM_BLOCO',
      'SIGLA',
      'NOMECAMPO',
      'NOMEBLOCO',
    ];

    const entries = Object.entries(properties || {}).map(([key, value]) => ({
      normalizedKey: normalizeFieldKey(key),
      value: sanitizeFieldValue(value),
    }));

    for (const candidate of candidates) {
      const target = normalizeFieldKey(candidate);
      const hit = entries.find((entry) => entry.normalizedKey === target && hasLetters(entry.value));
      if (hit?.value) {
        return hit.value;
      }
    }

    const semantic = entries.find(
      (entry) => (
        (entry.normalizedKey.includes('NOME')
          || entry.normalizedKey.includes('CAMPO')
          || entry.normalizedKey.includes('BLOCO')
          || entry.normalizedKey.includes('NOM'))
        && hasLetters(entry.value)
      ),
    );
    if (semantic?.value) {
      return semantic.value;
    }

    if (layerId === 'campos-producao') return 'Campo de Produção';
    if (layerId === 'blocos-exploratorios') return 'Bloco Exploratório';
    return 'Área';
  };

  const attachHoverNameTooltip = (layerId: string) => {
    if (!map.current) return;
    if (layerHoverHandlersRef.current[layerId]) return;

    const shouldShowName = layerId === 'campos-producao' || layerId === 'blocos-exploratorios';
    if (!shouldShowName) return;

    if (!hoverPopupRef.current) {
      hoverPopupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
      });
    }

    const move = (e: any) => {
      if (!map.current) return;

      const feature = e.features?.[0];
      const name = getFeatureName(feature?.properties, layerId);
      map.current.getCanvas().style.cursor = 'pointer';
      hoverPopupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(`<strong>${name}</strong>`)
        .addTo(map.current);
    };

    const leave = () => {
      if (!map.current) return;
      map.current.getCanvas().style.cursor = '';
      hoverPopupRef.current?.remove();
    };

    map.current.on('mousemove', layerId, move);
    map.current.on('mouseleave', layerId, leave);
    layerHoverHandlersRef.current[layerId] = { move, leave };
  };

  const LAND_MASK_URL =
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  useEffect(() => {
    const loadLandMask = async () => {
      try {
        const response = await fetch(LAND_MASK_URL);
        if (!response.ok) return;
        landMaskRef.current = await response.json();
        console.log('✅ Land mask carregado');
      } catch (error) {
        console.error('❌ Erro ao carregar land mask:', error);
      }
    };

    loadLandMask();
  }, []);

  const isPointOnLand = (lon: number, lat: number) => {
    if (!landMaskRef.current?.features?.length) return false;
    const pt = turfPoint([lon, lat]);
    for (const feature of landMaskRef.current.features) {
      if (booleanPointInPolygon(pt, feature)) {
        return true;
      }
    }
    return false;
  };

  const getEffectiveBounds = () => {
    return { latMin, latMax, lonMin, lonMax };
  };

  // Initialize map
  useEffect(() => {
    if (map.current) return; // Initialize map only once

    if (!mapboxToken) {
      console.error('Mapbox token não configurado');
      return;
    }

    if (!mapContainer.current) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: initialCenter ?? [-44.0, -23.5], // Centered on Santos/Campos region
      zoom: initialZoom ?? 5,
      pitch: 0,
      bearing: 0,
    });

    map.current.on('load', () => {
      setIsMapLoaded(true);
      console.log('✅ Mapa carregado');

      if (!map.current?.hasImage('wind-arrow')) {
        const size = 40;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#111827';
          ctx.beginPath();
          ctx.moveTo(size / 2, 2);
          ctx.lineTo(size - 6, size - 6);
          ctx.lineTo(size / 2, size - 16);
          ctx.lineTo(6, size - 6);
          ctx.closePath();
          ctx.fill();
          map.current.addImage('wind-arrow', ctx.getImageData(0, 0, size, size), {
            pixelRatio: 2,
          });
        }
      }
    });

    map.current.on('click', (event) => {
      const { lng, lat } = event.lngLat;
      onPointSelect?.({ lat, lon: lng });
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    return () => {
      // Cleanup on component unmount
    };
  }, [mapboxToken, initialCenter, initialZoom]);

  useEffect(() => {
    if (!map.current) return;
    if (!selectedPoint) {
      if (selectedPointMarkerRef.current) {
        selectedPointMarkerRef.current.remove();
        selectedPointMarkerRef.current = null;
      }
      return;
    }

    if (!selectedPointMarkerRef.current) {
      selectedPointMarkerRef.current = new mapboxgl.Marker({ color: '#111827' })
        .setLngLat([selectedPoint.lon, selectedPoint.lat])
        .addTo(map.current);
    } else {
      selectedPointMarkerRef.current.setLngLat([selectedPoint.lon, selectedPoint.lat]);
    }
  }, [selectedPoint]);

  useEffect(() => {
    if (!map.current || !isMapLoaded || !focusBounds) return;

    const { minLon, minLat, maxLon, maxLat } = focusBounds;
    if (
      !Number.isFinite(minLon)
      || !Number.isFinite(minLat)
      || !Number.isFinite(maxLon)
      || !Number.isFinite(maxLat)
    ) {
      return;
    }

    const width = Math.abs(maxLon - minLon);
    const height = Math.abs(maxLat - minLat);

    if (width < 0.0001 && height < 0.0001) {
      map.current.flyTo({
        center: [minLon, minLat],
        zoom: Math.max(initialZoom ?? 5, 8),
        duration: 900,
      });
      return;
    }

    map.current.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      {
        padding: 32,
        duration: 1000,
        maxZoom: 10,
      },
    );
  }, [focusBounds, isMapLoaded, initialZoom]);

  // Load shapefile layer acima do heatmap
  const loadShapefileLayer = async (
    layerId: string,
    shpUrl: string,
    dbfUrl: string,
    paint: mapboxgl.FillPaint,
  ) => {
    if (!map.current || !isMapLoaded) return;

    try {
      // Check if layer already exists
      if (map.current.getSource(layerId)) {
        console.log(`⚠️ Layer ${layerId} já existe`);
        return;
      }

      console.log(`📍 Carregando shapefile: ${layerId}`);

      // Load shapefile
      const source = await shapefile.open(shpUrl, dbfUrl);
      const features: any[] = [];
      let result = await source.read();

      while (!result.done) {
        features.push(result.value);
        result = await source.read();
      }

      console.log(`✅ ${layerId}: ${features.length} features carregadas`);

      // Add source
      map.current.addSource(layerId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features,
        },
      });

      // Adiciona camada de shapefile acima do heatmap, se existir
      const beforeId = map.current.getLayer('heatmap-layer') ? 'heatmap-layer' : undefined;
      map.current.addLayer({
        id: layerId,
        type: 'fill',
        source: layerId,
        paint,
      }, beforeId);

      // Add outline acima do heatmap também
      map.current.addLayer({
        id: `${layerId}-outline`,
        type: 'line',
        source: layerId,
        paint: {
          'line-color': paint['fill-outline-color'] || '#000000',
          'line-width': 2,
        },
      }, beforeId);

      attachHoverNameTooltip(layerId);
    } catch (error) {
      console.error(`❌ Erro ao carregar ${layerId}:`, error);
    }
  };

  // Remove layer
  const removeLayerIfExists = (layerId: string) => {
    if (!map.current) return;

    try {
      const handlers = layerHoverHandlersRef.current[layerId];
      if (handlers) {
        map.current.off('mousemove', layerId, handlers.move);
        map.current.off('mouseleave', layerId, handlers.leave);
        delete layerHoverHandlersRef.current[layerId];
      }

      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getLayer(`${layerId}-outline`)) {
        map.current.removeLayer(`${layerId}-outline`);
      }
      if (map.current.getSource(layerId)) {
        map.current.removeSource(layerId);
      }
      console.log(`✅ Layer ${layerId} removida`);
    } catch (error) {
      console.error(`❌ Erro ao remover layer ${layerId}:`, error);
    }
  };

  // Add heatmap layer
  const addHeatmapLayer = (
    data: any,
    minValue: number,
    maxValue: number,
    thresholds?: { operationalMax?: number; attentionMax?: number },
  ) => {
    if (!map.current) return;

    const heatmapSourceId = 'heatmap-source';
    const heatmapLayerId = 'heatmap-layer';

    try {
      const existingSource = map.current.getSource(heatmapSourceId) as mapboxgl.GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(data);
      } else {
        map.current.addSource(heatmapSourceId, {
          type: 'geojson',
          data: data,
        });
      }

      const range = maxValue - minValue || 1;
      const q1 = minValue + range * 0.25;
      const q2 = minValue + range * 0.5;
      const q3 = minValue + range * 0.75;
      const rawOperational = thresholds?.operationalMax;
      const rawAttention = thresholds?.attentionMax;
      const operationalStop = rawOperational !== undefined
        ? Math.min(Math.max(rawOperational, minValue), maxValue)
        : q2;
      const attentionStop = rawAttention !== undefined
        ? Math.min(Math.max(rawAttention, operationalStop), maxValue)
        : q3;

      if (!map.current.getLayer(heatmapLayerId)) {
        // Add circle layer with value-based color (stable across zoom)
        map.current.addLayer({
          id: heatmapLayerId,
          type: 'circle',
          source: heatmapSourceId,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0,
              4,
              6,
              8,
              9,
              14,
              12,
              22,
            ],
            'circle-blur': 0.6,
            'circle-color': [
              'interpolate',
              ['linear'],
              ['get', 'value'],
              minValue,
              'rgb(0, 70, 200)',
              operationalStop,
              'rgb(0, 200, 120)',
              attentionStop,
              'rgb(255, 190, 0)',
              maxValue,
              'rgb(230, 30, 30)',
            ],
            'circle-opacity': 0.8,
            'circle-opacity-transition': {
              duration: 600,
              delay: 0,
            },
          },
        });
      }

      console.log('✅ Heatmap renderizado');
    } catch (error) {
      console.error('❌ Erro ao adicionar heatmap:', error);
    }
  };

  const buildSnapshotUrl = (variable: string, time: string) => {
    const params = new URLSearchParams({
      variable,
      time,
    });

    const bounds = getEffectiveBounds();

    if (bounds.latMin !== undefined) params.set('lat_min', String(bounds.latMin));
    if (bounds.latMax !== undefined) params.set('lat_max', String(bounds.latMax));
    if (bounds.lonMin !== undefined) params.set('lon_min', String(bounds.lonMin));
    if (bounds.lonMax !== undefined) params.set('lon_max', String(bounds.lonMax));

    return `${apiBaseUrl}/api/v1/climate/snapshot?${params.toString()}`;
  };

  const buildCurrentSnapshotUrl = (time: string) => {
    const params = new URLSearchParams({
      time,
    });

    const bounds = getEffectiveBounds();

    if (bounds.latMin !== undefined) params.set('lat_min', String(bounds.latMin));
    if (bounds.latMax !== undefined) params.set('lat_max', String(bounds.latMax));
    if (bounds.lonMin !== undefined) params.set('lon_min', String(bounds.lonMin));
    if (bounds.lonMax !== undefined) params.set('lon_max', String(bounds.lonMax));

    return `${apiBaseUrl}/api/v1/climate/current-snapshot?${params.toString()}`;
  };

  const buildWindSnapshotUrl = (time: string) => {
    const params = new URLSearchParams({
      time,
    });

    const bounds = getEffectiveBounds();

    if (operationalMax !== undefined) {
      params.set('operational_max_knots', String(operationalMax));
    }
    if (attentionMax !== undefined) {
      params.set('attention_max_knots', String(attentionMax));
    }

    if (bounds.latMin !== undefined) params.set('lat_min', String(bounds.latMin));
    if (bounds.latMax !== undefined) params.set('lat_max', String(bounds.latMax));
    if (bounds.lonMin !== undefined) params.set('lon_min', String(bounds.lonMin));
    if (bounds.lonMax !== undefined) params.set('lon_max', String(bounds.lonMax));

    return `${apiBaseUrl}/api/v1/climate/wind-hazard-snapshot?${params.toString()}`;
  };

  const buildWaveSnapshotUrl = (time: string) => {
    const params = new URLSearchParams({
      time,
      stat: 'mean',
    });

    const bounds = getEffectiveBounds();

    if (bounds.latMin !== undefined) params.set('lat_min', String(bounds.latMin));
    if (bounds.latMax !== undefined) params.set('lat_max', String(bounds.latMax));
    if (bounds.lonMin !== undefined) params.set('lon_min', String(bounds.lonMin));
    if (bounds.lonMax !== undefined) params.set('lon_max', String(bounds.lonMax));

    return `${apiBaseUrl}/api/v1/climate/wave-snapshot?${params.toString()}`;
  };

  const computeMinMax = (values: number[][], step: number) => {
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < values.length; i += step) {
      const row = values[i];
      for (let j = 0; j < row.length; j += step) {
        const value = Number(row[j]);
        if (!Number.isFinite(value)) continue;
        if (value < minValue) minValue = value;
        if (value > maxValue) maxValue = value;
      }
    }

    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      return { minValue: 0, maxValue: 1 };
    }

    return { minValue, maxValue };
  };

  const buildHeatmapFeaturesFromGrid = (
    latList: number[],
    lonList: number[],
    values: number[][],
    minOverride?: number,
    maxOverride?: number,
  ) => {
    const totalPoints = latList.length * lonList.length;
    const targetPoints = 10000;
    const step = Math.max(1, Math.ceil(Math.sqrt(totalPoints / targetPoints)));
    const { minValue, maxValue } = computeMinMax(values, step);
    const finalMin = Number.isFinite(minOverride as number) ? (minOverride as number) : minValue;
    const finalMax = Number.isFinite(maxOverride as number) ? (maxOverride as number) : maxValue;
    const range = finalMax - finalMin || 1;
    const landMaskThreshold = 0;
    const features: any[] = [];

    for (let i = 0; i < latList.length; i += step) {
      for (let j = 0; j < lonList.length; j += step) {
        const value = Number(values[i]?.[j]);
        if (!Number.isFinite(value)) continue;
        if (value <= landMaskThreshold) continue;
        if (isPointOnLand(lonList[j], latList[i])) continue;
        const mag = Math.max(0, Math.min(1, (value - finalMin) / range));

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lonList[j], latList[i]],
          },
          properties: {
            mag,
            value,
          },
        });
      }
    }

    if (!features.length) {
      console.warn('⚠️ Heatmap sem pontos após filtros de terra.');
    }

    return { features, minValue: finalMin, maxValue: finalMax };
  };

  const addWindArrowLayer = (
    latList: number[],
    lonList: number[],
    direction: number[][],
  ) => {
    if (!map.current) return;

    const totalPoints = latList.length * lonList.length;
    const targetPoints = 2000;
    const step = Math.max(1, Math.ceil(Math.sqrt(totalPoints / targetPoints)));
    const features: any[] = [];

    for (let i = 0; i < latList.length; i += step) {
      for (let j = 0; j < lonList.length; j += step) {
        const value = Number(direction[i]?.[j]);
        if (!Number.isFinite(value)) continue;
        if (isPointOnLand(lonList[j], latList[i])) continue;

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lonList[j], latList[i]],
          },
          properties: {
            direction: value,
          },
        });
      }
    }

    const geoJsonData = {
      type: 'FeatureCollection',
      features,
    };

    const existingSource = map.current.getSource(windArrowSourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geoJsonData as any);
    } else {
      map.current.addSource(windArrowSourceId, {
        type: 'geojson',
        data: geoJsonData as any,
      });
    }

    if (!map.current.getLayer(windArrowLayerId)) {
      map.current.addLayer({
        id: windArrowLayerId,
        type: 'symbol',
        source: windArrowSourceId,
        layout: {
          'icon-image': 'wind-arrow',
          'icon-size': 0.35,
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-rotate': ['get', 'direction'],
        },
        paint: {
          'icon-opacity': 0.8,
        },
      });
    }
  };

  // Update layers when filters change
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    if (hideLayers) return;
    if (hideLayers) return;

    console.log('🔄 Atualizando layers:', filters);

    // Handle Bacia de Santos
    const showBaciaSantos = filters?.layers?.baciaSantos;
    if (showBaciaSantos) {
      loadShapefileLayer(
        'bacia-santos',
        '/data/santos/Santos-polygon.shp',
        '/data/santos/Santos-polygon.dbf',
        {
          'fill-color': '#8b5a2b',
          'fill-opacity': 0.2,
          'fill-outline-color': '#d2b48c',
        },
      );
    } else {
      removeLayerIfExists('bacia-santos');
    }

    // Handle Bacia de Campos
    const showBaciaCampos = filters?.layers?.baciaCampos;
    if (showBaciaCampos) {
      loadShapefileLayer(
        'bacia-campos',
        '/data/campos/Campos-polygon.shp',
        '/data/campos/Campos-polygon.dbf',
        {
          'fill-color': '#4b7c8c',
          'fill-opacity': 0.2,
          'fill-outline-color': '#8fa3b3',
        },
      );
    } else {
      removeLayerIfExists('bacia-campos');
    }

    // Handle Blocos Exploratórios
    const showBlocos = filters?.layers?.blocosExploratorios;
    if (showBlocos) {
      loadShapefileLayer(
        'blocos-exploratorios',
        '/data/blocos_exploratorios/BLOCOS_EXPLORATORIOS_SIRGASPolygon.shp',
        '/data/blocos_exploratorios/BLOCOS_EXPLORATORIOS_SIRGASPolygon.dbf',
        {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.25,
          'fill-outline-color': '#1e40af',
        },
      );
    } else {
      removeLayerIfExists('blocos-exploratorios');
    }

    // Handle Campos de Produção
    const showCampos = filters?.layers?.camposProducao;
    if (showCampos) {
      loadShapefileLayer(
        'campos-producao',
        '/data/campos_producao/CAMPOS_PRODUCAO_SIRGASPolygon.shp',
        '/data/campos_producao/CAMPOS_PRODUCAO_SIRGASPolygon.dbf',
        {
          'fill-color': '#22c55e',
          'fill-opacity': 0.25,
          'fill-outline-color': '#166534',
        },
      );
    } else {
      removeLayerIfExists('campos-producao');
    }
  }, [hazardType, filters, isMapLoaded, hideLayers]);

  // Add heatmap when snapshot changes (when Visualizar is clicked)
  useEffect(() => {
    if (!snapshotTime) return;

    const controller = new AbortController();

    const loadWindSnapshot = async () => {
      try {
        console.log(`📊 Carregando vento: ${snapshotTime}`);

        const response = await fetch(buildWindSnapshotUrl(snapshotTime), { signal: controller.signal });
        if (!response.ok) {
          throw new Error('Erro ao buscar dados de vento');
        }

        const windData = await response.json();
        const latList = windData.lat as number[];
        const lonList = windData.lon as number[];
        const values = (windData.speed_knots ?? windData.values) as number[][];
        const direction = (windData.direction_deg ?? []) as number[][];

        const { features, minValue, maxValue } = buildHeatmapFeaturesFromGrid(
          latList,
          lonList,
          values,
          undefined,
          undefined,
        );

        const geoJsonData = {
          type: 'FeatureCollection',
          features,
        };

        addHeatmapLayer(geoJsonData, minValue, maxValue, {
          operationalMax,
          attentionMax,
        });
        if (direction.length) {
          addWindArrowLayer(latList, lonList, direction);
        }
        console.log(`✅ Vento renderizado (min: ${minValue}, max: ${maxValue})`);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('❌ Erro ao carregar vento:', error);
      }
    };

    const loadCurrentSnapshot = async () => {
      try {
        console.log(`📊 Carregando corrente: ${snapshotTime}`);

        const response = await fetch(buildCurrentSnapshotUrl(snapshotTime), {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar dados de corrente');
        }

        const currentData = await response.json();
        const latList = currentData.lat as number[];
        const lonList = currentData.lon as number[];
        const values = currentData.values as number[][];

        const { features, minValue, maxValue } = buildHeatmapFeaturesFromGrid(
          latList,
          lonList,
          values,
          undefined,
          undefined,
        );

        const geoJsonData = {
          type: 'FeatureCollection',
          features,
        };

        addHeatmapLayer(geoJsonData, minValue, maxValue, {
          operationalMax,
          attentionMax,
        });
        console.log(`✅ Corrente renderizada (min: ${minValue}, max: ${maxValue})`);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('❌ Erro ao carregar corrente:', error);
      }
    };

    const loadWaveSnapshot = async () => {
      try {
        console.log(`📊 Carregando onda: ${snapshotTime}`);

        const response = await fetch(buildWaveSnapshotUrl(snapshotTime), {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar dados de onda');
        }

        const waveData = await response.json();
        const latList = waveData.lat as number[];
        const lonList = waveData.lon as number[];
        const values = waveData.values as number[][];

        const { features, minValue, maxValue } = buildHeatmapFeaturesFromGrid(
          latList,
          lonList,
          values,
          undefined,
          undefined,
        );

        const geoJsonData = {
          type: 'FeatureCollection',
          features,
        };

        addHeatmapLayer(geoJsonData, minValue, maxValue, {
          operationalMax,
          attentionMax,
        });
        console.log(`✅ Onda renderizada (min: ${minValue}, max: ${maxValue})`);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('❌ Erro ao carregar onda:', error);
      }
    };

    if (hazardType === 'wind') {
      loadWindSnapshot();
    } else if (hazardType === 'wave') {
      loadWaveSnapshot();
    } else if (hazardType === 'current') {
      loadCurrentSnapshot();
    }

    return () => controller.abort();
  }, [
    isMapLoaded,
    hazardType,
    snapshotTime,
    latMin,
    latMax,
    lonMin,
    lonMax,
    apiBaseUrl,
    operationalMax,
    attentionMax,
    hideLayers,
  ]);

  useEffect(() => {
    return () => {
      if (!map.current) return;

      Object.entries(layerHoverHandlersRef.current).forEach(([layerId, handlers]) => {
        map.current?.off('mousemove', layerId, handlers.move);
        map.current?.off('mouseleave', layerId, handlers.leave);
      });

      layerHoverHandlersRef.current = {};
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
    };
  }, []);

  return (
    <div className="map-wrapper">
      {!mapboxToken && (
        <div className="map-token-warning">
          ⚠️ Adicione VITE_MAPBOX_TOKEN no arquivo .env para exibir o mapa.
        </div>
      )}
      <div ref={mapContainer} className="map" />
    </div>
  );
};

export default Map;
