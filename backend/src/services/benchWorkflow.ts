import { Prisma } from '@prisma/client';
import { calculateRequirementMatch } from '../lib/matching.js';

export const BENCH_WORKFLOW_RESOURCES = new Set(['bench', 'submissions', 'bench-interviews', 'bench-offers', 'placements']);

export type WorkflowEvent = {
  resource: string;
  action: 'created' | 'updated';
  record: Record<string, unknown>;
};

const requiredFields: Record<string, string[]> = {
  bench: ['candidateName', 'email', 'phone', 'primarySkill', 'skills', 'visaStatus', 'validVisa', 'availableFrom', 'noticePeriod', 'expectedRate', 'ownerName', 'resumeUrl'],
  submissions: ['benchConsultantId', 'jobId', 'candidateCompany', 'vendorCompany', 'vendorEmail', 'implementationName', 'endClient', 'jobTitle', 'requirementReference', 'workLocation', 'workMode', 'submissionDate', 'ratePerHour', 'ownerName', 'status'],
  'bench-interviews': ['benchConsultantId', 'submissionId', 'candidateName', 'jobTitle', 'interviewRound', 'interviewDate', 'interviewTime', 'technology', 'vendorEmail', 'submissionRate', 'workLocation', 'workMode', 'status', 'ownerName'],
  'bench-offers': ['submissionId', 'benchInterviewId', 'benchConsultantId', 'candidateName', 'clientCompany', 'jobTitle', 'offerDate', 'status', 'ownerName'],
  placements: ['benchOfferId', 'submissionId', 'benchConsultantId', 'candidateName', 'clientCompany', 'vendorCompany', 'joiningDate', 'actualStartDate', 'billingRate', 'vendorEmail', 'vendorContactNumber', 'workLocation', 'workMode', 'status', 'ownerName'],
};

const VALID_VISA_STATUSES = new Set(['USC/Citizen','GC','GC-EAD','H1B','H4 EAD','L2S','OPT']);

const workModeAliases: Record<string, string> = {
  onsite: 'On-site',
  'on site': 'On-site',
  'on-site': 'On-site',
  remote: 'Remote',
  hybrid: 'Hybrid',
};

