# Filename: gatherer-server-watchdog.ps1
# Purpose: Ensure the gatherer HTTP server stays up - restart start-server.bat if port 3099 is down.
# Author: Kevin Doyle Jr. / Infinitum Imagery LLC
# Last Modified: 2026-06-30
# Platform Compatibility: Windows 10/11 server PC

param(
    [int]$GathererWatchdogPort = 3099,
    [int]$GathererWatchdogTimeoutSec = 10
)

$GathererWatchdogProjectRoot = Split-Path -Parent $PSScriptRoot
$GathererWatchdogStartScript = Join-Path $GathererWatchdogProjectRoot "start-server.bat"
$GathererWatchdogLogDir = Join-Path $GathererWatchdogProjectRoot "data\logs"
$GathererWatchdogLogFile = Join-Path $GathererWatchdogLogDir "watchdog.log"
$GathererWatchdogStatusUrl = "http://localhost:$GathererWatchdogPort/api/status"

function Write-GathererWatchdogLog {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $Message"
    if (-not (Test-Path $GathererWatchdogLogDir)) {
        New-Item -ItemType Directory -Path $GathererWatchdogLogDir -Force | Out-Null
    }
    Add-Content -Path $GathererWatchdogLogFile -Value $line -Encoding UTF8
}

function Test-GathererWatchdogServerHealthy {
    try {
        Invoke-RestMethod -Uri $GathererWatchdogStatusUrl -TimeoutSec $GathererWatchdogTimeoutSec -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Get-GathererWatchdogNodeServerProcesses {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "dist\\index\.js" -or $_.CommandLine -match "dist/index.js" }
}

function Start-GathererWatchdogServer {
    if (-not (Test-Path $GathererWatchdogStartScript)) {
        Write-GathererWatchdogLog "ERROR start-server.bat missing at $GathererWatchdogStartScript"
        exit 1
    }

    Write-GathererWatchdogLog "Starting gatherer via start-server.bat (minimized)"
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c `"$GathererWatchdogStartScript`"" `
        -WorkingDirectory $GathererWatchdogProjectRoot `
        -WindowStyle Minimized | Out-Null
}

Set-Location $GathererWatchdogProjectRoot

if (Test-GathererWatchdogServerHealthy) {
    Write-GathererWatchdogLog "OK port $GathererWatchdogPort responding"
    exit 0
}

$gathererWatchdogExistingProcesses = @(Get-GathererWatchdogNodeServerProcesses)

if ($gathererWatchdogExistingProcesses.Count -gt 0) {
    Write-GathererWatchdogLog "WARN port $GathererWatchdogPort not responding but node dist/index.js is running - waiting for next check"
    exit 0
}

Start-GathererWatchdogServer
exit 0

# Suggestions For Features and Additions Later:
# - Optional stale-process kill when port stays dead for N minutes
# - Email/Slack alert when restart is triggered
