// Frontend Main App
// OceanValue React Application

import React from 'react';
import './styles/App.css';
import Map from './components/Map/Map';
import TimelineControl from './components/Timeline/TimelineControl';
import Header from './components/Header/Header';
import MyAssetsPage, { SavedAsset } from './pages/MyAssetsPage';
import MaritimeDowntimePage from './pages/MaritimeDowntimePage';
import ClimateRiskPage from './pages/ClimateRiskPage';

interface VisualizationConfig {
  riskType: 'wind' | 'wave';
  startDate: string;
  endDate: string;
  layers: {
    camposProducao: boolean;
    blocosExploratorios: boolean;
    baciaSantos: boolean;
    baciaCampos: boolean;
  };
  thresholds?: {
    wind?: { operationalMax: number; attentionMax: number };
    wave?: { operationalMax: number; attentionMax: number };
  };
  latMin?: number;
  latMax?: number;
  lonMin?: number;
  lonMax?: number;
}

const ASSETS_STORAGE_KEY = 'oceanvalue_saved_assets_v1';

function App() {
  const [currentConfig, setCurrentConfig] = React.useState<VisualizationConfig | null>(null);
  const [snapshotTime, setSnapshotTime] = React.useState<string | undefined>(undefined);
  const [activePage, setActivePage] = React.useState<'map' | 'analysis' | 'assets' | 'maritime-downtime' | 'climate-risk'>('map');
  const [savedAssets, setSavedAssets] = React.useState<SavedAsset[]>([]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(ASSETS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedAsset[];
      if (Array.isArray(parsed)) {
        setSavedAssets(parsed);
      }
    } catch (error) {
      console.error('Erro ao carregar ativos salvos:', error);
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(savedAssets));
  }, [savedAssets]);

  return (
    <div className="App">
      <Header
        activePage={activePage}
        onNavigate={setActivePage}
      />
      
      <div className={`main-container ${activePage !== 'map' ? 'content-scroll-mode' : ''}`}>
        {activePage === 'map' ? (
          <div className="map-container">
            <Map 
              hazardType={currentConfig?.riskType || 'wind'} 
              filters={{
                layers: currentConfig?.layers || {
                  camposProducao: false,
                  blocosExploratorios: false,
                  baciaSantos: false,
                  baciaCampos: false
                }
              }}
              operationalMax={currentConfig?.thresholds?.[currentConfig?.riskType || 'wind']?.operationalMax}
              attentionMax={currentConfig?.thresholds?.[currentConfig?.riskType || 'wind']?.attentionMax}
              snapshotTime={snapshotTime ?? currentConfig?.startDate}
              latMin={currentConfig?.latMin}
              latMax={currentConfig?.latMax}
              lonMin={currentConfig?.lonMin}
              lonMax={currentConfig?.lonMax}
              hideLayers={!currentConfig}
            />
            
            {currentConfig && (
              <TimelineControl
                startDate={currentConfig.startDate}
                endDate={currentConfig.endDate}
                operationalMax={currentConfig.thresholds?.[currentConfig.riskType]?.operationalMax}
                attentionMax={currentConfig.thresholds?.[currentConfig.riskType]?.attentionMax}
                riskType={currentConfig.riskType}
                onTimeChange={setSnapshotTime}
              />
            )}
          </div>
        ) : activePage === 'maritime-downtime' ? (
          <MaritimeDowntimePage />
        ) : activePage === 'climate-risk' ? (
          <ClimateRiskPage />
        ) : (
          <MyAssetsPage
            assets={savedAssets}
            onRemoveAsset={(id) => setSavedAssets((prev) => prev.filter((item) => item.id !== id))}
            onClearAssets={() => setSavedAssets([])}
          />
        )}
      </div>
    </div>
  );
}

export default App;
