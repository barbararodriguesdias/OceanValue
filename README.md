# OceanValue

Plataforma de análise de risco climático para operações offshore, com foco em suporte à decisão operacional e impacto econômico/financeiro.

O projeto combina:
- backend de processamento climático e cálculo de risco;
- frontend analítico com mapa, dashboards e comparação de cenários;
- scripts de ingestão para dados externos (ERA5 e CMEMS) com armazenamento otimizado em Zarr.

---

## Funcionalidades

- Análise multi-risco por ponto geográfico (ex.: vento, onda, corrente, temperatura).
- Classificação operacional por limites (operacional, atenção e parada).
- Cálculo de indicadores de risco e métricas financeiras (AAL, VaR, TVaR, prêmio puro/técnico, etc.).
- Dashboards com histogramas, curvas de excedência, séries temporais e comparativos históricos vs. futuro.
- Seleção de área/ponto via mapa e suporte a shapefiles para campos e blocos.
- Salvamento de análises no módulo de ativos (visão resumida e didática).
- Scripts para ingestão de dados climáticos e geração de cache Zarr para consultas mais rápidas.

---

## Estrutura de pastas (detalhada)

```text
OceanValue/
├─ backend/
│  ├─ app/
│  │  ├─ main.py                 # Entrada da API FastAPI
│  │  ├─ database.py             # Configuração de banco/conexão
│  │  ├─ routers/                # Endpoints REST
│  │  │  ├─ analysis.py
│  │  │  ├─ climate_data.py
│  │  │  ├─ data.py
│  │  │  ├─ hazards.py
│  │  │  └─ reports.py
│  │  ├─ services/               # Leitura/processamento de dados climáticos
│  │  │  ├─ netcdf_reader.py
│  │  │  ├─ zarr_reader.py
│  │  │  └─ cmems_current.py
│  │  ├─ models/                 # Modelos de domínio/persistência
│  │  ├─ schemas/                # Schemas Pydantic
│  │  ├─ tasks/                  # Tarefas assíncronas (quando aplicável)
│  │  └─ utils/                  # Utilitários gerais
│  ├─ requirements.txt
│  └─ Dockerfile
│
├─ frontend/
│  ├─ src/
│  │  ├─ main.tsx                # Bootstrap React
│  │  ├─ App.tsx                 # Composição principal da UI
│  │  ├─ components/             # Componentes reutilizáveis
│  │  │  ├─ Map/
│  │  │  ├─ SideDrawer/
│  │  │  ├─ Timeline/
│  │  │  ├─ Header/
│  │  │  └─ ClimateDataViewer/
│  │  ├─ pages/                  # Páginas de alto nível
│  │  │  ├─ AnalysisPage.tsx
│  │  │  └─ MyAssetsPage.tsx
│  │  ├─ services/               # Camada de acesso às APIs
│  │  ├─ styles/                 # Estilos globais
│  │  ├─ hooks/                  # Hooks customizados
│  │  └─ utils/                  # Helpers utilitários
│  ├─ public/                    # Arquivos estáticos (inclui shapefiles)
│  ├─ package.json
│  ├─ vite.config.ts
│  └─ Dockerfile
│
├─ scripts/
│  ├─ download_era5_temperature_to_zarr.py
│  └─ download_cmems_current_to_zarr.py
│
├─ data/                         # Dados locais do projeto
├─ outputs/                      # Saídas de processamento
├─ tests/                        # Testes backend/frontend
├─ docker-compose.yml
└─ README.md
```

## Stack tecnológico

### Frontend
- React 18 + TypeScript
- Vite
- Chart.js + react-chartjs-2
- Mapbox GL + react-map-gl
- Deck.gl
- MUI (Material UI)
- Zustand

### Backend
- FastAPI + Uvicorn
- Pydantic
- SQLAlchemy / SQLModel / Alembic
- Xarray, NetCDF4, Zarr
- GeoPandas, Shapely, Fiona, Rasterio, Rioxarray
- Celery + Redis (estrutura preparada)

### Infraestrutura
- Docker e Docker Compose (execução opcional em contêiner)
- Armazenamento local e externo para dados climáticos (ex.: `D:/OceanPact/climate_data`)
- Suporte a ingestão de datasets externos (ERA5 e CMEMS)

---

## Scripts de ingestão mantidos

- `scripts/download_era5_temperature_to_zarr.py`
- `scripts/download_cmems_current_to_zarr.py`

Objetivo:
- baixar dados por recorte espacial (bbox derivada de shapefiles);
- persistir dados brutos em NetCDF;
- atualizar cache analítico em formato Zarr.

---

## Contato

- Responsável: Barbara Dias
- E-mail: rodriguesdiasbarbara@gmail.com

---

## Última atualização

- 25/02/2026
