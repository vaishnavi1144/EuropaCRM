$ErrorActionPreference = "Stop"
Write-Host "Starting PostgreSQL..." -ForegroundColor Cyan
docker compose up -d

if (-not (Test-Path "backend/.env")) { Copy-Item "backend/.env.example" "backend/.env" }
if (-not (Test-Path "frontend/.env")) { Copy-Item "frontend/.env.example" "frontend/.env" }

Write-Host "Installing packages..." -ForegroundColor Cyan
npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund
Write-Host "Generating Prisma Client..." -ForegroundColor Cyan
npm run db:generate
Write-Host "Applying safe PostgreSQL migrations..." -ForegroundColor Cyan
Push-Location backend
npx prisma migrate deploy
Pop-Location
Write-Host "Creating the initial administrator login..." -ForegroundColor Cyan
npm run db:link
npm run db:seed
Write-Host "Setup complete. Login with admin / admin123, then change the password." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Green
