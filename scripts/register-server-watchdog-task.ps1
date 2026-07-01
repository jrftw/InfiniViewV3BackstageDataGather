# Filename: register-server-watchdog-task.ps1
# Purpose: Register Windows Scheduled Task - health-check gatherer every 5 minutes.
# Author: Kevin Doyle Jr. / Infinitum Imagery LLC
# Last Modified: 2026-06-30
# Platform Compatibility: Windows 10/11 server PC

$GathererWatchdogTaskName = "InfiniViewBackstageGathererWatchdog"
$GathererWatchdogProjectRoot = Split-Path -Parent $PSScriptRoot
$GathererWatchdogScriptPath = Join-Path $GathererWatchdogProjectRoot "scripts\gatherer-server-watchdog.ps1"
$GathererWatchdogIntervalMinutes = 5

if (-not (Test-Path $GathererWatchdogScriptPath)) {
    Write-Error "Watchdog script not found at $GathererWatchdogScriptPath"
    exit 1
}

$GathererWatchdogAction = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$GathererWatchdogScriptPath`"" `
    -WorkingDirectory $GathererWatchdogProjectRoot

$GathererWatchdogRepeatDuration = New-TimeSpan -Days 3650

$GathererWatchdogTrigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes $GathererWatchdogIntervalMinutes) `
    -RepetitionDuration $GathererWatchdogRepeatDuration

$GathererWatchdogSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
    -TaskName $GathererWatchdogTaskName `
    -Action $GathererWatchdogAction `
    -Trigger $GathererWatchdogTrigger `
    -Settings $GathererWatchdogSettings `
    -Force | Out-Null

Write-Host "Scheduled task '$GathererWatchdogTaskName' registered - health check every $GathererWatchdogIntervalMinutes minutes."
Write-Host "Logs: $GathererWatchdogProjectRoot/data/logs/watchdog.log"
Write-Host "To remove: Unregister-ScheduledTask -TaskName '$GathererWatchdogTaskName' -Confirm:`$false"

# Suggestions For Features and Additions Later:
# - Run watchdog once immediately after registration
