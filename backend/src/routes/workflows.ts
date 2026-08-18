import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hasPermission } from '../lib/permissions.js';
import { emitResourceEvent } from '../lib/socket.js';
import { notifyUsers } from '../services/audit.js';
import { calculateRequirementMatch } from '../lib/matching.js';
import { applyBenchAutomation, createPlacementFromAcceptedOffer, flattenRecord as flattenBenchRecord, type WorkflowEvent } from '../services/benchWorkflow.js';

export const workflowsRouter = Router();

function matchingRequirementFromJob(job: any) {
  const requirement = job.requirement ?? {};
  return {
    skills: requirement.skills || job.skillsRequired || '',
    preferredSkills: job.preferredSkills || (requirement.customData as any)?.preferredSkills || null,
    minExperience: Number(requirement.minExperience ?? job.minExperience ?? 0),
    maxExperience: job.maxExperience ?? (requirement.customData as any)?.maxExperience ?? null,
    location: requirement.location ?? job.location ?? null,
    visaRequirements: requirement.visaRequirements ?? job.visaRequirements ?? null,
    maxRate: requirement.maxRate ?? job.maxRate ?? null,
    workMode: job.workMode ?? (requirement.customData as any)?.workMode ?? null,
    domain: (job.customData as any)?.domain ?? (requirement.customData as any)?.domain ?? null,
  };
}

async function ensureJobRequirement(tx: any, job: any) {
  if (job.requirementId && job.requirement) return job;
  const requirementData = {
    title: job.jobTitle,
    clientCompany: job.endClient || job.company,
    vendorCompany: job.vendorCompany || null,
    skills: job.skillsRequired || '',
    minExperience: Number(job.minExperience || 0),
    location: job.location || null,
    visaRequirements: job.visaRequirements || null,
    maxRate: job.maxRate == null ? null : Number(job.maxRate),
    status: job.status,
    customData: {
      source: 'JOB_AUTOMATION_REPAIR', jobId: job.id, jobReference: job.jobReference,
      maxExperience: job.maxExperience, workMode: job.workMode, rateType: job.rateType,
      currency: job.currency || 'USD', expiryDate: job.expiryDate, preferredSkills: job.preferredSkills,
    },
  };
  const requirement = await tx.requirement.create({ data: requirementData });
  return tx.job.update({ where: { id: job.id }, data: { requirementId: requirement.id }, include: { requirement: true } });
}

function requirePermission(permission: string) {
  return (_req: any, res: any, next: any) => hasPermission(res.locals.authUser ?? {}, permission)
    ? next()
    : res.status(403).json({ message: 'You do not have permission to perform this workflow.' });
}

const convertLeadSchema = z.object({
  opportunityName: z.string().trim().min(1).optional(),
  amount: z.coerce.number().int().nonnegative().default(0),
  closeDate: z.string().optional(),
  deliveryType: z.string().optional(),
});

