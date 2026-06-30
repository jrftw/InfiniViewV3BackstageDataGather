@echo off
REM InfiniView V3 Backstage Gatherer — register 24/7 startup + watchdog + auto-update tasks
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\register-server-reliability-tasks.ps1"
pause
