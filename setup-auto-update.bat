@echo off
REM Registers a Windows Scheduled Task to pull updates from GitHub every 15 minutes
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\setup-auto-update-task.ps1"
pause
