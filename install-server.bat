@echo off
REM InfiniView V3 Backstage Gatherer — first-time setup on server PC
cd /d "%~dp0"
echo ============================================
echo  InfiniView V3 Backstage Gatherer Install
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed. Install Node 18+ from https://nodejs.org
  pause
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git is not installed. Install from https://git-scm.com
  pause
  exit /b 1
)

echo Installing dependencies...
call npm ci
if errorlevel 1 (
  echo npm ci failed. Trying npm install...
  call npm install
)

echo.
echo Building TypeScript...
call npm run build

if not exist ".env" (
  echo.
  echo Creating .env from .env.example — EDIT THIS FILE with your credentials.
  copy /Y ".env.example" ".env"
)

echo.
echo ============================================
echo  Next steps:
echo  1. Edit .env with Google credentials
echo  2. Run: npm run login   (log into Backstage once)
echo  3. Run: start-server.bat
echo  4. Run: setup-server-reliability.bat  (auto-start + watchdog on server PC)
echo ============================================
pause
