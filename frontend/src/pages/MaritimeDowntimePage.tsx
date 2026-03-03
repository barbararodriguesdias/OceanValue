/**
 * MaritimeDowntimePage: Análise de Downtime Operacional de Embarcações
 * Propósito 1: Calcular tempo de parada (downtime) de embarcações baseado em janelas operacionais
 */

import { useState } from 'react';
import './MaritimeDowntimePage.css';
import { analysisService, MaritimeDowntimeResult } from '../services/analysisService';

interface VesselData {
  name: string;
  type: string;
  downtimeCostPerHour: number;
}

interface OperationalLimits {
  wind: {
    operational: number;  // knots
    attention: number;
    stop: number;
  };
  wave: {
    operational: number;  // meters
    attention: number;
    stop: number;
  };
  current?: {
    operational: number;  // m/s
    attention: number;
    stop: number;
  };
}

const MaritimeDowntimePage = () => {
  // Localização
  const [lat, setLat] = useState<number>(-23.5);
  const [lon, setLon] = useState<number>(-45.0);
  
  // Dados da embarcação
  const [vesselData, setVesselData] = useState<VesselData>({
    name: '',
    type: 'supply_vessel',
    downtimeCostPerHour: 50000
  });

  // Período de análise
  const [startDate, setStartDate] = useState<string>('2020-01-01');
  const [endDate, setEndDate] = useState<string>('2023-12-31');

  // Limites operacionais
  const [limits, setLimits] = useState<OperationalLimits>({
    wind: { operational: 15, attention: 20, stop: 30 },
    wave: { operational: 2.0, attention: 3.0, stop: 5.0 }
  });

  // Análise de rota
  const [routeMode, setRouteMode] = useState<boolean>(false);
  const [waypoints, setWaypoints] = useState<Array<{lat: number, lon: number}>>([]);

  // Resultados
  const [result, setResult] = useState<MaritimeDowntimeResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Análise de rota será implementada na próxima fase

  const handleRunAnalysis = async () => {
    setLoading(true);
    try {
      const data = await analysisService.runMaritimeDowntime({
        vessel_name: vesselData.name,
        vessel_type: vesselData.type,
        downtime_cost_per_hour: vesselData.downtimeCostPerHour,
        lat: routeMode ? undefined : lat,
        lon: routeMode ? undefined : lon,
        waypoints: routeMode ? waypoints : undefined,
        start_time: startDate,
        end_time: endDate,
        wind_limits: limits.wind,
        wave_limits: limits.wave,
        current_limits: limits.current,
      });
      setResult(data);
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao executar análise de downtime marítimo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="maritime-downtime-page">
      <header className="page-header">
        <h1>Análise de Downtime Marítimo</h1>
        <p className="page-subtitle">
          Calcule o tempo de parada operacional de embarcações baseado em condições climáticas e janelas operacionais
        </p>
      </header>

      <div className="page-content">
        {/* Localização */}
        <section className="map-section">
          <div className="location-input">
            <h3>Localização da Embarcação</h3>
            {!routeMode ? (
              <div className="form-row">
                <div className="form-group">
                  <label>Latitude</label>
                  <input 
                    type="number"
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    step="0.0001"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input 
                    type="number"
                    value={lon}
                    onChange={(e) => setLon(Number(e.target.value))}
                    step="0.0001"
                  />
                </div>
              </div>
            ) : (
              <div className="route-waypoints">
                <p>Waypoints da rota: {waypoints.length}</p>
                <button onClick={() => setWaypoints([])} disabled={waypoints.length === 0}>
                  Limpar rota
                </button>
              </div>
            )}
            
            <div className="mode-toggle">
              <button 
                className={!routeMode ? 'active' : ''}
                onClick={() => setRouteMode(false)}
              >
                Ponto fixo
              </button>
              <button 
                className={routeMode ? 'active' : ''}
                onClick={() => setRouteMode(true)}
              >
                Análise de rota (em desenvolvimento)
              </button>
            </div>
          </div>
        </section>

        {/* Formulário */}
        <section className="form-section">
          <div className="form-card">
            <h2>Dados da Embarcação</h2>
            
            <div className="form-group">
              <label>Nome da Embarcação</label>
              <input 
                type="text"
                value={vesselData.name}
                onChange={(e) => setVesselData({...vesselData, name: e.target.value})}
                placeholder="Ex: PSV Ocean Explorer"
              />
            </div>

            <div className="form-group">
              <label>Tipo de Embarcação</label>
              <select 
                value={vesselData.type}
                onChange={(e) => setVesselData({...vesselData, type: e.target.value})}
              >
                <option value="supply_vessel">PSV - Plataform Supply Vessel</option>
                <option value="anchor_handler">AHTS - Anchor Handling Tug Supply</option>
                <option value="rov_vessel">Embarcação ROV</option>
                <option value="dive_support">Navio de Apoio de Mergulho</option>
                <option value="construction">Embarcação de Construção</option>
                <option value="cable_layer">Navio de Cabos</option>
                <option value="crew_boat">Crew Boat</option>
              </select>
            </div>

            <div className="form-group">
              <label>Custo de Downtime (BRL/hora)</label>
              <input 
                type="number"
                value={vesselData.downtimeCostPerHour}
                onChange={(e) => setVesselData({...vesselData, downtimeCostPerHour: Number(e.target.value)})}
                min="0"
                step="1000"
              />
            </div>
          </div>

          <div className="form-card">
            <h2>Período de Análise</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>Data Inicial</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Data Final</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-card">
            <h2>Limites Operacionais</h2>
            
            <div className="limits-group">
              <h3>Vento (knots)</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Operacional</label>
                  <input 
                    type="number"
                    value={limits.wind.operational}
                    onChange={(e) => setLimits({
                      ...limits,
                      wind: {...limits.wind, operational: Number(e.target.value)}
                    })}
                    min="0"
                    step="1"
                  />
                </div>
                <div className="form-group">
                  <label>Atenção</label>
                  <input 
                    type="number"
                    value={limits.wind.attention}
                    onChange={(e) => setLimits({
                      ...limits,
                      wind: {...limits.wind, attention: Number(e.target.value)}
                    })}
                    min="0"
                    step="1"
                  />
                </div>
                <div className="form-group">
                  <label>Parada</label>
                  <input 
                    type="number"
                    value={limits.wind.stop}
                    onChange={(e) => setLimits({
                      ...limits,
                      wind: {...limits.wind, stop: Number(e.target.value)}
                    })}
                    min="0"
                    step="1"
                  />
                </div>
              </div>
            </div>

            <div className="limits-group">
              <h3>Onda (metros)</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Operacional</label>
                  <input 
                    type="number"
                    value={limits.wave.operational}
                    onChange={(e) => setLimits({
                      ...limits,
                      wave: {...limits.wave, operational: Number(e.target.value)}
                    })}
                    min="0"
                    step="0.5"
                  />
                </div>
                <div className="form-group">
                  <label>Atenção</label>
                  <input 
                    type="number"
                    value={limits.wave.attention}
                    onChange={(e) => setLimits({
                      ...limits,
                      wave: {...limits.wave, attention: Number(e.target.value)}
                    })}
                    min="0"
                    step="0.5"
                  />
                </div>
                <div className="form-group">
                  <label>Parada</label>
                  <input 
                    type="number"
                    value={limits.wave.stop}
                    onChange={(e) => setLimits({
                      ...limits,
                      wave: {...limits.wave, stop: Number(e.target.value)}
                    })}
                    min="0"
                    step="0.5"
                  />
                </div>
              </div>
            </div>
          </div>

          <button 
            className="run-analysis-btn"
            onClick={handleRunAnalysis}
            disabled={loading || !vesselData.name}
          >
            {loading ? 'Analisando...' : 'EXECUTAR'}
          </button>
        </section>

        {/* Resultados */}
        {result && (
          <section className="results-section">
            <h2>Resultados da análise</h2>
            
            <div className="results-grid">
              <div className="result-card">
                <h3>Janela Operacional</h3>
                <div className="metric">
                  <span className="value">{result.operational_hours || 0}h</span>
                  <span className="label">Horas Operacionais</span>
                </div>
                <div className="metric">
                  <span className="value">{result.attention_hours || 0}h</span>
                  <span className="label">Horas em Atenção</span>
                </div>
                <div className="metric">
                  <span className="value">{result.stop_hours || 0}h</span>
                  <span className="label">Horas de Parada</span>
                </div>
              </div>

              <div className="result-card">
                <h3>Impacto Financeiro</h3>
                <div className="metric">
                  <span className="value">
                    {(result.total_downtime_cost || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })}
                  </span>
                  <span className="label">Custo Total de Downtime</span>
                </div>
                <div className="metric">
                  <span className="value">
                    {(result.aal || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })}
                  </span>
                  <span className="label">AAL (Perda Anual Esperada)</span>
                </div>
              </div>
            </div>

            <div className="info-box">
              <p>
                <strong>Em desenvolvimento:</strong> Integração completa com CLIMADA para análises avançadas,
                incluindo curvas de probabilidade de atraso e otimização de rotas.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default MaritimeDowntimePage;
