import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { emitResourceEvent } from '../lib/socket.js';
import { hashPassword } from '../lib/password.js';
import { hasPermission, normalizeRole, sanitizePermissionsForRole } from '../lib/permissions.js';
import { BENCH_WORKFLOW_RESOURCES, applyBenchAutomation, enrichAndValidateBenchInput, flattenRecord as flattenBenchRecord, type WorkflowEvent } from '../services/benchWorkflow.js';
import { calculateRequirementMatch } from '../lib/matching.js';
import { normalizeJobPayload } from '../lib/payloadNormalization.js';

const resources = {
  leads: { model: 'lead', type: 'Lead', search: ['name', 'company', 'email', 'status', 'ownerName'] },
  contacts: { model: 'contact', type: 'Contact', search: ['name', 'company', 'email', 'contactType', 'ownerName'] },
  accounts: { model: 'account', type: 'Account', search: ['accountName', 'industry', 'email', 'ownerName', 'status'] },
  opportunities: { model: 'opportunity', type: 'Opportunity', search: ['opportunityName', 'accountName', 'stage', 'ownerName'] },
  campaigns: { model: 'campaign', type: 'Campaign', search: ['campaignName', 'type', 'status', 'ownerName'] },
  activities: { model: 'activity', type: 'Activity', search: ['activity', 'description', 'relatedTo', 'type', 'status', 'ownerName'] },
  candidates: { model: 'candidate', type: 'Candidate', search: ['name', 'email', 'skills', 'status', 'ownerName'] },
  jobs: { model: 'job', type: 'Job', search: ['jobTitle', 'skillsRequired', 'company', 'jobType', 'location', 'status', 'ownerName'] },
  interviews: { model: 'interview', type: 'Interview', search: ['candidateName', 'jobTitle', 'status', 'interviewer'] },
  offers: { model: 'offer', type: 'Offer', search: ['candidateName', 'jobTitle', 'status', 'ownerName'] },
  bench: { model: 'bench', type: 'Bench', search: ['candidateName', 'skills', 'visaStatus', 'ownerName'] },
  submissions: { model: 'submission', type: 'Submission', search: ['candidateName', 'vendorCompany', 'jobTitle', 'status', 'ownerName'] },
  'submission-emails': { model: 'submissionEmail', type: 'SubmissionEmail', search: ['toEmail', 'ccEmail', 'subject', 'status', 'sentBy'] },
  'bench-interviews': { model: 'benchInterview', type: 'BenchInterview', search: ['candidateName', 'clientCompany', 'vendorCompany', 'jobTitle', 'status', 'interviewer', 'ownerName'] },
  'bench-offers': { model: 'benchOffer', type: 'BenchOffer', search: ['candidateName', 'clientCompany', 'vendorCompany', 'jobTitle', 'status', 'ownerName'] },
  requirements: { model: 'requirement', type: 'Requirement', search: ['title', 'clientCompany', 'vendorCompany', 'skills', 'status'] },
  placements: { model: 'placement', type: 'Placement', search: ['candidateName', 'clientCompany', 'vendorCompany', 'status', 'ownerName'] },
  'ai-projects': { model: 'aiProject', type: 'AiProject', search: ['projectName', 'techStack', 'status', 'leadEngineer', 'ownerName'] },
  tasks: { model: 'aiTask', type: 'AiTask', search: ['taskName', 'projectName', 'status', 'priority', 'assignee'] },
  resources: { model: 'aiResource', type: 'AiResource', search: ['name', 'type', 'allocationStatus', 'skillLevel', 'ownerName'] },
  users: { model: 'user', type: 'User', search: ['name', 'username', 'email', 'role'] },
} as const;

type ResourceName = keyof typeof resources;
const importSchema = z.object({ rows: z.array(z.record(z.unknown())).min(1).max(2000) });
const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(2000) });
export const crudRouter = Router();

function isAdmin(user: any) {
  return ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(String(user?.role ?? '').toUpperCase());
}

