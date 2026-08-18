@echo off
setlocal
cd /d "%~dp0"
docker start europa-crm-postgres >nul 2>&1
if errorlevel 1 (
  echo Open Docker Desktop, wait until it is running, then try again.
  pause
  exit /b 1
)
echo Starting Europa CRM. Open http://localhost:5173
echo Login: admin / admin123
call npm run dev