export async function enrichAndValidateBenchInput(
  tx: any,
  resource: string,
  input: Record<string, unknown>,
  existing?: Record<string, unknown> | null,
) {
  const merged = { ...(existing ? flattenRecord(existing) : {}), ...input } as Record<string, unknown>;
  delete merged.id;
  delete merged.createdAt;
  delete merged.updatedAt;

  if (typeof merged.workMode === 'string') merged.workMode = normalizeWorkMode(merged.workMode);
  if (typeof merged.workPreference === 'string') merged.workPreference = normalizeWorkMode(merged.workPreference);

  if (resource === 'bench') {
    if (!existing && !text(merged.consultantCode)) merged.consultantCode = await generateConsultantCode(tx);
    if (!VALID_VISA_STATUSES.has(text(merged.visaStatus))) throw workflowError('Select a valid Visa Status.', 422);
    if (text(merged.availableFrom) && Number.isNaN(Date.parse(text(merged.availableFrom)))) throw workflowError('Available From must be a valid date.', 422);
    if (text(merged.noticePeriod) && Number(merged.noticePeriod) < 0) throw workflowError('Notice Period cannot be negative.', 422);
    if (positiveNumber(merged.expectedRate)) merged.ratePerHour = Number(merged.expectedRate);
    merged.profileCompletion = calculateProfileCompletion(merged);
    await validateBenchDuplicates(tx, merged, existing ? String(existing.id) : undefined);
  }

  if (resource === 'submissions') {
    const consultant = await tx.bench.findUnique({ where: { id: text(merged.benchConsultantId) } });
    if (!consultant) throw workflowError('Select a valid Bench Consultant.', 422);
    const job = await tx.job.findUnique({ where: { id: text(merged.jobId) }, include: { requirement: true } });
    if (!job) throw workflowError('Select a valid Job.', 422);
    if (job.status !== 'Open') throw workflowError('Submissions can be created only for Open Jobs.', 409);
    if (Number(job.vacancyCount || 0) <= 0) throw workflowError('This Job has no remaining vacancies.', 409);
    if (job.expiryDate && job.expiryDate < new Date().toISOString().slice(0,10)) throw workflowError('This Job has expired.', 409);
    const consultantData = flattenRecord(consultant);
    merged.candidateName = text(merged.candidateName) || consultant.candidateName;
    merged.consultantEmail = text(merged.consultantEmail) || String(consultantData.email ?? '');
    merged.consultantPhone = text(merged.consultantPhone) || String(consultantData.phone ?? '');
    merged.consultantSkills = text(merged.consultantSkills) || consultant.skills;
    merged.consultantVisaStatus = text(merged.consultantVisaStatus) || consultant.visaStatus;
    merged.requirementId = job.requirementId;
    merged.jobTitle = text(merged.jobTitle) || job.jobTitle;
    merged.requirementReference = text(merged.requirementReference) || job.jobReference || job.id;
    merged.vendorCompany = text(merged.vendorCompany) || job.vendorCompany || '';
    merged.vendorEmail = text(merged.vendorEmail) || job.vendorEmail || '';
    merged.vendorContact = text(merged.vendorContact) || job.vendorContact || '';
    merged.implementationName = text(merged.implementationName) || job.implementationPartner || '';
    merged.endClient = text(merged.endClient) || job.endClient || job.company;
    merged.workLocation = text(merged.workLocation) || job.location || '';
    merged.workMode = text(merged.workMode) || job.workMode || '';
    merged.rateType = text(merged.rateType) || job.rateType || '';
    merged.maximumJobRate = merged.maximumJobRate ?? job.maxRate;
    merged.requiredSkills = text(merged.requiredSkills) || job.skillsRequired || '';
    merged.submissionTarget = text(merged.submissionTarget) || 'Vendor Company';
    if (!['Vendor Company', 'Hiring / End Client'].includes(String(merged.submissionTarget))) {
      throw workflowError('Select Vendor Company or Hiring / End Client as the Submission Target.', 422);
    }
    merged.targetCompany = merged.submissionTarget === 'Hiring / End Client' ? (job.endClient || job.company) : (job.vendorCompany || job.company);
    const jobCustom = job.customData && typeof job.customData === 'object' && !Array.isArray(job.customData) ? job.customData as Record<string, unknown> : {};
    merged.targetEmail = merged.submissionTarget === 'Hiring / End Client' ? String(jobCustom.endClientEmail ?? '') : (job.vendorEmail || '');
    if (!text(merged.ownerName)) merged.ownerName = consultant.ownerName;
    if (!positiveNumber(merged.ratePerHour)) merged.ratePerHour = positiveNumber(consultantData.expectedRate) ? Number(consultantData.expectedRate) : consultant.ratePerHour;
    if (job.maxRate && Number(merged.ratePerHour) > Number(job.maxRate)) throw workflowError(`Submission rate cannot exceed the Job maximum rate of $${Number(job.maxRate).toFixed(2)}/hour.`, 422);
    if (!merged.submissionDate) merged.submissionDate = new Date().toISOString().slice(0,10);
    if (!merged.nextFollowUpDate && text(merged.status) !== 'On Hold') { const d = new Date(); d.setDate(d.getDate()+2); merged.nextFollowUpDate = d.toISOString().slice(0,10); }
    if (!merged.resumeVersion) merged.resumeVersion = consultant.resumeUrl || consultantData.resumeOriginalName || '';
    if (job.requirement) {
      const match = calculateRequirementMatch(job.requirement, consultant);
      merged.matchPercentage = match.percentage;
      merged.matchDetails = match;
      if (!match.matched.visa) throw workflowError('Consultant visa does not match the selected Job requirements.', 422);
      if (!match.matched.experience) throw workflowError('Consultant experience is below the Job minimum.', 422);
    }
    const targetStatus = text(merged.status) || 'Draft';
    const previousStatus = text(existing?.status) || '';
    const allowedTransitions: Record<string, string[]> = {
      Draft: ['Submitted', 'Sent', 'Resume Sent', 'On Hold', 'Rejected', 'Withdrawn'],
      Submitted: ['Sent', 'Resume Sent', 'Vendor Review', 'Client Review', 'Under Review', 'On Hold', 'Rejected', 'Withdrawn'],
      Sent: ['Under Review', 'Vendor Review', 'Client Review', 'Interview', 'Interview Requested', 'On Hold', 'Rejected', 'Withdrawn'],
      'Resume Sent': ['Sent', 'Under Review', 'Vendor Review', 'Client Review', 'Interview', 'Interview Requested', 'On Hold', 'Rejected', 'Withdrawn'],
      'Under Review': ['Interview', 'Interview Requested', 'Vendor Review', 'Client Review', 'Selected', 'On Hold', 'Rejected', 'Withdrawn'],
      'Vendor Review': ['Client Review', 'Under Review', 'Interview', 'On Hold', 'Rejected', 'Withdrawn'],
      'Client Review': ['Interview Requested', 'Interview', 'Under Review', 'On Hold', 'Rejected', 'Withdrawn'],
      'Interview Requested': ['Interview Scheduled', 'On Hold', 'Rejected', 'Withdrawn'],
      'Interview Scheduled': ['Interview', 'Selected', 'On Hold', 'Rejected', 'Withdrawn'],
      Interview: ['Selected', 'On Hold', 'Rejected', 'Withdrawn'],
      Selected: [],
      'On Hold': ['Submitted', 'Resume Sent', 'Under Review', 'Vendor Review', 'Client Review', 'Interview Requested', 'Interview', 'Rejected', 'Withdrawn'],
      Rejected: ['Withdrawn'],
      Withdrawn: [],
    };
    if (!existing) {
      if (!['Draft', 'Submitted'].includes(targetStatus)) {
        throw workflowError('A new Submission can only start as Draft or Submitted.', 409);
      }
    } else if (previousStatus !== targetStatus) {
      const nextStatuses = allowedTransitions[previousStatus] ?? [];
      if (!nextStatuses.includes(targetStatus)) {
        throw workflowError(`Submission status cannot move from ${previousStatus || 'Unknown'} to ${targetStatus}.`, 409);
      }
    }
    if (targetStatus === 'On Hold') {
      if (!text(merged.holdReason)) throw workflowError('Hold reason is required when a Submission is On Hold.', 422);
      if (!text(merged.nextFollowUpDate)) throw workflowError('Next follow-up date is required when a Submission is On Hold.', 422);
    }
    await validateDuplicateSubmission(tx, merged, existing ? String(existing.id) : undefined);
    if (text(merged.status) === 'Accepted') {
      if (!existing?.id) throw workflowError('A new Submission cannot start as Accepted. Complete Interview and Offer stages first.', 409);
      const acceptedOffer = await tx.benchOffer.findFirst({ where: { submissionId: String(existing.id), status: 'Accepted' } });
      if (!acceptedOffer) throw workflowError('Submission can become Accepted only after its linked Offer is Accepted.', 409);
    }
  }

  if (resource === 'bench-interviews') {
    if (existing) {
      const oldData = flattenRecord(existing);
      const selectedRequested = text(merged.status) === 'Selected' || text(merged.result) === 'Selected';
      if (selectedRequested && text(oldData.status) !== 'Selected' && text(oldData.result) !== 'Selected' && text(input.__workflowAction) !== 'SELECT_INTERVIEW') {
        throw workflowError('Use the Select Interview workflow action. Normal Edit cannot select an interview.', 409);
      }
    }
    delete merged.__workflowAction;
    const submission = await tx.submission.findUnique({ where: { id: text(merged.submissionId) } });
    if (!submission?.benchConsultantId) throw workflowError('Select a valid linked Submission.', 422);
    if (text(merged.result) === 'On Hold') {
      if (!text(merged.holdReason)) throw workflowError('Hold reason is required when an Interview is On Hold.', 422);
      if (!text(merged.followUpDate)) throw workflowError('Next follow-up date is required when an Interview is On Hold.', 422);
    }
    // Prevent accidental duplicate interviews (e.g., double-clicking Schedule Interview)
    if (!existing) {
      try {
        const date = text(merged.interviewDate);
        const time = text(merged.interviewTime);
        const consultantId = text(merged.benchConsultantId) || submission.benchConsultantId;
        let duplicate: any = null;
        if (date && time && consultantId) {
          duplicate = await tx.benchInterview.findFirst({ where: { submissionId: text(merged.submissionId), benchConsultantId: consultantId, interviewDate: date, interviewTime: time, status: { notIn: ['Cancelled', 'Rejected'] } } });
        }
        if (!duplicate && consultantId && text(merged.interviewRound)) {
          duplicate = await tx.benchInterview.findFirst({ where: { submissionId: text(merged.submissionId), benchConsultantId: consultantId, interviewRound: text(merged.interviewRound), status: { notIn: ['Cancelled', 'Rejected'] } } });
        }
        if (duplicate) throw workflowError('An interview already exists for this submission and consultant.', 409);
      } catch (err) {
        if (err instanceof Error && (err as any).statusCode === 409) throw err;
      }
    }
    if (text(merged.benchConsultantId) && text(merged.benchConsultantId) !== submission.benchConsultantId) {
      throw workflowError('The selected Submission does not belong to the selected Consultant.', 409);
    }
    const submissionData = flattenRecord(submission);
    merged.benchConsultantId = submission.benchConsultantId;
    merged.candidateName = submission.candidateName;
    merged.clientCompany = text(submissionData.endClient) || text(submissionData.implementationName);
    merged.vendorCompany = submission.vendorCompany;
    merged.jobTitle = submission.jobTitle;
    merged.vendorEmail = text(merged.vendorEmail) || text(submissionData.vendorEmail);
    merged.submissionRate = positiveNumber(merged.submissionRate) ? merged.submissionRate : submission.ratePerHour;
    merged.workLocation = text(merged.workLocation) || text(submissionData.workLocation);
    merged.workMode = normalizeWorkMode(text(merged.workMode) || text(submissionData.workMode));
    merged.technology = text(merged.technology) || text(submissionData.consultantSkills) || submission.jobTitle;
    merged.ownerName = text(merged.ownerName) || submission.ownerName;
  }

  if (resource === 'bench-offers') {
    if (existing && text(merged.status) === 'Accepted' && text(flattenRecord(existing).status) !== 'Accepted' && text(input.__workflowAction) !== 'ACCEPT_OFFER') {
      throw workflowError('Use the Accept Offer workflow action. Normal Edit cannot accept an offer.', 409);
    }
    delete merged.__workflowAction;
    const submission = await tx.submission.findUnique({ where: { id: text(merged.submissionId) } });
    if (!submission?.benchConsultantId) throw workflowError('Select a valid linked Submission.', 422);
    const submissionData = flattenRecord(submission);
    merged.benchConsultantId = submission.benchConsultantId;
    merged.candidateName = submission.candidateName;
    merged.clientCompany = text(submissionData.endClient) || text(submissionData.implementationName);
    merged.vendorCompany = submission.vendorCompany;
    merged.jobTitle = submission.jobTitle;
    merged.billRate = positiveNumber(merged.billRate) ? merged.billRate : submission.ratePerHour;
    merged.workLocation = text(merged.workLocation) || text(submissionData.workLocation);
    merged.workMode = normalizeWorkMode(text(merged.workMode) || text(submissionData.workMode));
    merged.vendorEmail = text(merged.vendorEmail) || text(submissionData.vendorEmail);
    merged.vendorContactNumber = text(merged.vendorContactNumber) || text(submissionData.vendorContact);
    merged.ownerName = text(merged.ownerName) || submission.ownerName;

    const interviewId = text(merged.benchInterviewId);
    if (interviewId) {
      const interview = await tx.benchInterview.findUnique({ where: { id: interviewId } });
      if (!interview || interview.submissionId !== submission.id || interview.benchConsultantId !== submission.benchConsultantId) {
        throw workflowError('The selected Interview is not linked to this Submission and Consultant.', 409);
      }
      if (interview.status !== 'Selected' && text(flattenRecord(interview).result) !== 'Selected') {
        throw workflowError('Only a selected Interview can be linked to an Offer.', 409);
      }
    }
  }

  if (resource === 'placements') {
    delete merged.payRate;
    const offer = await tx.benchOffer.findUnique({ where: { id: text(merged.benchOfferId) } });
    if (!offer) throw workflowError('Select a valid Accepted Offer.', 422);
    if (offer.status !== 'Accepted') throw workflowError('A Placement can be created only from an Accepted Offer.', 409);
    if (text(merged.submissionId) && text(merged.submissionId) !== offer.submissionId) throw workflowError('The Placement Submission does not match the Accepted Offer.', 409);
    if (text(merged.benchConsultantId) && text(merged.benchConsultantId) !== offer.benchConsultantId) throw workflowError('The Placement Consultant does not match the Accepted Offer.', 409);
    const offerData = flattenRecord(offer);
    const submission = await tx.submission.findUnique({ where: { id: offer.submissionId } });
    const submissionData = submission ? flattenRecord(submission) : {};
    merged.submissionId = offer.submissionId;
    merged.benchConsultantId = offer.benchConsultantId;
    merged.candidateName = offer.candidateName;
    merged.clientCompany = offer.clientCompany;
    merged.vendorCompany = offer.vendorCompany || submission?.vendorCompany || '';
    merged.jobTitle = offer.jobTitle;
    merged.billingRate = positiveNumber(merged.billingRate) ? merged.billingRate : offer.billRate;
    merged.vendorEmail = text(merged.vendorEmail) || text(submissionData.vendorEmail);
    merged.vendorContactNumber = text(merged.vendorContactNumber) || text(submissionData.vendorContact);
    merged.workLocation = text(merged.workLocation) || text(offerData.workLocation);
    merged.workMode = normalizeWorkMode(text(merged.workMode) || text(offerData.workMode));
    merged.ownerName = text(merged.ownerName) || offer.ownerName;
    merged.margin = positiveNumber(merged.margin) ? merged.margin : Math.max(0, offer.billRate - offer.payRate);
    await validatePlacementOverlap(tx, offer.benchConsultantId, text(merged.actualStartDate) || text(merged.joiningDate), text(merged.contractEndDate), existing ? String(existing.id) : undefined);
  }

  const status = text(merged.status);
  const isWorkflowDraft = (resource === 'bench-interviews' || resource === 'bench-offers') && status === 'Draft';
  validateRequired(resource, merged, isWorkflowDraft);
  return merged;
}

