#!/usr/bin/env bash
set -euo pipefail

docker compose up -d
[ -f backend/.env ] || cp backend/.env.example backend/.env
[ -f frontend/.env ] || cp frontend/.env.example frontend/.env
npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund
npm run db:generate
(
  cd backend
  npx prisma migrate deploy
)
npm run db:link
npm run db:seed
echo "Setup complete. Login with admin / admin123, then change the password."
echo "Run: npm run dev"
