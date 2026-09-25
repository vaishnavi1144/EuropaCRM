@echo off
setlocal
cd /d "%~dp0"

echo [1/4] Installing dependencies...
call npm ci
if errorlevel 1 goto :error

echo [2/4] Generating Prisma Client and reconciling migrations...
call npm run db:deploy-ready
if errorlevel 1 goto :error

echo [3/4] Building backend and frontend...
call npm run build
if errorlevel 1 goto :error

echo [4/4] Deployment preparation completed successfully.
echo Start the production backend with: npm start
exit /b 0

:error
echo Deployment preparation failed. Review the error above.
exit /b 1