export async function applyBenchAutomation(
  tx: any,
  resource: string,
  record: Record<string, unknown>,
  previous: Record<string, unknown> | null,
  actor: { id?: string; name?: string },
): Promise<WorkflowEvent[]> {
  const current = flattenRecord(record);
  const before = previous ? flattenRecord(previous) : null;
  const events: WorkflowEvent[] = [];

  await tx.auditLog.create({
    data: {
      userId: actor.id ?? null,
      action: previous ? 'BENCH_WORKFLOW_RECORD_UPDATED' : 'BENCH_WORKFLOW_RECORD_CREATED',
      entityType: resource,
      entityId: String(record.id),
      beforeData: before ? jsonSafe(before) as Prisma.InputJsonValue : undefined,
      afterData: jsonSafe(current) as Prisma.InputJsonValue,
    },
  });

  if (resource === 'bench') {
    await createExpiryActivities(tx, current, actor.id);
  }

  if (resource === 'submissions') {
    const consultantId = text(current.benchConsultantId);
    if (consultantId) {
      const status = text(current.status);
      let marketingStatus = 'Active';
      let availabilityStatus = 'Marketing';
    if (['Submitted', 'Resume Sent', 'Under Review', 'Vendor Review', 'Client Review', 'Interview Requested'].includes(status)) marketingStatus = 'Submitted';
    else if (status === 'Interview Scheduled') { marketingStatus = 'Interviewing'; availabilityStatus = 'Interviewing'; }
    else if (status === 'Accepted') { marketingStatus = 'Offer'; availabilityStatus = 'Offer'; }
    else if (status === 'On Hold') { marketingStatus = 'On Hold'; availabilityStatus = 'On Hold'; }
    else if (['Rejected', 'Withdrawn'].includes(status)) { marketingStatus = 'Active'; availabilityStatus = 'Available'; }
    const bench = await updateBenchStatus(tx, consultantId, marketingStatus, availabilityStatus, ['Submitted', 'Vendor Review', 'Client Review', 'Interview Requested'].includes(status) ? current.submissionDate : undefined);
      if (bench) events.push({ resource: 'bench', action: 'updated', record: flattenRecord(bench) });
    }
    if (text(current.nextFollowUpDate)) {
      const activity = await upsertActivity(tx, {
        relatedEntityType: text(current.status) === 'On Hold' ? 'SubmissionHold' : 'SubmissionFollowUp',
        relatedEntityId: String(record.id), activity: text(current.status) === 'On Hold' ? `Hold follow-up: ${text(current.candidateName)}` : `Follow up submission: ${text(current.candidateName)}`,
        description: `${text(current.vendorCompany)} / ${text(current.implementationName)}` + (text(current.status) === 'On Hold' && text(current.holdReason) ? ` — Hold reason: ${text(current.holdReason)}` : ''),
        relatedTo: text(current.candidateName), relatedType: 'Submission', type: 'Follow-up', status: 'Pending', priority: 'High', ownerName: text(current.ownerName), dueDate: text(current.nextFollowUpDate), ownerId: actor.id,
      });
      events.push({ resource: 'activities', action: activity.created ? 'created' : 'updated', record: flattenRecord(activity.record) });
    }
    const movedToInterview = text(current.status) === 'Interview Scheduled' && text(before?.status) !== 'Interview Scheduled';
    if (movedToInterview && text(current.benchConsultantId)) {
      const existingInterview = await tx.benchInterview.findFirst({ where: { submissionId: String(record.id), status: { notIn: ['Cancelled', 'Rejected'] } } });
      if (!existingInterview) {
        const interview = await tx.benchInterview.create({
          data: {
            candidateName: text(current.candidateName), submissionId: String(record.id), benchConsultantId: text(current.benchConsultantId),
            clientCompany: text(current.endClient) || text(current.implementationName), vendorCompany: text(current.vendorCompany), jobTitle: text(current.jobTitle),
            technology: text(current.consultantSkills) || text(current.jobTitle), vendorEmail: text(current.vendorEmail), submissionRate: numberValue(current.ratePerHour),
            workLocation: text(current.workLocation), workMode: normalizeWorkMode(text(current.workMode)), interviewRound: 'Technical', status: 'Draft', ownerName: text(current.ownerName),
            customData: { source: 'AUTO_FROM_SUBMISSION', instructions: '', result: 'Pending' },
          },
        });
        events.push({ resource: 'bench-interviews', action: 'created', record: flattenRecord(interview) });
        const activity = await upsertActivity(tx, {
          relatedEntityType: 'InterviewScheduling', relatedEntityId: interview.id, activity: `Complete interview schedule: ${interview.candidateName}`,
          description: `${interview.clientCompany ?? ''} — ${interview.jobTitle}`, relatedTo: interview.candidateName, relatedType: 'Bench Interview', type: 'Task', status: 'Pending', priority: 'High', ownerName: interview.ownerName, dueDate: today(), ownerId: actor.id,
        });
        events.push({ resource: 'activities', action: activity.created ? 'created' : 'updated', record: flattenRecord(activity.record) });
      }
    }
  }

  if (resource === 'bench-interviews') {
    const result = text(current.result);
    const status = text(current.status);
    // When a new interview is created and scheduled, link and update related records
    const isCreatedNow = !before;
    if (isCreatedNow && status === 'Scheduled' && text(current.submissionId)) {
      // Update Submission status to Interview Scheduled
      try {
        const updatedSubmission = await tx.submission.update({ where: { id: text(current.submissionId) }, data: { status: 'Interview Scheduled' } });
        events.push({ resource: 'submissions', action: 'updated', record: flattenRecord(updatedSubmission) });
      } catch (err) {
        // ignore if submission missing or concurrent update; validation elsewhere ensures submission exists
      }
      // Update bench consultant marketing/status to Interviewing
      if (text(current.benchConsultantId)) {
        const bench = await updateBenchStatus(tx, text(current.benchConsultantId), 'Interviewing', 'Interviewing');
        if (bench) events.push({ resource: 'bench', action: 'updated', record: flattenRecord(bench) });
      }
      // Create an activity/history entry to track scheduling
      const activity = await upsertActivity(tx, {
        relatedEntityType: 'InterviewScheduling', relatedEntityId: String(record.id), activity: `Interview scheduled: ${text(current.candidateName)}`,
        description: `${text(current.clientCompany)} / ${text(current.jobTitle)}`, relatedTo: text(current.candidateName), relatedType: 'Bench Interview', type: 'Task', status: 'Pending', priority: 'High', ownerName: text(current.ownerName), dueDate: today(), ownerId: actor.id,
      });
      events.push({ resource: 'activities', action: activity.created ? 'created' : 'updated', record: flattenRecord(activity.record) });
    }
    if (status === 'Scheduled' && text(current.interviewDate)) {
      for (const hours of [24, 1]) {
        const reminder = subtractHours(text(current.interviewDate), text(current.interviewTime) || '09:00', hours);
        const activity = await upsertActivity(tx, {
          relatedEntityType: `InterviewReminder${hours}h`, relatedEntityId: String(record.id), activity: `Interview reminder (${hours}h): ${text(current.candidateName)}`,
          description: `${text(current.interviewRound)} round — ${text(current.clientCompany)}`, relatedTo: text(current.candidateName), relatedType: 'Bench Interview', type: 'Meeting', status: 'Scheduled', priority: 'High', ownerName: text(current.ownerName), dueDate: reminder.date, dueTime: reminder.time, ownerId: actor.id,
        });
        events.push({ resource: 'activities', action: activity.created ? 'created' : 'updated', record: flattenRecord(activity.record) });
      }
    }
    if (text(current.result) === 'On Hold') {
      const bench = await updateBenchStatus(tx, text(current.benchConsultantId), 'On Hold', 'On Hold');
      if (bench) events.push({ resource: 'bench', action: 'updated', record: flattenRecord(bench) });
      if (text(current.followUpDate)) {
        const activity = await upsertActivity(tx, {
          relatedEntityType: 'InterviewHold', relatedEntityId: String(record.id), activity: `Hold follow-up: ${text(current.candidateName)}`,
          description: `${text(current.interviewRound)} round — ${text(current.clientCompany)}` + (text(current.holdReason) ? ` — Hold reason: ${text(current.holdReason)}` : ''),
          relatedTo: text(current.candidateName), relatedType: 'Bench Interview', type: 'Follow-up', status: 'Pending', priority: 'High', ownerName: text(current.ownerName), dueDate: text(current.followUpDate), ownerId: actor.id,
        });
        events.push({ resource: 'activities', action: activity.created ? 'created' : 'updated', record: flattenRecord(activity.record) });
      }
    }
    if (status === 'Pending Feedback' || (status === 'Completed' && result === 'Pending')) {
      const dueDate = text(current.followUpDate) || addDays(today(), 1);
      const activity = await upsertActivity(tx, {
        relatedEntityType: 'InterviewFeedback', relatedEntityId: String(record.id), activity: `Collect interview feedback: ${text(current.candidateName)}`,
        description: `${text(current.interviewRound)} round — ${text(current.clientCompany)}`, relatedTo: text(current.candidateName), relatedType: 'Bench Interview', type: 'Follow-up', status: 'Pending', priority: 'High', ownerName: text(current.ownerName), dueDate, ownerId: actor.id,
      });
      events.push({ resource: 'activities', action: activity.created ? 'created' : 'updated', record: flattenRecord(activity.record) });
    }
    const resultChanged = result && result !== text(before?.result);
    if (resultChanged && result === 'Next Round' && text(current.submissionId)) {
      if (text(current.interviewRound) === 'HR') throw workflowError('HR is the final interview round. Select or reject the consultant instead of creating another round.', 409);
      const existingNext = await findByCustomSource(tx.benchInterview, { submissionId: text(current.submissionId) }, String(record.id));
      if (!existingNext) {
        const nextInterview = await tx.benchInterview.create({
          data: {
            candidateName: text(current.candidateName), submissionId: text(current.submissionId), benchConsultantId: text(current.benchConsultantId),
            clientCompany: text(current.clientCompany), vendorCompany: text(current.vendorCompany), jobTitle: text(current.jobTitle), technology: text(current.technology),
            vendorEmail: text(current.vendorEmail), submissionRate: numberValue(current.submissionRate), workLocation: text(current.workLocation), workMode: normalizeWorkMode(text(current.workMode)),
            interviewRound: nextRound(text(current.interviewRound)), status: 'Draft', ownerName: text(current.ownerName),
            customData: { source: 'AUTO_NEXT_ROUND', sourceInterviewId: String(record.id), result: 'Pending' },
          },
        });
        events.push({ resource: 'bench-interviews', action: 'created', record: flattenRecord(nextInterview) });
      }
    }
    const selectedNow = resultChanged && result === 'Selected';
    if (selectedNow && text(current.submissionId)) {
      if (status !== 'Completed') {
        const completed = await tx.benchInterview.update({ where: { id: String(record.id) }, data: { status: 'Completed' } });
        events.push({ resource: 'bench-interviews', action: 'updated', record: flattenRecord(completed) });
      }
      const existingOffer = await tx.benchOffer.findFirst({ where: { benchInterviewId: String(record.id) } });
      if (!existingOffer) {
        const submission = await tx.submission.findUnique({ where: { id: text(current.submissionId) } });
        if (!submission) throw workflowError('The selected Interview is missing its linked Submission.', 422);
        const submissionData = flattenRecord(submission);
        const offer = await tx.benchOffer.create({
          data: {
            candidateName: submission.candidateName,
            submissionId: submission.id,
            benchConsultantId: submission.benchConsultantId!,
            benchInterviewId: String(record.id),
            clientCompany: text(submissionData.endClient) || text(submissionData.implementationName),
            vendorCompany: text(submissionData.vendorCompany),
            vendorEmail: text(submissionData.vendorEmail),
            vendorContactNumber: text(submissionData.vendorContact),
            jobTitle: submission.jobTitle,
            offerDate: today(),
            billRate: submission.ratePerHour,
            payRate: numberValue(submissionData.payRate),
            rateType: text(submissionData.rateType) || 'C2C',
            workLocation: text(submissionData.workLocation),
            status: 'Draft',
            ownerName: submission.ownerName,
            customData: {
              source: 'AUTO_FROM_SELECTED_INTERVIEW',
              workMode: normalizeWorkMode(text(submissionData.workMode)),
              offerSharedDate: '',
              onboardingStatus: 'Not Started',
            },
          },
        });
        events.push({ resource: 'bench-offers', action: 'created', record: flattenRecord(offer) });
        const activity = await upsertActivity(tx, {
          relatedEntityType: 'OfferCreation',
          relatedEntityId: offer.id,
          activity: `Create offer draft for selected interview: ${text(current.candidateName)}`,
          description: `${text(offer.clientCompany)} / ${text(offer.jobTitle)}`,
          relatedTo: text(current.candidateName),
          relatedType: 'Bench Offer',
          type: 'Task',
          status: 'Pending',
          priority: 'High',
          ownerName: text(current.ownerName),
          dueDate: today(),
          ownerId: actor.id,
        });
        events.push({ resource: 'activities', action: activity.created ? 'created' : 'updated', record: flattenRecord(activity.record) });
      }
      const bench = await updateBenchStatus(tx, text(current.benchConsultantId), 'Offer', 'Offer');
      if (bench) events.push({ resource: 'bench', action: 'updated', record: flattenRecord(bench) });
    }
    if (resultChanged && result === 'Rejected' && text(current.submissionId)) {
      if (status !== 'Completed') {
        const completed = await tx.benchInterview.update({ where: { id: String(record.id) }, data: { status: 'Completed' } });
        events.push({ resource: 'bench-interviews', action: 'updated', record: flattenRecord(completed) });
      }
      const submission = await tx.submission.update({ where: { id: text(current.submissionId) }, data: { status: 'Rejected' } });
      events.push({ resource: 'submissions', action: 'updated', record: flattenRecord(submission) });
      const bench = await updateBenchStatus(tx, text(current.benchConsultantId), 'Active', 'Available');
      if (bench) events.push({ resource: 'bench', action: 'updated', record: flattenRecord(bench) });
      const activity = await upsertActivity(tx, {
        relatedEntityType: 'InterviewRejection',
        relatedEntityId: String(record.id),
        activity: `Interview rejected: ${text(current.candidateName)}`,
        description: `${text(current.interviewRound)} round — ${text(current.clientCompany)}${text(current.rejectionStage) ? ` / Rejection stage: ${text(current.rejectionStage)}` : ''}`,
        relatedTo: text(current.candidateName),
        relatedType: 'Bench Interview',
        type: 'Follow-up',
        status: 'Pending',
        priority: 'High',
        ownerName: text(current.ownerName),
        dueDate: today(),
        ownerId: actor.id,
      });
      events.push({ resource: 'activities', action: activity.created ? 'created' : 'updated', record: flattenRecord(activity.record) });
    }
  }

  if (resource === 'bench-offers') {
    if (text(current.offerExpiryDate)) {
      const activity = await upsertActivity(tx, {
        relatedEntityType: 'OfferExpiry', relatedEntityId: String(record.id), activity: `Offer expiry: ${text(current.candidateName)}`,
        description: `${text(current.clientCompany)} — ${text(current.jobTitle)}`, relatedTo: text(current.candidateName), relatedType: 'Bench Offer', type: 'Follow-up', status: 'Pending', priority: 'High', ownerName: text(current.ownerName), dueDate: text(current.offerExpiryDate), ownerId: actor.id,
      });
      events.push({ resource: 'activities', action: activity.created ? 'created' : 'updated', record: flattenRecord(activity.record) });
    }
    const statusChanged = text(current.status) !== text(before?.status);
    if (statusChanged && text(current.status) === 'Accepted') {
      const acceptedDate = text(current.offerAcceptedDate) || today();
      const updatedOffer = await tx.benchOffer.update({ where: { id: String(record.id) }, data: { offerAcceptedDate: acceptedDate, customData: mergeCustom(record, { onboardingStatus: 'In Progress' }) } });
      events.push({ resource: 'bench-offers', action: 'updated', record: flattenRecord(updatedOffer) });
      const submission = await tx.submission.update({ where: { id: text(current.submissionId) }, data: { status: 'Accepted' } });
      events.push({ resource: 'submissions', action: 'updated', record: flattenRecord(submission) });
      const bench = await updateBenchStatus(tx, text(current.benchConsultantId), 'Offer', 'Offer');
      if (bench) events.push({ resource: 'bench', action: 'updated', record: flattenRecord(bench) });
      const activity = await upsertActivity(tx, {
        relatedEntityType: 'JoiningConfirmation', relatedEntityId: String(record.id), activity: `Confirm joining: ${text(current.candidateName)}`,
        description: `${text(current.clientCompany)} — accepted offer`, relatedTo: text(current.candidateName), relatedType: 'Bench Offer', type: 'Task', status: 'Pending', priority: 'High', ownerName: text(current.ownerName), dueDate: text(current.expectedJoiningDate) || addDays(today(), 1), ownerId: actor.id,
      });
      events.push({ resource: 'activities', action: activity.created ? 'created' : 'updated', record: flattenRecord(activity.record) });

      // Create one linked onboarding placement immediately after acceptance. This is
      // intentionally idempotent and keeps the later Confirm Joining action available
      // to complete actual start and contract details without creating duplicates.
      const existingPlacement = await tx.placement.findFirst({ where: { benchOfferId: String(record.id) } });
      if (!existingPlacement) {
        const linkedSubmission = await tx.submission.findUnique({ where: { id: text(current.submissionId) }, include: { job: true } });
        if (!linkedSubmission) throw workflowError('The accepted Offer is missing its linked Submission.', 422);
        const submissionData = flattenRecord(linkedSubmission);
        const expectedStart = text(current.expectedJoiningDate) || acceptedDate;
        const placement = await tx.placement.create({
          data: {
            benchOfferId: String(record.id),
            submissionId: linkedSubmission.id,
            benchConsultantId: text(current.benchConsultantId),
            candidateName: text(current.candidateName),
            clientCompany: text(current.clientCompany),
            vendorCompany: text(current.vendorCompany) || linkedSubmission.vendorCompany,
            vendorEmail: text(submissionData.vendorEmail) || null,
            vendorContactNumber: text(submissionData.vendorContact) || null,
            billingRate: numberValue(current.billRate),
            startDate: expectedStart,
            status: 'Onboarding',
            ownerName: text(current.ownerName),
            customData: {
              source: 'AUTO_FROM_ACCEPTED_OFFER',
              joiningDate: expectedStart,
              expectedJoiningDate: expectedStart,
              actualStartDate: '',
              jobTitle: text(current.jobTitle),
              workLocation: text(current.workLocation) || text(submissionData.workLocation),
              workMode: normalizeWorkMode(text((current as any).workMode) || text(submissionData.workMode)),
              contractDuration: text((current as any).contractDuration),
              onboardingStatus: 'In Progress',
              createdByUserId: actor.id ?? null,
              createdByUserName: actor.name ?? text(current.ownerName),
            },
          },
        });
        events.push({ resource: 'placements', action: 'created', record: flattenRecord(placement) });

        if (linkedSubmission.job) {
          const remaining = Math.max(0, Number(linkedSubmission.job.vacancyCount || 0) - 1);
          const jobStatus = remaining === 0 ? 'Filled' : linkedSubmission.job.status;
          const updatedJob = await tx.job.update({
            where: { id: linkedSubmission.job.id },
            data: { vacancyCount: remaining, status: jobStatus },
          });
          if (updatedJob.requirementId) {
            await tx.requirement.update({ where: { id: updatedJob.requirementId }, data: { status: jobStatus } });
          }
          events.push({ resource: 'jobs', action: 'updated', record: flattenRecord(updatedJob) });
        }
      }
    }
    if (statusChanged && ['Rejected', 'Expired', 'Withdrawn', 'Cancelled'].includes(text(current.status))) {
      const bench = await updateBenchStatus(tx, text(current.benchConsultantId), 'Active', 'Available');
      if (bench) events.push({ resource: 'bench', action: 'updated', record: flattenRecord(bench) });
    }
  }

  if (resource === 'placements') {
    const status = text(current.status);
    if (['Onboarding', 'Active', 'Extended'].includes(status)) {
      const bench = await updateBenchStatus(tx, text(current.benchConsultantId), 'Placed', 'Placed');
      if (bench) events.push({ resource: 'bench', action: 'updated', record: flattenRecord(bench) });
      if (text(current.submissionId)) {
        const submission = await tx.submission.update({ where: { id: text(current.submissionId) }, data: { status: 'Accepted' } });
        events.push({ resource: 'submissions', action: 'updated', record: flattenRecord(submission) });
      }
      if (text(current.benchOfferId)) {
        const existingOffer = await tx.benchOffer.findUnique({ where: { id: text(current.benchOfferId) } });
        if (existingOffer) {
          const offer = await tx.benchOffer.update({ where: { id: existingOffer.id }, data: { status: 'Accepted', customData: mergeCustom(existingOffer, { onboardingStatus: status === 'Active' ? 'Completed' : 'In Progress' }) } });
          events.push({ resource: 'bench-offers', action: 'updated', record: flattenRecord(offer) });
        }
      }
      const contractEnd = text(current.contractEndDate) || text(current.endDate);
      if (contractEnd) {
        for (const days of [30, 15, 7]) {
          const dueDate = addDays(contractEnd, -days);
          const activity = await upsertActivity(tx, {
            relatedEntityType: `PlacementContractReminder${days}`, relatedEntityId: String(record.id), activity: `Contract ends in ${days} days: ${text(current.candidateName)}`,
            description: `${text(current.clientCompany)} — review extension or completion`, relatedTo: text(current.candidateName), relatedType: 'Placement', type: 'Follow-up', status: 'Pending', priority: days <= 7 ? 'High' : 'Medium', ownerName: text(current.ownerName), dueDate, ownerId: actor.id,
          });
          events.push({ resource: 'activities', action: activity.created ? 'created' : 'updated', record: flattenRecord(activity.record) });
        }
      }
    }
    if (['Completed', 'Terminated', 'Cancelled'].includes(status) && text(current.benchConsultantId)) {
      const active = await tx.placement.findFirst({ where: { benchConsultantId: text(current.benchConsultantId), id: { not: String(record.id) }, status: { in: ['Onboarding', 'Active', 'Extended'] } } });
      if (!active) {
        const bench = await updateBenchStatus(tx, text(current.benchConsultantId), 'Active', 'Available');
        if (bench) events.push({ resource: 'bench', action: 'updated', record: flattenRecord(bench) });
      }
    }
  }

  if (actor.id && events.length) {
    await tx.notification.create({
      data: {
        userId: actor.id,
        type: 'BENCH_WORKFLOW_AUTOMATION',
        title: 'Bench workflow updated',
        message: `${events.length} linked record${events.length === 1 ? '' : 's'} and reminder${events.length === 1 ? '' : 's'} were updated automatically.`,
        entityType: resource,
        entityId: String(record.id),
      },
    });
  }
  return events;
}

