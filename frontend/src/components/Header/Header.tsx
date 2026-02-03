// Header Component
// OceanValue Navigation Header

import React from 'react';
import './Header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo-section">
          <h1 className="logo">🌊 OceanValue</h1>
          <p className="tagline">Climate Risk Pricing for Maritime Operations</p>
        </div>
        
        <nav className="navigation">
          <a href="#" className="nav-link">Análise</a>
          <a href="#" className="nav-link">Documentação</a>
          <a href="#" className="nav-link">Sobre</a>
        </nav>

        <div className="user-section">
          <button className="btn-login">Entrar</button>
        </div>
      </div>
    </header>
  );
};

export default Header;
