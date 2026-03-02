import React from 'react';
import './Header.css';

interface HeaderProps {
  activePage?: 'map' | 'analysis' | 'assets' | 'maritime-downtime' | 'climate-risk';
  onNavigate?: (page: 'map' | 'analysis' | 'assets' | 'maritime-downtime' | 'climate-risk') => void;
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
            className={`nav-link ${activePage === 'map' ? 'active' : ''}`}
            onClick={() => onNavigate?.('map')}
            style={{ fontWeight: 700 }}
          >
            Visualização
          </button>
          <button
            className={`nav-link ${activePage === 'maritime-downtime' ? 'active' : ''}`}
            onClick={() => onNavigate?.('maritime-downtime')}
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