export async function createPlacementFromAcceptedOffer(tx: any, offerId: string, input: Record<string, unknown>, actor: { id?: string; name?: string }) {
  const offer = await tx.benchOffer.findUnique({ where: { id: offerId }, include: { placement: true, submission: true } });
  if (!offer) throw workflowError('Offer not found.', 404);
  if (offer.status !== 'Accepted') throw workflowError('Confirm joining only after the Offer is Accepted.', 409);
  const offerData = flattenRecord(offer);
  if (offer.placement) {
    const actualStartDate = text(input.actualStartDate) || text(input.joiningDate);
    if (!actualStartDate) throw workflowError('Actual Start Date is required.', 422);
    await validatePlacementOverlap(tx, offer.benchConsultantId, actualStartDate, text(input.contractEndDate), offer.placement.id);
    const previous = offer.placement;
    const previousData = flattenRecord(previous);
    const customData = {
      ...((previous.customData && typeof previous.customData === 'object') ? previous.customData : {}),
      joiningDate: text(input.joiningDate) || actualStartDate,
      actualStartDate,
      contractStartDate: text(input.contractStartDate) || actualStartDate,
      contractEndDate: text(input.contractEndDate),
      vendorEmail: text(input.vendorEmail) || text(previousData.vendorEmail),
      vendorContactNumber: text(input.vendorContactNumber) || text(previousData.vendorContactNumber),
      workLocation: text(input.workLocation) || text(previousData.workLocation),
      workMode: normalizeWorkMode(text(input.workMode) || text(previousData.workMode)),
      contractDuration: text(input.contractDuration) || text(previousData.contractDuration),
      onboardingStatus: 'Completed',
    };
    const placement = await tx.placement.update({
      where: { id: previous.id },
      data: {
        vendorEmail: customData.vendorEmail || null,
        vendorContactNumber: customData.vendorContactNumber || null,
        startDate: actualStartDate,
        endDate: customData.contractEndDate || null,
        status: 'Active',
        customData,
      },
    });
    const events = await applyBenchAutomation(tx, 'placements', placement, previous, actor);
    return { idempotent: false, placement, events };
  }
  const submissionData = flattenRecord(offer.submission);
  const actualStartDate = text(input.actualStartDate) || text(input.joiningDate);
  if (!actualStartDate) throw workflowError('Actual Start Date is required.', 422);
  await validatePlacementOverlap(tx, offer.benchConsultantId, actualStartDate, text(input.contractEndDate));
  const customData = {
    joiningDate: text(input.joiningDate) || actualStartDate,
    actualStartDate,
    contractStartDate: text(input.contractStartDate) || actualStartDate,
    contractEndDate: text(input.contractEndDate),
    expectedJoiningDate: offer.expectedJoiningDate ?? '',
    jobTitle: offer.jobTitle,
    vendorEmail: text(input.vendorEmail) || text(submissionData.vendorEmail),
    vendorContactNumber: text(input.vendorContactNumber) || text(submissionData.vendorContact),
    workLocation: text(input.workLocation) || text(offerData.workLocation),
    workMode: normalizeWorkMode(text(input.workMode) || text(offerData.workMode)),
    contractDuration: text(input.contractDuration) || text(offerData.contractDuration),
    margin: Math.max(0, offer.billRate - offer.payRate),
    onboardingStatus: 'In Progress',
  };
  validateRequired('placements', {
    benchOfferId: offer.id, submissionId: offer.submissionId, benchConsultantId: offer.benchConsultantId, candidateName: offer.candidateName,
    clientCompany: offer.clientCompany, vendorCompany: offer.vendorCompany || offer.submission.vendorCompany, billingRate: offer.billRate,
    ownerName: offer.ownerName, status: 'Active', ...customData,
  }, false);
  const placement = await tx.placement.create({
    data: {
      benchOfferId: offer.id, submissionId: offer.submissionId, benchConsultantId: offer.benchConsultantId, candidateName: offer.candidateName,
      clientCompany: offer.clientCompany, vendorCompany: offer.vendorCompany || offer.submission.vendorCompany, vendorEmail: customData.vendorEmail,
      vendorContactNumber: customData.vendorContactNumber, billingRate: offer.billRate, startDate: actualStartDate, endDate: customData.contractEndDate || null,
      status: 'Active', ownerName: offer.ownerName, customData,
    },
  });
  const events = await applyBenchAutomation(tx, 'placements', placement, null, actor);
  return { idempotent: false, placement, events };
}

