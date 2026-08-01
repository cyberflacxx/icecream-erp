$ErrorActionPreference = 'Stop'

param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$HealthUrl = $env:PHASE_1G_HEALTH_URL
)

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

Require-Command psql

if (-not $DatabaseUrl) {
  throw 'DATABASE_URL is required.'
}

Write-Host '== Phase 1G smoke: verify 043 =='
psql $DatabaseUrl -X -v ON_ERROR_STOP=1 -f 'migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql'

Write-Host '== Phase 1G smoke: verify 044 =='
psql $DatabaseUrl -X -v ON_ERROR_STOP=1 -f 'migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql'

Write-Host '== Phase 1G smoke: verify 045 =='
psql $DatabaseUrl -X -v ON_ERROR_STOP=1 -f 'migrations/manual/045_inventory_operational_reversals.verify.sql'

Write-Host '== Phase 1G smoke: postdeploy checks =='
psql $DatabaseUrl -X -v ON_ERROR_STOP=1 -f 'deployment/phase-1g-postdeploy.sql'

if ($HealthUrl) {
  Write-Host '== Phase 1G smoke: application health =='
  $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing
  Write-Host ("health_status=" + [int]$response.StatusCode)
}

Write-Host 'Phase 1G smoke test completed.'
