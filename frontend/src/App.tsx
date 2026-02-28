// Frontend Main App
// OceanValue React Application

import React from 'react';
import './styles/App.css';
// import Map from './components/Map/Map';
// import SideDrawer, { VisualizationConfig } from './components/SideDrawer/SideDrawer';
// import TimelineControl from './components/Timeline/TimelineControl';
import Header from './components/Header/Header';
import MyAssetsPage, { SavedAsset } from './pages/MyAssetsPage';
import MaritimeDowntimePage from './pages/MaritimeDowntimePage';
import ClimateRiskPage from './pages/ClimateRiskPage';

const ASSETS_STORAGE_KEY = 'oceanvalue_saved_assets_v1';

function App() {
  const [activePage, setActivePage] = React.useState<'climate-risk' | 'maritime-downtime' | 'assets'>('climate-risk');
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
      <Header activePage={activePage} onNavigate={setActivePage} />
      <div className="main-container content-scroll-mode">
        {activePage === 'climate-risk' && <ClimateRiskPage />}
        {activePage === 'maritime-downtime' && <MaritimeDowntimePage />}
        {activePage === 'assets' && (
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
