import { Router } from 'express';
import { z } from 'zod';
import { emitResourceEvent } from '../lib/socket.js';
import { hasPermission } from '../lib/permissions.js';
import { prisma } from '../lib/prisma.js';
import { checkMailConnection, sendMail } from '../services/email.js';
import { resolveRecipients, searchRecipients, type MailModule } from '../services/mailRecipients.js';

export const emailRouter = Router();
const moduleSchema = z.enum(['sales', 'it', 'bench', 'ai']);
const refSchema = z.object({ entityType: z.string().min(1), entityId: z.string().min(1) });
const groupSchema = z.object({
  module: moduleSchema,
  groupName: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  members: z.array(refSchema).default([]),
});

const permissionPrefix: Record<MailModule, string> = {
  sales: 'sales-mail',
  it: 'recruitment-mail',
  bench: 'bench-mail',
  ai: 'ai-mail',
};

function can(user: any, module: MailModule, action: string) {
  return hasPermission(user, `${permissionPrefix[module]}-${action}`);
}

function ensure(user: any, module: MailModule, action: string, res: any) {
  if (!can(user, module, action)) {
    res.status(403).json({ message: 'You do not have permission for this mail action.' });
    return false;
  }
  return true;
}

emailRouter.get('/check/:module', async (req, res, next) => {
  try {
    const module = moduleSchema.parse(req.params.module);
    if (!ensure(res.locals.authUser, module, 'view', res)) return;
    res.json(await checkMailConnection(module));
  } catch (e) {
    next(e);
  }
});

emailRouter.get('/recipients/search', async (req, res, next) => {
  try {
    const module = moduleSchema.parse(req.query.module);
    if (!ensure(res.locals.authUser, module, 'groups-view', res)) return;
    const entityType = z.string().parse(req.query.entityType);
    res.json({ data: await searchRecipients(module, entityType, String(req.query.q ?? ''), res.locals.authUser) });
  } catch (e) {
    next(e);
  }
});

