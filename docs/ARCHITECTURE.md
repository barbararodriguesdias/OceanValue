# OceanValue Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER (Browser)                     │
│  React + TypeScript + Mapbox GL JS + Plotly + Material UI       │
└────────────────────────────────────────────────────────────────┬─┘
                                                                   │
                          HTTPS / REST API
                                                                   │
┌────────────────────────────────────────────────────────────────┴─┐
│                    API GATEWAY / LOAD BALANCER                    │
│                  (AWS ALB / Nginx Reverse Proxy)                  │
└─────────────────────────────────────────────────────────────────┬┘
                                                                   │
┌────────────────────────────────────────────────────────────────┴─┐
│                    APPLICATION LAYER (Backend)                    │
│                    FastAPI + Python + CLIMADA                     │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Routers (API Endpoints)                                │   │
│  │  ├─ /api/v1/hazards/* (vento, onda, inundação, calor)  │   │
│  │  ├─ /api/v1/data/* (upload, explore)                   │   │
│  │  ├─ /api/v1/analysis/* (rodar análise)                 │   │
│  │  └─ /api/v1/reports/* (gerar relatórios)               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                │                                  │
│  ┌──────────────────────────────┴──────────────────────────┐    │
│  │  Services Layer (Business Logic)                        │    │
│  │  ├─ HazardService                                       │    │
│  │  ├─ WindAnalyzer (CLIMADA)                             │    │
│  │  ├─ WaveAnalyzer (CLIMADA)                             │    │
│  │  ├─ FloodAnalyzer (CLIMADA)                            │    │
│  │  ├─ HeatWaveAnalyzer (CLIMADA)                         │    │
│  │  ├─ ReportGenerator                                    │    │
│  │  └─ DataProcessor (NetCDF, Zarr)                       │    │
│  └──────────────────────────────────────────────────────────┘   │
│                                │                                  │
│  ┌──────────────────────────────┴──────────────────────────┐    │
│  │  Task Queue & Async Processing                          │    │
│  │  ├─ Celery Worker (Long-running tasks)                 │    │
│  │  ├─ Queue: analyze_wind, generate_report, etc.         │    │
│  │  └─ Messages via Redis                                 │    │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                    │
└─────────────────────────────────────────────────────────────────┬┘
                                                                   │
                              Storage & Caching
                                                                   │
┌────────────────────────────────────────────────────────────────┴─┐
│                    DATA LAYER & CACHING                           │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PostgreSQL + PostGIS                                  │    │
│  │  ├─ Exposures (portos, embarcações, plataformas)       │    │
│  │  ├─ Projects, Analyses, Results                        │    │
│  │  └─ Spatial indices (GIST)                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Redis Cache                                           │    │
│  │  ├─ Session cache                                      │    │
│  │  ├─ Query results cache                                │    │
│  │  └─ Task queue messages                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  File Storage (S3 / Local)                             │    │
│  │  ├─ /data/raw/ (uploaded NetCDF files)                 │    │
│  │  ├─ /data/processed/ (processed datasets)              │    │
│  │  ├─ /data/zarr_cache/ (Zarr store for fast access)    │    │
│  │  └─ /reports/ (generated PDFs)                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Frontend (React)
- **Map Component**: Display hazard data with Mapbox GL
- **Timeline Component**: Play/pause animation, scrub timeline
- **Side Drawer**: Hazard selection, filters, region selection
- **Layer Control**: Toggle hazards, opacity, legend
- **Visualizations**: Charts, heatmaps, popups
- **Upload Interface**: Drag-drop or file picker for .nc files
- **Report Viewer**: Display or download PDF reports

### Backend (FastAPI)
- **Hazard Endpoints**: `/api/v1/hazards/{type}` (vento, onda, inundação, calor)
- **Data Endpoints**: `/api/v1/data/upload`, `/api/v1/data/{id}/explore`
- **Analysis Endpoints**: `/api/v1/analysis/run`, `/api/v1/analysis/{id}/status`
- **Report Endpoints**: `/api/v1/reports/generate`, `/api/v1/reports/{id}/download`
- **Tile Server**: `/tiles/{layer}/{z}/{x}/{y}.png` (raster tiles for map)

### CLIMADA Integration
- **WindHazardAnalyzer**: Load wind data, create hazard, calculate impacts
- **WaveHazardAnalyzer**: Wave data, impacts on vessels/ports
- **FloodHazardAnalyzer**: Precipitation + elevation, storm surge modeling
- **HeatWaveAnalyzer**: Temperature data, heat stress indices

### Database
- **PostGIS Spatial Types**: POINT for ports, POLYGON for regions
- **Indexes**: GIST on geometry columns for fast spatial queries
- **Materialized Views**: Pre-computed summaries for dashboard

### File Processing
- **NetCDF4**: Read user-uploaded climate data files
- **Zarr**: Convert to Zarr for faster access (chunked, compressed)
- **Rasterio**: Read/write raster data
- **GeoPandas**: Vector data handling

## Data Flow Examples

### 1. Analyze Wind Risk for a Port

```
User selects:
  - Hazard: VENTO
  - Region: Porto de Santos (drawn on map)
  - Period: 2015-2023
  - Wind threshold: > 25 knots
  - Limit: 30 knots

Frontend → POST /api/v1/analysis/run {hazard, region, period, params}
  ↓
Backend:
  - Receive request
  - Load Exposures (porto_santos geometry)
  - Load Wind Hazard (ERA5 2015-2023)
  - Calculate Impacts (using CLIMADA)
  - Calculate costs (using impact functions)
  - Cache results in Redis
  ↓
Frontend ← JSON {analysis_id, status: "processing"}

  [Polling /api/v1/analysis/{id}/status]
  ↓
Frontend ← JSON {status: "completed", results}
  - Show on map
  - Display charts
  - Enable "Generate Report" button
```

### 2. Generate Risk Pricing Report

```
User clicks "Gerar Relatório"

Frontend → POST /api/v1/reports/generate {analysis_id}
  ↓
Backend (Celery Task):
  - Fetch analysis results
  - Calculate cost breakdowns
  - Scenario analysis (+10%, -10% climate)
  - Render HTML report template
  - Generate charts (Plotly → PNG)
  - Convert HTML → PDF (WeasyPrint)
  - Save PDF to S3
  ↓
Frontend ← JSON {report_id, download_url}
  - User downloads PDF
```

### 3. Upload Custom NetCDF File

```
User drag-drops file: "wave_forecast_2024.nc"

Frontend → POST /api/v1/data/upload
  - File upload (multipart/form-data)
  ↓
Backend:
  - Validate NetCDF structure
  - Extract metadata (variables, dimensions, CRS)
  - Convert to Zarr (/data/zarr_cache/wave_forecast_2024.zarr)
  - Create database entry
  ↓
Frontend ← JSON {file_id, variables: ["Hs", "Tp", ...]}
  - Display in "Data Explorer"
  - User selects variable to visualize
  - Tiles generated on-the-fly for map display
```

## Technologies by Layer

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TS | UI framework |
| | Mapbox GL JS | Interactive maps |
| | deck.gl | Large dataset visualization |
| | Plotly | Interactive charts |
| | Redux/Zustand | State management |
| **Backend** | FastAPI | REST API framework |
| | SQLAlchemy | ORM |
| | Pydantic | Data validation |
| | CLIMADA | Climate hazard calculation |
| | Celery | Async task queue |
| **Database** | PostgreSQL | Main DB |
| | PostGIS | Spatial queries |
| **Cache** | Redis | Session + query cache |
| **Storage** | Zarr | Efficient climate data storage |
| | S3 | File storage (prod) |
| **DevOps** | Docker | Containerization |
| | Docker Compose | Local development |
| | GitHub Actions | CI/CD |
| | AWS | Production hosting |

## Scalability Considerations

1. **Horizontal Scaling**: Multiple API instances behind load balancer
2. **Database**: Connection pooling, read replicas for analytics
3. **Caching**: Redis for frequent queries, Zarr for data locality
4. **Async**: Celery workers for CPU-intensive CLIMADA tasks
5. **CDN**: CloudFront for map tiles and static files
6. **Monitoring**: Prometheus + Grafana for metrics

---

**Last Updated**: Fevereiro 2026  
**Version**: 1.0