function ownershipWhere(type: string, user: any): Record<string, unknown> | null {
  if (isAdmin(user) || type === 'User' || type === 'Job') return null;
  const fields = modelFields(type);
  const clauses: Record<string, unknown>[] = [];
  if (fields.has('ownerId')) clauses.push({ ownerId: user.id });
  if (fields.has('customData')) clauses.push({ customData: { path: ['createdByUserId'], equals: user.id } });
  // Compatibility for records created before ownership metadata was introduced.
  if (fields.has('ownerName') && user.name) clauses.push({ ownerName: { equals: String(user.name), mode: 'insensitive' } });
  return clauses.length ? { OR: clauses } : { customData: { path: ['createdByUserId'], equals: user.id } };
}


function creatorOnlyWhere(type: string, user: any): Record<string, unknown> | null {
  if (isAdmin(user) || type === 'User') return null;
  const fields = modelFields(type);
  const clauses: Record<string, unknown>[] = [];
  if (fields.has('ownerId')) clauses.push({ ownerId: user.id });
  if (fields.has('customData')) clauses.push({ customData: { path: ['createdByUserId'], equals: user.id } });
  if (fields.has('ownerName') && user.name) clauses.push({ ownerName: { equals: String(user.name), mode: 'insensitive' } });
  return clauses.length ? { OR: clauses } : { customData: { path: ['createdByUserId'], equals: user.id } };
}

function withCreatorOwnership(type: string, input: Record<string, unknown>, user: any) {
  if (type === 'User') return input;
  const fields = modelFields(type);
  const next: Record<string, unknown> = { ...input, createdByUserId: user.id, createdByUserName: user.name };
  if (fields.has('ownerId')) next.ownerId = user.id;
  if (fields.has('ownerName')) next.ownerName = user.name;
  return next;
}

function assertOwned(type: string, record: any, user: any) {
  if (isAdmin(user) || type === 'User') return;
  const custom = record?.customData && typeof record.customData === 'object' ? record.customData : {};
  const owned = record?.ownerId === user.id || custom.createdByUserId === user.id || (record?.ownerName && String(record.ownerName).toLowerCase() === String(user.name ?? '').toLowerCase());
  if (!owned) throw Object.assign(new Error('You can only view or modify records created by your own login.'), { statusCode: 403 });
}


crudRouter.param('resource', (req, res, next, resource) => {
  if (!(resource in resources)) return res.status(404).json({ message: 'Unknown resource' });
  next();
});

const resourcePermission: Partial<Record<ResourceName, string>> = {
  leads: 'leads', contacts: 'contacts', accounts: 'accounts', opportunities: 'opportunities', campaigns: 'campaigns', activities: 'activities',
  candidates: 'candidates', jobs: 'jobs', interviews: 'interviews', offers: 'offers',
  bench: 'bench', submissions: 'submissions', 'submission-emails': 'submissions', requirements: 'submissions', 'bench-interviews': 'submissions', 'bench-offers': 'placements', placements: 'placements',
  'ai-projects': 'ai-projects', tasks: 'tasks', resources: 'resources', users: 'users',
};

crudRouter.use('/:resource', (req, res, next) => {
  const requiredPermission = resourcePermission[req.params.resource as ResourceName];
  if (!requiredPermission || hasPermission(res.locals.authUser ?? {}, requiredPermission)) return next();
  return res.status(403).json({ message: 'You do not have access to this module.' });
});

