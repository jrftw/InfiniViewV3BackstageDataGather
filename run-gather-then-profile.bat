@echo off
REM InfiniView V3 Backstage Gatherer — full pipeline: Backstage export then profile batch
cd /d "%~dp0"
title InfiniView V3 — Backstage + Profile Pipeline

echo.
echo === Step 1/2: Backstage gather (export, merge, CRM/DIP, Google Sheet) ===
call npm run gather
if errorlevel 1 (
  echo Backstage gather failed — profile batch skipped.
  pause
  exit /b 1
)

echo.
echo === Step 2/2: Profile acquirer batch (stale creators, up to batch limit) ===
call npm run profile-acquire
pause
