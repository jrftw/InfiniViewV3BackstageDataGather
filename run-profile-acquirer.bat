@echo off
cd /d "%~dp0"
call npx tsx src/jobs/runProfileAcquirerJob.ts %*