workflowsRouter.post('/leads/:id/convert', requirePermission('leads'), async (req, res, next) => {
  try {
    const input = convertLeadSchema.parse(req.body ?? {});
    const actor = res.locals.authUser;
    const result = await prisma.$transaction(async (tx: any) => {
      const lead = await tx.lead.findUnique({ where: { id: req.params.id } });
      if (!lead) throw Object.assign(new Error('Lead not found.'), { statusCode: 404 });
      if (lead.convertedOpportunityId) {
        const [contact, account, opportunity] = await Promise.all([
          lead.convertedContactId ? tx.contact.findUnique({ where: { id: lead.convertedContactId } }) : null,
          lead.convertedAccountId ? tx.account.findUnique({ where: { id: lead.convertedAccountId } }) : null,
          tx.opportunity.findUnique({ where: { id: lead.convertedOpportunityId } }),
        ]);
        return { idempotent: true, lead, contact, account, opportunity, activity: null };
      }
      const normalizedEmail = lead.email.trim().toLowerCase();
      let account = await tx.account.findFirst({ where: { normalizedName: normalizeName(lead.company) } });
      if (!account) account = await tx.account.create({ data: { accountName: lead.company, normalizedName: normalizeName(lead.company), accountType: 'Prospect', lifecycleStatus: 'Prospect', email: normalizedEmail, ownerName: lead.ownerName, ownerId: lead.ownerId } });
      let contact = await tx.contact.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } } });
      if (!contact) contact = await tx.contact.create({ data: { name: lead.name, company: lead.company, email: normalizedEmail, phone: lead.phone, ownerName: lead.ownerName, ownerId: lead.ownerId, accountId: account.id, sourceLeadId: lead.id } });
      else if (!contact.accountId || !contact.sourceLeadId) contact = await tx.contact.update({ where: { id: contact.id }, data: { accountId: contact.accountId ?? account.id, sourceLeadId: contact.sourceLeadId ?? lead.id } });
      const opportunity = await tx.opportunity.create({ data: { opportunityName: input.opportunityName ?? `${lead.company} Opportunity`, accountName: account.accountName, accountId: account.id, primaryContactId: contact.id, sourceLeadId: lead.id, amount: input.amount, closeDate: input.closeDate, deliveryType: input.deliveryType, ownerName: lead.ownerName, ownerId: lead.ownerId, probability: 10 } });
      const activity = await tx.activity.create({ data: { activity: 'Follow up converted lead', description: `Follow up on ${opportunity.opportunityName}`, relatedTo: opportunity.opportunityName, relatedType: 'Opportunity', relatedEntityType: 'Opportunity', relatedEntityId: opportunity.id, type: 'Follow-up', ownerName: lead.ownerName, ownerId: lead.ownerId } });
      const updatedLead = await tx.lead.update({ where: { id: lead.id }, data: { status: 'Converted', convertedAt: new Date(), convertedById: actor.id, convertedContactId: contact.id, convertedAccountId: account.id, convertedOpportunityId: opportunity.id } });
      await tx.auditLog.create({ data: { userId: actor.id, action: 'LEAD_CONVERTED', entityType: 'Lead', entityId: lead.id, beforeData: lead, afterData: updatedLead, metadata: { contactId: contact.id, accountId: account.id, opportunityId: opportunity.id, activityId: activity.id } } });
      return { idempotent: false, lead: updatedLead, contact, account, opportunity, activity };
    });
    emitResourceEvent('leads', 'updated', result.lead);
    if (!result.idempotent) {
      emitResourceEvent('contacts', 'created', result.contact);
      emitResourceEvent('accounts', 'created', result.account);
      emitResourceEvent('opportunities', 'created', result.opportunity);
      emitResourceEvent('activities', 'created', result.activity);
    }
    res.json({ message: result.idempotent ? 'Lead was already converted. Existing linked records were returned.' : 'Lead converted successfully.', ...result });
  } catch (error) { next(error); }
});

const closeWonSchema = z.object({ finalAmount: z.coerce.number().int().positive(), closeDate: z.string().min(1), notes: z.string().trim().min(1), deliveryType: z.string().trim().min(1) });
workflowsRouter.post('/opportunities/:id/close-won', requirePermission('opportunities'), async (req, res, next) => {
  try {
    const input = closeWonSchema.parse(req.body);
    const actor = res.locals.authUser;
    const result = await prisma.$transaction(async (tx: any) => {
      const opportunity = await tx.opportunity.findUnique({ where: { id: req.params.id }, include: { account: true, primaryContact: true, aiProject: true } });
      if (!opportunity) throw Object.assign(new Error('Opportunity not found.'), { statusCode: 404 });
      if (opportunity.stage === 'Closed Won' && (!isAi(input.deliveryType) || opportunity.aiProject)) return { idempotent: true, opportunity, project: opportunity.aiProject };
      const updated = await tx.opportunity.update({ where: { id: opportunity.id }, data: { stage: 'Closed Won', finalAmount: input.finalAmount, amount: input.finalAmount, closeDate: input.closeDate, closeNotes: input.notes, deliveryType: input.deliveryType, probability: 100 } });
      if (opportunity.accountId) await tx.account.update({ where: { id: opportunity.accountId }, data: { lifecycleStatus: 'Customer', accountType: 'Customer' } });
      await tx.opportunityStageHistory.create({ data: { opportunityId: opportunity.id, fromStage: opportunity.stage, toStage: 'Closed Won', reason: input.notes, changedById: actor.id } });
      await tx.activity.create({ data: { activity: 'Customer onboarding', description: input.notes, relatedTo: updated.opportunityName, relatedType: 'Opportunity', relatedEntityType: 'Opportunity', relatedEntityId: updated.id, type: 'Task', priority: 'High', ownerName: updated.ownerName, ownerId: updated.ownerId } });
      let project = opportunity.aiProject;
      if (isAi(input.deliveryType) && !project) {
        project = await tx.aiProject.create({ data: { projectName: updated.opportunityName, description: input.notes, techStack: 'To be confirmed', status: 'Planning', leadEngineer: 'Unassigned', ownerName: updated.ownerName, ownerId: updated.ownerId, sourceOpportunityId: updated.id, accountId: updated.accountId, contactId: updated.primaryContactId } });
        const templates = await tx.projectTaskTemplate.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } });
        const defaults = templates.length ? templates : [
          { name: 'Project discovery and scope confirmation', description: 'Confirm objectives, data, milestones and acceptance criteria.', defaultWeight: 2, mandatory: true },
          { name: 'Technical plan', description: 'Prepare architecture, delivery plan and risks.', defaultWeight: 2, mandatory: true },
          { name: 'Kick-off meeting', description: 'Conduct customer and delivery team kick-off.', defaultWeight: 1, mandatory: true },
        ];
        await tx.aiTask.createMany({ data: defaults.map((t: any) => ({ taskName: t.name, projectName: project.projectName, projectId: project.id, assignee: 'Unassigned', status: 'Todo', priority: 'Medium', weight: t.defaultWeight, mandatory: t.mandatory, description: t.description })) });
      }
      await tx.auditLog.create({ data: { userId: actor.id, action: 'OPPORTUNITY_CLOSED_WON', entityType: 'Opportunity', entityId: updated.id, beforeData: opportunity, afterData: updated, metadata: { projectId: project?.id ?? null } } });
      return { idempotent: false, opportunity: updated, project };
    });
    if (result.project) {
      const aiUsers = await (prisma as any).user.findMany({ where: { isActive: true, role: 'AITEAM' }, select: { id: true } });
      await notifyUsers(aiUsers.map((u: any) => u.id), { type: 'AI_PROJECT_CREATED', title: 'New AI project handoff', message: `${result.project.projectName} was created from a won opportunity.`, entityType: 'AiProject', entityId: result.project.id });
      emitResourceEvent('ai-projects', result.idempotent ? 'updated' : 'created', result.project);
    }
    emitResourceEvent('opportunities', 'updated', result.opportunity);
    res.json({ message: result.idempotent ? 'Opportunity was already closed won.' : 'Opportunity closed won successfully.', ...result });
  } catch (error) { next(error); }
});

