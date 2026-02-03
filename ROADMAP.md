# OceanValue - Roadmap Detalhado (26 Semanas / 6 Meses)

**Período**: Fevereiro 3 - Agosto 3, 2026  
**Status**: Iniciando Fase 1

---

## 📊 Timeline Visual

```
FEVEREIRO          MARÇO             ABRIL             MAIO              JUNHO-JULHO
Sem 1-4            Sem 5-8           Sem 9-12         Sem 13-16         Sem 17-26
├──────┤           ├──────┤           ├──────┤          ├──────┤          ├─────────┤

FASE 1: FUNDAÇÃO   FASE 2: BACKEND   FASE 3: FRONTEND  FASE 4: INTEGR.   FASE 5-6: TESTES
Setup & Plan       CLIMADA           Mapa + Temporal   DB + Reports      Produção
[████░░░░░░░░░░░░] [░░░░████░░░░░░░░] [░░░░░░░░████░░░░] [░░░░░░░░░░░░████] [░░░░░░░░░░░░░░░░]
```

---

## FASE 1: FUNDAÇÃO & ARQUITETURA (Semanas 1-4)
**Duração**: 4 semanas  
**Fim esperado**: Final Fevereiro  
**Responsável**: Você (Barbara)

### Semana 1-2: Setup Inicial & Análise CLIMADA
**Duração**: 2 semanas (40h)