emailRouter.get('/groups', async (req, res, next) => {
  try {
    const module = moduleSchema.parse(req.query.module);
    if (!ensure(res.locals.authUser, module, 'groups-view', res)) return;
    const search = String(req.query.search ?? '').trim();
    const data = await prisma.mailGroup.findMany({
      where: {
        ownerUserId: res.locals.authUser.id,
        module,
        ...(search ? { groupName: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { _count: { select: { members: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

emailRouter.post('/groups', async (req, res, next) => {
  try {
    const input = groupSchema.parse(req.body);
    if (!ensure(res.locals.authUser, input.module, 'groups-create', res)) return;
    const unique = Array.from(
      new Map<string, { entityType: string; entityId: string }>(
        input.members.map((x): [string, { entityType: string; entityId: string }] => [
          `${x.entityType}:${x.entityId}`,
          x,
        ]),
      ).values(),
    );
    await resolveRecipients(input.module, unique, res.locals.authUser);
    const group = await prisma.mailGroup.create({
      data: {
        ownerUserId: res.locals.authUser.id,
        module: input.module,
        groupName: input.groupName,
        description: input.description || null,
        members: { create: unique },
      },
      include: { members: true },
    });
    res.status(201).json(group);
  } catch (e) {
    next(e);
  }
});

emailRouter.get('/groups/:id', async (req, res, next) => {
  try {
    const group = await prisma.mailGroup.findFirst({
      where: { id: req.params.id, ownerUserId: res.locals.authUser.id },
      include: { members: true },
    });
    if (!group) return res.status(404).json({ message: 'Mail group not found.' });
    const module = moduleSchema.parse(group.module);
    if (!ensure(res.locals.authUser, module, 'groups-view', res)) return;
    const resolved = await resolveRecipients(module, group.members, res.locals.authUser);
    res.json({ ...group, ...resolved });
  } catch (e) {
    next(e);
  }
});

emailRouter.patch('/groups/:id', async (req, res, next) => {
  try {
    const current = await prisma.mailGroup.findFirst({
      where: { id: req.params.id, ownerUserId: res.locals.authUser.id },
      include: { members: true },
    });
    if (!current) return res.status(404).json({ message: 'Mail group not found.' });
    const module = moduleSchema.parse(current.module);
    if (!ensure(res.locals.authUser, module, 'groups-edit', res)) return;
    const input = groupSchema.partial().parse(req.body);
    const members = input.members
      ? Array.from(
          new Map<string, { entityType: string; entityId: string }>(
            input.members.map((x): [string, { entityType: string; entityId: string }] => [
              `${x.entityType}:${x.entityId}`,
              x,
            ]),
          ).values(),
        )
      : null;
    const updated = await prisma.$transaction(async (tx: any) => {
      if (members) {
        await tx.mailGroupMember.deleteMany({ where: { groupId: current.id } });
        await tx.mailGroupMember.createMany({ data: members.map((member) => ({ ...member, groupId: current.id })), skipDuplicates: true });
      }
      return tx.mailGroup.update({
        where: { id: current.id },
        data: { groupName: input.groupName, description: input.description === undefined ? undefined : input.description || null },
        include: { members: true },
      });
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

emailRouter.delete('/groups/:id', async (req, res, next) => {
  try {
    const current = await prisma.mailGroup.findFirst({ where: { id: req.params.id, ownerUserId: res.locals.authUser.id } });
    if (!current) return res.status(404).json({ message: 'Mail group not found.' });
    const module = moduleSchema.parse(current.module);
    if (!ensure(res.locals.authUser, module, 'groups-delete', res)) return;
    await prisma.mailGroup.delete({ where: { id: current.id } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

emailRouter.post('/groups/:id/duplicate', async (req, res, next) => {
  try {
    const current = await prisma.mailGroup.findFirst({
      where: { id: req.params.id, ownerUserId: res.locals.authUser.id },
      include: { members: true },
    });
    if (!current) return res.status(404).json({ message: 'Mail group not found.' });
    const module = moduleSchema.parse(current.module);
    if (!ensure(res.locals.authUser, module, 'groups-create', res)) return;
    let name = `${current.groupName} Copy`;
    let index = 2;
    while (await prisma.mailGroup.findFirst({ where: { ownerUserId: res.locals.authUser.id, module, groupName: name } })) {
      name = `${current.groupName} Copy ${index++}`;
    }
    const copy = await prisma.mailGroup.create({
      data: {
        ownerUserId: res.locals.authUser.id,
        module,
        groupName: name,
        description: current.description,
        members: { create: current.members.map((member: any) => ({ entityType: member.entityType, entityId: member.entityId })) },
      },
      include: { members: true },
    });
    res.status(201).json(copy);
  } catch (e) {
    next(e);
  }
});

emailRouter.post('/send', async (req, res, next) => {
  try {
    const attachmentSchema = z.object({
      filename: z.string().min(1),
      content: z.string().min(1),
      contentType: z.string().optional(),
    });
    const input = z.object({
      module: moduleSchema,
      subject: z.string().min(1),
      body: z.string().min(1),
      to: z.union([z.string().email(), z.array(z.string().email())]).optional(),
      cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
      attachments: z.array(attachmentSchema).optional(),
      submissionId: z.string().min(1).optional(),
      submissionIds: z.array(z.string().min(1)).optional(),
      groupId: z.string().optional(),
      members: z.array(refSchema).optional(),
      excludedMembers: z.array(refSchema).optional(),
    }).parse(req.body);

    if (!ensure(res.locals.authUser, input.module, 'compose', res)) return;
    if ((input.submissionId || input.submissionIds) && !hasPermission(res.locals.authUser, 'submissions')) {
      return res.status(403).json({ message: 'You do not have permission to send submission emails.' });
    }

    let emails = Array.isArray(input.to) ? input.to : input.to ? [input.to] : [];
    let refs = input.members ?? [];

    if (input.groupId) {
      const group = await prisma.mailGroup.findFirst({
        where: { id: input.groupId, ownerUserId: res.locals.authUser.id, module: input.module },
        include: { members: true },
      });
      if (!group) return res.status(404).json({ message: 'Mail group not found.' });
      refs = [...group.members, ...refs];
    }

    const excluded = new Set((input.excludedMembers ?? []).map((item) => `${item.entityType}:${item.entityId}`));
    refs = refs.filter((item) => !excluded.has(`${item.entityType}:${item.entityId}`));
    const resolved = await resolveRecipients(input.module, refs, res.locals.authUser);
    emails = [...new Set([...emails, ...resolved.recipients.map((recipient) => recipient.email)].map((address) => address.toLowerCase()))];

    if (!emails.length) return res.status(400).json({ message: 'Select at least one valid recipient.' });

    const targetSubmissionIds = input.submissionIds ?? (input.submissionId ? [input.submissionId] : []);
    const targetSubmissions = targetSubmissionIds.length
      ? await prisma.submission.findMany({ where: { id: { in: targetSubmissionIds } } })
      : [];

    if (targetSubmissionIds.length && targetSubmissions.length !== targetSubmissionIds.length) {
      return res.status(404).json({ message: 'One or more submissions were not found.' });
    }

    for (const subId of targetSubmissionIds) {
      const existingSent = await prisma.submissionEmail.findFirst({
        where: { submissionId: subId, status: 'Sent' },
      });
      if (existingSent) {
        const sub = targetSubmissions.find((s: any) => s.id === subId);
        return res.status(409).json({ message: `A resume email has already been sent for submission of ${sub?.candidateName ?? subId}.` });
      }
    }

    const result = await sendMail(input.module, emails.join(','), input.subject, input.body, input.cc, input.attachments);

    if (targetSubmissionIds.length > 0) {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const createdTime = now.toTimeString().slice(0, 5);
      const sender = String(res.locals.authUser?.name ?? res.locals.authUser?.email ?? 'System User');
      const ccEmail = input.cc ? (Array.isArray(input.cc) ? input.cc.join(',') : input.cc) : null;

      const transactions = await prisma.$transaction(async (tx: any) => {
        const results = [];
        for (const subId of targetSubmissionIds) {
          const sub = targetSubmissions.find((s: any) => s.id === subId);
          const emailRecord = await tx.submissionEmail.create({
            data: {
              submissionId: subId,
              toEmail: emails.join(','),
              ccEmail: ccEmail || null,
              subject: input.subject,
              body: input.body,
              attachments: input.attachments?.length ? input.attachments : null,
              sentBy: sender,
              sentDate: now,
              status: 'Sent',
              messageId: result.messageId || null,
            },
          });

          const submissionUpdateData: Record<string, unknown> = {};
          if (['Draft', 'Submitted'].includes(String(sub?.status ?? ''))) {
            submissionUpdateData.status = 'Sent';
          }
          if (!sub?.submissionDate) {
            submissionUpdateData.submissionDate = today;
          }

          const updated = Object.keys(submissionUpdateData).length
            ? await tx.submission.update({ where: { id: subId }, data: submissionUpdateData })
            : await tx.submission.findUnique({ where: { id: subId } });

          const emailActivity = await tx.activity.create({
            data: {
              activity: `Email sent: ${input.subject}`,
              description: input.body,
              relatedTo: sub?.candidateName ?? undefined,
              relatedType: 'Submission',
              relatedEntityType: 'Submission',
              relatedEntityId: subId,
              type: 'Email',
              status: 'Completed',
              priority: 'High',
              ownerName: sender,
              ownerId: res.locals.authUser?.id,
              createdOn: today,
              createdTime,
              customData: { submissionId: subId, submissionEmailId: emailRecord.id },
            },
          });

          const followUpDue = new Date(now);
          followUpDue.setDate(followUpDue.getDate() + 1);

          const followUpTask = await tx.activity.create({
            data: {
              activity: `Follow up resume submission: ${sub?.candidateName ?? 'Candidate'}`,
              description: `Follow up on resume submission for ${sub?.jobTitle ?? 'the role'}`,
              relatedTo: sub?.candidateName ?? undefined,
              relatedType: 'Submission',
              relatedEntityType: 'Submission',
              relatedEntityId: subId,
              type: 'Task',
              status: 'Pending',
              priority: 'High',
              ownerName: sender,
              ownerId: res.locals.authUser?.id,
              dueDate: followUpDue.toISOString().slice(0, 10),
              createdOn: today,
              customData: { submissionId: subId, submissionEmailId: emailRecord.id },
            },
          });

          results.push({ updatedSubmission: updated, emailActivity, followUpTask });
        }
        return results;
      });

      for (const resItem of transactions) {
        emitResourceEvent('submissions', 'updated', resItem.updatedSubmission);
        emitResourceEvent('activities', 'created', resItem.emailActivity);
        emitResourceEvent('activities', 'created', resItem.followUpTask);
      }
    }

    res.json(result);
  } catch (e) {
    next(e);
  }
});
