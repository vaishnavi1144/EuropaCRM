import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hasPermission } from '../lib/permissions.js';

export const searchRouter = Router();

searchRouter.get('/', async (req, res, next) => {
  try {
    const q = z.string().trim().min(2).max(100).parse(req.query.q);
    const contains = { contains: q, mode: 'insensitive' as const };
    const user = res.locals.authUser ?? {};
    const allowed = (permission: string) => hasPermission(user, permission);

    const [leads, contacts, accounts, opportunities, candidates, jobs, bench, projects, tasks] = await Promise.all([
      allowed('leads') ? prisma.lead.findMany({ where: { OR: [{ name: contains }, { company: contains }, { email: contains }] }, take: 5, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
      allowed('contacts') ? prisma.contact.findMany({ where: { OR: [{ name: contains }, { company: contains }, { email: contains }] }, take: 5, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
      allowed('accounts') ? prisma.account.findMany({ where: { OR: [{ accountName: contains }, { industry: contains }] }, take: 5, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
      allowed('opportunities') ? prisma.opportunity.findMany({ where: { OR: [{ opportunityName: contains }, { accountName: contains }] }, take: 5, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
      allowed('candidates') ? prisma.candidate.findMany({ where: { OR: [{ name: contains }, { skills: contains }, { email: contains }] }, take: 5, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
      allowed('jobs') ? prisma.job.findMany({ where: { OR: [{ jobTitle: contains }, { company: contains }, { location: contains }] }, take: 5, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
      allowed('bench') ? prisma.bench.findMany({ where: { OR: [{ candidateName: contains }, { skills: contains }, { visaStatus: contains }] }, take: 5, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
      allowed('ai-projects') ? prisma.aiProject.findMany({ where: { OR: [{ projectName: contains }, { techStack: contains }, { leadEngineer: contains }] }, take: 5, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
      allowed('tasks') ? prisma.aiTask.findMany({ where: { OR: [{ taskName: contains }, { projectName: contains }, { assignee: contains }] }, take: 5, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
    ]);

    const data = [
      ...leads.map((item: any) => hit('leads', item.id, item.name, `${item.company} · ${item.status}`, '/leads')),
      ...contacts.map((item: any) => hit('contacts', item.id, item.name, `${item.company} · ${item.email}`, '/contacts')),
      ...accounts.map((item: any) => hit('accounts', item.id, item.accountName, `${item.industry ?? 'Account'} · ${item.status}`, '/accounts')),
      ...opportunities.map((item: any) => hit('opportunities', item.id, item.opportunityName, `${item.accountName} · ${item.stage}`, '/opportunities')),
      ...candidates.map((item: any) => hit('candidates', item.id, item.name, `${item.skills} · ${item.status}`, '/candidates')),
      ...jobs.map((item: any) => hit('jobs', item.id, item.jobTitle, `${item.company} · ${item.status}`, '/jobs')),
      ...bench.map((item: any) => hit('bench', item.id, item.candidateName, `${item.skills} · ${String((item.customData as any)?.noticePeriod ?? 'Notice period not specified')}`, '/bench')),
      ...projects.map((item: any) => hit('ai-projects', item.id, item.projectName, `${item.techStack} · ${item.status}`, '/ai-projects')),
      ...tasks.map((item: any) => hit('tasks', item.id, item.taskName, `${item.projectName} · ${item.status}`, '/tasks')),
    ].slice(0, 30);
    res.json({ data });
  } catch (error) { next(error); }
});

function hit(resource: string, id: string, label: string, subtitle: string, path: string) {
  return { resource, id, label, subtitle, path: `${path}?search=${encodeURIComponent(label)}` };
}
