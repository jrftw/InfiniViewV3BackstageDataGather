# Filename: register-server-startup-task.ps1
# Purpose: Register Windows Scheduled Task — start gatherer at boot and user logon.
# Author: Kevin Doyle Jr. / Infinitum Imagery LLC
# Last Modified: 2026-06-30
# Platform Compatibility: Windows 10/11 server PC

$GathererStartupProjectRoot = Split-Path -Parent $PSScriptRoot
$GathererStartupTaskName = "InfiniViewBackstageGathererServer"
$GathererStartupScript = Join-Path $GathererStartupProjectRoot "start-server.bat"

if (-not (Test-Path $GathererStartupScript)) {
    Write-Error "start-server.bat not found at $GathererStartupScript"
    exit 1
}

$GathererStartupAction = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$GathererStartupScript`"" `
    -WorkingDirectory $GathererStartupProjectRoot

$GathererStartupTriggerLogon = New-ScheduledTaskTrigger -AtLogOn
$GathererStartupTriggerBoot = New-ScheduledTaskTrigger -AtStartup

$GathererStartupSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $GathererStartupTaskName `
    -Action $GathererStartupAction `
    -Trigger @($GathererStartupTriggerLogon, $GathererStartupTriggerBoot) `
    -Settings $GathererStartupSettings `
    -Force | Out-Null

Write-Host "Scheduled task '$GathererStartupTaskName' registered — starts start-server.bat at boot + logon."
Write-Host "Project: $GathererStartupProjectRoot"
Write-Host "Tip: enable auto-logon on the server PC so Playwright can use the saved Backstage session."
Write-Host "To remove: Unregister-ScheduledTask -TaskName '$GathererStartupTaskName' -Confirm:`$false"

# Suggestions For Features and Additions Later:
# - Hidden VBS launcher when no interactive desktop is required
