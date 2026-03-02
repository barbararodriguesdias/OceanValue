import React from 'react';
import './Header.css';

interface HeaderProps {
<<<<<<< HEAD
  activePage?: 'map' | 'analysis' | 'assets' | 'maritime-downtime' | 'climate-risk';
  onNavigate?: (page: 'map' | 'analysis' | 'assets' | 'maritime-downtime' | 'climate-risk') => void;
=======
  activePage?: 'climate-risk' | 'maritime-downtime' | 'assets';
  onNavigate?: (page: 'climate-risk' | 'maritime-downtime' | 'assets') => void;
>>>>>>> 679b437a955223e69a5f4efba330a4210e250337
}

const Header: React.FC<HeaderProps> = ({ activePage, onNavigate }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo-section">
          <img src="/oceanpact-logo.png" alt="OceanPact Logo" className="logo-image" style={{ marginRight: '18px', height: '40px' }} />
          <div className="logo-text">
            <h1 className="logo">OceanValue</h1>
            <p className="tagline">Climate Risk Pricing for Maritime Operations</p>
          </div>
        </div>
        <nav className="navigation">
          <button
<<<<<<< HEAD
            className={`nav-link ${activePage === 'map' ? 'active' : ''}`}
            onClick={() => onNavigate?.('map')}
            style={{ fontWeight: 700 }}
          >
            Visualização
=======
            className={`nav-link ${activePage === 'climate-risk' ? 'active' : ''}`}
            onClick={() => onNavigate?.('climate-risk')}
            title="Análise de Risco Climático Regional"
            style={{ fontWeight: 700 }}
          >
            Risco Climático
>>>>>>> 679b437a955223e69a5f4efba330a4210e250337
          </button>
          <button
            className={`nav-link ${activePage === 'maritime-downtime' ? 'active' : ''}`}
            onClick={() => onNavigate?.('maritime-downtime')}
<<<<<<< HEAD
            title="Análise de Downtime Operacional de Embarcações"
            style={{ fontWeight: 700 }}
          >
            Downtime Marítimo
          </button>
          <button
            className={`nav-link ${activePage === 'climate-risk' ? 'active' : ''}`}
            onClick={() => onNavigate?.('climate-risk')}
            title="Análise de Risco Climático Regional"
            style={{ fontWeight: 700 }}
          >
            Risco Climático
=======
            title="Downtime Marítimo"
            style={{ fontWeight: 700 }}
          >
            Downtime Marítimo
>>>>>>> 679b437a955223e69a5f4efba330a4210e250337
          </button>
          <button
            className={`nav-link ${activePage === 'assets' ? 'active' : ''}`}
            onClick={() => onNavigate?.('assets')}
            style={{ fontWeight: 700 }}
          >
            Meus Ativos
          </button>
        </nav>
        <div className="user-section">
          <button className="btn-login">Entrar</button>
        </div>
      </div>
    </header>
  );
};

export default Header;