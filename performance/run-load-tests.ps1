<#
.SYNOPSIS
  Runs the payment API load test at several virtual-user levels and
  produces JMeter JTL results plus an optional Docker resource snapshot.

.DESCRIPTION
  Finds JMeter (JMETER_HOME env var, PATH, or common install locations),
  runs performance\payment-load-test.jmx non-GUI for each level (default
  10, 25, 50 VUs), optionally samples `docker stats` during each run, then
  calls compare-results.js to build a Markdown comparison table.

.EXAMPLE
  powershell -File performance\run-load-tests.ps1
  powershell -File performance\run-load-tests.ps1 -Levels 10,25,50 -Duration 60 -CollectDockerStats
  powershell -File performance\run-load-tests.ps1 -BaseUrl localhost -Port 3000 -RampUp 10
#>
[CmdletBinding()]
param(
  [int[]]$Levels = @(10, 25, 50),
  [int]$RampUp = 10,
  [int]$Duration = 60,
  [int]$ThinkMs = 0,
  [string]$BaseUrl = 'localhost',
  [int]$Port = 3000,
  [switch]$CollectDockerStats
)

$ErrorActionPreference = 'Stop'
$perfDir = $PSScriptRoot
$resultsDir = Join-Path $perfDir 'results'
New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null

function Find-JMeter {
  if ($env:JMETER_HOME -and (Test-Path (Join-Path $env:JMETER_HOME 'bin\jmeter.bat'))) {
    return Join-Path $env:JMETER_HOME 'bin\jmeter.bat'
  }
  $cmd = Get-Command jmeter.bat -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command jmeter -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    'C:\tools\apache-jmeter-5.6.3\bin\jmeter.bat',
    'C:\Program Files\apache-jmeter-5.6.3\bin\jmeter.bat',
    "$env:USERPROFILE\Downloads\apache-jmeter-5.6.3\bin\jmeter.bat"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  return $null
}

$jmeter = Find-JMeter
if (-not $jmeter) {
  Write-Error 'JMeter not found. Install it (e.g. winget install Apache.JMeter), then set JMETER_HOME or add its bin folder to PATH.'
}

Write-Host "JMeter : $jmeter"
Write-Host "Target : http://${BaseUrl}:${Port}/api/payments"
Write-Host "Levels : $($Levels -join ', ') VUs | ramp-up ${RampUp}s | duration ${Duration}s | think ${ThinkMs}ms"
Write-Host ""

foreach ($level in $Levels) {
  $jtl = Join-Path $resultsDir "load-$level.jtl"
  $log = Join-Path $resultsDir "load-$level.log"

  Write-Host "=== Running $level virtual users -> $(Split-Path $jtl -Leaf) ===" -ForegroundColor Cyan

  $statsJob = $null
  if ($CollectDockerStats) {
    $csv = Join-Path $resultsDir "docker-stats-$level.csv"
    'timestamp,name,cpu_percent,mem_usage,mem_limit' | Set-Content -LiteralPath $csv
    $statsJob = Start-Job -ScriptBlock {
      param($CsvPath, $Seconds)
      $deadline = (Get-Date).AddSeconds($Seconds)
      while ((Get-Date) -lt $deadline) {
        $lines = docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}}' 2>$null
        foreach ($line in $lines) {
          $parts = $line -split ','
          if ($parts.Count -ge 3) {
            $name = $parts[0]
            $cpu = $parts[1].TrimEnd('%')
            $mem = $parts[2]
            Add-Content -LiteralPath $CsvPath "$(Get-Date -Format o),$name,$cpu,$mem"
          }
        }
        Start-Sleep -Seconds 5
      }
    } -ArgumentList $csv, ($RampUp + $Duration + 10)
  }

  & $jmeter -n -t (Join-Path $perfDir 'payment-load-test.jmx') `
    -Jhost $BaseUrl -Jport $Port `
    -Jthreads $level -Jrampup $RampUp -Jduration $Duration -JthinkMs $ThinkMs `
    -l $jtl -j $log

  if ($statsJob) {
    Wait-Job $statsJob | Out-Null
    Receive-Job $statsJob | Out-Null
    Remove-Job $statsJob
    Write-Host "Docker stats -> docker-stats-$level.csv"
  }

  if ($LASTEXITCODE -ne 0) {
    Write-Warning "JMeter exited with code $LASTEXITCODE for level $level (see $log)"
  }
  Write-Host ""
}

Write-Host '=== Building comparison table ===' -ForegroundColor Cyan
$jtls = @(Get-ChildItem -Path $resultsDir -Filter 'load-*.jtl' | Select-Object -ExpandProperty FullName)
if ($jtls.Count -eq 0) {
  Write-Warning "No JTL files found in $resultsDir - nothing to compare."
} else {
  node (Join-Path $perfDir 'compare-results.js') @jtls
}
