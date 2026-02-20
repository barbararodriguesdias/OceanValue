// Modern SideDrawer with Risk Analysis Filters
// OceanValue Platform

import React, { useState, useEffect } from 'react';
import './SideDrawer.css';

interface SideDrawerProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onVisualize: (config: VisualizationConfig) => void;
}

export interface VisualizationConfig {
  riskType: string;
  region: string;
  startDate: string;
  endDate: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  operationalMax: number;
  attentionMax: number;
  thresholds: Record<string, { operationalMax: number; attentionMax: number; unit: string }>;
  layers: {
    baciaSantos: boolean;
    baciaCampos: boolean;
    blocosExploratorios: boolean;
    camposProducao: boolean;
  };
}

const RISK_TYPES = [
  { id: 'wind', label: 'Vento', icon: '💨' },
  { id: 'wave', label: 'Onda', icon: '🌊' },
  { id: 'flood', label: 'Inundação', icon: '💧' },
  { id: 'heatwave', label: 'Ondas Térmicas', icon: '🔥' },
  { id: 'temperature', label: 'Temp. Superfície', icon: '🌡️' },
  { id: 'current', label: 'Corrente', icon: '➡️' }
];

const REGIONS = [
  {
    id: 'geral',
    label: 'Geral',
    bounds: { latMin: -30.271, latMax: -17.186, lonMin: -50.264, lonMax: -35.293 }
  },
  {
    id: 'bacia-santos',
    label: 'Bacia de Santos',
    bounds: { latMin: -28.0, latMax: -23.0, lonMin: -48.0, lonMax: -42.0 }
  },
  {
    id: 'bacia-campos',
    label: 'Bacia de Campos',
    bounds: { latMin: -23.5, latMax: -20.5, lonMin: -42.0, lonMax: -39.0 }
  },
  {
    id: 'blocos',
    label: 'Blocos Exploratórios',
    bounds: { latMin: -25.0, latMax: -20.0, lonMin: -45.0, lonMax: -39.0 }
  },
  {
    id: 'campos-producao',
    label: 'Campos de Produção',
    bounds: { latMin: -25.0, latMax: -20.0, lonMin: -45.0, lonMax: -39.0 }
  }
];

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onOpen,
  onClose,
  onVisualize,
}) => {
  const [riskType, setRiskType] = useState('wind');
  const [region, setRegion] = useState('geral');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');

  // Spatial bounds
  const [latMin, setLatMin] = useState(-30.271);
  const [latMax, setLatMax] = useState(-17.186);
  const [lonMin, setLonMin] = useState(-50.264);
  const [lonMax, setLonMax] = useState(-35.293);

  const [riskThresholds, setRiskThresholds] = useState<Record<string, { operationalMax: number; attentionMax: number; unit: string }>>({
    wind: { operationalMax: 15, attentionMax: 20, unit: 'nos' },
    wave: { operationalMax: 2, attentionMax: 4, unit: 'm' },
    current: { operationalMax: 1, attentionMax: 2, unit: 'm/s' },
    temperature: { operationalMax: 30, attentionMax: 35, unit: '°C' },
    flood: { operationalMax: 1, attentionMax: 2, unit: 'm' },
    heatwave: { operationalMax: 3, attentionMax: 7, unit: 'dias' }
  });

  // Layers
  const [layers, setLayers] = useState({
    baciaSantos: false,
    baciaCampos: false,
    blocosExploratorios: false,
    camposProducao: false
  });

  // Update bounds when region changes
  useEffect(() => {
    const selectedRegion = REGIONS.find(r => r.id === region);
    if (selectedRegion) {
      setLatMin(selectedRegion.bounds.latMin);
      setLatMax(selectedRegion.bounds.latMax);
      setLonMin(selectedRegion.bounds.lonMin);
      setLonMax(selectedRegion.bounds.lonMax);
    }
  }, [region]);

  const updateThreshold = (
    riskId: string,
    type: 'operationalMax' | 'attentionMax',
    value: number,
  ) => {
    setRiskThresholds(prev => ({
      ...prev,
      [riskId]: { ...prev[riskId as keyof typeof prev], [type]: value }
    }));
  };

  const handleVisualize = () => {
    const currentLimits = riskThresholds[riskType as keyof typeof riskThresholds];
    const config: VisualizationConfig = {
      riskType,
      region,
      startDate,
      endDate,
      latMin,
      latMax,
      lonMin,
      lonMax,
      operationalMax: currentLimits.operationalMax,
      attentionMax: currentLimits.attentionMax,
      thresholds: riskThresholds,
      layers
    };
    onVisualize(config);
  };

  return (
    <>
      {isOpen && <div className="drawer-overlay" onClick={onClose} />}
      
      <div className={`side-drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2>Análise de Risco</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-content">
          {/* Tipo de Risco */}
          <section className="filter-section">
            <h3>Tipo de Risco</h3>
            <div className="risk-types-grid">
              {RISK_TYPES.map(risk => (
                <button
                  key={risk.id}
                  className={`risk-hex ${riskType === risk.id ? 'active' : ''}`}
                  onClick={() => setRiskType(risk.id)}
                >
                  <span className="risk-icon">{risk.icon}</span>
                  <span className="risk-label">{risk.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Região */}
          <section className="filter-section">
            <h3>Região</h3>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="region-select">
              {REGIONS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <div className="bounds-compact">
              <input type="number" value={latMin} onChange={(e) => setLatMin(parseFloat(e.target.value))} step="0.001" placeholder="Lat Min" />
              <input type="number" value={latMax} onChange={(e) => setLatMax(parseFloat(e.target.value))} step="0.001" placeholder="Lat Max" />
              <input type="number" value={lonMin} onChange={(e) => setLonMin(parseFloat(e.target.value))} step="0.001" placeholder="Lon Min" />
              <input type="number" value={lonMax} onChange={(e) => setLonMax(parseFloat(e.target.value))} step="0.001" placeholder="Lon Max" />
            </div>
          </section>

          {/* Período de Análise */}
          <section className="filter-section">
            <h3>Período de Análise</h3>
            <div className="input-group">
              <label>Data Inicial</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Data Final</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </section>

          {/* Limites Operacionais por Risco */}
          <section className="filter-section">
            <h3>Limites Operacionais</h3>
            <div className="var-limits-compact">
              {RISK_TYPES.map(risk => {
                const limits = riskThresholds[risk.id as keyof typeof riskThresholds];
                return (
                  <div key={risk.id} className="var-limit-row">
                    <span className="var-icon">{risk.icon}</span>
                    <span className="var-name">{risk.label}</span>
                    <input
                      type="number"
                      value={limits.operationalMax}
                      onChange={(e) => updateThreshold(risk.id, 'operationalMax', parseFloat(e.target.value))}
                      step="0.1"
                      placeholder="Operacional <="
                      className="var-input-min"
                    />
                    <span className="separator">—</span>
                    <input
                      type="number"
                      value={limits.attentionMax}
                      onChange={(e) => updateThreshold(risk.id, 'attentionMax', parseFloat(e.target.value))}
                      step="0.1"
                      placeholder="Atenção <="
                      className="var-input-max"
                    />
                    <span className="var-unit">{limits.unit}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Camadas */}
          <section className="filter-section">
            <h3>Camadas</h3>
            <div className="layers-list">
              <label className="layer-item">
                <input
                  type="checkbox"
                  checked={layers.baciaSantos}
                  onChange={(e) => setLayers({ ...layers, baciaSantos: e.target.checked })}
                />
                <span>Bacia de Santos</span>
              </label>
              <label className="layer-item">
                <input
                  type="checkbox"
                  checked={layers.baciaCampos}
                  onChange={(e) => setLayers({ ...layers, baciaCampos: e.target.checked })}
                />
                <span>Bacia de Campos</span>
              </label>
              <label className="layer-item">
                <input
                  type="checkbox"
                  checked={layers.blocosExploratorios}
                  onChange={(e) => setLayers({ ...layers, blocosExploratorios: e.target.checked })}
                />
                <span>Blocos Exploratórios</span>
              </label>
              <label className="layer-item">
                <input
                  type="checkbox"
                  checked={layers.camposProducao}
                  onChange={(e) => setLayers({ ...layers, camposProducao: e.target.checked })}
                />
                <span>Campos de Produção</span>
              </label>
            </div>
          </section>

          {/* Visualizar Button */}
          <button className="visualize-btn" onClick={handleVisualize}>
            <span className="btn-icon">📊</span>
            <span>Visualizar</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default SideDrawer;
