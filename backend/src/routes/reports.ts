import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { hasPermission } from '../lib/permissions.js';

export const reportsRouter = Router();

function isAdmin(user: any) { return ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(String(user?.role ?? '').toUpperCase()); }
function customOrOwnerNameScope(user: any, modelName: string): any {
  if (isAdmin(user)) return {};
  const clauses: any[] = [
    { customData: { path: ['createdByUserId'], equals: user.id } }
  ];

  const hasOwnerFields = ['lead', 'contact', 'account', 'opportunity', 'activity', 'bench', 'aiProject', 'campaign'].includes(modelName);
  if (hasOwnerFields) {
    if (user.id && modelName !== 'campaign') {
      clauses.push({ ownerId: user.id });
    }
    if (user.name) {
      clauses.push({ ownerName: { equals: user.name, mode: 'insensitive' } });
    }
  }

  if (['submission', 'benchInterview', 'benchOffer', 'placement'].includes(modelName)) {
    if (user.id) {
      clauses.push({ benchConsultant: { ownerId: user.id } });
    }
    if (user.name) {
      clauses.push({ ownerName: { equals: user.name, mode: 'insensitive' } });
    }
  }

  if (modelName === 'candidate') {
    if (user.name) {
      clauses.push({ ownerName: { equals: user.name, mode: 'insensitive' } });
    }
  }

  if (modelName === 'aiTask') {
    if (user.id) {
      clauses.push({ assigneeId: user.id });
    }
  }

  return { OR: clauses };
}

reportsRouter.get('/overview', async (_req, res, next) => {
  try {
    const user = res.locals.authUser ?? {};
    if (!hasPermission(user, 'dashboard')) return res.status(403).json({ message: 'You do not have access to the dashboard.' });
    const allowed = (permission: string) => hasPermission(user, permission);
    const [leads, contacts, accounts, opportunities, campaigns, activities, candidates, jobs, bench, submissions, benchInterviews, benchOffers, placements, rejectedSubmissions, onHoldConsultants, todayInterviews, aiProjects, tasks, won, pipeline] = await Promise.all([
      allowed('leads') ? prisma.lead.count({ where: customOrOwnerNameScope(user, 'lead') }) : 0,
      allowed('contacts') ? prisma.contact.count({ where: customOrOwnerNameScope(user, 'contact') }) : 0,
      allowed('accounts') ? prisma.account.count({ where: customOrOwnerNameScope(user, 'account') }) : 0,
      allowed('opportunities') ? prisma.opportunity.count({ where: customOrOwnerNameScope(user, 'opportunity') }) : 0,
      allowed('campaigns') ? prisma.campaign.count({ where: customOrOwnerNameScope(user, 'campaign') }) : 0,
      allowed('activities') ? prisma.activity.count({ where: customOrOwnerNameScope(user, 'activity') }) : 0,
      allowed('candidates') ? prisma.candidate.count({ where: customOrOwnerNameScope(user, 'candidate') }) : 0,
      allowed('jobs') ? prisma.job.count({ where: { status: { in: ['Open', 'Active'] } } }) : 0,
      allowed('bench') ? prisma.bench.count({ where: customOrOwnerNameScope(user, 'bench') }) : 0,
      allowed('submissions') ? prisma.submission.count({ where: customOrOwnerNameScope(user, 'submission') }) : 0,
      allowed('submissions') ? prisma.benchInterview.count({ where: customOrOwnerNameScope(user, 'benchInterview') }) : 0,
      allowed('placements') ? prisma.benchOffer.count({ where: customOrOwnerNameScope(user, 'benchOffer') }) : 0,
      allowed('placements') ? prisma.placement.count({ where: customOrOwnerNameScope(user, 'placement') }) : 0,
      allowed('submissions') ? prisma.submission.count({ where: { AND: [customOrOwnerNameScope(user, 'submission'), { status: 'Rejected' }] } }) : 0,
      allowed('bench') ? prisma.bench.count({ where: { AND: [customOrOwnerNameScope(user, 'bench'), { marketingStatus: 'On Hold' }] } }) : 0,
      allowed('submissions') ? prisma.benchInterview.count({ where: { AND: [customOrOwnerNameScope(user, 'benchInterview'), { interviewDate: new Date().toISOString().slice(0,10), status: { in: ['Scheduled', 'Confirmed'] } }] } }) : 0,
      allowed('ai-projects') ? prisma.aiProject.count({ where: customOrOwnerNameScope(user, 'aiProject') }) : 0,
      allowed('tasks') ? prisma.aiTask.count({ where: customOrOwnerNameScope(user, 'aiTask') }) : 0,
      allowed('opportunities') ? prisma.opportunity.count({ where: { AND: [customOrOwnerNameScope(user, 'opportunity'), { stage: 'Closed Won' }] } }) : 0,
      allowed('opportunities') ? prisma.opportunity.aggregate({ where: customOrOwnerNameScope(user, 'opportunity'), _sum: { amount: true } }) : Promise.resolve({ _sum: { amount: 0 } }),
    ]);
    res.json({ leads, contacts, accounts, opportunities, campaigns, activities, candidates, jobs, bench, submissions, benchInterviews, benchOffers, placements, rejectedSubmissions, onHoldConsultants, todayInterviews, aiProjects, tasks, pipelineValue: pipeline._sum.amount ?? 0, winRate: opportunities ? Number(((won / opportunities) * 100).toFixed(1)) : 0 });
  } catch (error) { next(error); }
});