const applicationSchema = z.object({ candidateId: z.string().min(1), jobId: z.string().min(1) });
workflowsRouter.post('/applications', requirePermission('candidates'), async (req, res, next) => {
  try {
    const input = applicationSchema.parse(req.body);
    const actor = res.locals.authUser;
    const application = await (prisma as any).candidateApplication.upsert({ where: { candidateId_jobId: input }, create: { ...input, ownerId: actor.id }, update: {} });
    res.status(201).json(application);
  } catch (error) { next(error); }
});

const interviewSchema = z.object({ interviewDate: z.string().min(1), interviewTime: z.string().optional(), interviewer: z.string().min(1) });
workflowsRouter.post('/applications/:id/schedule-interview', requirePermission('interviews'), async (req, res, next) => {
  try {
    const input = interviewSchema.parse(req.body);
    const actor = res.locals.authUser;
    const result = await prisma.$transaction(async (tx: any) => {
      const app = await tx.candidateApplication.findUnique({ where: { id: req.params.id }, include: { candidate: true, job: true } });
      if (!app) throw Object.assign(new Error('Candidate application not found.'), { statusCode: 404 });
      const interview = await tx.interview.create({ data: { applicationId: app.id, candidateId: app.candidateId, jobId: app.jobId, candidateName: app.candidate.name, jobTitle: app.job.jobTitle, interviewDate: input.interviewDate, interviewTime: input.interviewTime, interviewer: input.interviewer } });
      await tx.candidateApplication.update({ where: { id: app.id }, data: { stage: 'Interviewing' } });
      await tx.candidate.update({ where: { id: app.candidateId }, data: { status: 'Interviewing' } });
      await tx.applicationStatusHistory.create({ data: { applicationId: app.id, fromStatus: app.stage, toStatus: 'Interviewing', changedById: actor.id } });
      return interview;
    });
    emitResourceEvent('interviews', 'created', result);
    res.status(201).json(result);
  } catch (error) { next(error); }
});

workflowsRouter.post('/interviews/:id/select', requirePermission('offers'), async (req, res, next) => {
  try {
    const actor = res.locals.authUser;
    const result = await prisma.$transaction(async (tx: any) => {
      const interview = await tx.interview.findUnique({ where: { id: req.params.id }, include: { application: true, candidate: true, job: true, offers: { where: { status: { in: ['Pending','Released'] } } } } });
      if (!interview?.application || !interview.candidate || !interview.job) throw Object.assign(new Error('Linked interview/application data is incomplete.'), { statusCode: 422 });
      if (!interview.feedback?.trim()) throw Object.assign(new Error('Interview feedback is required before selection.'), { statusCode: 422 });
      if (interview.offers.length) return { idempotent: true, offer: interview.offers[0] };
      const offer = await tx.offer.create({ data: { applicationId: interview.applicationId, interviewId: interview.id, candidateId: interview.candidateId, jobId: interview.jobId, candidateName: interview.candidate.name, jobTitle: interview.job.jobTitle, ownerName: actor.name } });
      await tx.interview.update({ where: { id: interview.id }, data: { status: 'Selected' } });
      await tx.candidateApplication.update({ where: { id: interview.applicationId }, data: { stage: 'Offered' } });
      await tx.candidate.update({ where: { id: interview.candidateId }, data: { status: 'Offered' } });
      return { idempotent: false, offer };
    });
    emitResourceEvent('offers', 'created', result.offer);
    res.json(result);
  } catch (error) { next(error); }
});

