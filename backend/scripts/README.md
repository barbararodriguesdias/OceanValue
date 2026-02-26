# Scripts de Provisão e Download

## Visão geral

Arquivo PSS scripts para automatizar:
1. Download do GPW (Gridded Population of the World) do servidor NASA
2. Setup/provisão de LitPop no ambiente CLIMADA
3. Teste de validação

## Scripts disponíveis

### 1. `download_gpw.py` - Download automático do GPW

Baixa `gpw-v4-population-count-rev11_2020_30_sec_tif.zip` diretamente do servidor NASA usando suas credenciais Earthdata.

```powershell
# Uso básico (salva em ~/Downloads)
C:/Users/Barbara.dias/.conda/envs/climada-env/python.exe `
  backend/scripts/download_gpw.py `
  --email seu.email@example.com

# Com diretório customizado
C:/Users/Barbara.dias/.conda/envs/climada-env/python.exe `
  backend/scripts/download_gpw.py `
  --email seu.email@example.com `
  --output D:\dados\gpw
```

**Flags:**
- `--email` (obrigatório): Email da conta NASA Earthdata
- `--password`: Senha (será solicitada interativamente se omitida)
- `--output`: Diretório de saída (padrão: `~/Downloads`)
- `--no-unzip`: Não descompactar após download

---

### 2. `setup_litpop_data.py` - Provisão de LitPop

Extrai o arquivo GPW ZIP e move para o diretório de dados do CLIMADA.

```powershell
# Uso básico
C:/Users/Barbara.dias/.conda/envs/climada-env/python.exe `
  backend/scripts/setup_litpop_data.py `
  --zip "C:\path\to\gpw-v4-population-count-rev11_2020_30_sec_tif.zip" `
  --run-smoke-test
```

**Flags:**
- `--zip` (obrigatório): Caminho para o arquivo ZIP baixado
- `--target-dir`: Diretório target para dados (padrão: `~\climada\data`)
- `--run-smoke-test`: Executar teste básico de LitPop após provisão

---

### 3. `provision_litpop_complete.ps1` - Workflow completo (RECOMENDADO)

Encadeia todos os passos: download → setup → teste.

```powershell
# Execução simples
.\backend\scripts\provision_litpop_complete.ps1 -email seu.email@example.com

# Com diretório customizado
.\backend\scripts\provision_litpop_complete.ps1 `
  -email seu.email@example.com `
  -output_dir D:\dados\gpw
```

**Flags:**
- `-email` (obrigatório): Email NASA Earthdata
- `-output_dir`: Diretório de saída (padrão: `~/Downloads`)
- `-skip_test`: Pular teste de validação

---

## Passo a passo rápido

### Opção 1: Fluxo completo automatizado (recomendado)

```powershell
cd C:\Users\Barbara.dias\Downloads\OceanValue
.\backend\scripts\provision_litpop_complete.ps1 -email seu@email.com
```

Isso fará tudo em um único comando (download → setup → teste).

### Opção 2: Passo a passo manual

```powershell
# 1. Download
C:/Users/Barbara.dias/.conda/envs/climada-env/python.exe `
  backend/scripts/download_gpw.py `
  --email seu@email.com `
  --output D:\downloads

# (A saída mostrará o caminho exato do arquivo)

# 2. Setup (copie o caminho exato do ZIP retornado acima)
C:/Users/Barbara.dias/.conda/envs/climada-env/python.exe `
  backend/scripts/setup_litpop_data.py `
  --zip "D:\downloads\gpw-v4-population-count-rev11_2020_30_sec_tif.zip" `
  --run-smoke-test
```

---

## Validação após provisão

Após sucesso, inicie o servidor backend:

```powershell
cd C:\Users\Barbara.dias\Downloads\OceanValue
C:/Users/Barbara.dias/.conda/envs/climada-env/python.exe -m uvicorn `
  backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Depois teste o endpoint onshore:

**URL:** http://127.0.0.1:8000/docs

**Corpo da requisição (POST /api/v1/analysis/climate-risk-onshore):**
```json
{
  "latitude": -23.55,
  "longitude": -46.63,
  "scenario": "present",
  "hazard_type": "wind"
}
```

**Resposta esperada:**
```json
{
  "population_source": "litpop",
  "total_population": 12345,
  "affected_population": 6789,
  "traceability": { ... },
  "financial_outputs": { ... }
}
```

Se `population_source` for `"litpop"` (não `"proxy"`), ✅ sucesso!

---

## Troubleshooting

### Erro: "earthaccess não está instalado"
```powershell
C:/Users/Barbara.dias/.conda/envs/climada-env/python.exe -m pip install earthaccess
```

### Erro: "NASA Earthdata login required"
- Crie/confirme sua conta em https://urs.earthdata.nasa.gov/users/new
- Verifique se tem permissão de acesso ao dataset GPW

### Erro: "FileNotFoundError"
- Verifique o caminho exato para o ZIP (copie-cole da saída do script)
- Confirme que o ZIP não está corrompido

---

## Referências

- **NASA Earthdata:** https://urs.earthdata.nasa.gov/
- **SEDAC GPW:** https://sedac.ciesin.columbia.edu/data/collection/gpw-v4/
- **CLIMADA LitPop docs:** https://climada-python.readthedocs.io/en/latest/tutorial/climada_entity_LitPop.html
