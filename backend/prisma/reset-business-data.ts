import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clear only CRM/demo business records. Preserve users, login sessions,
  // app settings, personal mail groups, and Prisma migration history.
  const businessTables = [
    'OpportunityStageHistory',
    'CampaignMember',
    'EmailEvent',
    'ApplicationStatusHistory',
    'OfferRevision',
    'ProjectResource',
    'AiResource',
    'AiTask',
    'ProjectTaskTemplate',
    'AiProject',
    'Placement',
    'Submission',
    'Requirement',
    'Bench',
    'Offer',
    'Interview',
    'CandidateApplication',
    'Job',
    'Candidate',
    'Activity',
    'Campaign',
    'Opportunity',
    'Contact',
    'Lead',
    'Account',
    'Notification',
    'AuditLog',
  ];

  const existing = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const existingNames = new Set(existing.map((row) => row.tablename));
  const targets = businessTables.filter((table) => existingNames.has(table));

  if (targets.length === 0) {
    console.log('No CRM business/demo tables were found to clear.');
    return;
  }

  const quoted = targets.map((table) => `"${table.replaceAll('"', '""')}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  console.log('Demo/business records cleared successfully.');
  console.log('Users, login access, application settings, and mail groups were preserved.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
