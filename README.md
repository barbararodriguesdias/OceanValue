# OceanValue - Climate Risk Pricing Platform for Maritime Operations

Plataforma de precificação de risco climático para operações marítimas, portuárias e offshore.

## 🌊 Visão Geral

**OceanValue** é uma ferramenta integrada que combina a poderosa biblioteca CLIMADA com análise geoespacial interativa para quantificar riscos climáticos em operações marítimas e portuárias.

### Funcionalidades Principais

- 🗺️ **Mapa Interativo**: Visualização de risco em tempo real, centralizada na costa brasileira (Santos, Campos)
- ⏱️ **Animação Temporal**: Barra de timeline para análise de série histórica
- 🎯 **Seleção de Risco**: Vento, Onda, Inundação, Conforto Térmico, SST, Correntes
- 📊 **Filtros Avançados**: Período, limites de variáveis, regiões (desenho no mapa)
- 📁 **Upload de Dados**: Suporte para arquivos NetCDF (.nc) personalizados
- 💰 **Relatório de Precificação**: PDF com análise de custos operacionais e cenários
- 📈 **Análise de Cenários**: Flutuação de gastos com mudanças climáticas

## 📁 Estrutura de Pastas

```
OceanValue/
├── backend/                      # API FastAPI + processamento CLIMADA
│   ├── app/
│   │   ├── main.py              # Aplicação FastAPI principal
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic schemas (validação)
│   │   ├── services/            # Lógica de negócio
│   │   │   ├── climada_service.py
│   │   │   ├── hazard_service.py
│   │   │   ├── wind_analyzer.py
│   │   │   ├── wave_analyzer.py
│   │   │   ├── flood_analyzer.py
│   │   │   └── heatwave_analyzer.py
│   │   ├── routers/             # Endpoints da API
│   │   │   ├── hazards.py
│   │   │   ├── data.py
│   │   │   ├── analysis.py
│   │   │   └── reports.py
│   │   ├── tasks/               # Celery tasks (processamento assíncrono)
│   │   ├── utils/               # Utilitários
│   │   └── database.py          # Configuração banco de dados
│   ├── requirements.txt         # Dependências Python
│   ├── .env.example            # Variáveis de ambiente exemplo
│   └── Dockerfile              # Container backend
│
├── frontend/                     # React + Mapbox GL JS
│   ├── src/
│   │   ├── components/          # Componentes React reutilizáveis
│   │   │   ├── Map/            # Mapa principal
│   │   │   ├── Timeline/       # Controle temporal
│   │   │   ├── SideDrawer/     # Painel deslizante lateral
│   │   │   ├── LayerControl/   # Controle de camadas
│   │   │   ├── Reports/        # Geração de relatórios
│   │   │   └── Upload/         # Upload de dados
│   │   ├── pages/              # Páginas principais
│   │   ├── services/           # Comunicação com API
│   │   ├── hooks/              # Custom hooks
│   │   ├── utils/              # Utilitários frontend
│   │   ├── styles/             # CSS/SCSS global
│   │   ├── assets/             # Imagens, ícones
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile              # Container frontend
│
├── data/                        # Dados e cache
│   ├── raw/                    # Dados brutos baixados
│   ├── processed/              # Dados processados
│   └── zarr_cache/            # Cache Zarr para performance
│
├── docs/                        # Documentação técnica
│   ├── API.md                  # Especificação API
│   ├── ARCHITECTURE.md         # Arquitetura do sistema
│   ├── CLIMADA_GUIDE.md        # Guia CLIMADA
│   ├── DEPLOYMENT.md           # Deploy e infraestrutura
│   └── USER_GUIDE.md           # Guia do usuário
│
├── tests/                       # Testes
│   ├── backend/                # Testes unitários backend
│   └── frontend/               # Testes frontend
│
├── scripts/                     # Scripts utilitários
│   ├── setup_db.py            # Inicializa banco de dados
│   ├── download_climate_data.py # Download de dados climáticos
│   └── preprocess_netcdf.py    # Conversão NetCDF → Zarr
│
├── docker-compose.yml          # Orquestração containers
├── .github/
│   └── workflows/              # CI/CD pipelines
├── .gitignore
└── ROADMAP.md                  # Este documento
```

## 🚀 Quick Start

### Pré-requisitos
- Python 3.9+
- Node.js 16+
- PostgreSQL 12+
- Docker & Docker Compose (opcional)

### Setup Local

```bash
# Clone repositório
git clone https://github.com/seu-usuario/OceanValue.git
cd OceanValue

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app/main.py

# Frontend (em outro terminal)
cd frontend
npm install
npm start
```

Aplicação estará em `http://localhost:3000`

## 🔧 Stack Tecnológico

### Backend
- **Framework**: FastAPI
- **Processamento Científico**: CLIMADA, xarray, netCDF4, Zarr
- **Banco de Dados**: PostgreSQL + PostGIS
- **Cache/Fila**: Redis + Celery
- **Relatórios**: WeasyPrint, ReportLab

### Frontend
- **Framework**: React + TypeScript
- **Mapa**: Mapbox GL JS + deck.gl
- **Gráficos**: Plotly, Chart.js
- **Estado**: Redux ou Zustand
- **Estilo**: Tailwind CSS ou Material-UI

### Infraestrutura
- **Containerização**: Docker + Docker Compose
- **Deploy**: AWS EC2 + RDS + S3
- **CI/CD**: GitHub Actions

## 📊 Roadmap e Timeline

Veja [ROADMAP.md](./ROADMAP.md) para detalhes completos das fases de desenvolvimento.

**Resumo**: 26 semanas (6 meses)
- Fase 1: Fundação (Semanas 1-4)
- Fase 2: Backend CLIMADA (Semanas 5-12)
- Fase 3: Frontend Mapa + Timeline (Semanas 8-16)
- Fase 4: Integração & Relatórios (Semanas 13-20)
- Fase 5: Testes & Otimização (Semanas 19-24)
- Fase 6: Deploy (Semanas 25-26)

## 📚 Documentação

- [API Endpoints](./docs/API.md)
- [Arquitetura do Sistema](./docs/ARCHITECTURE.md)
- [Guia CLIMADA](./docs/CLIMADA_GUIDE.md)
- [Deploy & Infraestrutura](./docs/DEPLOYMENT.md)
- [Guia do Usuário](./docs/USER_GUIDE.md)

## 🤝 Contribuindo

1. Crie um branch (`git checkout -b feature/MinhaFeature`)
2. Commit suas mudanças (`git commit -am 'Add MinhaFeature'`)
3. Push para branch (`git push origin feature/MinhaFeature`)
4. Abra um Pull Request

## ⚖️ Licença

MIT License - veja LICENSE para detalhes

## 📞 Contato

**Autor**: Barbara Dias  
**Email**: barbara.dias@oceanvalue.com  
**GitHub**: @barbaradias

---

**Última atualização**: Fevereiro 2026  
**Versão**: 0.1.0 (em desenvolvimento)
