import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';

dotenv.config({ path: './backend/.env' });
const prisma = new PrismaClient();

async function run() {
  const actor = { id: null, name: 'TEST_AUTOMATION' };
  console.log('Starting bench workflow test (requires DATABASE_URL configured)...');
  await prisma.$connect();
  try {
    // Cleanup any prior test data owned by TEST_AUTOMATION
    await prisma.$transaction(async (tx) => {
      await tx.benchOffer.deleteMany({ where: { ownerName: actor.name } }).catch(() => {});
      await tx.benchInterview.deleteMany({ where: { ownerName: actor.name } }).catch(() => {});
      await tx.submissionEmail.deleteMany({ where: { sentBy: actor.name } }).catch(() => {});
      await tx.submission.deleteMany({ where: { ownerName: actor.name } }).catch(() => {});
      await tx.job.deleteMany({ where: { ownerName: actor.name } }).catch(() => {});
      await tx.bench.deleteMany({ where: { ownerName: actor.name } }).catch(() => {});
      await tx.activity.deleteMany({ where: { ownerName: actor.name } }).catch(() => {});
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1) Create a Bench consultant
      const bench = await tx.bench.create({ data: {
        candidateName: 'Test Candidate',
        skills: 'JS,TS,React',
        visaStatus: 'USC/Citizen',
        validVisa: 'Yes',
        consultantCode: `TEST-${Date.now()}`,
        experienceYears: 5,
        marketingStatus: 'Available',
        ratePerHour: 60,
        resumeUrl: 'http://example.com/resume.pdf',
        ownerName: actor.name,
        customData: {
          email: 'candidate@test.local',
          phone: '555-0100',
          primarySkill: 'React',
          expectedRate: 60,
          availableFrom: new Date().toISOString().slice(0,10),
          noticePeriod: '2 weeks',
          timeZone: 'UTC',
          source: 'SMOKE_TEST'
        }
      }});

      // 2) Create a Job
      const job = await tx.job.create({ data: {
        jobTitle: 'Test Job',
        company: 'TestCo',
        jobReference: `JOB-${Date.now()}`,
        endClient: 'ClientCo',
        implementationPartner: 'ImplCo',
        vendorCompany: 'VendorCo',
        vendorEmail: 'vendor@test.local',
        skillsRequired: 'JS,React',
        preferredSkills: 'TypeScript',
        experienceRequired: '3-6 years',
        minExperience: 3,
        maxRate: 120,
        rateType: 'Hourly',
        currency: 'USD',
        workMode: 'Remote',
        location: 'Remote',
        jobDescription: 'Smoke test job',
        status: 'Open',
        vacancyCount: 2,
        ownerName: actor.name,
        customData: { source: 'SMOKE_TEST' }
      }});

      // 3) Create a Submission for that bench -> job
      const submissionData = {
        candidateName: bench.candidateName,
        candidateCompany: 'CandidateCo',
        vendorCompany: 'VendorCo',
        vendorEmail: 'vendor@test.local',
        implementationName: 'ImplCo',
        jobTitle: job.jobTitle,
        submissionDate: new Date().toISOString().slice(0,10),
        ratePerHour: 60,
        ownerName: actor.name,
        status: 'Submitted',
        feedback: 'Initial submission from smoke test',
        customData: { source: 'SMOKE_TEST', jobReference: job.jobReference, consultantEmail: bench.customData?.email ?? 'candidate@test.local' },
        matchPercentage: 85,
        matchDetails: { score: 85, matchedSkills: ['JS','React'] }
      };

      const submission = await tx.submission.create({ data: {
        ...submissionData,
        benchConsultant: { connect: { id: bench.id } },
        job: { connect: { id: job.id } },
      } });

      // Call workflow to apply automation for submission create
      const { applyBenchAutomation } = await import('../backend/dist/src/services/benchWorkflow.js');
      await applyBenchAutomation(tx, 'submissions', submission, null, actor);

      // 4) Attempt duplicate submission (should be blocked by validation)
      let duplicateBlocked = false;
      try {
        // Use the enrichAndValidateBenchInput path to validate duplicate submission
        const { enrichAndValidateBenchInput } = await import('../backend/dist/src/services/benchWorkflow.js');
        await enrichAndValidateBenchInput(tx, 'submissions', { ...submissionData, benchConsultantId: bench.id, jobId: job.id }, submission);
      } catch (err) {
        duplicateBlocked = true;
      }

      // 5) Simulate sending resume email: create submissionEmail + activity + follow-up
      const now = new Date();
      const emailRecord = await tx.submissionEmail.create({ data: {
        submissionId: submission.id, toEmail: 'client@test.local', subject: 'Resume: Test Candidate', body: 'Please find resume attached', sentBy: actor.name, sentDate: now, status: 'Sent'
      }});
      const emailActivity = await tx.activity.create({ data: {
        activity: `Email sent: Resume`, description: 'Resume sent for testing', relatedType: 'Submission', relatedEntityType: 'Submission', relatedEntityId: submission.id, type: 'Email', status: 'Completed', priority: 'High', ownerName: actor.name, ownerId: actor.id, createdOn: now.toISOString().slice(0,10), createdTime: now.toTimeString().slice(0,5), customData: { submissionEmailId: emailRecord.id }
      }});

      // 6) Move Submission -> Interview Scheduled and run automation
      const before = submission;
      const updatedSubmission = await tx.submission.update({ where: { id: submission.id }, data: { status: 'Interview Scheduled' } });
      await applyBenchAutomation(tx, 'submissions', updatedSubmission, before, actor);

      // 7) Verify interview created
      const interview = await tx.benchInterview.findFirst({ where: { submissionId: submission.id } });

      // 8) Schedule the interview (set date/time) and run automation to create reminders
      const interviewBefore = interview;
      const scheduled = await tx.benchInterview.update({ where: { id: interview.id }, data: {
        status: 'Scheduled',
        interviewDate: new Date(Date.now()+2*24*3600*1000).toISOString().slice(0,10),
        interviewTime: '10:00',
        timeZone: 'UTC',
        interviewMode: 'Video',
        meetingLink: 'https://meet.example/test',
        interviewer: 'Test Hiring Manager',
        technology: 'React/TypeScript'
      } });
      await applyBenchAutomation(tx, 'bench-interviews', scheduled, interviewBefore, actor);

      // 9) Set interview result to Selected and run automation to create offer
      const selectedBefore = scheduled;
      const selected = await tx.benchInterview.update({ where: { id: interview.id }, data: { result: 'Selected', status: 'Completed', feedback: 'Great candidate' } });
      await applyBenchAutomation(tx, 'bench-interviews', selected, selectedBefore, actor);

      const offer = await tx.benchOffer.findFirst({ where: { benchInterviewId: interview.id } });
      const benchAfter = await tx.bench.findUnique({ where: { id: bench.id } });

      return { bench, job, submission, interview, scheduled, selected, offer, benchAfter, duplicateBlocked };
    });

    console.log('Results:', result);
    const ok = result && result.offer && result.duplicateBlocked;
    console.log(ok ? 'Bench workflow smoke test PASSED' : 'Bench workflow smoke test FAILED');
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((err) => { console.error('Test failed:', err); process.exit(1); });
