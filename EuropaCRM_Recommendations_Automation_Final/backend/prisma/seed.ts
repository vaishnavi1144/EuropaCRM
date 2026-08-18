import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_NAME?.trim() || 'Europa Administrator';
  const username = process.env.ADMIN_USERNAME?.trim() || 'admin';
  const email = process.env.ADMIN_EMAIL?.trim() || 'admin@europacrm.local';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const userModel = (prisma as any).user;
  const existing = await userModel.findFirst({ where: { OR: [{ username }, { email }] } });

  const admin = existing
    ? await userModel.update({
        where: { id: existing.id },
        data: { name, username, email, role: 'SUPER_ADMIN', isActive: true, passwordHash: hashPassword(password) },
      })
    : await userModel.create({
        data: { name, username, email, role: 'SUPER_ADMIN', isActive: true, passwordHash: hashPassword(password) },
      });

  const demoOwner = await userModel.findFirst({ where: { isActive: true, role: { in: ['BENCH_SALES', 'ADMIN', 'SUPER_ADMIN'] }, id: { not: admin.id } }, orderBy: { updatedAt: 'desc' } }) ?? admin;
  await seedAutomationExamples(demoOwner);
  await seedMockRecruiters();

  console.log(`Administrator login ready: ${username}`);
  console.log('Three Jobs and three Bench Consultants were seeded for the active Bench Sales user with live matching and one complete workflow example.');
}

