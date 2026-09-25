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
    const rows = await p.$queryRawUnsafe("select tablename from pg_tables where schemaname='public'");
    console.log('Connected database public tables:', rows.map(r => r.tablename));
  } catch (err) {
    console.error('Error listing tables:', (err && err.message) || err);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
