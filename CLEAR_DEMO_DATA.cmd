@echo off
setlocal
cd /d "%~dp0"

echo ==========================================================
echo       EUROPA CRM - CLEAR DEMO / BUSINESS RECORDS
echo ==========================================================
echo.
echo This keeps the existing PostgreSQL container, database,
echo administrator/users, login access, settings, and mail groups.
echo It removes only CRM demo/business records so dashboard values
 echo become zero.
echo.
choice /C YN /M "Clear all current CRM business records"
if errorlevel 2 exit /b 0

if not exist backend\.env (
  echo ERROR: backend\.env was not found.
  echo Create it from backend\.env.example and set DATABASE_URL first.
  exit /b 1
)

echo.
echo [1/3] Installing the project's pinned dependencies...
call npm install
if errorlevel 1 goto :error

echo [2/3] Generating the Prisma client with the local Prisma version...
call npm run db:generate
if errorlevel 1 goto :error

echo [3/3] Clearing demo/business records only...
call npm run db:reset-business
if errorlevel 1 goto :error

echo.
echo Completed. Refresh the dashboard or restart npm run dev.
echo Leads, contacts, accounts, opportunities, candidates, jobs,
echo consultants, submissions, projects, tasks, activities, pipeline
 echo value, and win rate should now show zero.
exit /b 0

:error
echo.
echo The cleanup stopped because a command failed.
exit /b 1
