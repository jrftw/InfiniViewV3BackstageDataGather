@echo off
REM InfiniView V3 Backstage Gatherer — manual run (uses BACKSTAGE_HEADLESS from .env)
cd /d "%~dp0"
call npm run gather
pause