function validateRequired(resource: string, values: Record<string, unknown>, draft: boolean) {
  const keys = draft ? requiredFields[resource].filter((key) => ['benchConsultantId', 'submissionId', 'benchInterviewId', 'candidateName', 'jobTitle', 'interviewRound', 'clientCompany', 'offerDate', 'status', 'ownerName'].includes(key)) : requiredFields[resource] ?? [];
  const numericKeys = new Set(['ratePerHour', 'submissionRate', 'billingRate']);
  const missing = keys.filter((key) => numericKeys.has(key) ? !positiveNumber(values[key]) : !hasValue(values[key]));
  if (missing.length) throw workflowError(`Complete the required fields: ${missing.join(', ')}.`, 422);
}

async function validateBenchDuplicates(tx: any, values: Record<string, unknown>, excludeId?: string) {
  const candidates = await tx.bench.findMany({ select: { id: true, candidateName: true, customData: true } });
  const email = normalizeEmail(values.email);
  const phone = normalizePhone(values.phone);
  const linkedin = normalizeUrl(values.linkedinUrl);
  const duplicate = candidates.find((item: any) => {
    if (item.id === excludeId) return false;
    const data = flattenRecord(item);
    return (email && normalizeEmail(data.email) === email) || (phone && normalizePhone(data.phone) === phone) || (linkedin && normalizeUrl(data.linkedinUrl) === linkedin);
  });
  if (duplicate) throw workflowError(`Possible duplicate consultant found: ${duplicate.candidateName}. Email, phone and LinkedIn must be unique.`, 409);
}

