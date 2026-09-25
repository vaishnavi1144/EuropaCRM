import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const client = new PrismaClient();
(async () => {
  try {
    await client.$connect();
    const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BenchInterview' AND column_name = 'result') THEN
    ALTER TABLE "BenchInterview" ADD COLUMN "result" TEXT NOT NULL DEFAULT 'Pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BenchInterview' AND column_name = 'rejectionReason') THEN
    ALTER TABLE "BenchInterview" ADD COLUMN "rejectionReason" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BenchInterview' AND column_name = 'rejectionStage') THEN
    ALTER TABLE "BenchInterview" ADD COLUMN "rejectionStage" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubmissionEmailStatus') THEN
    CREATE TYPE "SubmissionEmailStatus" AS ENUM ('Draft', 'Sent', 'Failed', 'Opened', 'Replied');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'SubmissionEmail') THEN
    CREATE TABLE "SubmissionEmail" (
      "id" TEXT NOT NULL,
      "submissionId" TEXT NOT NULL,
      "toEmail" TEXT NOT NULL,
      "ccEmail" TEXT,
      "subject" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "attachments" JSONB,
      "sentBy" TEXT NOT NULL,
      "sentDate" TIMESTAMP(3),
      "status" "SubmissionEmailStatus" NOT NULL DEFAULT 'Draft',
      "messageId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SubmissionEmail_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "SubmissionEmail_submissionId_idx" ON "SubmissionEmail"("submissionId");
    CREATE INDEX "SubmissionEmail_status_idx" ON "SubmissionEmail"("status");
    ALTER TABLE "SubmissionEmail" ADD CONSTRAINT "SubmissionEmail_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
`;
    await client.$executeRawUnsafe(sql);
    console.log('Database schema patched successfully.');
  } catch (err) {
    console.error('Failed to patch database schema:', err);
    process.exit(1);
  } finally {
    await client.$disconnect();
  }
})();
