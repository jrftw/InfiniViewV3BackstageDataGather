# Filename: register-server-reliability-tasks.ps1
# Purpose: One-shot setup — startup task, watchdog task, and optional auto-update task.
# Author: Kevin Doyle Jr. / Infinitum Imagery LLC
# Last Modified: 2026-06-30
# Platform Compatibility: Windows 10/11 server PC

$GathererReliabilityScriptsDir = $PSScriptRoot

Write-Host ""
Write-Host "InfiniView V3 Backstage Gatherer — 24/7 server reliability setup" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

& (Join-Path $GathererReliabilityScriptsDir "register-server-startup-task.ps1")
Write-Host ""
& (Join-Path $GathererReliabilityScriptsDir "register-server-watchdog-task.ps1")
Write-Host ""

$gathererReliabilityAutoUpdateScript = Join-Path $GathererReliabilityScriptsDir "setup-auto-update-task.ps1"
if (Test-Path $gathererReliabilityAutoUpdateScript) {
    & $gathererReliabilityAutoUpdateScript
    Write-Host ""
}

Write-Host "Done. Recommended on server PC:" -ForegroundColor Green
Write-Host "  1. Windows Settings -> Power -> Sleep = Never"
Write-Host "  2. Copy data\auth\backstage-auth.json from dev PC (or npm run login once)"
Write-Host "  3. Set BACKSTAGE_HEADLESS=true in .env"
Write-Host "  4. Reboot once to confirm tasks start the server automatically"
Write-Host ""

# Suggestions For Features and Additions Later:
# - Verify tasks with Get-ScheduledTask after registration