async function validateDuplicateSubmission(tx: any, values: Record<string, unknown>, excludeId?: string) {
  const consultantId = text(values.benchConsultantId);
  const jobId = text(values.jobId);
  if (!consultantId || !jobId) return;
  const duplicate = await tx.submission.findFirst({ where: {
    benchConsultantId: consultantId,
    jobId,
    vendorCompany: { equals: text(values.vendorCompany), mode: 'insensitive' },
    id: excludeId ? { not: excludeId } : undefined,
    status: { notIn: ['Rejected', 'Withdrawn', 'Expired'] },
  } });
  if (duplicate) throw workflowError('This consultant already has an active submission for the selected Job and Vendor.', 409);
}

async function validatePlacementOverlap(tx: any, consultantId: string, startDate: string, endDate?: string, excludeId?: string) {
  if (!consultantId || !startDate) return;
  const placements = await tx.placement.findMany({ where: { benchConsultantId: consultantId, id: excludeId ? { not: excludeId } : undefined, status: { in: ['Onboarding', 'Active', 'Extended'] } } });
  const start = Date.parse(startDate);
  const end = endDate ? Date.parse(endDate) : Number.POSITIVE_INFINITY;
  const overlap = placements.find((item: any) => {
    const data = flattenRecord(item);
    const existingStart = Date.parse(text(data.actualStartDate) || text(item.startDate));
    const existingEndText = text(data.contractEndDate) || text(item.endDate);
    const existingEnd = existingEndText ? Date.parse(existingEndText) : Number.POSITIVE_INFINITY;
    return Number.isFinite(start) && start <= existingEnd && existingStart <= end;
  });
  if (overlap) throw workflowError('Consultant already has an overlapping active placement.', 409);
}

