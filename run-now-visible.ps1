# InfiniView V3 Backstage Gatherer — visible browser run (PowerShell)
Set-Location $PSScriptRoot
$env:BACKSTAGE_HEADLESS = "false"
$env:BACKSTAGE_SLOW_MO_MS = "75"
Write-Host ""
Write-Host "Opening Backstage in a VISIBLE browser window..."
Write-Host ""
npm run gather
Write-Host ""
Read-Host "Press Enter to close"
