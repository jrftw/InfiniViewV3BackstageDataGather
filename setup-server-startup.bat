@echo off
REM Register Windows task — start gatherer server automatically at logon
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\register-server-startup-task.ps1"
pause
