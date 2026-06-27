# Registers a Windows Scheduled Task to start the gatherer server at user logon.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\register-server-startup-task.ps1

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TaskName = "InfiniViewBackstageGathererServer"
$StartScript = Join-Path $ProjectRoot "start-server.bat"

if (-not (Test-Path $StartScript)) {
    Write-Error "start-server.bat not found at $StartScript"
    exit 1
}

$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$StartScript`"" -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null

Write-Host "Scheduled task '$TaskName' registered — starts start-server.bat at Windows logon."
Write-Host "Project: $ProjectRoot"
Write-Host "To remove: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
