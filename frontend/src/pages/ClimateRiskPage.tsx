// ...existing code...
import * as shapefile from 'shapefile';
import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { analysisService, ClimateRiskResult } from '../services/analysisService';
import Map from '../components/Map/Map';
import './ClimateRiskPage.css';

type AssetType =
  | 'platform'
  | 'fpso'
  | 'subsea'
  | 'windfarm'
  | 'port'
  | 'infrastructure'
  | 'industrial'
  | 'population';
type AnalysisMode = 'offshore' | 'onshore';

const ASSET_LIMIT_PROFILES: Record<AssetType, {
  windOperationalMax: number;
  windAttentionMax: number;
  waveOperationalMax: number;
  waveAttentionMax: number;
}> = {
  platform: { windOperationalMax: 15, windAttentionMax: 20, waveOperationalMax: 2.0, waveAttentionMax: 4.0 },
  fpso: { windOperationalMax: 18, windAttentionMax: 24, waveOperationalMax: 2.8, waveAttentionMax: 4.8 },
  subsea: { windOperationalMax: 22, windAttentionMax: 28, waveOperationalMax: 3.5, waveAttentionMax: 5.8 },
  windfarm: { windOperationalMax: 14, windAttentionMax: 19, waveOperationalMax: 2.2, waveAttentionMax: 3.8 },
  port: { windOperationalMax: 13, windAttentionMax: 18, waveOperationalMax: 1.8, waveAttentionMax: 3.2 },
  infrastructure: { windOperationalMax: 16, windAttentionMax: 22, waveOperationalMax: 2.4, waveAttentionMax: 4.2 },
  industrial: { windOperationalMax: 15, windAttentionMax: 21, waveOperationalMax: 2.2, waveAttentionMax: 4.0 },
  population: { windOperationalMax: 14, windAttentionMax: 19, waveOperationalMax: 1.7, waveAttentionMax: 3.0 },
};

interface ClimateScenario {
  start_year: string;
  end_year: string;
  ssp_scenario: 'SSP1-2.6' | 'SSP2-4.5' | 'SSP5-8.5';
}
type NamedLocationSource = 'campos_producao' | 'blocos_exploratorios';
interface NamedLocation {
  key: string;
  name: string;
  source: NamedLocationSource;
  point: { lat: number; lon: number };
  bounds: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  };
}

const NAME_FIELD_CANDIDATES = [
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

const normalizeFieldKey = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]/gi, '')
  .toUpperCase();

const sanitizeValue = (value: unknown) => String(value ?? '').replace(/\u0000/g, '').trim();
const hasLetters = (value: string) => /[A-Za-zÀ-ÿ]/.test(value);

const extractCoordinates = (geometry: any): [number, number][] => {
  const coords: [number, number][] = [];
  const walk = (value: any) => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2
      && typeof value[0] === 'number'
      && typeof value[1] === 'number'
      && Number.isFinite(value[0])
      && Number.isFinite(value[1])
    ) {
      coords.push([value[0], value[1]]);
      return;
    }
    value.forEach(walk);
  };
  walk(geometry?.coordinates);
  return coords;
};

const centroidFromGeometry = (geometry: any): { lat: number; lon: number } | null => {
  const coords = extractCoordinates(geometry);
  if (!coords.length) return null;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  coords.forEach(([lon, lat]) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });
  if (
    !Number.isFinite(minLon)
    || !Number.isFinite(maxLon)
    || !Number.isFinite(minLat)
    || !Number.isFinite(maxLat)
  ) {
    return null;
  }
  return {
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
  };
};

const boundsFromGeometry = (
  geometry: any,
): {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
} | null => {
  const coords = extractCoordinates(geometry);
  if (!coords.length) return null;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  coords.forEach(([lon, lat]) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });
  if (
    !Number.isFinite(minLon)
    || !Number.isFinite(maxLon)
    || !Number.isFinite(minLat)
    || !Number.isFinite(maxLat)
  ) {
    return null;
  }
  return { minLon, minLat, maxLon, maxLat };
};