const acceptOfferSchema = z.object({ joiningDate: z.string().min(1), notes: z.string().optional() });
workflowsRouter.post('/offers/:id/accept', requirePermission('offers'), async (req, res, next) => {
  try {
    const input = acceptOfferSchema.parse(req.body);
    const actor = res.locals.authUser;
    const result = await prisma.$transaction(async (tx: any) => {
      const offer = await tx.offer.findUnique({ where: { id: req.params.id }, include: { application: true, job: true } });
      if (!offer?.application || !offer.jobId || !offer.candidateId) throw Object.assign(new Error('Offer is not linked to a candidate application and job.'), { statusCode: 422 });
      if (offer.status === 'Accepted') return { idempotent: true, offer };
      if (offer.job.vacancyCount <= 0) throw Object.assign(new Error('No open vacancy remains for this job.'), { statusCode: 409 });
      const updated = await tx.offer.update({ where: { id: offer.id }, data: { status: 'Accepted', joiningDate: input.joiningDate, decisionReason: input.notes } });
      await tx.candidateApplication.update({ where: { id: offer.applicationId! }, data: { stage: 'Placed', placedAt: new Date() } });
      await tx.candidate.update({ where: { id: offer.candidateId! }, data: { status: 'Placed' } });
      await tx.job.update({ where: { id: offer.jobId! }, data: { vacancyCount: { decrement: 1 }, ...(offer.job.vacancyCount === 1 ? { status: 'Closed' } : {}) } });
      await tx.applicationStatusHistory.create({ data: { applicationId: offer.applicationId!, fromStatus: offer.application.stage, toStatus: 'Placed', reason: input.notes, changedById: actor.id } });
      return { idempotent: false, offer: updated };
    });
    emitResourceEvent('offers', 'updated', result.offer);
    res.json(result);
  } catch (error) { next(error); }
});

workflowsRouter.post('/candidates/:id/move-to-bench', requirePermission('bench'), async (req, res, next) => {
  try {
    const actor = res.locals.authUser;
    const result = await prisma.$transaction(async (tx: any) => {
      const candidate = await tx.candidate.findUnique({ where: { id: req.params.id } });
      if (!candidate) throw Object.assign(new Error('Candidate not found.'), { statusCode: 404 });
      const existing = await tx.bench.findUnique({ where: { candidateId: candidate.id } });
      if (existing) return { idempotent: true, bench: existing };
      const custom = (candidate.customData && typeof candidate.customData === 'object' ? candidate.customData : {}) as Record<string, unknown>;
      const visaStatus = String(custom.visaStatus ?? '').trim();
      const validVisaStatuses = new Set(['USC/Citizen','GC','GC-EAD','H1B','H4 EAD','L2S','OPT']);
      if (!validVisaStatuses.has(visaStatus)) throw Object.assign(new Error('Candidate requires a valid Bench visa status before Move to Bench.'), { statusCode: 422 });
      const required = { email: candidate.email, phone: candidate.phone, validVisa: custom.validVisa, availableFrom: custom.availableFrom, noticePeriod: custom.noticePeriod, expectedRate: custom.expectedRate };
      const missing = Object.entries(required).filter(([,value]) => !String(value ?? '').trim()).map(([key]) => key);
      if (missing.length) throw Object.assign(new Error(`Complete Candidate fields before Move to Bench: ${missing.join(', ')}.`), { statusCode: 422 });
      const consultantCode = `CON-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random()*90)}`;
      const bench = await tx.bench.create({ data: {
        consultantCode, candidateId: candidate.id, candidateName: candidate.name, skills: candidate.skills, visaStatus,
        validVisa: String(custom.validVisa), experienceYears: Number(candidate.experienceYears), marketingStatus: 'Active',
        ratePerHour: Number(custom.expectedRate), resumeUrl: candidate.resumeUrl, ownerName: actor.name, ownerId: actor.id,
        customData: { email: candidate.email, phone: candidate.phone, primarySkill: custom.primarySkill ?? candidate.skills.split(',')[0]?.trim(), noticePeriod: custom.noticePeriod, availableFrom: custom.availableFrom, expectedRate: Number(custom.expectedRate), timeZone: custom.timeZone ?? 'America/New_York', source: 'MOVE_TO_BENCH' }
      } });
      return { idempotent: false, bench };
    });
    emitResourceEvent('bench', result.idempotent ? 'updated' : 'created', result.bench);
    res.json(result);
  } catch (error) { next(error); }
});