reportsRouter.get('/bench-dashboard', async (req, res, next) => {
  try {
    const authUser = res.locals.authUser ?? {};
    if (!hasPermission(authUser, 'dashboard') && !hasPermission(authUser, 'bench-reports')) {
      return res.status(403).json({ message: 'You do not have access to this dashboard.' });
    }

    const dateFromQuery = req.query.dateFrom;
    const dateToQuery = req.query.dateTo;
    const dateFrom = dateFromQuery ? new Date(`${dateFromQuery}T00:00:00Z`) : null;
    const dateTo = dateToQuery ? new Date(`${dateToQuery}T23:59:59Z`) : null;

    const roleNormalized = authUser.role ? authUser.role.toUpperCase() : 'SALES';
    const isUserAdmin = isAdmin(authUser);
    const isManager = roleNormalized === 'MANAGER';

    let recruiterWhere: any = {};
    if (isUserAdmin) {
      if (isManager) {
        recruiterWhere = {
          role: 'BENCHSALES',
          isActive: true,
          OR: [
            { managerId: authUser.id },
            { id: authUser.id }
          ]
        };
      } else {
        recruiterWhere = { role: 'BENCHSALES', isActive: true };
      }
    } else {
      recruiterWhere = { id: authUser.id };
    }

    const recruiters = await prisma.user.findMany({
      where: recruiterWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        managerId: true,
      }
    });

    const recruiterIds = recruiters.map((r: any) => r.id);
    const recruiterNames = recruiters.map((r: any) => r.name);

    const dateFilter = (field: string) => {
      if (!dateFrom && !dateTo) return {};
      const clause: any = {};
      if (dateFrom) clause.gte = dateFrom;
      if (dateTo) clause.lte = dateTo;
      return { [field]: clause };
    };

    const stringDateFilter = (field: string) => {
      if (!dateFrom && !dateTo) return {};
      const clause: any = {};
      if (dateFrom) clause.gte = dateFrom.toISOString().slice(0, 10);
      if (dateTo) clause.lte = dateTo.toISOString().slice(0, 10);
      return { [field]: clause };
    };

    const [submissions, interviews, offers, placements, consultants, jobs] = await Promise.all([
      prisma.submission.findMany({
        where: {
          OR: [
            { ownerName: { in: recruiterNames } },
            { benchConsultant: { ownerId: { in: recruiterIds } } }
          ],
          ...stringDateFilter('submissionDate')
        },
        include: {
          benchConsultant: true
        }
      }),
      prisma.benchInterview.findMany({
        where: {
          OR: [
            { ownerName: { in: recruiterNames } },
            { benchConsultant: { ownerId: { in: recruiterIds } } }
          ],
          ...stringDateFilter('interviewDate')
        },
        include: {
          benchConsultant: true
        }
      }),
      prisma.benchOffer.findMany({
        where: {
          OR: [
            { ownerName: { in: recruiterNames } },
            { benchConsultant: { ownerId: { in: recruiterIds } } }
          ],
          ...stringDateFilter('offerDate')
        },
        include: {
          benchConsultant: true
        }
      }),
      prisma.placement.findMany({
        where: {
          OR: [
            { ownerName: { in: recruiterNames } },
            { benchConsultant: { ownerId: { in: recruiterIds } } }
          ],
          ...stringDateFilter('startDate')
        },
        include: {
          benchConsultant: true
        }
      }),
      prisma.bench.findMany({
        where: {
          ownerId: { in: recruiterIds },
          ...dateFilter('createdAt')
        }
      }),
      prisma.job.findMany({
        where: {
          status: { in: ['Open', 'Active'] },
          OR: [{ ownerName: { in: recruiterNames } }, { customData: { path: ['createdByUserId'], array_contains: recruiterIds } }]
        },
        select: { id: true, jobTitle: true, jobReference: true, endClient: true, company: true, createdAt: true }
      })
    ]);

    const recruitersMetrics = recruiters.map((r: any) => {
      const rSubs = submissions.filter((s: any) => s.ownerName === r.name || s.benchConsultant?.ownerId === r.id);
      const rInts = interviews.filter((i: any) => i.ownerName === r.name || i.benchConsultant?.ownerId === r.id);
      const rOffs = offers.filter((o: any) => o.ownerName === r.name || o.benchConsultant?.ownerId === r.id);
      const rPlacs = placements.filter((p: any) => p.ownerName === r.name || p.benchConsultant?.ownerId === r.id);

      const rounds: Record<string, number> = {};
      rInts.forEach((i: any) => {
        if (i.status === 'Completed' && i.result === 'Selected') {
          const rnd = i.interviewRound || 'Round 1';
          rounds[rnd] = (rounds[rnd] || 0) + 1;
        }
      });

      const revenue = rPlacs.reduce((sum: number, p: any) => sum + (p.billingRate || 0) * 160, 0);

      return {
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        avatarUrl: r.avatarUrl,
        submissions: rSubs.length,
        interviews: rInts.length,
        rounds,
        offers: rOffs.length,
        placements: rPlacs.length,
        revenue
      };
    });

    const totalUsers = recruiters.length;
    const totalConsultants = consultants.length;
    const totalSubmissions = submissions.length;
    const totalInterviews = interviews.length;
    const totalOffers = offers.length;
    const totalPlacements = placements.length;
    const totalRevenue = placements.reduce((sum: number, p: any) => sum + (p.billingRate || 0) * 160, 0);

    const funnelStages = [
      { stage: 'Submitted to Vendor', count: submissions.length },
      { stage: 'Interview Scheduled', count: interviews.filter((i: any) => i.status === 'Scheduled').length },
      { stage: 'Round 1 Selected', count: interviews.filter((i: any) => i.interviewRound === 'Round 1' && i.status === 'Completed' && i.result === 'Selected').length },
      { stage: 'Round 2 Selected', count: interviews.filter((i: any) => i.interviewRound === 'Round 2' && i.status === 'Completed' && i.result === 'Selected').length },
      { stage: 'Round 3 Selected', count: interviews.filter((i: any) => i.interviewRound === 'Round 3' && i.status === 'Completed' && i.result === 'Selected').length },
      { stage: 'Offers Sent', count: offers.length },
      { stage: 'Placed', count: placements.length },
    ];

    const roundSelections = [
      { label: 'Round 1', value: interviews.filter((i: any) => i.interviewRound === 'Round 1' && i.status === 'Completed' && i.result === 'Selected').length },
      { label: 'Round 2', value: interviews.filter((i: any) => i.interviewRound === 'Round 2' && i.status === 'Completed' && i.result === 'Selected').length },
      { label: 'Round 3', value: interviews.filter((i: any) => i.interviewRound === 'Round 3' && i.status === 'Completed' && i.result === 'Selected').length },
    ];

    const vendorMap = new Map<string, number>();
    submissions.forEach((s: any) => {
      const v = s.vendorCompany || 'Unknown';
      vendorMap.set(v, (vendorMap.get(v) || 0) + 1);
    });
    const sortedVendors = [...vendorMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        percentage: submissions.length ? Number(((count / submissions.length) * 100).toFixed(1)) : 0
      }));

    const activitiesList: any[] = [];
    submissions.forEach((s: any) => {
      activitiesList.push({
        id: `sub-${s.id}`,
        date: s.createdAt,
        user: s.ownerName,
        consultant: s.candidateName,
        action: 'submitted consultant to vendor',
        vendor: s.vendorCompany,
        job: s.jobTitle
      });
    });
    interviews.forEach((i: any) => {
      activitiesList.push({
        id: `int-${i.id}`,
        date: i.createdAt,
        user: i.ownerName,
        consultant: i.candidateName,
        action: i.status === 'Scheduled' ? 'Interview scheduled' : i.result === 'Next Round' ? 'Candidate moved to next round' : 'Interview completed',
        vendor: i.vendorCompany || 'Unknown',
        job: i.jobTitle
      });
    });
    offers.forEach((o: any) => {
      activitiesList.push({
        id: `off-${o.id}`,
        date: o.createdAt,
        user: o.ownerName,
        consultant: o.candidateName,
        action: o.status === 'Accepted' ? 'Offer accepted' : 'Offer created',
        vendor: o.vendorCompany || 'Unknown',
        job: o.jobTitle
      });
    });
    placements.forEach((p: any) => {
      activitiesList.push({
        id: `plac-${p.id}`,
        date: p.createdAt,
        user: p.ownerName,
        consultant: p.candidateName,
        action: 'Candidate placed',
        vendor: p.vendorCompany,
        job: p.customData && (p.customData as any).jobTitle ? (p.customData as any).jobTitle : '—'
      });
    });

    const recentActivities = activitiesList
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 30);

    const today = new Date().toISOString().slice(0, 10);
    const staleCutoff = Date.now() - 7 * 86400000;
    const consultantById = new Map(consultants.map((item: any) => [item.id, item]));
    const submissionConsultantIds = new Set(submissions.map((item: any) => item.benchConsultantId).filter(Boolean));
    const submissionsWithoutRecentUpdate = submissions.filter((item: any) => new Date(item.updatedAt ?? item.createdAt).getTime() < staleCutoff && !['Rejected', 'Withdrawn', 'Selected'].includes(item.status));
    const interviewsAwaitingFeedback = interviews.filter((item: any) => ['Completed', 'Scheduled'].includes(item.status) && !String(item.feedback ?? '').trim() && !['Rejected', 'Selected'].includes(item.result));
    const offersAwaitingResponse = offers.filter((item: any) => ['Pending', 'Released'].includes(item.status));
    const jobsWithoutSubmissions = jobs.filter((job: any) => !submissions.some((submission: any) => submission.jobId === job.id));
    const interviewsToday = interviews.filter((item: any) => item.interviewDate === today && !['Cancelled', 'Rejected'].includes(item.status));
    const followUpsToday = submissions.filter((item: any) => {
      const custom = item.customData && typeof item.customData === 'object' ? item.customData : {};
      return String(custom.nextFollowUpDate ?? item.nextFollowUpDate ?? '') === today;
    });
    const consultantsNeedingSubmission = consultants.filter((item: any) => ['Active', 'Available'].includes(String(item.marketingStatus)) && !submissionConsultantIds.has(item.id));
    const agingBuckets = [
      { label: '0–15 days', min: 0, max: 15 }, { label: '16–30 days', min: 16, max: 30 },
      { label: '31–45 days', min: 31, max: 45 }, { label: '46–60 days', min: 46, max: 60 }, { label: '60+ days', min: 61, max: Infinity },
    ].map((bucket) => ({ ...bucket, count: consultants.filter((item: any) => {
      const custom = item.customData && typeof item.customData === 'object' ? item.customData : {};
      const start = String(custom.availableFrom ?? item.availableFrom ?? item.createdAt);
      const age = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 86400000));
      return age >= bucket.min && age <= bucket.max;
    }).length }));
    const submissionCount = submissions.length;
    const interviewCount = interviews.length;
    const offerCount = offers.length;
    const placementCount = placements.length;
    const attention = [
      { key: 'bench-aging', label: 'Consultants on bench over 30 days', count: agingBuckets.filter((item) => item.min >= 31).reduce((sum, item) => sum + item.count, 0), path: '/bench?aging=31-plus' },
      { key: 'stale-submissions', label: 'Submissions without recent update', count: submissionsWithoutRecentUpdate.length, path: '/submissions?status=Submitted' },
      { key: 'interview-feedback', label: 'Interviews awaiting feedback', count: interviewsAwaitingFeedback.length, path: '/bench-interviews?status=Completed' },
      { key: 'offer-response', label: 'Offers awaiting response', count: offersAwaitingResponse.length, path: '/bench-offers?status=Pending' },
      { key: 'jobs-without-submissions', label: 'Open jobs with no submissions', count: jobsWithoutSubmissions.length, path: '/jobs?status=Open' },
    ];
    const todayActions = [
      { key: 'interviews-today', label: 'Interviews scheduled today', count: interviewsToday.length, path: `/bench-interviews?search=${today}` },
      { key: 'follow-ups-today', label: 'Follow-ups due today', count: followUpsToday.length, path: `/submissions?search=${today}` },
      { key: 'pending-offers', label: 'Pending offers', count: offersAwaitingResponse.length, path: '/bench-offers?status=Pending' },
      { key: 'client-feedback', label: 'Client feedback pending', count: interviewsAwaitingFeedback.length, path: '/bench-interviews?status=Completed' },
      { key: 'consultants-to-submit', label: 'Consultants needing submission', count: consultantsNeedingSubmission.length, path: '/bench' },
    ];
    const conversion = [
      { label: 'Submission → Interview', value: interviewCount },
      { label: 'Interview → Offer', value: offerCount },
      { label: 'Offer → Placement', value: placementCount },
      { label: 'Submission → Placement', value: placementCount },
    ];

    res.json({
      summary: {
        totalUsers,
        totalConsultants,
        totalSubmissions,
        totalInterviews,
        totalOffers,
        totalPlacements,
        totalRevenue,
        attention,
        todayActions,
        agingBuckets,
        conversion
      },
      recruiters: recruitersMetrics,
      pipelineFunnel: funnelStages,
      roundSelections,
      topVendors: sortedVendors,
      recentActivities
    });

  } catch (error) { next(error); }
});

