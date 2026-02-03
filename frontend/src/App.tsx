// Frontend Main App
// OceanValue React Application

import React from 'react';
import './App.css';
import Map from './components/Map/Map';
import SideDrawer from './components/SideDrawer/SideDrawer';
import Timeline from './components/Timeline/Timeline';
import Header from './components/Header/Header';

function App() {
  const [hazardType, setHazardType] = React.useState<string>('wind');
  const [isDrawerOpen, setIsDrawerOpen] = React.useState<boolean>(false);
  const [filters, setFilters] = React.useState<any>({});
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  const handleHazardSelect = (hazard: string) => {
    setHazardType(hazard);
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleVisualize = async () => {
    setIsLoading(true);
    try {
      // TODO: Call backend API to generate visualization
      console.log('Visualizing with filters:', filters);
    } catch (error) {
      console.error('Error visualizing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      // TODO: Call backend API to generate report
      console.log('Generating report with filters:', filters);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <Header />
      
      <div className="main-container">
        {/* Main Map */}
        <div className="map-container">
          <Map hazardType={hazardType} filters={filters} />
          
          {/* Timeline Controls */}
          <Timeline />
        </div>

        {/* Side Drawer */}
        <SideDrawer
          isOpen={isDrawerOpen}
          onOpen={() => setIsDrawerOpen(true)}
          onClose={() => setIsDrawerOpen(false)}
          hazardType={hazardType}
          onHazardSelect={handleHazardSelect}
          onFilterChange={handleFilterChange}
          onVisualize={handleVisualize}
          onGenerateReport={handleGenerateReport}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

export default App;
