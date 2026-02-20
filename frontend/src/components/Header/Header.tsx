import React from 'react';
import './Header.css';

interface HeaderProps {
  onToggleDrawer?: () => void;
  activePage?: 'map' | 'analysis' | 'assets';
  onNavigate?: (page: 'map' | 'analysis' | 'assets') => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleDrawer, activePage, onNavigate }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo-section">
          <button
            className="menu-toggle-btn"
            onClick={onToggleDrawer}
            title="Toggle Menu"
            aria-label="Toggle Menu"
          >
            &#9776;
          </button>
          <img
            src="/oceanpact-logo.png"
            alt="OceanPact Logo"
            className="logo-image"
          />
          <div className="logo-text">
            <h1 className="logo">OceanValue</h1>
            <p className="tagline">Climate Risk Pricing for Maritime Operations</p>
          </div>
        </div>

        <nav className="navigation">
          <button
            className={`nav-link ${activePage === 'map' ? 'active' : ''}`}
            onClick={() => onNavigate?.('map')}
          >
            Visualizacao
          </button>
          <button
            className={`nav-link ${activePage === 'analysis' ? 'active' : ''}`}
            onClick={() => onNavigate?.('analysis')}
          >
            Analise
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