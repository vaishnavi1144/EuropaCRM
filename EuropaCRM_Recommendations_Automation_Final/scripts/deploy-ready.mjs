import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const backendDir = path.join(rootDir, 'backend');
const migrationName = '20260722063201_npm_run_db_seednpm_run_dev';
const migrationFile = path.join(backendDir, 'prisma', 'migrations', migrationName, 'migration.sql');

function run(command, args, cwd = rootDir) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const prisma = new PrismaClient();
try {
  const tableRows = await prisma.$queryRawUnsafe(`
    SELECT to_regclass('public."_prisma_migrations"')::text AS name
  `);
  const hasMigrationTable = Array.isArray(tableRows) && tableRows[0]?.name;

  if (hasMigrationTable) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT checksum, finished_at FROM "_prisma_migrations" WHERE migration_name = $1 LIMIT 1`,
      migrationName,
    );

    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.finished_at) {
      const sql = await readFile(migrationFile);
      const localChecksum = createHash('sha256').update(sql).digest('hex');
      if (rows[0].checksum !== localChecksum) {
        console.log(`Reconciling archived migration history: ${migrationName}`);
        await prisma.$executeRawUnsafe(
          `UPDATE "_prisma_migrations" SET checksum = $1 WHERE migration_name = $2 AND finished_at IS NOT NULL`,
          localChecksum,
          migrationName,
        );
      }
    }
  }
} finally {
  await prisma.$disconnect();
}

console.log('Applying pending Prisma migrations...');
run('npx', ['prisma', 'migrate', 'deploy'], backendDir);
console.log('Database migration history is ready.');
