@echo off
REM InfiniView V3 Backstage Gatherer — start server with auto-restart after git updates
cd /d "%~dp0"
title InfiniView V3 Backstage Gatherer Server

:loop
echo [%date% %time%] Starting gatherer server...
call npm run start
echo [%date% %time%] Server stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