reportsRouter.get('/:type', async (req, res, next) => {
  try {
    const type = String(req.params.type);
    const reportPermission: Record<string, string> = { sales: 'sales-reports', recruitment: 'recruitment-reports', bench: 'bench-reports', ai: 'ai-reports' };
    const requiredPermission = reportPermission[type];
    if (!requiredPermission || !hasPermission(res.locals.authUser ?? {}, requiredPermission)) return res.status(403).json({ message: 'You do not have access to this report.' });
    const dateFrom = parseDate(req.query.dateFrom, new Date(2000, 0, 1));
    const dateTo = parseDate(req.query.dateTo, new Date());
    dateTo.setHours(23, 59, 59, 999);
    const group = ['daily','weekly','monthly'].includes(String(req.query.group)) ? String(req.query.group) : 'monthly';
    if (type === 'sales') return res.json(await salesReport(dateFrom, dateTo, group));
    if (type === 'recruitment') return res.json(await recruitmentReport(dateFrom, dateTo, group));
    if (type === 'bench') return res.json(await benchReport(dateFrom, dateTo, group, res.locals.authUser ?? {}));
    if (type === 'ai') return res.json(await aiReport(dateFrom, dateTo, group));
    return res.status(404).json({ message: 'Unknown report type' });
  } catch (error) { next(error); }
});

