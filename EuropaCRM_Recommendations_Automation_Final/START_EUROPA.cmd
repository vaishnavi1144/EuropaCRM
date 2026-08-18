@echo off
setlocal
cd /d "%~dp0"
echo [1/5] Starting PostgreSQL container...
docker start europa-crm-postgres >nul 2>&1
if errorlevel 1 (
  echo Docker container could not be started. Open Docker Desktop and try again.
  pause
  exit /b 1
)
if not exist backend\.env (
  copy /Y backend\.env.example backend\.env >nul
  echo Created backend\.env. Review it if your database credentials are different.
)
echo [2/5] Installing dependencies...
call npm install
if errorlevel 1 goto :fail
echo [3/5] Generating Prisma client...
call npm run db:generate
if errorlevel 1 goto :fail
echo [4/5] Applying migrations and repairing admin login...
pushd backend
call npx prisma migrate deploy
if errorlevel 1 (popd & goto :fail)
call npx prisma db seed
if errorlevel 1 (popd & goto :fail)
popd
echo [5/5] Starting Europa CRM...
echo Open http://localhost:5173 and login with admin / admin123
echo.
call npm run dev
goto :eof
:fail
echo.
echo Setup failed. Read the error above.
pause
exit /b 1
