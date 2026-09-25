import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting data migration...');

  // 1. Migrate Submissions
  const submissions = await (prisma as any).submission.findMany();
  console.log(`Found ${submissions.length} submissions to inspect.`);
  for (const s of submissions) {
    const custom = s.customData && typeof s.customData === 'object' && !Array.isArray(s.customData)
      ? { ...s.customData as Record<string, unknown> }
      : {};
    let changed = false;

    let implementationName = s.implementationName;
    if (custom.clientCompany !== undefined) {
      implementationName = String(custom.clientCompany);
      delete custom.clientCompany;
      changed = true;
    }
    
    let candidateCompany = s.candidateCompany;
    if (custom.candidateCompany !== undefined) {
      candidateCompany = String(custom.candidateCompany);
      delete custom.candidateCompany;
      changed = true;
    }

    let vendorEmail = s.vendorEmail;
    if (custom.vendorEmail !== undefined) {
      vendorEmail = String(custom.vendorEmail);
      delete custom.vendorEmail;
      changed = true;
    }

    if (changed || custom.clientCompany !== undefined || custom.candidateCompany !== undefined || custom.vendorEmail !== undefined) {
      await (prisma as any).submission.update({
        where: { id: s.id },
        data: {
          implementationName,
          candidateCompany,
          vendorEmail,
          customData: custom,
        },
      });
      console.log(`Migrated submission ID: ${s.id}`);
    }
  }

  // 2. Migrate BenchInterviews
  const interviews = await (prisma as any).benchInterview.findMany();
  console.log(`Found ${interviews.length} interviews to inspect.`);
  for (const iv of interviews) {
    const custom = iv.customData && typeof iv.customData === 'object' && !Array.isArray(iv.customData)
      ? { ...iv.customData as Record<string, unknown> }
      : {};
    let changed = false;

    let technology = iv.technology;
    if (custom.technology !== undefined) {
      technology = String(custom.technology);
      delete custom.technology;
      changed = true;
    }

    let vendorEmail = iv.vendorEmail;
    if (custom.vendorEmail !== undefined) {
      vendorEmail = String(custom.vendorEmail);
      delete custom.vendorEmail;
      changed = true;
    }

    let submissionRate = iv.submissionRate;
    if (custom.submissionRate !== undefined) {
      submissionRate = Number(custom.submissionRate || 0);
      delete custom.submissionRate;
      changed = true;
    }

    let workLocation = iv.workLocation;
    if (custom.workLocation !== undefined) {
      workLocation = String(custom.workLocation);
      delete custom.workLocation;
      changed = true;
    }

    let workMode = iv.workMode;
    if (custom.workMode !== undefined) {
      workMode = String(custom.workMode);
      delete custom.workMode;
      changed = true;
    }

    if (changed) {
      await (prisma as any).benchInterview.update({
        where: { id: iv.id },
        data: {
          technology,
          vendorEmail,
          submissionRate,
          workLocation,
          workMode,
          customData: custom,
        },
      });
      console.log(`Migrated interview ID: ${iv.id}`);
    }
  }

  // 3. Migrate Placements
  const placements = await (prisma as any).placement.findMany();
  console.log(`Found ${placements.length} placements to inspect.`);
  for (const p of placements) {
    const custom = p.customData && typeof p.customData === 'object' && !Array.isArray(p.customData)
      ? { ...p.customData as Record<string, unknown> }
      : {};
    let changed = false;

    let vendorEmail = p.vendorEmail;
    if (custom.vendorEmail !== undefined) {
      vendorEmail = String(custom.vendorEmail);
      delete custom.vendorEmail;
      changed = true;
    }

    let vendorContactNumber = p.vendorContactNumber;
    if (custom.vendorContactNumber !== undefined) {
      vendorContactNumber = String(custom.vendorContactNumber);
      delete custom.vendorContactNumber;
      changed = true;
    }

    if (custom.payRate !== undefined) {
      delete custom.payRate;
      changed = true;
    }

    if (changed) {
      await (prisma as any).placement.update({
        where: { id: p.id },
        data: {
          vendorEmail,
          vendorContactNumber,
          customData: custom,
        },
      });
      console.log(`Migrated placement ID: ${p.id}`);
    }
  }

  console.log('Data migration finished successfully.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
