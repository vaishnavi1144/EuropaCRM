import { prisma } from './prisma.js';

const customDataTables = [
  'Lead',
  'Contact',
  'Account',
  'Opportunity',
  'Campaign',
  'Activity',
  'Candidate',
  'Job',
  'Interview',
  'Offer',
  'Bench',
  'Submission',
  'Placement',
  'AiProject',
  'AiTask',
  'AiResource',
] as const;

/**
 * Keeps databases created by earlier Europa CRM builds compatible with the
 * current Prisma schema. Statements are idempotent and preserve all records.
 */
export async function ensureDatabaseCompatibility() {
  await prisma.$executeRawUnsafe('ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "permissions" JSONB');

  for (const table of customDataTables) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE IF EXISTS "${table}" ADD COLUMN IF NOT EXISTS "customData" JSONB`,
    );
  }
}
