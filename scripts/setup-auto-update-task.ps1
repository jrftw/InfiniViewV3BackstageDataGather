# Registers scheduled task for GitHub auto-update on server PC
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TaskName = "InfiniViewBackstageGathererAutoUpdate"
$ScriptPath = Join-Path $ProjectRoot "scripts\auto-update.ps1"
$IntervalMinutes = 15

if (-not (Get-Command schtasks -ErrorAction SilentlyContinue)) {
    Write-Error "schtasks not available"
    exit 1
}

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration ([TimeSpan]::MaxValue)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null

Write-Host "Scheduled task '$TaskName' registered — checks GitHub every $IntervalMinutes minutes."
Write-Host "Make sure start-server.bat is running so the app restarts after updates."
