// Side Drawer Component
// OceanValue Filter and Analysis Controls

import React, { useState } from 'react';
import './SideDrawer.css';

interface SideDrawerProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  hazardType: string;
  onHazardSelect: (hazard: string) => void;
  onFilterChange: (filters: any) => void;
  onVisualize: () => void;
  onGenerateReport: () => void;
  isLoading: boolean;
}

const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onOpen,
  onClose,
  hazardType,
  onHazardSelect,
  onFilterChange,
  onVisualize,
  onGenerateReport,
  isLoading,
}) => {
  const [selectedRegion, setSelectedRegion] = useState('');
  const [lat, setLat] = useState('-23.96');
  const [lon, setLon] = useState('-46.30');
  const [startDate, setStartDate] = useState('2015-01-01');
  const [endDate, setEndDate] = useState('2023-12-31');
  const [windThreshold, setWindThreshold] = useState(25);
  const [waveThreshold, setWaveThreshold] = useState(2.5);
  const [precipThreshold, setPrecipThreshold] = useState(50);
  const [tempThreshold, setTempThreshold] = useState(32);

  const handleApplyFilters = () => {
    const filters = {
      hazardType,
      region: { lat: parseFloat(lat), lon: parseFloat(lon), name: selectedRegion },
      period: { start: startDate, end: endDate },
      thresholds: {
        wind: windThreshold,
        wave: waveThreshold,
        precip: precipThreshold,
        temp: tempThreshold,
      },
    };
    
    onFilterChange(filters);
    onVisualize();
  };

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <button className="drawer-toggle" onClick={onOpen}>
          ☰ Filtros
        </button>
      )}

      {/* Drawer Overlay */}
      {isOpen && <div className="drawer-overlay" onClick={onClose}></div>}

      {/* Drawer Panel */}
      <div className={`side-drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2>Filtros de Análise</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-content">
          {/* Hazard Selection */}
          <section className="filter-section">
            <h3>Tipo de Risco</h3>
            <div className="hazard-options">
              {[
                { id: 'wind', label: 'Vento' },
                { id: 'wave', label: 'Onda' },
                { id: 'flood', label: 'Inundação' },
                { id: 'heatwave', label: 'Ondas Térmicas' },
                { id: 'sst', label: 'Temp. Superficial do Mar' },
                { id: 'current', label: 'Corrente' },
              ].map((hazard) => (
                <label key={hazard.id} className="radio-option">
                  <input
                    type="radio"
                    name="hazard"
                    value={hazard.id}
                    checked={hazardType === hazard.id}
                    onChange={(e) => onHazardSelect(e.target.value)}
                  />
                  <span>{hazard.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Region Selection */}
          <section className="filter-section">
            <h3>Região</h3>
            <select 
              value={selectedRegion} 
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="form-select"
            >
              <option value="">-- Selecione Região --</option>
              <option value="santos">Bacia de Santos</option>
              <option value="campos">Bacia de Campos</option>
              <option value="espirito_santo">Bacia do Espírito Santo</option>
              <option value="rio_de_janeiro">Rio de Janeiro</option>
              <option value="bahia">Bahia</option>
            </select>
            
            <div className="coordinates">
              <label>
                Latitude:
                <input type="number" value={lat} onChange={(e) => setLat(e.target.value)} step="0.01" />
              </label>
              <label>
                Longitude:
                <input type="number" value={lon} onChange={(e) => setLon(e.target.value)} step="0.01" />
              </label>
            </div>

            <button className="btn-draw">📍 Desenhar Região no Mapa</button>
          </section>

          {/* Period Selection */}
          <section className="filter-section">
            <h3>Período de Análise</h3>
            <label>
              Data Inicial:
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label>
              Data Final:
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <div className="period-presets">
              <button className="preset" onClick={() => { setStartDate('2023-01-01'); setEndDate('2023-12-31'); }}>1 Ano</button>
              <button className="preset" onClick={() => { setStartDate('2019-01-01'); setEndDate('2023-12-31'); }}>5 Anos</button>
              <button className="preset" onClick={() => { setStartDate('2015-01-01'); setEndDate('2023-12-31'); }}>Todo</button>
            </div>
          </section>

          {/* Thresholds */}
          <section className="filter-section">
            <h3>Limites de Variáveis</h3>
            
            {(hazardType === 'wind' || hazardType === '') && (
              <label>
                Limite Vento (knots):
                <input 
                  type="range" 
                  min="0" 
                  max="50" 
                  value={windThreshold}
                  onChange={(e) => setWindThreshold(parseFloat(e.target.value))}
                />
                <span>{windThreshold.toFixed(1)}</span>
              </label>
            )}

            {(hazardType === 'wave' || hazardType === '') && (
              <label>
                Limite Onda (m):
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  step="0.1"
                  value={waveThreshold}
                  onChange={(e) => setWaveThreshold(parseFloat(e.target.value))}
                />
                <span>{waveThreshold.toFixed(1)}</span>
              </label>
            )}

            {(hazardType === 'flood' || hazardType === '') && (
              <label>
                Limite Precipitação (mm):
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  step="5"
                  value={precipThreshold}
                  onChange={(e) => setPrecipThreshold(parseFloat(e.target.value))}
                />
                <span>{precipThreshold.toFixed(0)}</span>
              </label>
            )}

            {(hazardType === 'heatwave' || hazardType === '') && (
              <label>
                Limite Temperatura (°C):
                <input 
                  type="range" 
                  min="20" 
                  max="45" 
                  step="0.1"
                  value={tempThreshold}
                  onChange={(e) => setTempThreshold(parseFloat(e.target.value))}
                />
                <span>{tempThreshold.toFixed(1)}</span>
              </label>
            )}
          </section>

          {/* Data Upload */}
          <section className="filter-section">
            <h3>Dados Personalizados</h3>
            <label className="file-upload">
              <input type="file" accept=".nc,.tif,.h5" />
              <span>📁 Arrastar arquivo ou clique aqui</span>
            </label>
            <p className="file-help">Formatos: .nc, .tif, .h5</p>
          </section>
        </div>

        {/* Action Buttons */}
        <div className="drawer-footer">
          <button 
            className="btn btn-primary" 
            onClick={handleApplyFilters}
            disabled={isLoading}
          >
            {isLoading ? '⏳ Processando...' : '🔍 Visualizar'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={onGenerateReport}
            disabled={isLoading}
          >
            {isLoading ? '⏳ Gerando...' : '📄 Gerar Relatório'}
          </button>
          <button className="btn btn-outline" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </>
  );
};

export default SideDrawer;
