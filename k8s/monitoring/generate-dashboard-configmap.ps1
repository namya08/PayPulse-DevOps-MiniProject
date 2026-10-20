# Generates k8s/monitoring/grafana-dashboard-configmap.yaml from the single
# source dashboard JSON (monitoring/grafana/dashboards/payment-dashboard.json)
# so the dashboard definition is never duplicated in the repository.
#
# Run from the repository root:
#   powershell -File k8s\monitoring\generate-dashboard-configmap.ps1
#   kubectl apply -f k8s\monitoring\grafana-dashboard-configmap.yaml

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$source = Join-Path $root 'monitoring\grafana\dashboards\payment-dashboard.json'
$out = Join-Path $PSScriptRoot 'grafana-dashboard-configmap.yaml'

if (-not (Test-Path $source)) {
    Write-Error "Dashboard source not found: $source"
}

$json = Get-Content -Raw -LiteralPath $source
# Validate it really is JSON before shipping it into a ConfigMap.
$null = $json | ConvertFrom-Json

$lines = @(
    'apiVersion: v1',
    'kind: ConfigMap',
    'metadata:',
    '  name: grafana-dashboard',
    '  namespace: payment-app',
    'data:',
    '  payment-dashboard.json: |'
)
foreach ($line in ($json -split "`r?`n")) {
    if ($line -eq '') { $lines += '    '; continue }
    $lines += ('    ' + $line)
}

Set-Content -LiteralPath $out -Value ($lines -join "`n") -Encoding utf8
Write-Host "Wrote $out"
