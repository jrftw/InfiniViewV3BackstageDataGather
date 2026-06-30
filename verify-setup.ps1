# InfiniView V3 Backstage Gatherer — verify production setup
# Usage: .\verify-setup.ps1

Set-Location $PSScriptRoot

Write-Host "`nInfiniView V3 Gatherer — setup verification" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$fail = 0

function Test-GathererStep {
    param([string]$Label, [bool]$Ok, [string]$Hint)
    if ($Ok) {
        Write-Host "  OK   $Label" -ForegroundColor Green
    } else {
        Write-Host "  FAIL $Label" -ForegroundColor Red
        if ($Hint) { Write-Host "       $Hint" -ForegroundColor DarkYellow }
        $script:fail += 1
    }
}

Test-GathererStep "Node.js installed" (Get-Command node -ErrorAction SilentlyContinue) "Install Node.js 18+"
Test-GathererStep ".env exists" (Test-Path ".env") "Copy .env.example to .env and fill credentials"
Test-GathererStep "dist/ built" (Test-Path "dist\index.js") "Run: npm run build"
Test-GathererStep "Backstage session" (Test-Path "data\auth\backstage-auth.json") "Run: npm run login:test"

if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    Test-GathererStep "GOOGLE_MASTER_SHEET_ID set" ($envContent -match "GOOGLE_MASTER_SHEET_ID=\S+") "Add Google Sheet ID to .env"
    Test-GathererStep "Profile acquirer enabled" ($envContent -match "GATHERER_PROFILE_ACQUIRER_ENABLED=true") "Set GATHERER_PROFILE_ACQUIRER_ENABLED=true"
    Test-GathererStep "Profile chain after Backstage" ($envContent -match "GATHERER_PROFILE_ACQUIRER_AFTER_BACKSTAGE=true") "Set GATHERER_PROFILE_ACQUIRER_AFTER_BACKSTAGE=true"
    Test-GathererStep "Server headless mode" ($envContent -match "BACKSTAGE_HEADLESS=true") "Set BACKSTAGE_HEADLESS=true on server PC"
}

Write-Host "`nRunning preflight (Google + session, no export)...`n" -ForegroundColor Cyan
npm run preflight
if ($LASTEXITCODE -ne 0) { $fail += 1 }

Write-Host "`nChecking Windows scheduled tasks..." -ForegroundColor Cyan
$gathererVerifyStartupTask = Get-ScheduledTask -TaskName "InfiniViewBackstageGathererServer" -ErrorAction SilentlyContinue
$gathererVerifyWatchdogTask = Get-ScheduledTask -TaskName "InfiniViewBackstageGathererWatchdog" -ErrorAction SilentlyContinue
Test-GathererStep "Startup scheduled task" ($null -ne $gathererVerifyStartupTask) "Run: .\setup-server-reliability.bat"
Test-GathererStep "Watchdog scheduled task" ($null -ne $gathererVerifyWatchdogTask) "Run: .\setup-server-reliability.bat"

Write-Host "`nChecking dashboard port 3099..." -ForegroundColor Cyan
try {
    $status = Invoke-RestMethod -Uri "http://localhost:3099/api/status" -TimeoutSec 3 -ErrorAction Stop
    Test-GathererStep "Gatherer server running (3099)" $true
    Write-Host "       Last run: $($status | ConvertTo-Json -Compress)" -ForegroundColor DarkGray
} catch {
    Test-GathererStep "Gatherer server running (3099)" $false "Start: .\start-server.bat"
}

Write-Host ""
if ($fail -eq 0) {
    Write-Host "All checks passed. Gatherer is ready for 24/7 operation." -ForegroundColor Green
} else {
    Write-Host "$fail check(s) failed — fix above, then run .\start-server.bat" -ForegroundColor Yellow
}
Write-Host ""