workflowsRouter.post('/bench-interviews/:id/select', requirePermission('submissions'), async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.benchInterview.findUnique({ where: { id: req.params.id } });
      if (!existing) throw Object.assign(new Error('Bench Interview not found.'), { statusCode: 404 });
      if (!String((existing.customData as any)?.feedback ?? existing.feedback ?? '').trim()) throw Object.assign(new Error('Interview feedback is required before selection.'), { statusCode: 422 });
        const customData = { ...((existing.customData as any) ?? {}), result: 'Selected' };
        // Set interview result to 'Selected' and mark status Completed
        const updated = await tx.benchInterview.update({ where: { id: existing.id }, data: { status: 'Completed', result: 'Selected', customData } });
      const events = await applyBenchAutomation(tx, 'bench-interviews', updated, existing, res.locals.authUser ?? {});
      return { updated, events };
    });
    emitResourceEvent('bench-interviews', 'updated', flattenBenchRecord(result.updated));
    for (const event of result.events) emitResourceEvent(event.resource, event.action, flattenBenchRecord(event.record));
    res.json({ message: 'Interview selected and Offer workflow created.', record: flattenBenchRecord(result.updated) });
  } catch (error) { next(error); }
});

workflowsRouter.post('/bench-offers/:id/accept', requirePermission('placements'), async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.benchOffer.findUnique({ where: { id: req.params.id } });
      if (!existing) throw Object.assign(new Error('Bench Offer not found.'), { statusCode: 404 });
      const updated = await tx.benchOffer.update({ where: { id: existing.id }, data: { status: 'Accepted', offerAcceptedDate: new Date().toISOString().slice(0,10) } });
      const events = await applyBenchAutomation(tx, 'bench-offers', updated, existing, res.locals.authUser ?? {});
      return { updated, events };
    });
    emitResourceEvent('bench-offers', 'updated', flattenBenchRecord(result.updated));
    for (const event of result.events) emitResourceEvent(event.resource, event.action, flattenBenchRecord(event.record));
    res.json({ message: 'Offer accepted. An onboarding Placement was created automatically; use Confirm Joining to record the actual start.', record: flattenBenchRecord(result.updated) });
  } catch (error) { next(error); }
});


workflowsRouter.post('/jobs/:jobId/top-matches', requirePermission('submissions'), async (req, res, next) => {
  try {
    const actor = res.locals.authUser ?? {};
    const limit = Math.max(1, Math.min(50, Number(req.body?.limit ?? 10)));
    const job = await (prisma as any).job.findUnique({ where: { id: req.params.jobId }, include: { requirement: true } });
    if (!job) throw Object.assign(new Error('Job not found.'), { statusCode: 404 });

    const consultants = await (prisma as any).bench.findMany({
      // Jobs and recommendations are organization-wide. Workflow records created
      // from a match are still owned by the recruiter who performs the action.
      where: { marketingStatus: { in: ['Active', 'Available'] } },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    });
    const matches = consultants
      .map((consultant: any) => ({ consultant: flattenBenchRecord(consultant), match: calculateRequirementMatch(matchingRequirementFromJob(job), consultant) }))
      .sort((left: any, right: any) => right.match.percentage - left.match.percentage)
      .slice(0, limit);

    await (prisma as any).auditLog.create({
      data: {
        userId: actor.id ?? null,
        action: 'JOB_MATCHING_EXECUTED',
        entityType: 'Job',
        entityId: job.id,
        metadata: { requirementId: job.requirementId, consultantCount: consultants.length, returnedCount: matches.length },
      },
    });
    res.json({ job: flattenBenchRecord(job), matches });
  } catch (error) { next(error); }
});