async function seedAutomationExamples(admin: any) {
  const today = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const plusDays = (days: number) => { const d = new Date(today); d.setDate(d.getDate() + days); return iso(d); };
  const ownerData = { createdByUserId: admin.id, createdByUserName: admin.name, demoRecord: true };

  const pythonRequirement = await findOrCreateRequirement({
    title: 'Python Developer', clientCompany: 'Apex Financial', vendorCompany: 'Qwertt Staffing',
    skills: 'Python, Django, FastAPI, SQL, REST API', minExperience: 1, location: 'Chicago',
    visaRequirements: 'USC/Citizen,H1B,GC', maxRate: 65, status: 'Open', customData: { demoKey: 'DEMO-REQ-PYTHON' },
  });
  const backendRequirement = await findOrCreateRequirement({
    title: 'Backend Engineer (Python)', clientCompany: 'Northstar Health', vendorCompany: 'Vertex Staffing',
    skills: 'Python, FastAPI, PostgreSQL, REST API, Docker', minExperience: 1, location: 'Chicago',
    visaRequirements: 'USC/Citizen,H1B,GC', maxRate: 68, status: 'Open', customData: { demoKey: 'DEMO-REQ-PYTHON-BACKEND' },
  });
  const javaScriptRequirement = await findOrCreateRequirement({
    title: 'Frontend Engineer', clientCompany: 'Lkjhg Retail', vendorCompany: 'Qwertt Staffing',
    skills: 'JavaScript, TypeScript, React.js, HTML5, CSS3', minExperience: 1, location: 'Texas',
    visaRequirements: 'H1B,USC/Citizen,GC', maxRate: 70, status: 'Open', customData: { demoKey: 'DEMO-REQ-JS' },
  });

  const pythonJobData = {
    jobTitle: 'Python Developer', company: 'Apex Financial', endClient: 'Apex Financial', vendorCompany: 'Qwertt Staffing',
    vendorEmail: 'vendor@example.com', vendorContact: '+1 312 555 0101', skillsRequired: 'Python, Django, FastAPI, SQL, REST API',
    preferredSkills: 'AWS, Docker', experienceRequired: '1-3 Years', minExperience: 1, maxExperience: 3,
    visaRequirements: 'USC/Citizen,H1B,GC', maxRate: 65, rateType: 'C2C', currency: 'USD', jobType: 'Contract',
    workMode: 'Hybrid', location: 'Chicago', status: 'Open', vacancyCount: 2, receivedDate: iso(today), expiryDate: plusDays(45),
    jobDescription: 'Demo job that strongly matches the Python consultant.', ownerName: admin.name, requirementId: pythonRequirement.id,
    customData: { ...ownerData, domain: 'Financial Services' },
  };
  const pythonJob = await (prisma as any).job.upsert({
    where: { jobReference: 'JOB-DEMO-001' },
    update: pythonJobData,
    create: { jobReference: 'JOB-DEMO-001', ...pythonJobData },
  });

  const backendJobData = {
    jobTitle: 'Backend Engineer (Python)', company: 'Northstar Health', endClient: 'Northstar Health', vendorCompany: 'Vertex Staffing',
    vendorEmail: 'health.vendor@example.com', vendorContact: '+1 773 555 0102', skillsRequired: 'Python, FastAPI, PostgreSQL, REST API, Docker',
    preferredSkills: 'AWS, Kubernetes', experienceRequired: '1-4 Years', minExperience: 1, maxExperience: 4,
    visaRequirements: 'USC/Citizen,H1B,GC', maxRate: 68, rateType: 'C2C', currency: 'USD', jobType: 'Contract',
    workMode: 'Hybrid', location: 'Chicago', status: 'Open', vacancyCount: 1, receivedDate: iso(today), expiryDate: plusDays(50),
    jobDescription: 'Second Python role that produces a good/review match for the same consultant.', ownerName: admin.name,
    requirementId: backendRequirement.id, customData: { ...ownerData, domain: 'Healthcare' },
  };
  await (prisma as any).job.upsert({
    where: { jobReference: 'JOB-DEMO-002' },
    update: backendJobData,
    create: { jobReference: 'JOB-DEMO-002', ...backendJobData },
  });

  const frontendJobData = {
    jobTitle: 'Frontend Engineer', company: 'Lkjhg Retail', endClient: 'Lkjhg Retail', vendorCompany: 'Qwertt Staffing',
    vendorEmail: 'frontend.vendor@example.com', vendorContact: '+1 214 555 0103', skillsRequired: 'JavaScript, TypeScript, React.js, HTML5, CSS3',
    preferredSkills: 'Node.js, Jest', experienceRequired: '1-4 Years', minExperience: 1, maxExperience: 4,
    visaRequirements: 'H1B,USC/Citizen,GC', maxRate: 70, rateType: 'C2C', currency: 'USD', jobType: 'Contract',
    workMode: 'Remote', location: 'Texas', status: 'Open', vacancyCount: 2, receivedDate: iso(today), expiryDate: plusDays(60),
    jobDescription: 'Demo role that strongly matches the JavaScript consultant.', ownerName: admin.name,
    requirementId: javaScriptRequirement.id, customData: { ...ownerData, domain: 'Retail' },
  };
  const frontendJob = await (prisma as any).job.upsert({
    where: { jobReference: 'JOB-DEMO-003' },
    update: frontendJobData,
    create: { jobReference: 'JOB-DEMO-003', ...frontendJobData },
  });

  const harshaData = {
    candidateName: 'Harsha', skills: 'Python, Django, FastAPI, SQL, REST API, Git', visaStatus: 'USC/Citizen', validVisa: plusDays(730),
    experienceYears: 1.5, marketingStatus: 'Active', ratePerHour: 59, resumeUrl: '/uploads/demo-harsha-resume.pdf', ownerName: admin.name,
    ownerId: admin.id, customData: { ...ownerData, email: 'harsha.demo@example.com', phone: '+1 312 555 0199', primarySkill: 'Python',
      technology: 'Python', currentJobTitle: 'Python Developer', currentLocation: 'Chicago', availableFrom: plusDays(7), noticePeriod: '1 Week',
      expectedRate: 59, workPreference: 'Hybrid', education: 'B.Tech Computer Science', certifications: 'Python Professional',
      projects: 'Financial REST API platform', profileCompletion: 100 },
  };
  const harsha = await (prisma as any).bench.upsert({
    where: { consultantCode: 'CON-DEMO-001' }, update: harshaData, create: { consultantCode: 'CON-DEMO-001', ...harshaData },
  });

  const bhavanaData = {
    candidateName: 'Mankala Bhavana', skills: 'JavaScript, TypeScript, React.js, HTML5, CSS3, Node.js', visaStatus: 'H1B', validVisa: plusDays(500),
    experienceYears: 2, marketingStatus: 'Active', ratePerHour: 60, resumeUrl: '/uploads/demo-bhavana-resume.pdf', ownerName: admin.name,
    ownerId: admin.id, customData: { ...ownerData, email: 'bhavana.demo@example.com', phone: '+1 214 555 0188', primarySkill: 'JavaScript',
      technology: 'JavaScript', currentJobTitle: 'Frontend Engineer', currentLocation: 'Texas', availableFrom: plusDays(14), noticePeriod: '1 Week',
      expectedRate: 60, workPreference: 'Remote', education: 'B.Tech Information Technology', certifications: 'React Developer',
      projects: 'Retail commerce UI', profileCompletion: 100 },
  };
  const bhavana = await (prisma as any).bench.upsert({
    where: { consultantCode: 'CON-DEMO-002' }, update: bhavanaData, create: { consultantCode: 'CON-DEMO-002', ...bhavanaData },
  });

  const rahulData = {
    candidateName: 'Rahul Workflow Demo', skills: 'JavaScript, TypeScript, React.js, HTML5, CSS3', visaStatus: 'H1B', validVisa: plusDays(500),
    experienceYears: 3, marketingStatus: 'Placed', ratePerHour: 62, resumeUrl: '/uploads/demo-rahul-resume.pdf', ownerName: admin.name,
    ownerId: admin.id, customData: { ...ownerData, email: 'rahul.workflow@example.com', phone: '+1 214 555 0177', primarySkill: 'React.js',
      technology: 'JavaScript', currentJobTitle: 'Frontend Engineer', currentLocation: 'Texas', availableFrom: plusDays(7), noticePeriod: '1 Week',
      expectedRate: 62, workPreference: 'Remote', education: 'B.Tech Computer Science', certifications: 'React Professional',
      projects: 'Retail storefront modernization', profileCompletion: 100 },
  };
  const rahul = await (prisma as any).bench.upsert({
    where: { consultantCode: 'CON-DEMO-003' }, update: rahulData, create: { consultantCode: 'CON-DEMO-003', ...rahulData },
  });

  // A separate third consultant demonstrates the complete downstream workflow without removing
  // Harsha or Bhavana from the Active Bench matching examples.
  let submission = await (prisma as any).submission.findFirst({ where: { benchConsultantId: rahul.id, jobId: frontendJob.id, vendorCompany: 'Qwertt Staffing' } });
  if (!submission) submission = await (prisma as any).submission.create({
    data: {
      candidateName: rahul.candidateName, candidateCompany: 'Europa Demo Bench', vendorCompany: 'Qwertt Staffing', vendorEmail: 'frontend.vendor@example.com', implementationName: 'Retail Delivery',
      jobTitle: frontendJob.jobTitle, ratePerHour: 62, submissionDate: iso(today), status: 'Selected', ownerName: admin.name,
      benchConsultantId: rahul.id, requirementId: javaScriptRequirement.id, jobId: frontendJob.id, matchPercentage: 94,
      matchDetails: { percentage: 94, category: 'Strong Match', strengths: ['All core frontend skills matched', 'Rate within range', 'Location and visa matched'], warnings: [] },
      customData: { ...ownerData, source: 'DEMO_AUTOMATION', endClient: 'Lkjhg Retail', workLocation: 'Texas', workMode: 'Remote', nextFollowUpDate: plusDays(2), activityTimeline: ['Resume Submitted', 'Interview Scheduled', 'Interview Completed', 'Selected'] },
    },
  });

  let interview = await (prisma as any).benchInterview.findFirst({ where: { submissionId: submission.id } });
  if (!interview) interview = await (prisma as any).benchInterview.create({
    data: {
      candidateName: rahul.candidateName, submissionId: submission.id, benchConsultantId: rahul.id, clientCompany: 'Lkjhg Retail', vendorCompany: 'Qwertt Staffing',
      jobTitle: frontendJob.jobTitle, technology: 'JavaScript / React.js', vendorEmail: 'frontend.vendor@example.com', submissionRate: 62, workLocation: 'Texas', workMode: 'Remote',
      interviewRound: 'Technical Round', interviewDate: plusDays(1), interviewTime: '10:30', timeZone: 'CST', interviewMode: 'Video', interviewer: 'Demo Hiring Manager', status: 'Selected', feedbackDate: iso(today), feedback: 'Strong frontend engineering and communication skills.', ownerName: admin.name,
      customData: { ...ownerData, source: 'DEMO_AUTOMATION', result: 'Selected' },
    },
  });

  let offer = await (prisma as any).benchOffer.findFirst({ where: { submissionId: submission.id } });
  if (!offer) offer = await (prisma as any).benchOffer.create({
    data: {
      candidateName: rahul.candidateName, submissionId: submission.id, benchConsultantId: rahul.id, benchInterviewId: interview.id,
      clientCompany: 'Lkjhg Retail', vendorCompany: 'Qwertt Staffing', jobTitle: frontendJob.jobTitle, offerDate: iso(today), offerReceivedDate: iso(today),
      offerAcceptedDate: iso(today), expectedJoiningDate: plusDays(7), billRate: 62, payRate: 50, rateType: 'C2C', workLocation: 'Texas', contractDuration: '12 Months', status: 'Accepted', ownerName: admin.name,
      customData: { ...ownerData, source: 'DEMO_AUTOMATION', workMode: 'Remote', onboardingStatus: 'In Progress' },
    },
  });

  const placement = await (prisma as any).placement.findFirst({ where: { submissionId: submission.id } });
  if (!placement) await (prisma as any).placement.create({
    data: {
      candidateName: rahul.candidateName, clientCompany: 'Lkjhg Retail', vendorCompany: 'Qwertt Staffing', vendorEmail: 'frontend.vendor@example.com', vendorContactNumber: '+1 214 555 0103',
      billingRate: 62, startDate: plusDays(7), endDate: plusDays(372), status: 'Onboarding', ownerName: admin.name,
      submissionId: submission.id, benchConsultantId: rahul.id, benchOfferId: offer.id,
      customData: { ...ownerData, source: 'DEMO_AUTOMATION', joiningDate: plusDays(7), jobTitle: frontendJob.jobTitle, workLocation: 'Texas', workMode: 'Remote', onboardingStatus: 'In Progress' },
    },
  });

  // Keep active matching consultants available even when seed is rerun after testing the workflow.
  await (prisma as any).bench.update({ where: { id: harsha.id }, data: { marketingStatus: 'Active' } });
  await (prisma as any).bench.update({ where: { id: bhavana.id }, data: { marketingStatus: 'Active' } });
}

