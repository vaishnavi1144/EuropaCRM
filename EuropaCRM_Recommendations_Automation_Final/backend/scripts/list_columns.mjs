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
    for (const tbl of ['BenchInterview','SubmissionEmail']) {
      const cols = await p.$queryRawUnsafe(`select column_name, data_type from information_schema.columns where table_name='${tbl}' order by ordinal_position`);
      console.log(`Columns for ${tbl}:`, cols.map(c => `${c.column_name} (${c.data_type})`));
    }
  } catch (err) {
    console.error('Error listing columns:', (err && err.message) || err);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