async function salesReport(from: Date, to: Date, group: string) {
  const where = { createdAt: { gte: from, lte: to } };
  const [leads, contacts, accounts, opportunities, campaigns, activities] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' } }), prisma.contact.findMany({ where }), prisma.account.findMany({ where }), prisma.opportunity.findMany({ where, orderBy: { amount: 'desc' } }), prisma.campaign.findMany({ where, orderBy: { createdAt: 'desc' } }), prisma.activity.findMany({ where }),
  ]);
  const won = opportunities.filter((item: any) => item.stage === 'Closed Won');
  const pipeline = opportunities.reduce((sum: number, item: any) => sum + item.amount, 0);
  return {
    kpis: [metric('Total Leads', leads.length, 'UsersRound'), metric('Contacts', contacts.length, 'Contact'), metric('Accounts', accounts.length, 'Building2'), metric('Opportunities', opportunities.length, 'Target'), metric('Pipeline Value', `$ ${pipeline.toLocaleString('en-US')}`, 'DollarSign'), metric('Win Rate', opportunities.length ? `${((won.length / opportunities.length) * 100).toFixed(1)}%` : '0%', 'Trophy')],
    donut: distribution(leads, 'leadSource'), bar: distribution(opportunities, 'stage'), funnel: distribution(opportunities, 'stage'), trend: trend(leads, group, (item: any) => item.status === 'Converted', (item: any) => item.status === 'Lost'),
    table1: { title: 'Top Opportunities', headers: ['Opportunity','Account','Stage','Amount'], rows: opportunities.slice(0,5).map((item: any) => [item.opportunityName,item.accountName,item.stage,`$ ${item.amount.toLocaleString('en-US')}`]), path: '/opportunities', linkText: 'View all opportunities →' },
    table2: { title: 'Recent Campaigns', headers: ['Campaign','Type','Status','Responses'], rows: campaigns.slice(0,5).map((item: any) => [item.campaignName,item.type,item.status,String(item.responses)]), path: '/campaigns', linkText: 'View all campaigns →' },
    activityCount: activities.length,
  };
}

