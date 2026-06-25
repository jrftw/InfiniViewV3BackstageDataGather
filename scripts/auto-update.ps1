# InfiniView V3 Backstage Gatherer — auto-update script for server PC
# Pulls latest from GitHub, rebuilds, restarts server

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$LogFile = Join-Path $ProjectRoot "data\logs\auto-update.log"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Write-UpdateLog($Message) {
    $Line = "[$Timestamp] $Message"
    Add-Content -Path $LogFile -Value $Line
    Write-Host $Line
}

try {
    if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
        Write-UpdateLog "Not a git repo — skipping update"
        exit 0
    }

    $Branch = if ($env:GIT_UPDATE_BRANCH) { $env:GIT_UPDATE_BRANCH } else { "main" }

    git fetch origin 2>&1 | Out-Null
    $LocalHead = (git rev-parse HEAD).Trim()
    $RemoteHead = (git rev-parse "origin/$Branch").Trim()

    if ($LocalHead -eq $RemoteHead) {
        Write-UpdateLog "Already up to date ($LocalHead)"
        exit 0
    }

    Write-UpdateLog "Updating $LocalHead -> $RemoteHead"

    $PidFile = Join-Path $ProjectRoot ".server.pid"
    if (Test-Path $PidFile) {
        $ServerPid = Get-Content $PidFile -Raw
        if ($ServerPid -match '^\d+$') {
            Write-UpdateLog "Stopping server PID $ServerPid"
            Stop-Process -Id ([int]$ServerPid) -Force -ErrorAction SilentlyContinue
        }
    }

    git pull origin $Branch
    npm ci
    npm run build

    Write-UpdateLog "Update complete. Start-server.bat loop will restart the app."
    exit 0
}
catch {
    Write-UpdateLog "Update failed: $_"
    exit 1
}