async function updateBenchStatus(tx: any, consultantId: string, marketingStatus: string, _availabilityStatus: string, _lastMarketedDate?: unknown) {
  if (!consultantId) return null;
  const bench = await tx.bench.findUnique({ where: { id: consultantId } });
  if (!bench) return null;
  // Keep the legacy database stage internally for workflow compatibility.
  // Availability and marketing form data are no longer written or exposed.
  return tx.bench.update({
    where: { id: consultantId },
    data: { marketingStatus },
  });
}

async function createExpiryActivities(tx: any, consultant: Record<string, unknown>, ownerId?: string) {
  for (const [field, label] of [['visaExpiryDate', 'Visa'], ['passportExpiryDate', 'Passport'], ['workAuthorizationExpiryDate', 'Work authorization']] as const) {
    const date = text(consultant[field]);
    if (!date) continue;
    await upsertActivity(tx, {
      relatedEntityType: `Consultant${field}`, relatedEntityId: text(consultant.id), activity: `${label} expiry: ${text(consultant.candidateName)}`,
      description: `${label} expires on ${date}`, relatedTo: text(consultant.candidateName), relatedType: 'Bench Consultant', type: 'Follow-up', status: 'Pending', priority: 'High', ownerName: text(consultant.ownerName), dueDate: addDays(date, -30), ownerId,
    });
  }
}

