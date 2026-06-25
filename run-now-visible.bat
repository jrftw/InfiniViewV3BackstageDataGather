@echo off
REM InfiniView V3 Backstage Gatherer — visible browser (watch automation run)
cd /d "%~dp0"
set BACKSTAGE_HEADLESS=false
set BACKSTAGE_SLOW_MO_MS=75
echo.
echo Opening Backstage in a VISIBLE browser window...
echo Close this window when the run finishes (or after an error).
echo.
call npm run gather
echo.
pause