const pickFeatureName = (properties: Record<string, any>, fallbackPrefix: string, index: number) => {
  const entries = Object.entries(properties || {}).map(([key, value]) => ({
    key,
    normalizedKey: normalizeFieldKey(key),
    value: sanitizeValue(value),
  }));
  for (const fieldName of NAME_FIELD_CANDIDATES) {
    const normalizedTarget = normalizeFieldKey(fieldName);
    const match = entries.find((entry) => entry.normalizedKey === normalizedTarget && hasLetters(entry.value));
    if (match?.value) {
      return match.value;
    }
  }
  const semanticKeyMatch = entries.find(
    (entry) => (
      (entry.normalizedKey.includes('NOME')
        || entry.normalizedKey.includes('CAMPO')
        || entry.normalizedKey.includes('BLOCO')
        || entry.normalizedKey.includes('NOM'))
      && hasLetters(entry.value)
    ),
  );
  if (semanticKeyMatch?.value) {
    return semanticKeyMatch.value;
  }
  const firstTextualValue = entries.find(
    (entry) => hasLetters(entry.value)
      && !entry.normalizedKey.startsWith('ID')
      && !entry.normalizedKey.startsWith('CD')
      && !entry.normalizedKey.includes('CODIGO'),
  );
  if (firstTextualValue?.value) {
    return firstTextualValue.value;
  }
  return `${fallbackPrefix} ${index + 1}`;
};

const loadNamedLocationsFromShapefile = async (
  shpUrl: string,
  dbfUrl: string,
  source: NamedLocationSource,
  fallbackPrefix: string,
): Promise<NamedLocation[]> => {
  const sourceReader = await shapefile.open(shpUrl, dbfUrl);
  const items: NamedLocation[] = [];
  let result = await sourceReader.read();
  let idx = 0;
  while (!result.done) {
    const feature = result.value;
    const center = centroidFromGeometry(feature?.geometry);
    const bounds = boundsFromGeometry(feature?.geometry);
    if (center && bounds) {
      const name = pickFeatureName(feature?.properties || {}, fallbackPrefix, idx);
      items.push({
        key: `${source}-${name}-${idx}`,
        name,
        source,
        point: center,
        bounds,
      });
    }
    idx += 1;
    result = await sourceReader.read();
  }
  return items;
};