async function upsertActivity(tx: any, data: Record<string, unknown>) {
  const existing = await tx.activity.findFirst({ where: { relatedEntityType: data.relatedEntityType, relatedEntityId: data.relatedEntityId } });
  if (existing) {
    const existingStatus = text(existing.status).toLowerCase();
    // Update only if existing reminder is still pending/scheduled; otherwise create a new activity
    if (['pending', 'scheduled'].includes(existingStatus)) {
      return { created: false, record: await tx.activity.update({ where: { id: existing.id }, data }) };
    }
    return { created: true, record: await tx.activity.create({ data }) };
  }
  return { created: true, record: await tx.activity.create({ data }) };
}

async function findByCustomSource(model: any, where: Record<string, unknown>, sourceId: string) {
  const records = await model.findMany({ where });
  return records.find((record: any) => text(flattenRecord(record).sourceInterviewId) === sourceId);
}

async function generateConsultantCode(tx: any) {
  const records = await tx.bench.findMany({ select: { consultantCode: true } });
  const used = new Set(records.map((record: any) => text(record.consultantCode)).filter(Boolean));
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = `CON-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!used.has(code)) return code;
  }
  return `CON-${Date.now().toString().slice(-9)}`;
}

function calculateProfileCompletion(values: Record<string, unknown>) {
  const keys = ['candidateName', 'email', 'phone', 'currentLocation', 'linkedinUrl', 'primarySkill', 'skills', 'experienceYears', 'highestQualification', 'visaStatus', 'validVisa', 'availableFrom', 'noticePeriod', 'expectedRate', 'ownerName', 'resumeUrl'];
  return Math.round((keys.filter((key) => hasValue(values[key])).length / keys.length) * 100);
}

function nextRound(round: string) {
  const order = ['Technical', 'Implementation', 'End Client', 'HR'];
  const index = order.indexOf(round);
  return order[Math.min(index < 0 ? 0 : index + 1, order.length - 1)];
}

function mergeCustom(record: Record<string, unknown>, updates: Record<string, unknown>) {
  const custom = record.customData && typeof record.customData === 'object' && !Array.isArray(record.customData) ? record.customData as Record<string, unknown> : {};
  return { ...custom, ...updates };
}


export function flattenRecord(record: any): Record<string, unknown> {
  if (!record || typeof record !== 'object') return {};
  const custom = record.customData && typeof record.customData === 'object' && !Array.isArray(record.customData) ? record.customData : {};
  const { customData: _customData, ...base } = record;
  return { ...base, ...custom };
}

function normalizeWorkMode(value: string) {
  if (!value) return '';
  return workModeAliases[normalize(value)] ?? value;
}
function normalizeEmail(value: unknown) { return text(value).trim().toLowerCase(); }
function normalizePhone(value: unknown) { return text(value).replace(/\D/g, ''); }
function normalizeUrl(value: unknown) { return text(value).trim().toLowerCase().replace(/\/$/, ''); }
function normalize(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function positiveNumber(value: unknown) { return Number(value) > 0; }
function numberValue(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function text(value: unknown) { return value === null || value === undefined ? '' : String(value).trim(); }
function hasValue(value: unknown) { return typeof value === 'number' ? Number.isFinite(value) && value > 0 : text(value) !== ''; }
function today() { return new Date().toISOString().slice(0, 10); }
function addDays(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); if (Number.isNaN(date.getTime())) return value; date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function subtractHours(dateValue: string, timeValue: string, hours: number) { const date = new Date(`${dateValue}T${timeValue || '09:00'}:00Z`); if (Number.isNaN(date.getTime())) return { date: dateValue, time: timeValue }; date.setUTCHours(date.getUTCHours() - hours); return { date: date.toISOString().slice(0, 10), time: date.toISOString().slice(11, 16) }; }
function jsonSafe(value: unknown) { return JSON.parse(JSON.stringify(value)); }
function workflowError(message: string, statusCode: number) { return Object.assign(new Error(message), { statusCode }); }
