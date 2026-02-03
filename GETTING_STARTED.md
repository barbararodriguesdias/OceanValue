# 📋 GUIA RÁPIDO DE INÍCIO - OceanValue

**Bem-vindo ao projeto OceanValue!**

Este guia cobre os próximos passos imediatos (Semana 1-2).

---

## 🎯 O Que Foi Criado

✅ **Estrutura de Pastas**: Projeto organizado em backend, frontend, data, docs, scripts, tests  
✅ **Documentação**: README.md, ROADMAP.md (26 semanas), ARCHITECTURE.md  
✅ **Backend Skeleton**: FastAPI com rotas para hazards, data, analysis, reports  
✅ **Frontend Skeleton**: React + TypeScript com componentes (Map, Timeline, SideDrawer)  
✅ **Configuração**: docker-compose.yml, requirements.txt, package.json, Dockerfiles  
✅ **Environment**: .env.example com todas as variáveis necessárias  

**Local do Projeto**: `C:\Users\Barbara.dias\Downloads\OceanValue`

---

## ⚡ Próximos Passos Imediatos (SEMANA 1)

### 1️⃣ **Inicializar Repositório Git** (1h)
```bash
cd C:\Users\Barbara.dias\Downloads\OceanValue

git init
git add .
git commit -m "Initial OceanValue project structure"
git remote add origin https://github.com/seu-usuario/OceanValue.git
git push -u origin main
```

**Resultado**: Repositório Git privado com primeira commit

---

### 2️⃣ **Setup Ambiente Python Local** (2h)

#### Criar Virtual Environment
```bash
cd C:\Users\Barbara.dias\Downloads\OceanValue\backend
python -m venv venv
.\venv\Scripts\activate
```

#### Instalar Dependências
```bash
# Versão reduzida (comentada a princípio, apenas packages essenciais)
pip install fastapi uvicorn python-dotenv

# Depois instale requirements completo
pip install -r requirements.txt
```

**Resultado**: Backend Python pronto para rodar

---

### 3️⃣ **Setup Ambiente Node.js Local** (1h)

```bash
cd C:\Users\Barbara.dias\Downloads\OceanValue\frontend
npm install
```

**Resultado**: Frontend dependências instaladas

---

### 4️⃣ **Criar Arquivo .env** (30 min)

```bash
cd C:\Users\Barbara.dias\Downloads\OceanValue

# Copy example
copy .env.example .env

# Edit .env com suas configurações locais
# - DB_PASSWORD
# - MAPBOX_TOKEN (pegar de https://mapbox.com)
# - AWS credentials (se usar)
```

---

### 5️⃣ **Testar Backend Localmente** (1h)

```bash
cd backend
.\venv\Scripts\activate

# Rodar FastAPI
python app/main.py

# Ou via uvicorn
uvicorn app.main:app --reload --port 8000
```

**Esperado**: Backend rodando em `http://localhost:8000`  
**Teste**: Acesse `http://localhost:8000/health` → deve retornar `{"status": "ok"}`

---

### 6️⃣ **Testar Frontend Localmente** (1h)

```bash
cd frontend
npm start
```

**Esperado**: Frontend rodando em `http://localhost:3000`

---

### 7️⃣ **Contatar Especialista CLIMADA** (30 min)

Envie email para comunidade CLIMADA:
```
To: climada@wfp.org
CC: contributors no GitHub (CLIMADA project)

Subject: Seeking CLIMADA Consultant - 6-month Maritime Risk Pricing Project

Content:
- Brief project description
- Timeline: 6 months (Feb-Aug 2026)
- Budget: EUR 6,000-8,000
- Scope: 80 hours consultation
- Contact: seu_email@example.com
```

**Resultado**: Começar negociação com especialista

---

### 8️⃣ **Contratar Dev Backend** (durante semana 1)

**Qualificações Buscadas**:
- Python 3.9+
- FastAPI experience
- PostgreSQL + PostGIS knowledge
- Experiência com dados geoespaciais (geopandas, rasterio)

**Timeline**: Full-time a partir de semana 5

**Estimado**: €2,500-3,000/mês

---

### 9️⃣ **Contratar Dev Frontend** (durante semana 1)

**Qualificações**:
- React 18 + TypeScript
- Mapbox GL JS
- Interactive maps & data visualization
- Material UI ou Tailwind

**Timeline**: Full-time a partir de semana 8

**Estimado**: €2,500-3,000/mês

---

### 🔟 **Criar GitHub Project & Issues** (1h)

1. Criar projeto no GitHub (Projects tab)
2. Adicionar issue para cada tarefa semana 1-4
3. Adicionar labels: `backend`, `frontend`, `documentation`, `infrastructure`
4. Setup: Wiki para documentação adicional

---

## 📊 Checklist Semana 1

- [ ] Git repositório criado e primeira commit
- [ ] Python venv + dependências instaladas
- [ ] Node.js + npm packages instalados
- [ ] .env arquivo criado com valores locais
- [ ] Backend rodando em localhost:8000
- [ ] Frontend rodando em localhost:3000
- [ ] Especialista CLIMADA contactado
- [ ] Job postings para Dev Backend e Dev Frontend
- [ ] GitHub Projects setup com issues
- [ ] Primeira reunião com stakeholders agendada

---

## 📚 Documentação Importante

| Documento | Objetivo | Localização |
|-----------|----------|------------|
| **README.md** | Visão geral projeto | `/` |
| **ROADMAP.md** | Timeline 26 semanas detalhada | `/` |
| **ARCHITECTURE.md** | Arquitetura sistema | `/docs/` |
| **requirements.txt** | Dependências Python | `/backend/` |
| **package.json** | Dependências Node.js | `/frontend/` |
| **docker-compose.yml** | Orquestração containers | `/` |

---

## 🔧 Comandos Úteis

```bash
# Backend
cd backend
.\venv\Scripts\activate
python app/main.py
pytest tests/  # Rodar testes

# Frontend
cd frontend
npm start      # Dev server
npm test       # Jest tests
npm build      # Build para produção

# Docker
docker-compose up -d           # Start all services
docker-compose logs -f backend # View logs
docker-compose down            # Stop all services

# Git
git status
git branch -a
git log --oneline
```

---

## ⚠️ Pontos Críticos Semana 1-4

1. **Estudar CLIMADA** - 8h dedicadas a entender library
2. **Database Design** - Schema PostgreSQL bem pensado desde o início
3. **API Design** - Endpoints bem estruturados antes de implementar
4. **Segurança** - JWT, CORS, validações desde dia 1
5. **Comunicação Stakeholders** - Reuniões a cada 2 semanas

---

## 📞 Contatos Importantes

- **CLIMADA Community**: climada@wfp.org
- **GitHub Issues**: para bug reports e feature requests
- **Seus Stakeholders**: reuniões quinzenais

---

## 🚀 Próxima Fase (Após Semana 1)

- Semana 2-4: **Fundação (Estudar CLIMADA + Arquitetura)**
- Semana 5-12: **Backend (Integração CLIMADA)**
- Semana 8-16: **Frontend (Mapa + Timeline + Filtros)**
- Semana 13-20: **Integração & Relatórios**
- Semana 21-25: **Testes & Otimização**
- Semana 26: **Deploy Produção**

---

**Status**: 🟢 Pronto para iniciar  
**Data**: Fevereiro 3, 2026  
**Versão**: 1.0
