import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const p = new PrismaClient();
  try {
    await p.$connect();
    const rows = await p.$queryRawUnsafe('select id, migration_name, finished_at from _prisma_migrations order by finished_at desc');
    console.log('Applied migrations:', rows.map(r => `${r.migration_name} (finished_at=${r.finished_at})`));
  } catch (err) {
    console.error('Error listing migrations:', (err && err.message) || err);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
