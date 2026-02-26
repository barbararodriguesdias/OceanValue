# Script PowerShell para automatizar: Download GPW → Setup LitPop → Teste onshore
# Uso: .\backend\scripts\provision_litpop_complete.ps1 -email seu@email.com
#
# Requisitos:
# - Conta NASA Earthdata ativa (https://urs.earthdata.nasa.gov/users/new)
# - Conda climada-env disponível

param(
    [Parameter(Mandatory=$true)]
    [string]$email,
    
    [string]$conda_env = "climada-env",
    [string]$output_dir = "$env:USERPROFILE\Downloads",
    [switch]$skip_test = $false
)

$ErrorActionPreference = "Stop"
$python = "C:/Users/Barbara.dias/.conda/envs/climada-env/python.exe"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "LitPop Provision Complete Workflow" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Passo 1: Verificar ambiente
Write-Host "[1/4] Verificando ambiente..." -ForegroundColor Yellow
if (-not (Test-Path $python)) {
    Write-Host "[ERROR] Python não encontrado em: $python" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Python encontrado: $python" -ForegroundColor Green

# Passo 2: Instalar dependências
Write-Host "[2/4] Instalando dependências (earthaccess)..." -ForegroundColor Yellow
& $python -m pip install --quiet earthaccess
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Falha ao instalar earthaccess" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] earthaccess instalado" -ForegroundColor Green

# Passo 3: Download GPW
Write-Host "[3/4] Baixando GPW v4.11 2020..." -ForegroundColor Yellow
Write-Host "      (você será solicitado a inserir sua senha NASA Earthdata)" -ForegroundColor Gray
$download_output = & $python backend/scripts/download_gpw.py --email $email --output $output_dir 2>&1
$download_exit = $LASTEXITCODE

# Extrair caminho do arquivo
$gpw_file = ($download_output | Select-String "Arquivo disponível em:" | ForEach-Object {
    $_ -replace '.*: ', ''
}).Trim()

if ([string]::IsNullOrWhiteSpace($gpw_file) -or $download_exit -ne 0) {
    Write-Host "[ERROR] Falha no download do GPW" -ForegroundColor Red
    Write-Host $download_output
    exit 1
}
Write-Host "[OK] GPW baixado: $gpw_file" -ForegroundColor Green

# Passo 4: Setup LitPop
Write-Host "[4/4] Provisioning LitPop no ambiente..." -ForegroundColor Yellow
& $python backend/scripts/setup_litpop_data.py --zip $gpw_file --run-smoke-test
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Falha no setup de LitPop" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] LitPop provisioned com sucesso" -ForegroundColor Green

# Resumo
Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✓ SUCESSO! LitPop está pronto" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Próximo passo: Validar endpoint onshore" -ForegroundColor Cyan
Write-Host "  Inicie o servidor:"
Write-Host "    cd $($PSScriptRoot -replace '\\backend\\scripts$', '')"
Write-Host "    $python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"
Write-Host ""
Write-Host "  Depois teste em: http://127.0.0.1:8000/docs"
Write-Host "  Procure pelo endpoint: POST /api/v1/analysis/climate-risk-onshore"
Write-Host "  Confirme que 'population_source' retorna 'litpop' (não 'proxy')"
Write-Host ""