async function recruitmentReport(from: Date, to: Date, group: string) {
  const where = { createdAt: { gte: from, lte: to } };
  const [candidates, jobs, interviews, offers] = await Promise.all([
    prisma.candidate.findMany({ where, orderBy: { createdAt: 'desc' } }), prisma.job.findMany({ where, orderBy: { createdAt: 'desc' } }), prisma.interview.findMany({ where, orderBy: { createdAt: 'desc' } }), prisma.offer.findMany({ where, orderBy: { createdAt: 'desc' } }),
  ]);
  const accepted = offers.filter((item: any) => item.status === 'Accepted');
  return {
    kpis: [metric('Total Candidates',candidates.length,'UsersRound'),metric('Active Jobs',jobs.filter((item: any)=>item.status==='Open').length,'BriefcaseBusiness'),metric('Interviews',interviews.length,'CalendarCheck2'),metric('Offers',offers.length,'Handshake'),metric('Placed Candidates',candidates.filter((item: any)=>item.status==='Placed').length,'BadgeCheck'),metric('Acceptance Rate',offers.length?`${((accepted.length/offers.length)*100).toFixed(1)}%`:'0%','Target')],
    donut: distribution(candidates,'status'), bar: distribution(jobs,'status'), funnel: distribution(candidates,'status'), trend: trend(candidates,group,(item: any)=>item.status==='Placed',(item: any)=>item.status==='Rejected'),
    table1:{title:'Active Job Openings',headers:['Job','Company','Type','Status'],rows:jobs.slice(0,5).map((item: any)=>[item.jobTitle,item.company,item.jobType,item.status]),path:'/jobs',linkText:'View all jobs →'},
    table2:{title:'Recent Offers',headers:['Candidate','Job','Amount','Status'],rows:offers.slice(0,5).map((item: any)=>[item.candidateName,item.jobTitle,`$ ${item.offerAmount.toLocaleString('en-US')}`,item.status]),path:'/offers',linkText:'View all offers →'},
  };
}

