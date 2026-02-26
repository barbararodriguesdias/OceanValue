# Teste correto de endpoint FastAPI com PowerShell

# Use o Invoke-RestMethod para POST com JSON no PowerShell:

$body = '{}'
$headers = @{ 'Content-Type' = 'application/json' }
$response = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/analysis/multi-risk' -Method Post -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 5