async function findOrCreateRequirement(data: any) {
  const existing = await (prisma as any).requirement.findFirst({ where: { title: data.title, clientCompany: data.clientCompany, skills: data.skills } });
  return existing ?? (prisma as any).requirement.create({ data });
}

async function seedMockRecruiters() {
  const recruiters = [
    {
      name: 'Harsha',
      email: 'harsha@europacrm.com',
      username: 'harsha',
      role: 'BENCHSALES',
      submissions: 48,
      interviews: 26,
      r1: 12,
      r2: 6,
      r3: 2,
      offers: 9,
      placements: 7,
      revenue: 68500,
    },
    {
      name: 'Veeru',
      email: 'veeru@europacrm.com',
      username: 'veeru',
      role: 'BENCHSALES',
      submissions: 35,
      interviews: 18,
      r1: 10,
      r2: 4,
      r3: 1,
      offers: 5,
      placements: 3,
      revenue: 32000,
    },
    {
      name: 'Sai Kumar',
      email: 'saikumar@europacrm.com',
      username: 'saikumar',
      role: 'BENCHSALES',
      submissions: 42,
      interviews: 21,
      r1: 11,
      r2: 5,
      r3: 2,
      offers: 7,
      placements: 5,
      revenue: 52300,
    },
    {
      name: 'Ramesh',
      email: 'ramesh@europacrm.com',
      username: 'ramesh',
      role: 'BENCHSALES',
      submissions: 37,
      interviews: 16,
      r1: 8,
      r2: 3,
      r3: 1,
      offers: 4,
      placements: 2,
      revenue: 25000,
    },
    {
      name: 'Pavan',
      email: 'pavan@europacrm.com',
      username: 'pavan',
      role: 'BENCHSALES',
      submissions: 28,
      interviews: 12,
      r1: 6,
      r2: 2,
      r3: 1,
      offers: 3,
      placements: 1,
      revenue: 15000,
    }
  ];

  const userModel = (prisma as any).user;
  const placementModel = (prisma as any).placement;
  const offerModel = (prisma as any).benchOffer;
  const interviewModel = (prisma as any).benchInterview;
  const submissionModel = (prisma as any).submission;
  const benchModel = (prisma as any).bench;

  for (const r of recruiters) {
    const existingUser = await userModel.findFirst({ where: { OR: [{ email: r.email }, { username: r.username }] } });
    if (existingUser) {
      const consultants = await benchModel.findMany({ where: { ownerId: existingUser.id } });
      const consultantIds = consultants.map((c: any) => c.id);
      
      await placementModel.deleteMany({ where: { benchConsultantId: { in: consultantIds } } });
      await offerModel.deleteMany({ where: { benchConsultantId: { in: consultantIds } } });
      await interviewModel.deleteMany({ where: { benchConsultantId: { in: consultantIds } } });
      await submissionModel.deleteMany({ where: { benchConsultantId: { in: consultantIds } } });
      await benchModel.deleteMany({ where: { ownerId: existingUser.id } });
      await userModel.delete({ where: { id: existingUser.id } });
    }
  }

  const passwordHash = hashPassword('recruiter123');
  for (const r of recruiters) {
    const user = await userModel.create({
      data: {
        name: r.name,
        email: r.email,
        username: r.username,
        role: r.role,
        isActive: true,
        passwordHash,
      }
    });

    const consultants = [];
    const numConsultants = Math.max(r.placements, 5);
    for (let i = 0; i < numConsultants; i++) {
      const c = await benchModel.create({
        data: {
          consultantCode: `CON-MOCK-${user.username.toUpperCase()}-${i}`,
          candidateName: `${r.name} Consultant ${i + 1}`,
          skills: 'Java, Spring Boot, React, SQL',
          visaStatus: 'H1B',
          validVisa: '2028-12-31',
          experienceYears: 5,
          marketingStatus: i < r.placements ? 'Placed' : 'Active',
          ratePerHour: 60,
          ownerName: r.name,
          ownerId: user.id,
          customData: {
            email: `${user.username}.c${i}@example.com`,
            phone: '1234567890',
            noticePeriod: '1 Week',
          }
        }
      });
      consultants.push(c);
    }

    const averageBillingRate = r.revenue / 160 / r.placements;
    const placements = [];
    for (let i = 0; i < r.placements; i++) {
      const p = await placementModel.create({
        data: {
          candidateName: consultants[i].candidateName,
          clientCompany: 'Mock End Client',
          vendorCompany: i % 2 === 0 ? 'ABC Staffing' : 'Tech Solutions',
          billingRate: averageBillingRate,
          startDate: '2026-05-01',
          endDate: '2027-05-01',
          status: 'Active',
          ownerName: r.name,
          benchConsultantId: consultants[i].id,
        }
      });
      placements.push(p);
    }

    const submissions = [];
    const vendors = ['ABC Staffing', 'Tech Solutions', 'Global Tech', 'Innovative IT', 'IT People'];
    const jobs = ['Java Developer', 'Frontend Engineer', 'Fullstack Developer', 'React Specialist'];
    for (let i = 0; i < r.submissions; i++) {
      const consultant = consultants[i % consultants.length];
      const vendor = vendors[i % vendors.length];
      const job = jobs[i % jobs.length];
      const status = i < r.placements ? 'Accepted' : (i < r.offers ? 'Selected' : 'Submitted');
      const sub = await submissionModel.create({
        data: {
          candidateName: consultant.candidateName,
          vendorCompany: vendor,
          jobTitle: job,
          ratePerHour: 60,
          submissionDate: '2026-05-01',
          status: status,
          ownerName: r.name,
          benchConsultantId: consultant.id,
        }
      });
      submissions.push(sub);
    }

    const offers = [];
    for (let i = 0; i < r.offers; i++) {
      const sub = submissions[i];
      const status = i < r.placements ? 'Accepted' : 'Pending';
      const off = await offerModel.create({
        data: {
          candidateName: sub.candidateName,
          submissionId: sub.id,
          benchConsultantId: sub.benchConsultantId!,
          clientCompany: 'Mock End Client',
          vendorCompany: sub.vendorCompany,
          jobTitle: sub.jobTitle,
          offerDate: '2026-05-10',
          billRate: averageBillingRate,
          payRate: averageBillingRate - 10,
          rateType: 'C2C',
          status: status,
          ownerName: r.name,
        }
      });
      offers.push(off);
    }

    let interviewCount = 0;
    for (let i = 0; i < r.r1; i++) {
      if (interviewCount >= r.interviews) break;
      const sub = submissions[interviewCount % submissions.length];
      await interviewModel.create({
        data: {
          candidateName: sub.candidateName,
          submissionId: sub.id,
          benchConsultantId: sub.benchConsultantId!,
          clientCompany: 'Mock End Client',
          vendorCompany: sub.vendorCompany,
          jobTitle: sub.jobTitle,
          interviewRound: 'Round 1',
          interviewDate: '2026-05-05',
          status: 'Completed',
          result: 'Selected',
          ownerName: r.name,
        }
      });
      interviewCount++;
    }

    for (let i = 0; i < r.r2; i++) {
      if (interviewCount >= r.interviews) break;
      const sub = submissions[interviewCount % submissions.length];
      await interviewModel.create({
        data: {
          candidateName: sub.candidateName,
          submissionId: sub.id,
          benchConsultantId: sub.benchConsultantId!,
          clientCompany: 'Mock End Client',
          vendorCompany: sub.vendorCompany,
          jobTitle: sub.jobTitle,
          interviewRound: 'Round 2',
          interviewDate: '2026-05-06',
          status: 'Completed',
          result: 'Selected',
          ownerName: r.name,
        }
      });
      interviewCount++;
    }

    for (let i = 0; i < r.r3; i++) {
      if (interviewCount >= r.interviews) break;
      const sub = submissions[interviewCount % submissions.length];
      await interviewModel.create({
        data: {
          candidateName: sub.candidateName,
          submissionId: sub.id,
          benchConsultantId: sub.benchConsultantId!,
          clientCompany: 'Mock End Client',
          vendorCompany: sub.vendorCompany,
          jobTitle: sub.jobTitle,
          interviewRound: 'Round 3',
          interviewDate: '2026-05-07',
          status: 'Completed',
          result: 'Selected',
          ownerName: r.name,
        }
      });
      interviewCount++;
    }

    while (interviewCount < r.interviews) {
      const sub = submissions[interviewCount % submissions.length];
      await interviewModel.create({
        data: {
          candidateName: sub.candidateName,
          submissionId: sub.id,
          benchConsultantId: sub.benchConsultantId!,
          clientCompany: 'Mock End Client',
          vendorCompany: sub.vendorCompany,
          jobTitle: sub.jobTitle,
          interviewRound: 'Round 1',
          interviewDate: '2026-05-08',
          status: 'Scheduled',
          result: 'Pending',
          ownerName: r.name,
        }
      });
      interviewCount++;
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