crudRouter.get('/:resource', async (req, res, next) => {
  try {
    const resource = req.params.resource as ResourceName;
    const config = resources[resource];
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 5000);
    const search = String(req.query.search ?? '').trim();
    const fields = modelFields(config.type);
    const where: Record<string, unknown> = {};
    const authUser = res.locals.authUser ?? {};
    const ownerScope = ownershipWhere(config.type, authUser);
    const searchScope = search ? { OR: config.search.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } })) } : null;
    if (ownerScope && searchScope) where.AND = [ownerScope, searchScope];
    else if (ownerScope) Object.assign(where, ownerScope);
    else if (searchScope) Object.assign(where, searchScope);
    for (const [key, raw] of Object.entries(req.query)) {
      if (['page', 'limit', 'search', 'sortBy', 'sortOrder'].includes(key) || typeof raw !== 'string' || raw === '') continue;
      const field = fields.get(key);
      if (!field) continue;
      if (field.type === 'String') where[key] = { contains: raw.trim(), mode: 'insensitive' };
      else if (field.type === 'Int' || field.type === 'Float' || field.type === 'Decimal') where[key] = Number(raw);
      else if (field.type === 'Boolean') where[key] = raw === 'true';
    }
    const requestedSort = String(req.query.sortBy ?? 'createdAt');
    const sortBy = fields.has(requestedSort) ? requestedSort : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    const model = (prisma as any)[config.model];
    let records: any[] = [];
    let total = 0;
    try {
      [records, total] = await Promise.all([
        model.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip: (page - 1) * limit, take: limit }),
        model.count({ where }),
      ]);
    } catch (err: any) {
      // If the database is missing a column referenced in orderBy (e.g., new workflow fields),
      // retry the query without orderBy to avoid crashing the module UI.
      const msg = String(err?.message ?? '').toLowerCase();
      if (msg.includes('does not exist') || msg.includes('column') && msg.includes('does not exist')) {
        [records, total] = await Promise.all([
          model.findMany({ where, skip: (page - 1) * limit, take: limit }),
          model.count({ where }),
        ]);
      } else {
        throw err;
      }
    }
    res.json({ data: records.map(flattenRecord), total, page, limit });
  } catch (error) { next(error); }
});

crudRouter.post('/:resource/import', async (req, res, next) => {
  try {
    const resource = req.params.resource as ResourceName;
    const input = importSchema.parse(req.body);
    const config = resources[resource];
    if (resource === 'placements') return res.status(409).json({ message: 'Create Placements only through Confirm Joining on an Accepted Offer.' });
    const model = (prisma as any)[config.model];
    const inserted: unknown[] = [];
    const errors: { row: number; message: string }[] = [];
    for (let index = 0; index < input.rows.length; index++) {
      try {
        const result = await prisma.$transaction(async (tx: any) => {
          let source = BENCH_WORKFLOW_RESOURCES.has(resource)
            ? await enrichAndValidateBenchInput(tx, resource, withCreatorOwnership(config.type, input.rows[index] as Record<string, unknown>, res.locals.authUser ?? {}))
            : withCreatorOwnership(config.type, input.rows[index] as Record<string, unknown>, res.locals.authUser ?? {});
          if (resource === 'jobs') {
            const sourceObj = source as Record<string, unknown>;
            if (!sourceObj.jobReference || !String(sourceObj.jobReference).trim()) {
              sourceObj.jobReference = await generateJobReference(tx);
            }
          }
          validateCoreResourceFields(resource, source as Record<string, unknown>);
          const created = await tx[config.model].create({ data: await prepareData(config.type, source) });
          const workflowEvents = BENCH_WORKFLOW_RESOURCES.has(resource)
            ? await applyBenchAutomation(tx, resource, created, null, res.locals.authUser ?? {})
            : [] as WorkflowEvent[];
          const latest = await tx[config.model].findUnique({ where: { id: created.id } });
          return { record: latest ?? created, workflowEvents };
        });
        const flattened = flattenRecord(result.record);
        inserted.push(flattened);
        emitResourceEvent(resource, 'created', flattened);
        emitWorkflowEvents(result.workflowEvents);
      } catch (error) { errors.push({ row: index + 2, message: friendlyError(error) }); }
    }
    res.status(inserted.length ? 201 : 422).json({ inserted, errors });
  } catch (error) { next(error); }
});

crudRouter.delete('/:resource', async (req, res, next) => {
  try {
    const resource = req.params.resource as ResourceName;
    const { ids } = bulkDeleteSchema.parse(req.body);
    if (BENCH_WORKFLOW_RESOURCES.has(resource)) return res.status(409).json({ message: 'Bulk delete is disabled for Bench workflow records. Delete one record at a time so linked workflow cleanup and audit history are preserved.' });
    const model = (prisma as any)[resources[resource].model];
    const ownerScope = creatorOnlyWhere(resources[resource].type, res.locals.authUser ?? {});
    const result = await model.deleteMany({ where: ownerScope ? { AND: [{ id: { in: ids } }, ownerScope] } : { id: { in: ids } } });
    ids.forEach((id) => emitResourceEvent(resource, 'deleted', { id }));
    res.json({ success: true, deleted: result.count });
  } catch (error) { next(error); }
});