workflowsRouter.post('/bench/:benchId/recommended-jobs', requirePermission('submissions'), async (req, res, next) => {
  try {
    const actor = res.locals.authUser ?? {};
    const limit = Math.max(1, Math.min(100, Number(req.body?.limit ?? 30)));
    const includeLowMatches = Boolean(req.body?.includeLowMatches ?? true);
    const consultant = await (prisma as any).bench.findUnique({ where: { id: req.params.benchId } });
    if (!consultant) throw Object.assign(new Error('Bench Consultant not found.'), { statusCode: 404 });
    const today = new Date().toISOString().slice(0, 10);
    const jobs = await (prisma as any).job.findMany({
      where: {
        status: { in: ['Open', 'Active'] },
        vacancyCount: { gt: 0 },
        OR: [{ expiryDate: null }, { expiryDate: '' }, { expiryDate: { gte: today } }],
      },
      include: { requirement: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    });
    const matches = jobs
      .map((job: any) => ({
        job: flattenBenchRecord(job),
        match: calculateRequirementMatch(matchingRequirementFromJob(job), consultant),
      }))
      .filter((entry: any) => includeLowMatches || entry.match.percentage >= 40)
      .sort((left: any, right: any) => right.match.percentage - left.match.percentage)
      .slice(0, limit);
    await (prisma as any).auditLog.create({
      data: { userId: actor.id ?? null, action: 'CONSULTANT_JOB_MATCHING_EXECUTED', entityType: 'Bench', entityId: consultant.id, metadata: { jobCount: jobs.length, returnedCount: matches.length } },
    });
    res.json({ consultant: flattenBenchRecord(consultant), matches });
  } catch (error) { next(error); }
});


const oneClickSubmissionSchema = z.object({
  ratePerHour: z.coerce.number().nonnegative().optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional(),
  rtrStatus: z.string().optional(),
  submissionTarget: z.enum(['Vendor Company', 'Hiring / End Client']).optional(),
  overrideReason: z.string().trim().optional(),
});

workflowsRouter.post('/jobs/:jobId/submit/:benchId', requirePermission('submissions'), async (req, res, next) => {
  try {
    const input = oneClickSubmissionSchema.parse(req.body ?? {});
    const actor = res.locals.authUser ?? {};
    const result = await prisma.$transaction(async (tx: any) => {
      const [job, consultant] = await Promise.all([
        tx.job.findUnique({ where: { id: req.params.jobId }, include: { requirement: true } }),
        tx.bench.findUnique({ where: { id: req.params.benchId } }),
      ]);
      if (!job || !consultant) throw Object.assign(new Error('Job or Consultant not found.'), { statusCode: 404 });
      const linkedJob = await ensureJobRequirement(tx, job);
      if (!['Open', 'Active'].includes(String(job.status))) throw Object.assign(new Error('Only an active Job can receive submissions.'), { statusCode: 409 });
      if (job.expiryDate && job.expiryDate < new Date().toISOString().slice(0, 10)) throw Object.assign(new Error('This Job has expired.'), { statusCode: 409 });
      if (Number(job.vacancyCount ?? 0) < 1) throw Object.assign(new Error('This Job has no remaining vacancies.'), { statusCode: 409 });
      if (!['Active', 'Available', 'Submitted'].includes(String(consultant.marketingStatus))) throw Object.assign(new Error('Only an active Bench Consultant can be submitted.'), { statusCode: 409 });

      const duplicate = await tx.submission.findFirst({
        where: {
          benchConsultantId: consultant.id,
          jobId: job.id,
          status: { in: ['Draft', 'Submitted', 'Vendor Review', 'Client Review', 'Interview Requested', 'Interview Scheduled', 'Interview Completed', 'Selected', 'On Hold', 'Accepted'] },
        },
      });
      if (duplicate) throw Object.assign(new Error('An active Submission already exists for this Consultant and Job.'), { statusCode: 409 });

      const match = calculateRequirementMatch(matchingRequirementFromJob(linkedJob), consultant);
      const consultantData = flattenBenchRecord(consultant) as any;
      const rate = input.ratePerHour ?? Number(consultant.ratePerHour ?? 0);
      const overrideReason = String(input.overrideReason ?? '').trim();
      if (!match.canSubmit) throw Object.assign(new Error(`Submission blocked: ${match.hardBlockers.join(' ')}`), { statusCode: 422 });
      if (match.requiresOverride && !overrideReason) throw Object.assign(new Error('This match requires recruiter review. Enter a manual override reason before submitting.'), { statusCode: 422 });
      if (job.maxRate != null && rate > Number(job.maxRate) && !overrideReason) throw Object.assign(new Error(`Submission rate exceeds $${Number(job.maxRate).toFixed(2)}. Enter an override reason if the rate is negotiable.`), { statusCode: 422 });

      const customData = {
        createdByUserId: actor.id,
        createdByUserName: actor.name,
        source: 'ONE_CLICK_RECOMMENDATION',
        jobReference: job.jobReference,
        endClient: job.endClient,
        workLocation: job.location,
        workMode: job.workMode,
        rateType: job.rateType,
        consultantEmail: consultantData.email,
        consultantPhone: consultantData.phone,
        consultantSkills: consultant.skills,
        consultantVisa: consultant.visaStatus,
        resumeUrl: consultant.resumeUrl,
        submissionTarget: input.submissionTarget ?? 'Vendor Company',
        targetCompany: input.submissionTarget === 'Hiring / End Client' ? (job.endClient || job.company) : (job.vendorCompany || job.company),
        targetEmail: input.submissionTarget === 'Vendor Company' ? (job.vendorEmail || '') : '',
        followUpDate: input.followUpDate ?? '',
        notes: input.notes ?? '',
        rtrStatus: input.rtrStatus ?? '',
        manualOverride: Boolean(overrideReason),
        overrideReason,
        matchCategory: match.category,
        matchStrengths: match.strengths,
        matchWarnings: match.warnings,
      };
      const submission = await tx.submission.create({
        data: {
          candidateName: consultant.candidateName,
          vendorCompany: job.vendorCompany || job.company,
          candidateCompany: consultantData.currentEmployer || null,
          vendorEmail: job.vendorEmail || null,
          implementationName: job.implementationPartner || null,
          jobTitle: job.jobTitle,
          ratePerHour: rate,
          submissionDate: new Date().toISOString().slice(0, 10),
          status: 'Draft',
          feedback: input.notes || null,
          ownerName: actor.name,
          benchConsultantId: consultant.id,
          requirementId: linkedJob.requirementId,
          jobId: job.id,
          matchPercentage: match.percentage,
          matchDetails: match,
          customData,
        },
      });
      const updatedConsultant = await tx.bench.update({ where: { id: consultant.id }, data: { marketingStatus: 'Submitted' } });
      const activity = await tx.activity.create({
        data: {
          activity: `Resume Submitted: ${consultant.candidateName}`,
          description: `${job.jobTitle} — ${job.endClient || job.company} — ${match.percentage}% match`,
          relatedTo: consultant.candidateName,
          relatedType: 'Submission',
          type: 'Submission',
          status: 'Completed',
          priority: 'High',
          ownerName: actor.name,
          ownerId: actor.id,
          createdOn: new Date().toISOString().slice(0, 10),
          customData: { createdByUserId: actor.id, submissionId: submission.id, jobId: job.id, benchConsultantId: consultant.id },
        },
      });
      await tx.notification.create({
        data: {
          userId: actor.id,
          type: 'SUBMISSION_CREATED',
          title: 'Resume submitted',
          message: `${consultant.candidateName} was submitted to ${job.jobTitle}.`,
          entityType: 'Submission',
          entityId: submission.id,
          metadata: { jobId: job.id, benchConsultantId: consultant.id, matchPercentage: match.percentage },
        },
      });
      await tx.auditLog.create({ data: { userId: actor.id, action: 'ONE_CLICK_SUBMISSION', entityType: 'Submission', entityId: submission.id, metadata: { jobId: job.id, benchConsultantId: consultant.id, matchPercentage: match.percentage, manualOverride: Boolean(overrideReason), overrideReason } } });
      return { submission, updatedConsultant, activity, match };
    });
    emitResourceEvent('submissions', 'created', flattenBenchRecord(result.submission));
    emitResourceEvent('bench', 'updated', flattenBenchRecord(result.updatedConsultant));
    emitResourceEvent('activities', 'created', flattenBenchRecord(result.activity));
    res.status(201).json({ message: 'Submission draft created successfully.', submission: flattenBenchRecord(result.submission), match: result.match });
  } catch (error) { next(error); }
});

workflowsRouter.post('/requirements/:requirementId/match/:benchId', requirePermission('submissions'), async (req, res, next) => {
  try {
    const [requirement, consultant] = await Promise.all([
      (prisma as any).requirement.findUnique({ where: { id: req.params.requirementId } }),
      (prisma as any).bench.findUnique({ where: { id: req.params.benchId } }),
    ]);
    if (!requirement || !consultant) throw Object.assign(new Error('Requirement or bench consultant not found.'), { statusCode: 404 });
    const result = calculateRequirementMatch(requirement, consultant);
    res.json(result);
  } catch (error) { next(error); }
});

const allocateSchema = z.object({ resourceId: z.string().min(1), allocationPercent: z.coerce.number().int().min(1).max(100), startDate: z.string().optional(), endDate: z.string().optional() });
workflowsRouter.post('/projects/:id/allocate-resource', requirePermission('resources'), async (req, res, next) => {
  try {
    const input = allocateSchema.parse(req.body);
    const allocation = await prisma.$transaction(async (tx: any) => {
      const [project, resource] = await Promise.all([tx.aiProject.findUnique({ where: { id: req.params.id } }), tx.aiResource.findUnique({ where: { id: input.resourceId } })]);
      if (!project || !resource) throw Object.assign(new Error('Project or resource not found.'), { statusCode: 404 });
      const existing = await tx.projectResource.findMany({ where: { resourceId: resource.id } });
      const used = existing.reduce((sum: number, item: any) => sum + item.allocationPercent, 0);
      if (used + input.allocationPercent > resource.capacityPercent) throw Object.assign(new Error(`Resource capacity exceeded. ${resource.capacityPercent - used}% remains available.`), { statusCode: 409 });
      const created = await tx.projectResource.upsert({ where: { projectId_resourceId: { projectId: project.id, resourceId: resource.id } }, create: { projectId: project.id, resourceId: resource.id, allocationPercent: input.allocationPercent, startDate: input.startDate, endDate: input.endDate }, update: { allocationPercent: input.allocationPercent, startDate: input.startDate, endDate: input.endDate } });
      await tx.aiResource.update({ where: { id: resource.id }, data: { allocationStatus: 'Allocated' } });
      return created;
    });
    res.status(201).json(allocation);
  } catch (error) { next(error); }
});

workflowsRouter.post('/submissions/:id/accept', requirePermission('placements'), async (_req, res) => {
  res.status(410).json({ message: 'Direct Submission-to-Placement conversion has been removed. Complete Interview, Offer acceptance, and Confirm Joining instead.' });
});

const confirmBenchJoiningSchema = z.object({
  joiningDate: z.string().min(1),
  actualStartDate: z.string().min(1),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  contractDuration: z.string().optional(),
  vendorEmail: z.string().email().optional().or(z.literal('')),
  vendorContactNumber: z.string().optional(),
  workLocation: z.string().optional(),
  workMode: z.enum(['Remote', 'Hybrid', 'On-site']).optional(),
});

workflowsRouter.post('/bench-offers/:id/confirm-joining', requirePermission('placements'), async (req, res, next) => {
  try {
    const input = confirmBenchJoiningSchema.parse(req.body ?? {});
    const result = await prisma.$transaction(async (tx: any) => createPlacementFromAcceptedOffer(tx, req.params.id, input, res.locals.authUser ?? {}));
    emitResourceEvent('placements', result.idempotent ? 'updated' : 'created', flattenBenchRecord(result.placement));
    for (const event of result.events as WorkflowEvent[]) emitResourceEvent(event.resource, event.action, flattenBenchRecord(event.record));
    res.json({
      message: result.idempotent ? 'A Placement already exists for this Accepted Offer.' : 'Joining confirmed and Placement created successfully.',
      ...result,
    });
  } catch (error) { next(error); }
});

workflowsRouter.post('/projects/:id/recalculate-progress', requirePermission('ai-projects'), async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const project = await tx.aiProject.findUnique({ where: { id: req.params.id }, include: { tasks: true } });
      if (!project) throw Object.assign(new Error('Project not found.'), { statusCode: 404 });
      const total = project.tasks.reduce((sum: number, task: any) => sum + Math.max(1, task.weight), 0);
      const done = project.tasks.filter((task: any) => task.status === 'Completed').reduce((sum: number, task: any) => sum + Math.max(1, task.weight), 0);
      const progress = total ? Math.round((done / total) * 100) : 0;
      const hasBlocked = project.tasks.some((task: any) => task.status === 'Blocked');
      const mandatoryIncomplete = project.tasks.some((task: any) => task.mandatory && task.status !== 'Completed');
      const updated = await tx.aiProject.update({ where: { id: project.id }, data: { progress } });
      return { project: updated, completionReady: progress === 100 && !hasBlocked && !mandatoryIncomplete, hasBlocked, mandatoryIncomplete };
    });
    emitResourceEvent('ai-projects', 'updated', result.project);
    res.json(result);
  } catch (error) { next(error); }
});

workflowsRouter.get('/notifications', async (_req, res, next) => {
  try {
    const userId = res.locals.authUser.id;
    const [data, unread] = await Promise.all([
      (prisma as any).notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      (prisma as any).notification.count({ where: { userId, readAt: null } }),
    ]);
    res.json({ data, unread });
  } catch (error) { next(error); }
});
workflowsRouter.post('/notifications/:id/read', async (req, res, next) => {
  try {
    const record = await (prisma as any).notification.updateMany({ where: { id: req.params.id, userId: res.locals.authUser.id }, data: { readAt: new Date() } });
    res.json({ success: record.count === 1 });
  } catch (error) { next(error); }
});

function normalizeName(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function isAi(value: string) { return /\b(ai|ml|machine learning|artificial intelligence)\b/i.test(value); }
