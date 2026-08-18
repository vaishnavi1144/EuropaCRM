$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "[1/4] Installing dependencies..." -ForegroundColor Cyan
npm ci
Write-Host "[2/4] Generating Prisma Client and reconciling migrations..." -ForegroundColor Cyan
npm run db:deploy-ready
Write-Host "[3/4] Building backend and frontend..." -ForegroundColor Cyan
npm run build
Write-Host "[4/4] Deployment preparation completed successfully." -ForegroundColor Green
Write-Host "Start the production backend with: npm start" -ForegroundColor Green