crudRouter.get('/:resource/:id', async (req, res, next) => {
  try {
    const resource = req.params.resource as ResourceName;
    const model = (prisma as any)[resources[resource].model];
    const data = await model.findUnique({ where: { id: req.params.id } });
    if (!data) return res.status(404).json({ message: 'Record not found' });
    if (resources[resource].type !== 'Job') assertOwned(resources[resource].type, data, res.locals.authUser ?? {});
    res.json(flattenRecord(data));
  } catch (error) { next(error); }
});

crudRouter.post('/:resource', async (req, res, next) => {
  try {
    const resource = req.params.resource as ResourceName;
    const config = resources[resource];
    if (resource === 'placements') return res.status(409).json({ message: 'Create Placements only through Confirm Joining on an Accepted Offer.' });
    const model = (prisma as any)[config.model];
    if (resource === 'users' && String(req.body?.role ?? '').toUpperCase() === 'SUPER_ADMIN' && String(res.locals.authUser?.role ?? '') !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only a Super Admin can create another Super Admin.' });
    }
    const result = await prisma.$transaction(async (tx: any) => {
      const incoming = z.record(z.unknown()).parse(req.body);
      const normalizedBody = resource === 'jobs' ? normalizeJobPayload(incoming) : incoming;
      let source = BENCH_WORKFLOW_RESOURCES.has(resource)
        ? await enrichAndValidateBenchInput(tx, resource, withCreatorOwnership(config.type, normalizedBody, res.locals.authUser ?? {}))
        : withCreatorOwnership(config.type, normalizedBody, res.locals.authUser ?? {});
      if (resource === 'jobs') {
        const sourceObj = source as Record<string, unknown>;
        if (!sourceObj.jobReference || !String(sourceObj.jobReference).trim()) {
          sourceObj.jobReference = await generateJobReference(tx);
        }
      }
      validateCoreResourceFields(resource, source as Record<string, unknown>);
      const created = await tx[config.model].create({ data: await prepareData(config.type, source) });
      const synchronized = resource === 'jobs' ? await syncJobRequirement(tx, created) : created;
      const workflowEvents = BENCH_WORKFLOW_RESOURCES.has(resource)
        ? await applyBenchAutomation(tx, resource, created, null, res.locals.authUser ?? {})
        : [] as WorkflowEvent[];
      const latest = await tx[config.model].findUnique({ where: { id: created.id } });
      return { record: latest ?? synchronized, workflowEvents };
    });
    const flattened = flattenRecord(result.record);
    emitResourceEvent(resource, 'created', flattened);
    emitWorkflowEvents(result.workflowEvents);
    res.status(201).json(flattened);
  } catch (error) { next(error); }
});