async function benchReport(from: Date, to: Date, group: string, user: any) {
  const where = { createdAt: { gte: from, lte: to } };
  const ownerScope = isAdmin(user) ? {} : { OR: [{ ownerName: String(user.name ?? '') }, { benchConsultant: { ownerId: user.id } }] };
  const benchScope = isAdmin(user) ? {} : { ownerId: user.id };
  const [consultants, submissions, interviews, offers, placements] = await Promise.all([
    prisma.bench.findMany({ where: { AND: [where, benchScope] }, orderBy: { createdAt: 'desc' } }),
    prisma.submission.findMany({ where: { AND: [where, ownerScope] }, orderBy: { createdAt: 'desc' } }),
    prisma.benchInterview.findMany({ where: { AND: [where, ownerScope] }, orderBy: { createdAt: 'desc' } }),
    prisma.benchOffer.findMany({ where: { AND: [where, ownerScope] }, orderBy: { createdAt: 'desc' } }),
    prisma.placement.findMany({ where: { AND: [where, ownerScope] }, orderBy: { createdAt: 'desc' } }),
  ]);
  const active = placements.filter((item: any)=>['Onboarding','Active','Extended'].includes(item.status));
  const acceptedOffers = offers.filter((item: any)=>item.status==='Accepted');
  const consultantRows = consultants.map((item: any) => ({ ...item, ...(item.customData && typeof item.customData === 'object' ? item.customData : {}) }));
  const placementByConsultant = new Map(placements.map((item: any) => [item.benchConsultantId, item]));
  const interviewsByConsultant = new Map<string, any[]>();
  interviews.forEach((item: any) => interviewsByConsultant.set(item.benchConsultantId, [...(interviewsByConsultant.get(item.benchConsultantId) ?? []), item]));
  const submissionsByConsultant = new Map<string, any[]>();
  submissions.forEach((item: any) => submissionsByConsultant.set(item.benchConsultantId, [...(submissionsByConsultant.get(item.benchConsultantId) ?? []), item]));
  const pipeline = consultantRows.map((consultant: any) => {
    const consultantSubmissions = submissionsByConsultant.get(consultant.id) ?? [];
    const consultantInterviews = interviewsByConsultant.get(consultant.id) ?? [];
    const placement = placementByConsultant.get(consultant.id);
    const status = placement ? 'Placed' : consultantInterviews.length ? 'Interview' : consultantSubmissions.length ? 'Submitted' : 'Available';
    const ageDays = Math.max(0, Math.floor((Date.now() - new Date(consultant.createdAt).getTime()) / 86400000));
    return { id: consultant.id, consultant: consultant.candidateName, technology: consultant.primarySkill || consultant.skills || '—', status, ageDays, owner: consultant.ownerName || '—', submissions: consultantSubmissions.length, interviews: consultantInterviews.length };
  });
  const submissionStatus = distribution(submissions, 'status');
  const clientSubmissions = distribution(submissions.map((item: any) => ({ ...item, client: item.endClient || item.clientCompany || 'Unspecified' })), 'client');
  const consultantSubmissions = distribution(submissions.map((item: any) => ({ ...item, consultant: item.candidateName || 'Unspecified' })), 'consultant');
  const submissionTrend = trend(submissions, group, (item: any) => ['Interview', 'Interview Requested', 'Interview Scheduled', 'Selected'].includes(item.status), (item: any) => ['Rejected', 'Withdrawn'].includes(item.status));
  const placementRows = placements.map((item: any) => ({ consultant: item.candidateName, client: item.clientCompany, vendor: item.vendorCompany, date: item.startDate || item.createdAt, rate: item.billingRate, owner: item.ownerName, status: item.status }));
  const revenueRows = placements.map((item: any) => {
    const custom = item.customData && typeof item.customData === 'object' ? item.customData : {};
    const payRate = Number(custom.payRate ?? 0);
    return { consultant: item.candidateName, client: item.clientCompany, month: periodLabel(item.startDate || item.createdAt, group), revenue: Number(item.billingRate || 0) * 160, margin: Math.max(0, Number(item.billingRate || 0) - payRate) * 160 };
  });
  const monthlyRevenue = [...revenueRows.reduce((map: Map<string, number>, item: any) => map.set(item.month, (map.get(item.month) ?? 0) + item.revenue), new Map())].map(([name, value]) => ({ name, value }));
  const consultantRevenue = distribution(revenueRows.map((item: any) => ({ ...item, name: item.consultant, value: item.revenue })), 'name');
  const clientRevenue = distribution(revenueRows.map((item: any) => ({ ...item, name: item.client, value: item.revenue })), 'name');
  const teamMap = new Map<string, any>();
  [...submissions.map((item: any) => item.ownerName), ...interviews.map((item: any) => item.ownerName), ...placements.map((item: any) => item.ownerName)].filter(Boolean).forEach((name: string) => {
    if (!teamMap.has(name)) teamMap.set(name, { id: name, name, submissions: 0, interviews: 0, placements: 0, revenue: 0 });
  });
  submissions.forEach((item: any) => { const row = teamMap.get(item.ownerName); if (row) row.submissions++; });
  interviews.forEach((item: any) => { const row = teamMap.get(item.ownerName); if (row) row.interviews++; });
  placements.forEach((item: any) => { const row = teamMap.get(item.ownerName); if (row) row.placements++, row.revenue += Number(item.billingRate || 0) * 160; });
  const team = [...teamMap.values()].map((item: any) => ({ ...item, conversionRate: item.submissions ? Number(((item.placements / item.submissions) * 100).toFixed(1)) : 0 }));
  return {
    kpis:[metric('Bench Consultants',consultants.length,'UsersRound'),metric('Profiles with Resume',consultantRows.filter((item: any)=>Boolean(item.resumeUrl)).length,'FileText'),metric('Submissions',submissions.length,'ClipboardList'),metric('Interviews',interviews.length,'CalendarCheck2'),metric('Accepted Offers',acceptedOffers.length,'Handshake'),metric('Active Placements',active.length,'BadgeCheck')],
    donut:distribution(consultantRows,'visaStatus'),bar:distribution(consultantRows,'noticePeriod'),funnel:distribution(submissions,'status'),trend:trend(submissions,group,(item: any)=>item.status==='Accepted',(item: any)=>item.status==='Rejected'),
    table1:{title:'Bench Consultants',headers:['Consultant','Visa','Experience','Notice Period'],rows:consultantRows.slice(0,5).map((item: any)=>[item.candidateName,item.visaStatus,`${item.experienceYears} yrs`,item.noticePeriod??'—']),path:'/bench',linkText:'View bench consultants →'},
    table2:{title:'Recent Interviews',headers:['Consultant','Client','Round','Status'],rows:interviews.slice(0,5).map((item: any)=>[item.candidateName,item.clientCompany??'—',item.interviewRound,item.status]),path:'/bench-interviews',linkText:'View all interviews →'},
    benchTabs: { pipeline, submissions: { total: submissions.length, status: submissionStatus, clients: clientSubmissions, consultants: consultantSubmissions, trend: submissionTrend }, placements: placementRows, revenue: { monthly: monthlyRevenue, consultants: consultantRevenue, clients: clientRevenue, total: revenueRows.reduce((sum: number, item: any) => sum + item.revenue, 0), margin: revenueRows.reduce((sum: number, item: any) => sum + item.margin, 0) }, team },
  };
}