#### ✅ Tarefas
- [ ] **Setup Repositório Git**
  - Inicializar repositório GitHub privado
  - Adicionar `.gitignore`, LICENSE, README
  - Branch strategy: main, develop, feature/*
  - Time: 2h

- [ ] **Estudar CLIMADA em Profundidade**
  - Documentação oficial + exemplos
  - Rodar exemplo vento/onda/inundação
  - Entender Hazard → Exposure → ImpactFunc → Impact
  - Identificar dados disponíveis (ERA5, GEBCO, SRTM)
  - Time: 8h
  - **⚠️ CONSULTOR CLIMADA NECESSÁRIO**: 2 sessões (4h) para validar abordagem

- [ ] **Design Dados & Schema**
  - Diagrama ER banco de dados
  - Definir estrutura NetCDF entrada
  - Tabelas PostgreSQL + PostGIS
  - Cache Zarr strategy
  - Time: 6h

- [ ] **Definir Requisitos Técnicos**
  - Documentar casos de uso
  - Especificar APIs
  - Listar dependências
  - Time: 4h

**📊 Entregável**: 
- Repositório Git com documentação
- Documento TECHNICAL_SPEC.md
- Diagrama ER banco dados

**🎯 Go/No-Go**: Validação com especialista CLIMADA

---

### Semana 3-4: Arquitetura & Setup Local
**Duração**: 2 semanas (40h)

#### ✅ Tarefas
- [ ] **Criar Estrutura FastAPI Inicial**
  - Setup `main.py` com rotas básicas
  - Configurar database connection
  - Setup autenticação JWT
  - CORS config
  - Time: 6h

- [ ] **Setup PostgreSQL + PostGIS**
  - Instalar PostgreSQL 14+
  - Habilitar extensão PostGIS
  - Criar schema inicial
  - Time: 4h

- [ ] **Setup React + Mapbox GL**
  - Create React App ou Vite
  - Instalar Mapbox GL + dependências
  - Componentes base (Map, Sidebar)
  - Time: 4h

- [ ] **Docker Setup**
  - Dockerfile backend
  - Dockerfile frontend
  - `docker-compose.yml` (backend + db + redis)
  - Time: 4h

- [ ] **CI/CD Inicial**
  - GitHub Actions workflow para testes
  - Configurar linting (eslint, pylint)
  - Time: 3h

- [ ] **Documentação Técnica**
  - ARCHITECTURE.md (diagrama alto nível)
  - SETUP.md (instruções setup local)
  - TIME: 3h

- [ ] **Contratar Especialista CLIMADA**
  - Identificar candidatos
  - Negociar contrato (80h ao longo dos meses)
  - Time: Será contínuo

**📊 Entregável**:
- Backend FastAPI com /health rodando
- Frontend React com Mapa básico rodando
- docker-compose.yml funcional
- 📄 ARCHITECTURE.md e SETUP.md

**🎯 Go/No-Go**: Ambos frontend e backend rodando localmente

---

## FASE 2: BACKEND & CLIMADA (Semanas 5-12)
**Duração**: 8 semanas  
**Fim esperado**: Final Março / Início Abril  
**Responsável**: Você + Dev Backend (part-time)

### Semana 5-6: Models & Base de Dados
**Duração**: 2 semanas (40h)
**Dev**: Dev Backend + Você

#### ✅ Tarefas
- [ ] **SQLAlchemy Models**
  - User, Project, Analysis models
  - Exposure (Porto, Embarcação, Plataforma)
  - HazardEvent, Result tables
  - Índices PostGIS
  - Time: 6h

- [ ] **Pydantic Schemas**
  - Request/Response schemas
  - Validações
  - Time: 4h

- [ ] **Migrações Database**
  - Setup Alembic
  - Criar migrações iniciais
  - Testar em ambiente local
  - Time: 4h

- [ ] **CRUD Operations**
  - Repositório pattern
  - Basic CRUD para cada model
  - Time: 6h

- [ ] **Autenticação & Segurança**
  - JWT implementation
  - Password hashing
  - Rate limiting
  - Time: 4h

**📊 Entregável**:
- Database migrado e populado
- `/api/v1/users/me` endpoint funcional
- Testes unitários banco dados

---

### Semana 7-10: Integração CLIMADA (Módulos)
**Duração**: 4 semanas (80h)
**Dev**: Você + Dev Backend + **CONSULTOR CLIMADA (24h)**

#### Semana 7: Módulo VENTO
**Time**: 20h (você + dev + consultor 6h)

- [ ] **WindHazardAnalyzer class**
  - Load ERA5 wind data
  - Interpolate para pontos portos
  - Calculate hazard.intensity
  - Time: 8h

- [ ] **Wind ImpactFunc**
  - Definir função de impacto vento → operações
  - Testar com dados reais
  - Time: 6h
  - **CONSULTOR**: validar methodology (2h)

- [ ] **Endpoint `/api/v1/hazards/wind`**
  - Receber lat/lon, período, parâmetros
  - Rodar análise
  - Retornar resultados (geojson + stats)
  - Time: 6h

**📊 Entregável**: API vento funcional

---

#### Semana 8: Módulo ONDA
**Time**: 20h (você + dev + consultor 6h)

- [ ] **WaveHazardAnalyzer class**
  - Load wave data (WaveWatch III ou similar)
  - Calcular Hs (altura significativa)
  - Time: 8h

- [ ] **Wave ImpactFunc**
  - Função impacto para embarcações/portos
  - Time: 6h
  - **CONSULTOR**: validação (2h)

- [ ] **Endpoint `/api/v1/hazards/wave`**
  - Time: 6h

**📊 Entregável**: API onda funcional

---

#### Semana 9: Módulo INUNDAÇÃO
**Time**: 20h (você + dev + consultor 8h)

- [ ] **FloodHazardAnalyzer class**
  - Integrar precipitação (ERA5)
  - Usar SRTM DEM para elevação
  - Calcular areas de inundação
  - Time: 10h
  - **CONSULTOR**: storm surge modeling (4h)

- [ ] **Flood ImpactFunc**
  - Função específica para portos
  - Time: 6h

- [ ] **Endpoint `/api/v1/hazards/flood`**
  - Time: 6h

**📊 Entregável**: API inundação funcional

---

#### Semana 10: Módulo CONFORTO TÉRMICO
**Time**: 20h (você + dev + consultor 4h)

- [ ] **HeatWaveAnalyzer class**
  - Load temperatura (ERA5)
  - Calcular heat index ou WBGT
  - Time: 8h

- [ ] **HeatWave ImpactFunc**
  - Função impacto conforto térmico
  - Time: 6h
  - **CONSULTOR**: limiares de conforto (2h)

- [ ] **Endpoint `/api/v1/hazards/heatwave`**
  - Time: 6h

**📊 Entregável**: API calor funcional + integração de todos 4 módulos

---

### Semana 11-12: Upload de Dados & Processamento
**Duração**: 2 semanas (40h)
**Dev**: Dev Backend + Você

#### ✅ Tarefas
- [ ] **Upload NetCDF**
  - Endpoint `/api/v1/data/upload`
  - Parse arquivo .nc
  - Validar estrutura
  - Store em `/data/raw`
  - Time: 8h

- [ ] **NetCDF → Zarr Converter**
  - Script `preprocess_netcdf.py`
  - Compressão automática
  - Indexação para acesso rápido
  - Time: 6h

- [ ] **Data Explorer Endpoint**
  - `/api/v1/data/{file_id}/explore`
  - Listar variáveis disponíveis
  - Estatísticas básicas
  - Time: 6h

- [ ] **Integração Celery**
  - Setup Redis
  - Task queue para análises longas
  - Progress tracking
  - Time: 8h

- [ ] **Tests Backend**
  - Testes unitários serviços
  - Testes integração API
  - Coverage > 70%
  - Time: 6h

**📊 Entregável**:
- Upload funcionando
- Celery + Redis em produção
- Testes backend > 70% coverage

---

## FASE 3: FRONTEND (Semanas 8-16)
**Duração**: 9 semanas  
**Responsável**: Dev Frontend

### Semana 8-9: Mapa Interativo & Timeline
**Duração**: 2 semanas (40h)
**Dev**: Dev Frontend

#### ✅ Tarefas
- [ ] **Mapa Mapbox GL**
  - Centralizado em Santos/Campos
  - Zoom inicial apropriado (nível 5-6)
  - Base layer (satellite, street, terrain)
  - Time: 6h

- [ ] **Timeline Slider**
  - Controle datas (start, end, current)
  - Play/pause animation
  - Time: 4h

- [ ] **Layer Control**
  - Seleção hazard (vento, onda, inundação, calor)
  - Toggle/opacity para cada layer
  - Legenda dinâmica
  - Time: 6h

- [ ] **Raster Tiles Rendering**
  - Integrar com Titiler ou backend
  - Display hazard como camada raster animada
  - Time: 8h

- [ ] **Map Interactions**
  - Zoom/pan
  - Hover info
  - Click para detalhes
  - Time: 6h

- [ ] **Performance Optimization**
  - Lazy loading tiles
  - Memoization
  - Time: 4h

**📊 Entregável**: Mapa interativo com timeline animada, visualizando 1 hazard

---

### Semana 10-12: Side Drawer & Filtros
**Duração**: 3 semanas (60h)
**Dev**: Dev Frontend

#### ✅ Tarefas
- [ ] **Side Drawer Component**
  - Abrir/fechar com animação
  - Responsive design
  - Time: 4h

- [ ] **Hazard Selection**
  - Radio buttons: Vento, Onda, Inundação, Calor, SST, Corrente
  - Descrição brevemente cada
  - Time: 3h

- [ ] **Period Selector**
  - Date range picker
  - Presets (último 1 ano, 5 anos, todo histórico)
  - Time: 5h

- [ ] **Parameter Limits**
  - Sliders: velocidade vento, altura onda, precipitação, temperatura
  - Min/max inputs
  - Validate range
  - Time: 6h

- [ ] **Region Selection**
  - Lat/lon inputs
  - Region dropdown (predefinidas)
  - **Draw tool** (desenhar polygon no mapa)
  - Time: 8h
  - 🟡 Nota: Draw tool requer `mapbox-gl-draw`

- [ ] **Buttons**
  - "Visualizar" (preview)
  - "Gerar Relatório" (PDF)
  - "Limpar Filtros"
  - Time: 3h

- [ ] **Form Validation**
  - Validação campos obrigatórios
  - Feedback ao usuário
  - Time: 4h

- [ ] **Integration com API**
  - Conectar filtros a endpoints backend
  - Loading states
  - Error handling
  - Time: 8h

- [ ] **State Management**
  - Redux ou Zustand para filtros
  - Persist filters em localStorage
  - Time: 6h

- [ ] **Tests Frontend**
  - Testes componentes
  - Testes integração
  - Coverage > 60%
  - Time: 6h

**📊 Entregável**: Side drawer funcional, filtros enviando requests à API

---

### Semana 13-16: Visualizações & Upload
**Duração**: 4 semanas (80h)
**Dev**: Dev Frontend

#### Semana 13-14: Detalhes & Gráficos
- [ ] **Popup/Modal de Detalhes**
  - Mostrar estatísticas ponto selecionado
  - Série temporal
  - Time: 8h

- [ ] **Gráficos (Plotly)**
  - Série temporal hazard
  - Distribuição (histogram)
  - Estatísticas descritivas
  - Time: 10h

- [ ] **Heatmap Overlay**
  - Visualizar intensidade espacial
  - Paleta de cores customizável
  - Time: 6h

- [ ] **Multiple Layers**
  - Combinar 2+ hazards simultaneamente
  - Blending modes
  - Time: 6h

**📊 Entregável**: Visualizações avançadas, popup com detalhes

---

#### Semana 15: Upload & Data Explorer
- [ ] **Upload UI**
  - Drag-drop ou file input
  - Mostrar progresso
  - Time: 4h

- [ ] **Data Explorer**
  - Listar variáveis arquivo .nc
  - Seleção variáveis a visualizar
  - Estatísticas file
  - Time: 6h

- [ ] **Integration Upload API**
  - Enviar arquivo backend
  - Parse + preview
  - Time: 4h

**📊 Entregável**: Upload funcionando

---

#### Semana 16: Refinamentos & Polish
- [ ] **UI/UX Polish**
  - Responsive design (mobile, tablet)
  - Acessibilidade (a11y)
  - Theme (dark/light)
  - Time: 8h

- [ ] **Performance**
  - Bundle size optimization
  - Lazy loading
  - Lighthouse > 80
  - Time: 6h

- [ ] **Documentation**
  - Component storybook
  - API integration guide
  - Time: 4h

**📊 Entregável**: Frontend MVP completo e responsivo

---

## FASE 4: INTEGRAÇÃO & RELATÓRIOS (Semanas 13-20)
**Duração**: 8 semanas  
**Responsável**: Dev Backend + Você (relatórios)

### Semana 13-14: PostgreSQL & Spatial Queries
**Duração**: 2 semanas (40h)

#### ✅ Tarefas
- [ ] **Spatial Queries**
  - Buscar exposures por região (ST_Contains)
  - Buffer queries (ST_Buffer)
  - Distance queries (ST_Distance)
  - Time: 8h

- [ ] **Caching Strategy**
  - Redis cache para queries frequentes
  - Invalidation strategy
  - Time: 6h

- [ ] **Full Text Search**
  - Buscar portos por nome
  - Autocomplete
  - Time: 4h

- [ ] **Data Import Scripts**
  - Import portos (CSV/shapefile)
  - Import plataformas
  - Time: 6h

- [ ] **Query Optimization**
  - Índices PostGIS
  - Query profiling
  - EXPLAIN ANALYZE
  - Time: 6h

**📊 Entregável**: Database otimizado, queries rápidas

---

### Semana 15-17: Geração de Relatórios
**Duração**: 3 semanas (60h)
**Dev**: Dev Backend + Você

#### ✅ Tarefas
- [ ] **Report Template**
  - HTML template com placeholder
  - Include: mapa, gráficos, tabelas, análise
  - Time: 8h
  - **Você**: Design do relatório

- [ ] **PDF Generation (WeasyPrint)**
  - Converter HTML → PDF
  - Incluir watermarks, footers
  - Time: 6h

- [ ] **Charts Rendering**
  - Plotly → PNG para PDF
  - SVG charts
  - Time: 4h

- [ ] **Data Aggregation**
  - Calcular estatísticas report
  - Sumarizações
  - Time: 6h

- [ ] **Report API**
  - Endpoint `/api/v1/reports/generate`
  - Async processing (Celery)
  - Download/email result
  - Time: 8h

- [ ] **Cost Quantification**
  - Calcular impacto financeiro
  - Losses por cenário
  - Criar tabelas de custo
  - Time: 8h
  - **CONSULTOR CLIMADA**: validar metodologia custos (2h)

- [ ] **Scenario Analysis**
  - +10%, -10% mudanças clima
  - Calcular gastos alternativos
  - Time: 6h

- [ ] **Testing**
  - Unit tests report generation
  - Integration tests
  - Coverage > 70%
  - Time: 6h

**📊 Entregável**: Relatório PDF completo com análise financeira

---

### Semana 18-20: Análise de Cenários & Dashboards
**Duração**: 3 semanas (60h)

#### ✅ Tarefas
- [ ] **Scenario Engine**
  - Baseline (dados históricos)
  - RCP 4.5 / RCP 8.5 (projeções climáticas)
  - Custom scenarios
  - Time: 10h

- [ ] **Dashboard Frontend**
  - Summary cards (total risk, locations, etc)
  - Mini charts (trend, distribution)
  - Project list
  - Time: 8h

- [ ] **Export Formats**
  - PDF (já feito)
  - XLSX com tabelas detalhadas
  - JSON para integração externa
  - GeoJSON com resultados espaciais
  - Time: 8h

- [ ] **Comparison Tool**
  - Comparar 2+ análises lado-a-lado
  - Highlight diferenças
  - Time: 6h

- [ ] **Historical Analysis**
  - Treemap: risco por porto
  - Timeline: evolução tempo
  - Heatmap: intensidade por período
  - Time: 8h

- [ ] **Documentation**
  - API.md atualizado
  - Report schema documentation
  - Time: 4h

- [ ] **Code Review & QA**
  - Backend review
  - Bug fixes
  - Time: 6h

**📊 Entregável**: Dashboard completo, comparação cenários, múltiplos formatos export

---

## FASE 5: TESTES & OTIMIZAÇÃO (Semanas 19-25)
**Duração**: 7 semanas  
**Responsável**: Você + QA (part-time)

### Semana 19-21: Testes Unitários & Integração
**Duração**: 3 semanas (60h)

#### ✅ Tarefas
- [ ] **Backend Tests (pytest)**
  - Unit tests todos serviços
  - Mock CLIMADA calls
  - Test coverage > 80%
  - Time: 12h

- [ ] **Frontend Tests (Jest + RTL)**
  - Component tests
  - Hook tests
  - Coverage > 70%
  - Time: 12h

- [ ] **API Integration Tests**
  - Test full workflows
  - Different user roles
  - Time: 8h

- [ ] **Database Tests**
  - Test spatial queries
  - Test constraints
  - Time: 6h

- [ ] **Data Validation Tests**
  - NetCDF upload validation
  - Exposure data validation
  - Time: 6h

- [ ] **Error Handling**
  - Test error cases
  - Error messages clear
  - Time: 6h

- [ ] **Documentation Coverage**
  - Docstrings
  - README testes
  - CI output coverage
  - Time: 4h

**📊 Entregável**: Coverage > 75% backend + >60% frontend

---

### Semana 22-23: Performance & Load Testing
**Duração**: 2 semanas (40h)
**Dev**: Dev Backend + QA Specialist

#### ✅ Tarefas
- [ ] **Backend Profiling**
  - Identificar gargalos CLIMADA
  - Memory profiling
  - Time: 6h

- [ ] **Load Testing**
  - Locust ou Apache JMeter
  - 100 concurrent users
  - Identify limits
  - Time: 6h

- [ ] **CLIMADA Optimization**
  - Batch processing
  - Cache intermediate results
  - Reducir resolução se necessário
  - Time: 10h
  - **CONSULTOR CLIMADA**: optimization advice (2h)

- [ ] **Frontend Performance**
  - Lighthouse audit
  - Bundle analysis
  - Optimize images
  - Time: 6h

- [ ] **Database Optimization**
  - Query optimization
  - Index tuning
  - Time: 4h

- [ ] **Caching Optimization**
  - Redis hit rate analysis
  - TTL tuning
  - Time: 4h

**📊 Entregável**: Performance baseline documentado, otimizações aplicadas

---

### Semana 24-25: Browser & Device Testing
**Duração**: 2 semanas (40h)
**Dev**: QA Specialist

#### ✅ Tarefas
- [ ] **Cross-Browser Testing**
  - Chrome, Firefox, Safari, Edge
  - Latest versions
  - Time: 6h

- [ ] **Responsive Testing**
  - Desktop, tablet, mobile
  - Orientação portrait/landscape
  - Time: 6h

- [ ] **Accessibility Audit**
  - WCAG 2.1 AA compliance
  - Screen reader testing
  - Time: 6h

- [ ] **E2E Tests (Cypress/Playwright)**
  - Critical user journeys
  - Data flows
  - Time: 12h

- [ ] **Security Testing**
  - SQL injection tests
  - XSS tests
  - CSRF tests
  - Time: 6h

- [ ] **Bug Fix & Polish**
  - Fix identified issues
  - UI refinements
  - Time: 4h

**📊 Entregável**: Bug list zerada, E2E tests passando

---

## FASE 6: DEPLOY & PRODUÇÃO (Semanas 25-26)
**Duração**: 2 semanas  
**Responsável**: DevOps + Você

### Semana 25: Staging & Final Validation
**Duração**: 1 semana (40h)
**Dev**: DevOps + Você

#### ✅ Tarefas
- [ ] **Infrastructure Setup**
  - AWS account setup
  - VPC, security groups
  - EC2 instance (t3.large) para backend
  - RDS PostgreSQL backup
  - S3 bucket para uploads/relatórios
  - CloudFront CDN
  - Time: 8h

- [ ] **Containerization**
  - Finalize Dockerfiles
  - docker-compose final
  - Multi-stage builds
  - Time: 4h

- [ ] **CI/CD Pipeline**
  - GitHub Actions (test → build → push ECR)
  - Auto-deploy staging em push develop
  - Time: 6h

- [ ] **Database Migration Staging**
  - Run Alembic migrations
  - Seed data de teste
  - Backup strategy
  - Time: 4h

- [ ] **Staging Deployment**
  - Deploy backend + frontend + db
  - Verify all endpoints
  - Test full workflows
  - Time: 6h

- [ ] **Monitoring Setup**
  - Sentry (error tracking)
  - DataDog ou CloudWatch
  - Health checks
  - Alerting
  - Time: 4h

- [ ] **Documentation Final**
  - DEPLOYMENT.md
  - Runbooks troubleshooting
  - Checklists
  - Time: 4h

- [ ] **Security Review**
  - Dependency scanning
  - Secrets management
  - SSL/TLS setup
  - Time: 4h

**📊 Entregável**: Staging environment funcionando

---

### Semana 26: Produção & Launch
**Duração**: 1 semana (40h)
**Dev**: DevOps + Você + Stakeholders

#### ✅ Tarefas
- [ ] **Pre-Launch Checklist**
  - Backup database
  - Rollback plan pronto
  - Status page criada
  - Time: 2h

- [ ] **Production Deployment**
  - Deploy backend + frontend
  - Verify endpoints
  - Test real users (closed beta)
  - Time: 4h

- [ ] **Domain & DNS**
  - Setup domain (oceanvalue.com)
  - SSL certificate
  - DNS records
  - Time: 2h

- [ ] **User Onboarding**
  - Create demo account
  - Write quickstart guide
  - Video tutorial
  - Time: 6h

- [ ] **Launch Preparation**
  - Social media
  - Email announcement
  - Press release
  - Time: 4h

- [ ] **Monitoring & Metrics**
  - Dashboard monitoramento ao vivo
  - Validate performance em prod
  - Response times <2s
  - Uptime > 99.5%
  - Time: 4h

- [ ] **Bug Triage & Hotfix**
  - On-call rotation
  - Rapid response protocol
  - Time: 6h

- [ ] **Documentation & Knowledge Transfer**
  - Final docs
  - Training session stakeholders
  - Handover plan
  - Time: 4h

- [ ] **Post-Launch**
  - Monitor closely first 48h
  - Gather feedback
  - Plan improvements Phase 2
  - Time: 2h

**📊 Entregável**: 🚀 **PRODUÇÃO AO VIVO**

---

## 📋 Resumo Tarefas por Fase

| Fase | Semanas | Principais Tarefas | Entregável | Tempo Total |
|------|---------|-------------------|-----------|------------|
| 1️⃣ Fundação | 1-4 | Setup Git, CLIMADA estudo, Arquitetura | README, TECHNICAL_SPEC | 80h |
| 2️⃣ Backend | 5-12 | Models, CLIMADA integrações, Upload, Celery | 4 APIs hazard, Upload, Relatório | 160h |
| 3️⃣ Frontend | 8-16 | Mapa, Timeline, Drawer, Filtros, Upload | Interface completa | 160h |
| 4️⃣ Integração | 13-20 | Database, Relatórios, Cenários, Dashboard | Relatório PDF, Dashboard | 160h |
| 5️⃣ Testes | 19-25 | Testes, Performance, E2E, Security | Coverage 75%+, E2E | 140h |
| 6️⃣ Deploy | 25-26 | Infrastructure, Staging, Produção | 🚀 Produção ao vivo | 80h |
| **TOTAL** | **26 semanas** | **Acima** | **Sistema completo funcional** | **780h** |

---

## 🎯 Marcos Chave (Go/No-Go)

```
SEMANA 4:  ✅ Fundação OK - FastAPI + React rodando, DB desenhado
SEMANA 8:  ✅ Módulo Vento funcional - API testada
SEMANA 12: ✅ Todos 4 módulos CLIMADA funcionando
SEMANA 16: ✅ Frontend MVP completo - Mapa animado
SEMANA 20: ✅ Relatórios funcionando - PDF exportado
SEMANA 25: ✅ Staging validado - Performance OK
SEMANA 26: 🚀 Produção ao vivo
```

---

## 👥 Equipe Necessária

| Papel | Duração | Horas | Custo Estimado | Notas |
|------|---------|-------|----------------|-------|
| **Você (Barbara)** | 26 sem | 520h | - | Coordenação + dev backend |
| **Dev Backend** | Sem 5-26 | 352h | €17.600 | Full-time 22 semanas |
| **Dev Frontend** | Sem 8-25 | 288h | €14.400 | Full-time 18 semanas |
| **CONSULTOR CLIMADA** | Sem 1-16 | 80h | €6.000 | 5h/sem, pair programming |
| **DevOps/Cloud** | Sem 24-26 | 40h | €4.000 | Part-time, setup + deploy |
| **QA Specialist** | Sem 19-25 | 56h | €3.360 | Part-time, testes |
| **DBA (optional)** | Sem 13-14 | 12h | €1.200 | Consultoria spatial queries |
| **TOTAL** | | **1.348h** | **~€46.560** | |

---

## ⚠️ Riscos & Mitigação

| Risco | Prob. | Severidade | Mitigação |
|-------|-------|-----------|-----------|
| CLIMADA curva aprendizado | ALTA | ALTA | Consultor desde semana 1 |
| Performance dados grandes | MÉDIA | ALTA | Profiling semana 7, cache Zarr |
| Mudanças requisitos | ALTA | MÉDIA | Reviews a cada 2 semanas |
| Cronograma apertado | ALTA | ALTA | MVP focado, priorizar features |
| Integração frontend-backend | MÉDIA | MÉDIA | API mocking desde semana 8 |
| Deploy produção | MÉDIA | ALTA | Staging completo semana 25 |

---

## 📚 Documentação Associada

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Diagrama detalhado sistema
- **[API.md](./docs/API.md)** - Especificação endpoints
- **[CLIMADA_GUIDE.md](./docs/CLIMADA_GUIDE.md)** - Como usar CLIMADA neste projeto
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Instruções deploy + infraestrutura
- **[USER_GUIDE.md](./docs/USER_GUIDE.md)** - Guia usuário final

---

## 🔄 Próximos Passos (Semana 1)

1. ✅ Criar repositório GitHub → **Feito**
2. ✅ Estruturar pastas → **Feito**
3. ⬜ Estudar CLIMADA (você) - 8h
4. ⬜ Contratar Dev Backend - começar entrevistas
5. ⬜ Contratar Consultor CLIMADA - negociar contrato
6. ⬜ Setup ambiente local Python - venv, packages
7. ⬜ Primeira reunião stakeholders - confirmar requisitos
8. ⬜ Criar GitHub Projects - rastrear tarefas semana 1-4

---

**Status**: 🟢 Iniciando (Semana 1 de 26)  
**Última atualização**: Fevereiro 3, 2026  
**Versão**: 1.0 - Roadmap Inicial