crudRouter.patch('/:resource/:id', async (req, res, next) => {
  try {
    const resource = req.params.resource as ResourceName;
    const config = resources[resource];
    const model = (prisma as any)[config.model];
    if (resource === 'users' && String(req.body?.role ?? '').toUpperCase() === 'SUPER_ADMIN' && String(res.locals.authUser?.role ?? '') !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only a Super Admin can assign the Super Admin role.' });
    }
    const result = await prisma.$transaction(async (tx: any) => {
      const existing = await tx[config.model].findUnique({ where: { id: req.params.id } });
      if (!existing) throw Object.assign(new Error('Record not found'), { statusCode: 404 });
      assertOwned(config.type, existing, res.locals.authUser ?? {});

      const incoming = z.record(z.unknown()).parse(req.body);
      const normalizedBody = resource === 'jobs' ? normalizeJobPayload(incoming) : incoming;
      const source = BENCH_WORKFLOW_RESOURCES.has(resource)
        ? await enrichAndValidateBenchInput(tx, resource, normalizedBody, existing)
        : normalizedBody;

      validateCoreResourceFields(resource, { ...flattenRecord(existing), ...(source as Record<string, unknown>) });
      const updated = await tx[config.model].update({ where: { id: req.params.id }, data: await prepareData(config.type, source, existing.customData) });
      const synchronized = resource === 'jobs' ? await syncJobRequirement(tx, updated) : updated;
      const workflowEvents = BENCH_WORKFLOW_RESOURCES.has(resource)
        ? await applyBenchAutomation(tx, resource, updated, existing, res.locals.authUser ?? {})
        : [] as WorkflowEvent[];
      const latest = await tx[config.model].findUnique({ where: { id: req.params.id } });
      return { record: latest ?? synchronized, workflowEvents };
    });
    const flattened = flattenRecord(result.record);
    emitResourceEvent(resource, 'updated', flattened);
    emitWorkflowEvents(result.workflowEvents);
    res.json(flattened);
  } catch (error) { next(error); }
});

crudRouter.delete('/:resource/:id', async (req, res, next) => {
  try {
    const resource = req.params.resource as ResourceName;
    const model = (prisma as any)[resources[resource].model];
    const existing = await model.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    assertOwned(resources[resource].type, existing, res.locals.authUser ?? {});
    await model.delete({ where: { id: req.params.id } });
    emitResourceEvent(resource, 'deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (error) { next(error); }
});

function validateCoreResourceFields(resource: ResourceName, source: Record<string, unknown>) {
  if (resource !== 'jobs') return;
  const required: Array<[string, string]> = [
    ['jobReference', 'Job Reference ID'],
    ['jobTitle', 'Job Title'],
    ['skillsRequired', 'Skills Required'],
    ['company', 'Company'],
    ['endClient', 'End Client'],
    ['vendorCompany', 'Vendor Company'],
    ['vendorEmail', 'Vendor Email'],
    ['location', 'Location'],
    ['workMode', 'Work Mode'],
    ['visaRequirements', 'Visa Requirements'],
    ['rateType', 'Rate Type'],
    ['jobType', 'Job Type'],
    ['receivedDate', 'Received Date'],
    ['expiryDate', 'Expiry Date'],
    ['status', 'Status'],
  ];
  const missing = required.filter(([key]) => !String(source[key] ?? '').trim()).map(([, label]) => label);
  if (missing.length) throw Object.assign(new Error(`${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required.`), { statusCode: 422 });
  if (Number(source.minExperience) < 0) throw Object.assign(new Error('Minimum Experience cannot be negative.'), { statusCode: 422 });
  if (source.maxExperience !== undefined && source.maxExperience !== null && String(source.maxExperience) !== '' && Number(source.maxExperience) < Number(source.minExperience ?? 0)) throw Object.assign(new Error('Maximum Experience must be greater than or equal to Minimum Experience.'), { statusCode: 422 });
  if (!(Number(source.maxRate) > 0)) throw Object.assign(new Error('Maximum Rate must be greater than zero.'), { statusCode: 422 });
  const vacancyCount = Number(source.vacancyCount);
  if (!Number.isInteger(vacancyCount) || vacancyCount < 0) throw Object.assign(new Error('Vacancy Count must be a whole number of zero or greater.'), { statusCode: 422 });
  if (String(source.status) === 'Open' && vacancyCount < 1) throw Object.assign(new Error('An Open Job must have at least one remaining vacancy.'), { statusCode: 422 });
  if (String(source.expiryDate) < String(source.receivedDate)) throw Object.assign(new Error('Expiry Date cannot be earlier than Received Date.'), { statusCode: 422 });
}

async function syncJobRequirement(tx: any, job: any) {
  const custom = job.customData && typeof job.customData === 'object' ? job.customData : {};
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
      ...custom,
      source: 'JOB_AUTOMATION',
      jobId: job.id,
      jobReference: job.jobReference,
      maxExperience: job.maxExperience,
      workMode: job.workMode,
      rateType: job.rateType,
      currency: job.currency || 'USD',
      expiryDate: job.expiryDate,
      preferredSkills: job.preferredSkills,
    },
  };
  let requirement;
  if (job.requirementId) {
    requirement = await tx.requirement.update({ where: { id: job.requirementId }, data: requirementData });
  } else {
    requirement = await tx.requirement.create({ data: requirementData });
    await tx.job.update({ where: { id: job.id }, data: { requirementId: requirement.id } });
  }
  return tx.job.findUnique({ where: { id: job.id } });
}

