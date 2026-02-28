import React from 'react';
import './Header.css';

interface HeaderProps {
  activePage?: 'climate-risk' | 'maritime-downtime' | 'assets';
  onNavigate?: (page: 'climate-risk' | 'maritime-downtime' | 'assets') => void;
}

const Header: React.FC<HeaderProps> = ({ activePage, onNavigate }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo-text">
            <h1 className="logo">OceanValue</h1>
            <p className="tagline">Climate Risk Pricing for Maritime Operations</p>
          </div>
        </div>
        <nav className="navigation">
          <button
            className={`nav-link ${activePage === 'climate-risk' ? 'active' : ''}`}
            onClick={() => onNavigate?.('climate-risk')}
            title="Análise de Risco Climático Regional"
          >
            Risco Climático
          </button>
          <button
            className={`nav-link ${activePage === 'maritime-downtime' ? 'active' : ''}`}
            onClick={() => onNavigate?.('maritime-downtime')}
            title="Análise de Downtime Operacional de Embarcações"
          >
            Downtime Marítimo
          </button>
          <button
            className={`nav-link ${activePage === 'assets' ? 'active' : ''}`}
            onClick={() => onNavigate?.('assets')}
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