async function aiReport(from: Date, to: Date, group: string) {
  const where = { createdAt: { gte: from, lte: to } };
  const [projects,tasks,resources] = await Promise.all([
    prisma.aiProject.findMany({ where, orderBy: { createdAt: 'desc' } }), prisma.aiTask.findMany({ where, orderBy: { createdAt: 'desc' } }), prisma.aiResource.findMany({ where, orderBy: { createdAt: 'desc' } }),
  ]);
  return {
    kpis:[metric('Total Projects',projects.length,'Bot'),metric('In Progress',projects.filter((item: any)=>item.status==='In Progress').length,'Activity'),metric('Production',projects.filter((item: any)=>item.status==='In Production').length,'Rocket'),metric('Total Tasks',tasks.length,'ClipboardList'),metric('Completed Tasks',tasks.filter((item: any)=>item.status==='Completed').length,'CircleCheckBig'),metric('Resources',resources.length,'Sparkles')],
    donut:distribution(projects,'status'),bar:distribution(resources,'allocationStatus'),funnel:distribution(tasks,'status'),trend:trend(tasks,group,(item: any)=>item.status==='Completed',(item: any)=>item.status==='Cancelled'),
    table1:{title:'AI Projects',headers:['Project','Status','Lead','End Date'],rows:projects.slice(0,5).map((item: any)=>[item.projectName,item.status,item.leadEngineer,item.endDate??'—']),path:'/ai-projects',linkText:'View all projects →'},
    table2:{title:'AI Resources',headers:['Resource','Type','Allocation','Cost/Hr'],rows:resources.slice(0,5).map((item: any)=>[item.name,item.type,item.allocationStatus,String(item.costPerHour)]),path:'/resources',linkText:'View all resources →'},
  };
}