function modelFields(type: string) {
  const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === type);
  if (!model) throw new Error(`Prisma model ${type} not found`);
  return new Map(model.fields.filter((field) => field.kind === 'scalar').map((field) => [field.name, field]));
}

async function prepareData(type: string, input: unknown, previousCustomData?: unknown) {
  const source = z.record(z.unknown()).parse(input);
  const fields = modelFields(type);
  const data: Record<string, unknown> = {};
  const customData: Record<string, unknown> = previousCustomData && typeof previousCustomData === 'object' && !Array.isArray(previousCustomData) ? { ...(previousCustomData as Record<string, unknown>) } : {};
  for (const [key, value] of Object.entries(source)) {
    if (['id', 'createdAt', 'updatedAt', 'passwordHash'].includes(key)) continue;
    const field = fields.get(key);
    if (!field || key === 'customData') { customData[key] = value; continue; }
    if (value === '' && !field.isRequired) {
      data[key] = null;
      continue;
    }
    data[key] = coerceValue(field.type, value);
  }
  if (type === 'Placement') {
    delete customData.payRate;
    delete data.payRate;
  }
  if (type === 'User') {
    const normalizedRole = normalizeRole(String(data.role ?? source.role ?? 'SALES'));
    data.role = normalizedRole;
    if ('permissions' in source) {
      if (!Array.isArray(source.permissions) || !source.permissions.every((item) => typeof item === 'string')) {
        throw new Error('Permissions must be supplied as a list of access keys.');
      }
      data.permissions = sanitizePermissionsForRole(normalizedRole, source.permissions);
      delete customData.permissions;
    }
    const password = typeof source.password === 'string' ? source.password.trim() : '';
    if (password) {
      data.passwordHash = hashPassword(password);

    }
    delete data.password;
    delete customData.password;
    if ('username' in data && typeof data.username === 'string') data.username = data.username.trim().toLowerCase();
    if ('email' in data && typeof data.email === 'string') data.email = data.email.trim().toLowerCase();
  }
  if (fields.has('customData')) data.customData = customData;
  return data;
}

function coerceValue(type: string, value: unknown) {
  if (value === null || value === undefined) return value;
  if (type === 'Int' || type === 'Float' || type === 'Decimal') return Number(value || 0);
  if (type === 'Boolean') return typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true';
  if (type === 'DateTime') { const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? value : date; }
  return value;
}

function flattenRecord(record: any) {
  if (!record || typeof record !== 'object') return record;
  const custom = record.customData && typeof record.customData === 'object' && !Array.isArray(record.customData) ? record.customData : {};
  const { customData: _customData, passwordHash: _passwordHash, ...base } = record;
  return { ...base, ...custom };
}

function emitWorkflowEvents(events: WorkflowEvent[]) {
  for (const event of events) emitResourceEvent(event.resource, event.action, flattenBenchRecord(event.record));
}

function friendlyError(error: unknown) {
  if (error instanceof z.ZodError) return error.issues.map((issue) => issue.message).join(', ');
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return 'A record with the same unique value already exists.';
    if (error.code === 'P2025') return 'Record not found.';
  }
  return error instanceof Error ? error.message : 'Database operation failed.';
}

async function generateJobReference(tx: any) {
  const records = await tx.job.findMany({ select: { jobReference: true } });
  const used = new Set(records.map((record: any) => String(record.jobReference ?? '').trim()).filter(Boolean));
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = `JOB-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!used.has(code)) return code;
  }
  return `JOB-${Date.now().toString().slice(-9)}`;
}
