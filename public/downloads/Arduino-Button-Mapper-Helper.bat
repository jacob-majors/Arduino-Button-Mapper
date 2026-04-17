@echo off
setlocal
title Arduino Button Mapper Local Helper

set SCRIPT_DIR=%~dp0

if exist "%SCRIPT_DIR%backend\server.js" (
  cd /d "%SCRIPT_DIR%backend"
) else if exist "%SCRIPT_DIR%..\backend\server.js" (
  cd /d "%SCRIPT_DIR%..\backend"
) else (
  echo Could not find a backend folder next to this helper launcher.
  echo Put this file inside the helper package folder, then open it again.
  pause
  exit /b 1
)

echo Starting Arduino Button Mapper local helper on http://localhost:3001 ...
node server.js
pause
