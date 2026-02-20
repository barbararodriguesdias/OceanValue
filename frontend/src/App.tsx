// Frontend Main App
// OceanValue React Application

import React from 'react';
import './styles/App.css';
import Map from './components/Map/Map';
import SideDrawer, { VisualizationConfig } from './components/SideDrawer/SideDrawer';
import TimelineControl from './components/Timeline/TimelineControl';
import Header from './components/Header/Header';
import AnalysisPage from './pages/AnalysisPage';
import MyAssetsPage, { SavedAsset } from './pages/MyAssetsPage';

const ASSETS_STORAGE_KEY = 'oceanvalue_saved_assets_v1';

function App() {
  const [isDrawerOpen, setIsDrawerOpen] = React.useState<boolean>(false);
  const [currentConfig, setCurrentConfig] = React.useState<VisualizationConfig | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [snapshotTime, setSnapshotTime] = React.useState<string | undefined>(undefined);
  const [activePage, setActivePage] = React.useState<'map' | 'analysis' | 'assets'>('map');
  const [selectedPoint, setSelectedPoint] = React.useState<{ lat: number; lon: number } | null>(null);
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

  const handleVisualize = async (config: VisualizationConfig) => {
    setIsLoading(true);
    try {
      console.log('Visualizando com config:', config);
      setCurrentConfig(config);
      // Só define snapshotTime se ainda não houver uma data selecionada pela Timeline
      setSnapshotTime(prev => prev ?? config.startDate);
      // TODO: Call backend API to load climate data
      // const data = await getSnapshot(variable, time, {
      //   lat_min: config.latMin,
      //   lat_max: config.latMax,
      //   lon_min: config.lonMin,
      //   lon_max: config.lonMax
      // });
      // When data is loaded, it will render heatmap on map
    } catch (error) {
      console.error('Erro ao visualizar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <Header
        onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        activePage={activePage}
        onNavigate={setActivePage}
      />
      
      <div className={`main-container ${activePage === 'analysis' || activePage === 'assets' ? 'content-scroll-mode' : ''}`}>
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
        ) : activePage === 'analysis' ? (
          <AnalysisPage
            selectedPoint={selectedPoint}
            onPointSelect={setSelectedPoint}
            config={currentConfig}
            onSaveAsset={(asset) => setSavedAssets((prev) => [asset, ...prev])}
          />
        ) : (
          <MyAssetsPage
            assets={savedAssets}
            onRemoveAsset={(id) => setSavedAssets((prev) => prev.filter((item) => item.id !== id))}
            onClearAssets={() => setSavedAssets([])}
          />
        )}

        {/* Side Drawer */}
        <SideDrawer
          isOpen={isDrawerOpen}
          onOpen={() => setIsDrawerOpen(true)}
          onClose={() => setIsDrawerOpen(false)}
          onVisualize={handleVisualize}
        />
      </div>
    </div>
  );
}

export default App;