const ClimateRiskPage = () => {
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('offshore');
  const [lat, setLat] = useState<number>(-23.5);
  const [lon, setLon] = useState<number>(-45.0);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lon: number } | null>({ lat: -23.5, lon: -45.0 });
  const [selectedNamedLocationKey, setSelectedNamedLocationKey] = useState<string>('');
  const [namedLocations, setNamedLocations] = useState<NamedLocation[]>([]);
  const [focusedBounds, setFocusedBounds] = useState<{
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  } | null>(null);
  const [isLoadingNamedLocations, setIsLoadingNamedLocations] = useState<boolean>(false);
  const [namedLocationsError, setNamedLocationsError] = useState<string | null>(null);
  const [assetType, setAssetType] = useState<AssetType>('platform');
  const [assetValue, setAssetValue] = useState<number>(100000000);
  const [includePopulation, setIncludePopulation] = useState<boolean>(true);
  const [stateName, setStateName] = useState<string>('');
  const [scenario, setScenario] = useState<ClimateScenario>({
    start_year: '1985',
    end_year: '2064',
    ssp_scenario: 'SSP5-8.5',
  });
  const [selectedHazards, setSelectedHazards] = useState<string[]>(['wind', 'wave']);
  const [windOperationalMax, setWindOperationalMax] = useState<number>(15);
  const [windAttentionMax, setWindAttentionMax] = useState<number>(20);
  const [waveOperationalMax, setWaveOperationalMax] = useState<number>(2);
  const [waveAttentionMax, setWaveAttentionMax] = useState<number>(4);
  const [climateRiskMapLayers, setClimateRiskMapLayers] = useState({
    baciaSantos: true,
    baciaCampos: true,
    blocosExploratorios: true,
    camposProducao: true,
    boundingBox: true,
  });
  const [result, setResult] = useState<ClimateRiskResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  // Removed unused state variables: region, period, stat

  useEffect(() => {
    const profile = ASSET_LIMIT_PROFILES[assetType] ?? ASSET_LIMIT_PROFILES.platform;
    setWindOperationalMax(profile.windOperationalMax);
    setWindAttentionMax(profile.windAttentionMax);
    setWaveOperationalMax(profile.waveOperationalMax);
    setWaveAttentionMax(profile.waveAttentionMax);
  }, [assetType]);

  useEffect(() => {
    let isMounted = true;
    const loadNamedLocations = async () => {
      setIsLoadingNamedLocations(true);
      setNamedLocationsError(null);
      try {
        const [campos, blocos] = await Promise.all([
          loadNamedLocationsFromShapefile(
            '/data/campos_producao/CAMPOS_PRODUCAO_SIRGASPolygon.shp',
            '/data/campos_producao/CAMPOS_PRODUCAO_SIRGASPolygon.dbf',
            'campos_producao',
            'Campo',
          ),
          loadNamedLocationsFromShapefile(
            '/data/blocos_exploratorios/BLOCOS_EXPLORATORIOS_SIRGASPolygon.shp',
            '/data/blocos_exploratorios/BLOCOS_EXPLORATORIOS_SIRGASPolygon.dbf',
            'blocos_exploratorios',
            'Bloco',
          ),
        ]);
        if (!isMounted) return;
        const merged = [...campos, ...blocos].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        setNamedLocations(merged);
      } catch {
        if (!isMounted) return;
        setNamedLocationsError('Não foi possível carregar nomes dos shapefiles.');
      } finally {
        if (isMounted) {
          setIsLoadingNamedLocations(false);
        }
      }
    };
    loadNamedLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleMapPointSelect = (point: { lat: number; lon: number }) => {
    setSelectedNamedLocationKey('');
    setFocusedBounds(null);
    setSelectedPoint(point);
    setLat(point.lat);
    setLon(point.lon);
  };

  const handleNamedLocationChange = (value: string) => {
    setSelectedNamedLocationKey(value);
    if (!value) return;
    const location = namedLocations.find((item) => item.key === value);
    if (!location) return;
    setFocusedBounds(location.bounds);
    setSelectedPoint(location.point);
    setLat(location.point.lat);
    setLon(location.point.lon);
  };

  const hazardOptions = analysisMode === 'offshore'
    ? [
        { id: 'wind', label: 'Ventos', enabled: true },
        { id: 'wave', label: 'Ondas', enabled: true },
        { id: 'current', label: 'Correntes (Em breve)', enabled: false },
      ]
    : [
        { id: 'water_scarcity', label: 'Escassez Hídrica (Em breve)', enabled: false },
        { id: 'flood', label: 'Inundação', enabled: true },
        { id: 'landslide', label: 'Deslizamento de Terra (Em breve)', enabled: false },
        { id: 'wildfire', label: 'Incêndio', enabled: true },
        { id: 'extreme_drought', label: 'Seca Extrema (Em breve)', enabled: false },
      ];

  const toggleHazard = (hazardId: string) => {
    if (selectedHazards.includes(hazardId)) {
      setSelectedHazards(selectedHazards.filter((h) => h !== hazardId));
    } else {
      setSelectedHazards([...selectedHazards, hazardId]);
    }
  };

  const handleRunAnalysis = async () => {
    setLoading(true);
    try {
      const payload = {
        lat,
        lon,
        asset_type: assetType,
        asset_value: assetValue,
        hazards: selectedHazards,
        wind_operational_max: windOperationalMax,
        wind_attention_max: Math.max(windAttentionMax, windOperationalMax),
        wave_operational_max: waveOperationalMax,
        wave_attention_max: Math.max(waveAttentionMax, waveOperationalMax),
        enable_scenarios: true,
        scenario: {
          historical_period: `${scenario.start_year}-2014`,
          future_period: `2015-${scenario.end_year}`,
          ssp_scenario: scenario.ssp_scenario,
        },
        include_population: includePopulation,
        state_name: stateName || undefined,
      };
      console.log('Payload enviado para análise:', payload);
      const data =
        analysisMode === 'offshore'
          ? await analysisService.runClimateRiskOffshore(payload)
          : await analysisService.runClimateRiskOnshore(payload);
      setResult(data);
    } catch (error) {
      console.error('Erro:', error);
      const detail = error instanceof Error ? error.message : String(error);
      if (detail.includes('is not a valid coordinate for dataset') || detail.includes('Arquivo NetCDF não encontrado')) {
        alert('O ponto selecionado está fora da área de cobertura dos dados climáticos. Selecione um ponto dentro da região suportada pelo NetCDF.');
      } else {
        alert(`Erro ao executar análise de risco climático.\n\nDetalhe: ${detail}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadClimateRiskPdf = async () => {
    try {
      const payload = {
        lat,
        lon,
        asset_type: assetType,
        asset_value: assetValue,
        hazards: selectedHazards,
        wind_operational_max: windOperationalMax,
        wind_attention_max: Math.max(windAttentionMax, windOperationalMax),
        wave_operational_max: waveOperationalMax,
        wave_attention_max: Math.max(waveAttentionMax, waveOperationalMax),
        enable_scenarios: true,
        scenario: {
          historical_period: `${scenario.start_year}-2014`,
          future_period: `2015-${scenario.end_year}`,
          ssp_scenario: scenario.ssp_scenario,
        },
        include_population: includePopulation,
        state_name: stateName || undefined,
      };
      const blob =
        analysisMode === 'offshore'
          ? await analysisService.downloadClimateRiskOffshorePdf(payload)
          : await analysisService.downloadClimateRiskOnshorePdf(payload);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = analysisMode === 'offshore' ? 'climate-risk-offshore.pdf' : 'climate-risk-onshore.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
      alert('Erro ao baixar relatório PDF.');
    }
  };

  return (
    <div className="climate-risk-page">
      <header className="page-header">
        <h1>Análise de Risco Climático Regional</h1>
        <p className="page-subtitle">
          Avalie riscos climáticos para ativos e regiões considerando dados históricos e cenários futuros
        </p>
      </header>
      <div className="page-content">
        <section className="climate-top-layout">
          <div className="left-controls">
            <div className="form-card mode-panel">
              <h2>Modo de Análise</h2>
              <div className="mode-selector">
                <button
                  className={analysisMode === 'offshore' ? 'mode-btn active' : 'mode-btn'}
                  onClick={() => setAnalysisMode('offshore')}
                >
                  <span className="mode-label">Offshore</span>
                  <span className="mode-desc">Ativos marítimos (plataformas, campos)</span>
                </button>
                <button
                  className={analysisMode === 'onshore' ? 'mode-btn active' : 'mode-btn'}
                  onClick={() => setAnalysisMode('onshore')}
                >
                  <span className="mode-label">Onshore</span>
                  <span className="mode-desc">Ativos terrestres (portos, infraestrutura, população)</span>
                </button>
              </div>
            </div>
            <div className="form-card coordinates-panel">
              <h2>Latitude e Longitude</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    value={lat}
                    onChange={(e) => {
                      const nextLat = Number(e.target.value);
                      setLat(nextLat);
                      setSelectedPoint((prev) => ({ lat: nextLat, lon: prev?.lon ?? lon }));
                      setSelectedNamedLocationKey('');
                      setFocusedBounds(null);
                    }}
                    step="0.0001"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    value={lon}
                    onChange={(e) => {
                      const nextLon = Number(e.target.value);
                      setLon(nextLon);
                      setSelectedPoint((prev) => ({ lat: prev?.lat ?? lat, lon: nextLon }));
                      setSelectedNamedLocationKey('');
                      setFocusedBounds(null);
                    }}
                    step="0.0001"
                  />
                </div>
              </div>
              <p className="location-display">
                Coordenadas: <strong>{lat.toFixed(4)}, {lon.toFixed(4)}</strong>
              </p>
            </div>
            <div className="form-card period-scenario-panel">
              <h2>Período e Cenário Climático</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Ano inicial (histórico)</label>
                  <input
                    type="number"
                    min="1979"
                    max="2015"
                    value={scenario.start_year}
                    onChange={(e) => setScenario({ ...scenario, start_year: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Ano final (preditivo)</label>
                  <input
                    type="number"
                    min="2015"
                    max="2064"
                    value={scenario.end_year}
                    onChange={(e) => setScenario({ ...scenario, end_year: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Cenário Climático</label>
                  <select
                    value={scenario.ssp_scenario}
                    onChange={(e) => setScenario({ ...scenario, ssp_scenario: e.target.value as ClimateScenario['ssp_scenario'] })}
                  >
                    <option value="SSP1-2.6">SSP1-2.6</option>
                    <option value="SSP2-4.5">SSP2-4.5</option>
                    <option value="SSP5-8.5">SSP5-8.5</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="right-map-panel">
            <div className="location-card">
              <h3>Localização da análise</h3>
              <div className="analysis-location-select">
                <label>
                  Selecionar campo/bloco por nome
                  <select
                    value={selectedNamedLocationKey}
                    onChange={(e) => handleNamedLocationChange(e.target.value)}
                    disabled={isLoadingNamedLocations || !namedLocations.length}
                  >
                    <option value="">Selecione (ou clique no mapa)</option>
                    <optgroup label="Campos de Produção">
                      {namedLocations
                        .filter((item) => item.source === 'campos_producao')
                        .map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.name}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Blocos Exploratórios">
                      {namedLocations
                        .filter((item) => item.source === 'blocos_exploratorios')
                        .map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </label>
                {isLoadingNamedLocations && <p className="analysis-hint">Carregando nomes dos shapefiles...</p>}
                {namedLocationsError && <p className="analysis-error">{namedLocationsError}</p>}
              </div>
              <div className="climate-map-with-toggles">
                <div className="analysis-mini-map">
                  <Map
                    hazardType="wind"
                    filters={{ layers: climateRiskMapLayers }}
                    selectedPoint={selectedPoint}
                    onPointSelect={handleMapPointSelect}
                    initialZoom={3.6}
                    initialCenter={[-44.0, -23.5]}
                    hideLayers={false}
                    focusBounds={focusedBounds}
                  />
                </div>
                <div className="climate-map-layer-toggles">
                  <h4>Camadas</h4>
                  <label className="climate-layer-item">
                    <span>Bacia Santos</span>
                    <span className="climate-layer-switch">
                      <input
                        className="climate-layer-checkbox"
                        type="checkbox"
                        checked={climateRiskMapLayers.baciaSantos}
                        onChange={(e) => setClimateRiskMapLayers((prev) => ({ ...prev, baciaSantos: e.target.checked }))}
                      />
                      <span className="climate-layer-slider" />
                    </span>
                  </label>
                  <label className="climate-layer-item">
                    <span>Bacia Campos</span>
                    <span className="climate-layer-switch">
                      <input
                        className="climate-layer-checkbox"
                        type="checkbox"
                        checked={climateRiskMapLayers.baciaCampos}
                        onChange={(e) => setClimateRiskMapLayers((prev) => ({ ...prev, baciaCampos: e.target.checked }))}
                      />
                      <span className="climate-layer-slider" />
                    </span>
                  </label>
                  <label className="climate-layer-item">
                    <span>Blocos</span>
                    <span className="climate-layer-switch">
                      <input
                        className="climate-layer-checkbox"
                        type="checkbox"
                        checked={climateRiskMapLayers.blocosExploratorios}
                        onChange={(e) => setClimateRiskMapLayers((prev) => ({ ...prev, blocosExploratorios: e.target.checked }))}
                      />
                      <span className="climate-layer-slider" />
                    </span>
                  </label>
                  <label className="climate-layer-item">
                    <span>Campos</span>
                    <span className="climate-layer-switch">
                      <input
                        className="climate-layer-checkbox"
                        type="checkbox"
                        checked={climateRiskMapLayers.camposProducao}
                        onChange={(e) => setClimateRiskMapLayers((prev) => ({ ...prev, camposProducao: e.target.checked }))}
                      />
                      <span className="climate-layer-slider" />
                    </span>
                  </label>
                  <label className="climate-layer-item">
                    <span>Bounding Box Dados</span>
                    <span className="climate-layer-switch">
                      <input
                        className="climate-layer-checkbox"
                        type="checkbox"
                        checked={climateRiskMapLayers.boundingBox}
                        onChange={(e) => setClimateRiskMapLayers((prev) => ({ ...prev, boundingBox: e.target.checked }))}
                      />
                      <span className="climate-layer-slider" />
                    </span>
                  </label>
                </div>
              </div>
            </div>
            <div className="form-card">
              <h2>Riscos Climáticos</h2>
              <div className="hazards-grid">
                {hazardOptions.map((hazard) => (
                  <button
                    key={hazard.id}
                    className={`hazard-btn ${selectedHazards.includes(hazard.id) ? 'selected' : ''} ${!hazard.enabled ? 'disabled' : ''}`}
                    onClick={() => hazard.enabled && toggleHazard(hazard.id)}
                    disabled={!hazard.enabled}
                  >
                    {hazard.label}
                    {!hazard.enabled && <span className="badge">Em breve</span>}
                  </button>
                ))}
              </div>
              {selectedHazards.includes('wind') && (
                <div className="form-row" style={{ marginTop: 12 }}>
                  <div className="form-group">
                    <label>Vento - Limite operacional (kn)</label>
                    <input
                      type="number"
                      value={windOperationalMax}
                      onChange={(e) => setWindOperationalMax(Number(e.target.value))}
                      step="0.1"
                    />
                  </div>
                  <div className="form-group">
                    <label>Vento - Limite atenção (kn)</label>
                    <input
                      type="number"
                      value={windAttentionMax}
                      onChange={(e) => setWindAttentionMax(Number(e.target.value))}
                      step="0.1"
                    />
                  </div>
                </div>
              )}
              {selectedHazards.includes('wave') && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Onda - Limite operacional (m)</label>
                    <input
                      type="number"
                      value={waveOperationalMax}
                      onChange={(e) => setWaveOperationalMax(Number(e.target.value))}
                      step="0.1"
                    />
                  </div>
                  <div className="form-group">
                    <label>Onda - Limite atenção (m)</label>
                    <input
                      type="number"
                      value={waveAttentionMax}
                      onChange={(e) => setWaveAttentionMax(Number(e.target.value))}
                      step="0.1"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="form-card">
              <h2>Configuração do Ativo</h2>
              <div className="form-group">
                <label>Tipo de Ativo</label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as AssetType)}
                >
                  {analysisMode === 'offshore' ? (
                    <>
                      <option value="platform">Plataforma de Petróleo/Gás</option>
                      <option value="fpso">FPSO</option>
                      <option value="subsea">Infraestrutura Submarina</option>
                      <option value="windfarm">Parque Eólico Offshore</option>
                    </>
                  ) : (
                    <>
                      <option value="port">Porto</option>
                      <option value="infrastructure">Infraestrutura Costeira</option>
                      <option value="industrial">Complexo Industrial</option>
                      <option value="population">Área Populacional</option>
                    </>
                  )}
                </select>
                <p className="analysis-hint">Limites de vento e onda são inicializados pelo perfil de vulnerabilidade do ativo selecionado.</p>
              </div>
              <div className="form-group">
                <label>Valor do Ativo (BRL)</label>
                <input
                  type="number"
                  value={assetValue}
                  onChange={(e) => setAssetValue(Number(e.target.value))}
                  min="0"
                  step="1000000"
                />
              </div>
              {analysisMode === 'onshore' && (
                <>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={includePopulation}
                        onChange={(e) => setIncludePopulation(e.target.checked)}
                      />
                      {' '}Incluir Análise Populacional (LitPop)
                    </label>
                  </div>
                  {includePopulation && (
                    <div className="form-group">
                      <label>Estado</label>
                      <select
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                      >
                        <option value="">Brasil (todos os estados)</option>
                        <option value="Rio de Janeiro">Rio de Janeiro</option>
                        <option value="São Paulo">São Paulo</option>
                        <option value="Espírito Santo">Espírito Santo</option>
                        <option value="Santa Catarina">Santa Catarina</option>
                        <option value="Rio Grande do Sul">Rio Grande do Sul</option>
                        <option value="Bahia">Bahia</option>
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
        <div className="analysis-actions" style={{ marginTop: 16 }}>
          <button
            className="run-analysis-btn"
            onClick={handleRunAnalysis}
            disabled={loading || selectedHazards.length === 0}
          >
            {loading ? 'Analisando...' : 'Executar análise de risco climático'}
          </button>
          {result && (
            <button
              className="run-analysis-btn"
              onClick={handleDownloadClimateRiskPdf}
              style={{ marginTop: 8, background: '#0f766e' }}
            >
              Baixar relatório PDF
            </button>
          )}
        </div>
        {result && (
          <>
            <section className="results-section">
              <h2>
                Resultados da análise - modo {analysisMode === 'offshore' ? 'Offshore' : 'Onshore'}
              </h2>
              {analysisMode === 'offshore' ? (
                <div className="results-grid">
                  <div className="result-card">
                    <h3>Métricas de Risco</h3>
                    <div className="metric">
                      <span className="value">
                        {result && typeof result.aal === 'number'
                          ? result.aal.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })
                          : 'N/A'}
                      </span>
                      <span className="label">AAL (Perda Anual Esperada)</span>
                    </div>
                    <div className="metric">
                      <span className="value">
                        {result && typeof result.pml === 'number'
                          ? result.pml.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })
                          : 'N/A'}
                      </span>
                      <span className="label">PML (Perda Máxima Provável)</span>
                    </div>
                  </div>
                  {result && result.scenario_comparison && typeof result.scenario_comparison.change_percent === 'number' && scenario && scenario.ssp_scenario ? (
                    <div className="result-card">
                      <h3>Comparação de Cenários</h3>
                      <div className="metric">
                        <span className="value">{result.scenario_comparison.change_percent}%</span>
                        <span className="label">Mudança Projetada ({scenario.ssp_scenario})</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="results-grid">
                  <div className="result-card">
                    <h3>Métricas Populacionais</h3>
                    {includePopulation && (
                      <>
                        <div className="metric">
                          <span className="value">
                            {result && typeof result.total_population === 'number'
                              ? result.total_population.toLocaleString('pt-BR')
                              : 'N/A'}
                          </span>
                          <span className="label">População Total</span>
                        </div>
                        <div className="metric">
                          <span className="value">
                            {result && typeof result.affected_population === 'number'
                              ? result.affected_population.toLocaleString('pt-BR')
                              : 'N/A'}
                          </span>
                          <span className="label">População em Risco</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="result-card">
                    <h3>Impacto Econômico</h3>
                    <div className="metric">
                      <span className="value">
                        {result && typeof result.aal === 'number'
                          ? result.aal.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                        }): 'N/A'}
                      </span>
                      <span className="label">AAL</span>
                    </div>
                  </div>
                </div>
              )}
              {result.vulnerability_profile?.hazards && (
                <div className="result-card">
                  <h3>Perfil de Vulnerabilidade Aplicado (CLIMADA)</h3>
                  <p className="analysis-hint" style={{ marginBottom: 10 }}>
                    Perfil do ativo:{' '}
                    <strong>{(result.vulnerability_profile.asset_type || assetType).toUpperCase()}</strong>
                  </p>
                  {Object.entries(result.vulnerability_profile.hazards).map(([hazardKey, hazardData]) => {
                    const intensity = hazardData.curve_definition?.intensity ?? [];
                    const mdd = hazardData.curve_definition?.mdd ?? [];
                    return (
                      <div
                        key={hazardKey}
                        style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #e2e8f0' }}
                      >
                        <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#1e293b' }}>
                          {hazardKey.toUpperCase()} ({hazardData.hazard_code || '-'})
                        </p>
                        <p style={{ margin: '0 0 4px', color: '#334155', fontSize: '0.88rem' }}>
                          Limites: operacional {Number(hazardData.operational_max || 0).toFixed(2)} {hazardData.units || ''} |
                          atenção {Number(hazardData.attention_max || 0).toFixed(2)} {hazardData.units || ''}
                        </p>
                        <p style={{ margin: '0 0 4px', color: '#334155', fontSize: '0.88rem' }}>
                          Fatores de perda: atenção {Number(hazardData.attention_loss_factor || 0).toFixed(2)} | parada{' '}
                          {Number(hazardData.stop_loss_factor || 0).toFixed(2)}
                        </p>
                        <p style={{ margin: 0, color: '#334155', fontSize: '0.86rem' }}>
                          Curva (intensidade → MDD):{' '}
                          {intensity
                            .map((x, idx) => `${Number(x).toFixed(2)}→${Number(mdd[idx] ?? 0).toFixed(2)}`)
                            .join(' | ')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <section className="results-section">
              {result.climada_graphs?.return_period_curve
                && result.climada_graphs.return_period_curve.return_period?.length > 0
                && result.climada_graphs.return_period_curve.impact?.length > 0 && (
                  <div className="result-card climate-chart-card">
                    <h3>CLIMADA - Curva de Retorno (Perda x Return Period)</h3>
                    <Line
                      data={{
                        labels: result.climada_graphs.return_period_curve.return_period.map((value) => `${value} anos`),
                        datasets: [
                          {
                            label: 'Impacto (BRL)',
                            data: result.climada_graphs.return_period_curve.impact,
                            borderColor: '#1e3a5f',
                            backgroundColor: 'rgba(30, 58, 95, 0.16)',
                            fill: true,
                            tension: 0.22,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                      }}
                    />
                  </div>
                )}
              {result.climada_graphs?.loss_exceedance_curve
                && result.climada_graphs.loss_exceedance_curve.loss?.length > 0
                && result.climada_graphs.loss_exceedance_curve.probability?.length > 0 && (
                  <div className="result-card climate-chart-card">
                    <h3>CLIMADA - Curva de Excedência de Perdas</h3>
                    <Line
                      data={{
                        labels: result.climada_graphs.loss_exceedance_curve.probability.map(
                          (value) => `${(value * 100).toFixed(1)}%`,
                        ),
                        datasets: [
                          {
                            label: 'Perda (BRL)',
                            data: result.climada_graphs.loss_exceedance_curve.loss,
                            borderColor: '#0f766e',
                            backgroundColor: 'rgba(15, 118, 110, 0.14)',
                            fill: true,
                            tension: 0.2,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                      }}
                    />
                  </div>
                )}
              {result.climada_graphs?.hazard_aal_bar
                && result.climada_graphs.hazard_aal_bar.labels?.length > 0
                && result.climada_graphs.hazard_aal_bar.values?.length > 0 && (
                  <div className="result-card climate-chart-card">
                    <h3>CLIMADA - AAL por Hazard</h3>
                    <Bar
                      data={{
                        labels: result.climada_graphs.hazard_aal_bar.labels.map((label) => label.toUpperCase()),
                        datasets: [
                          {
                            label: 'AAL (BRL)',
                            data: result.climada_graphs.hazard_aal_bar.values,
                            backgroundColor: ['#1d4ed8', '#0891b2', '#0f766e'],
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                      }}
                    />
                  </div>
                )}
              <div className="info-box">
                <p>
                  <strong>Pipeline CLIMADA ativo:</strong> cálculo de vento/onda com Hazard, Exposures,
                  ImpactFuncSet e ImpactCalc, incluindo curvas de retorno e excedência.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default ClimateRiskPage;