function metric(label: string, value: string | number, icon: string) { return { label, value: String(value), trend: '', icon }; }
function distribution<T extends Record<string, any>>(rows: T[], key: keyof T) { const map = new Map<string,number>(); rows.forEach((row)=>{const value=String(row[key]??'Unspecified')||'Unspecified';map.set(value,(map.get(value)??0)+1);}); return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value])=>({name,value})); }
function trend<T extends { createdAt: Date; [key: string]: any }>(rows:T[],group:string,isSuccess:(item:T)=>boolean,isClosed:(item:T)=>boolean){const map=new Map<string,{total:number;success:number;closed:number}>();rows.forEach((row)=>{const label=periodLabel(row.createdAt,group);const item=map.get(label)??{total:0,success:0,closed:0};item.total++;if(isSuccess(row))item.success++;if(isClosed(row))item.closed++;map.set(label,item);});return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([label,value])=>({label,...value}));}
function periodLabel(date:Date,group:string){const value=new Date(date);if(group==='daily')return value.toISOString().slice(0,10);if(group==='weekly'){const start=new Date(value);start.setDate(value.getDate()-value.getDay());return start.toISOString().slice(0,10);}return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}`;}
function parseDate(value: unknown, fallback: Date){if(typeof value!=='string')return new Date(fallback);const date=new Date(`${value}T00:00:00`);return Number.isNaN(date.getTime())?new Date(fallback):date;}
