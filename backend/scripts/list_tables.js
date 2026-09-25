const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    await p.$connect();
    const rows = await p.$queryRawUnsafe("select tablename from pg_tables where schemaname='public'");
    console.log('Connected database public tables:', rows.map(r => r.tablename));
  } catch (err) {
    console.error('Error listing tables:', err.message || err);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
