import { Router } from 'express';
import { z } from 'zod';
import { emitResourceEvent } from '../lib/socket.js';
import { hasPermission } from '../lib/permissions.js';
import { prisma } from '../lib/prisma.js';
import { checkMailConnection, sendMail } from '../services/email.js';
import { syncIncomingGmailMessages } from '../services/googleGmail.js';
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
    res.json(await checkMailConnection(module, res.locals.authUser));
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
      from: z.string().optional(),
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

    const result = await sendMail(input.module, emails.join(','), input.subject, input.body, input.cc, input.attachments, res.locals.authUser, input.from);

    const fromEmail = input.from?.trim() || res.locals.authUser?.email || `${input.module}@europacrm.local`;
    const fromName = res.locals.authUser?.name || 'Europa Administrator';
    const snippet = input.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);

    const savedEmailMessage = await prisma.emailMessage.create({
      data: {
        module: input.module,
        folder: 'sent',
        fromEmail,
        fromName,
        toEmail: emails.join(', '),
        ccEmail: input.cc ? (Array.isArray(input.cc) ? input.cc.join(', ') : input.cc) : null,
        subject: input.subject,
        body: input.body,
        snippet,
        attachments: input.attachments?.length ? input.attachments : null,
        isRead: true,
        status: 'Sent',
        messageId: result.messageId || `msg-${Date.now()}`,
        customData: (result as any).threadId ? { threadId: (result as any).threadId } : null,
        submissionId: input.submissionId || (targetSubmissionIds[0] ?? null),
        ownerUserId: res.locals.authUser?.id,
        ownerName: fromName,
        sentAt: new Date(),
      },
    });
    emitResourceEvent('email-messages', 'created', savedEmailMessage);

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

    res.json({ ...result, messageId: savedEmailMessage.id });
  } catch (e) {
    next(e);
  }
});

async function seedSampleInbox(module: string, user: any) {
  const userEmail = user?.email || 'admin@europacrm.local';
  const samples = module === 'bench' ? [
    {
      fromEmail: 'vendor.connect@infosys-partner.com',
      fromName: 'Sarah Jenkins (Infosys Vendor Mgmt)',
      toEmail: userEmail,
      subject: 'Interview Shortlist: Java Full Stack Lead Consultant',
      body: `Hi Team,<br/><br/>We are pleased to inform you that your submitted consultant has been shortlisted by the client hiring manager for the Java Full Stack Lead opening.<br/><br/><b>Scheduled Round:</b> Client Video Round<br/><b>Date & Time:</b> Thursday at 2:00 PM EST<br/><b>Interview Mode:</b> Microsoft Teams<br/><br/>Please confirm availability and share the candidate's updated photo ID copy.<br/><br/>Best regards,<br/><b>Sarah Jenkins</b><br/>Lead Vendor Account Specialist<br/>Infosys Partner Network`,
      snippet: 'We are pleased to inform you that your submitted consultant has been shortlisted by the client...',
    },
    {
      fromEmail: 'recruiting@wipro-msp.com',
      fromName: 'David Chen (Wipro Staffing Partner)',
      toEmail: userEmail,
      subject: 'Rate Confirmation & Work Authorization: AWS DevOps Profile',
      body: `Hello Team,<br/><br/>Thanks for submitting the AWS DevOps consultant profile. The profile looks strong. Could you please confirm if the consultant is available on C2C at $85/hr and has valid H1B/GC authorization valid for at least 12 months?<br/><br/>Looking forward to your swift response to proceed to client submission.<br/><br/>Thanks & Regards,<br/><b>David Chen</b><br/>Strategic Accounts | Wipro`,
      snippet: 'Thanks for submitting the AWS DevOps consultant profile. The profile looks strong...',
    },
    {
      fromEmail: 'accounts@tcs-americas.net',
      fromName: 'Priya Sharma (TCS Vendor Desk)',
      toEmail: userEmail,
      subject: 'Candidate Feedback: Senior Data Engineer Interview',
      body: `Dear Partner,<br/><br/>The client panel has provided feedback for the Round 1 Technical interview conducted yesterday. Overall feedback is positive, and the interviewer noted strong PySpark and Snowflake architecture skills. They will be proceeding with the final managerial round next week.<br/><br/>Warm regards,<br/><b>Priya Sharma</b><br/>TCS Americas Partner Relations`,
      snippet: 'The client panel has provided feedback for the Round 1 Technical interview conducted yesterday...',
    },
  ] : [
    {
      fromEmail: 'client.inquiries@enterprise-partner.com',
      fromName: 'Mark Stevens',
      toEmail: userEmail,
      subject: 'Partnership Inquiry & Requirement Discussion',
      body: `Hello,<br/><br/>We would like to follow up on your recent correspondence and discuss current technology requirements. Please let us know a suitable time for a 15-minute sync this week.<br/><br/>Regards,<br/>Mark Stevens`,
      snippet: 'We would like to follow up on your recent correspondence and discuss current technology...',
    }
  ];

  for (const s of samples) {
    await prisma.emailMessage.create({
      data: {
        module,
        folder: 'inbox',
        fromEmail: s.fromEmail,
        fromName: s.fromName,
        toEmail: s.toEmail,
        subject: s.subject,
        body: s.body,
        snippet: s.snippet,
        isRead: false,
        status: 'Received',
        ownerUserId: user?.id,
        ownerName: user?.name,
        sentAt: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 3)),
      },
    });
  }
}

emailRouter.get('/messages', async (req, res, next) => {
  try {
    const module = moduleSchema.parse(req.query.module);
    if (!ensure(res.locals.authUser, module, 'view', res)) return;
    const folder = String(req.query.folder ?? 'inbox').toLowerCase();
    const search = String(req.query.search ?? '').trim();

    if (folder === 'inbox') {
      if (res.locals.authUser?.id) {
        try {
          await syncIncomingGmailMessages(res.locals.authUser.id, module);
        } catch (syncErr) {
          console.warn('[Gmail Inbox Sync]', syncErr);
        }
      }
      const inboxCount = await prisma.emailMessage.count({
        where: { module, folder: 'inbox', ownerUserId: res.locals.authUser?.id },
      });
      if (inboxCount === 0) {
        await seedSampleInbox(module, res.locals.authUser);
      }
    }

    let where: any;
    if (folder === 'starred') {
      where = {
        module,
        isStarred: true,
        ownerUserId: res.locals.authUser?.id,
      };
    } else {
      where = {
        module,
        folder,
        ownerUserId: res.locals.authUser?.id,
      };
    }
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { toEmail: { contains: search, mode: 'insensitive' } },
        { fromEmail: { contains: search, mode: 'insensitive' } },
        { fromName: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    const messages = await prisma.emailMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const [inboxUnread, inboxTotal, sentTotal, starredTotal, draftsTotal, archiveTotal, trashTotal, spamTotal] = await Promise.all([
      prisma.emailMessage.count({ where: { module, folder: 'inbox', ownerUserId: res.locals.authUser?.id, isRead: false } }),
      prisma.emailMessage.count({ where: { module, folder: 'inbox', ownerUserId: res.locals.authUser?.id } }),
      prisma.emailMessage.count({ where: { module, folder: 'sent', ownerUserId: res.locals.authUser?.id } }),
      prisma.emailMessage.count({ where: { module, isStarred: true, ownerUserId: res.locals.authUser?.id } }),
      prisma.emailMessage.count({ where: { module, folder: 'drafts', ownerUserId: res.locals.authUser?.id } }),
      prisma.emailMessage.count({ where: { module, folder: 'archive', ownerUserId: res.locals.authUser?.id } }),
      prisma.emailMessage.count({ where: { module, folder: 'trash', ownerUserId: res.locals.authUser?.id } }),
      prisma.emailMessage.count({ where: { module, folder: 'spam', ownerUserId: res.locals.authUser?.id } }),
    ]);

    res.json({
      data: messages,
      counts: {
        inbox: inboxTotal,
        inboxUnread,
        sent: sentTotal,
        starred: starredTotal,
        drafts: draftsTotal,
        archive: archiveTotal,
        trash: trashTotal,
        spam: spamTotal,
      },
    });
  } catch (e) {
    next(e);
  }
});

emailRouter.post('/sync', async (req, res, next) => {
  try {
    const module = moduleSchema.parse(req.body.module || 'sales');
    if (!ensure(res.locals.authUser, module, 'view', res)) return;
    const result = await syncIncomingGmailMessages(res.locals.authUser.id, module);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

emailRouter.get('/messages/:id', async (req, res, next) => {
  try {
    const message = await prisma.emailMessage.findFirst({
      where: { id: req.params.id, ownerUserId: res.locals.authUser?.id },
    });
    if (!message) return res.status(404).json({ message: 'Email not found.' });
    if (!message.isRead) {
      await prisma.emailMessage.update({
        where: { id: message.id },
        data: { isRead: true },
      });
      message.isRead = true;
    }
    res.json(message);
  } catch (e) {
    next(e);
  }
});

emailRouter.post('/messages/:id/star', async (req, res, next) => {
  try {
    const message = await prisma.emailMessage.findFirst({
      where: { id: req.params.id, ownerUserId: res.locals.authUser?.id },
    });
    if (!message) return res.status(404).json({ message: 'Email not found.' });
    const updated = await prisma.emailMessage.update({
      where: { id: message.id },
      data: { isStarred: !message.isStarred },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

emailRouter.patch('/messages/:id/folder', async (req, res, next) => {
  try {
    const { folder } = z.object({
      folder: z.enum(['inbox', 'sent', 'drafts', 'archive', 'trash', 'spam']),
    }).parse(req.body);

    const message = await prisma.emailMessage.findFirst({
      where: { id: req.params.id, ownerUserId: res.locals.authUser?.id },
    });
    if (!message) return res.status(404).json({ message: 'Email not found.' });

    const updated = await prisma.emailMessage.update({
      where: { id: message.id },
      data: { folder },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

emailRouter.post('/messages/bulk-folder', async (req, res, next) => {
  try {
    const { ids, folder } = z.object({
      ids: z.array(z.string().min(1)),
      folder: z.enum(['inbox', 'sent', 'drafts', 'archive', 'trash', 'spam']),
    }).parse(req.body);

    await prisma.emailMessage.updateMany({
      where: { id: { in: ids }, ownerUserId: res.locals.authUser?.id },
      data: { folder },
    });
    res.json({ success: true, count: ids.length });
  } catch (e) {
    next(e);
  }
});

emailRouter.post('/drafts', async (req, res, next) => {
  try {
    const input = z.object({
      id: z.string().optional(),
      module: moduleSchema,
      to: z.string().optional(),
      cc: z.string().optional(),
      subject: z.string().optional().default(''),
      body: z.string().optional().default(''),
      attachments: z.array(z.object({
        filename: z.string(),
        content: z.string(),
        contentType: z.string().optional(),
        sizeText: z.string().optional(),
      })).optional(),
    }).parse(req.body);

    const snippet = (input.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    const fromEmail = res.locals.authUser?.email || `${input.module}@europacrm.local`;
    const fromName = res.locals.authUser?.name || 'Me';

    if (input.id) {
      const existing = await prisma.emailMessage.findFirst({
        where: { id: input.id, ownerUserId: res.locals.authUser?.id },
      });
      if (existing) {
        const updated = await prisma.emailMessage.update({
          where: { id: existing.id },
          data: {
            toEmail: input.to || '',
            ccEmail: input.cc || null,
            subject: input.subject || '(No Subject)',
            body: input.body,
            snippet,
            attachments: input.attachments?.length ? input.attachments : null,
            updatedAt: new Date(),
          },
        });
        return res.json(updated);
      }
    }

    const draft = await prisma.emailMessage.create({
      data: {
        module: input.module,
        folder: 'drafts',
        fromEmail,
        fromName,
        toEmail: input.to || '',
        ccEmail: input.cc || null,
        subject: input.subject || '(No Subject)',
        body: input.body,
        snippet,
        attachments: input.attachments?.length ? input.attachments : null,
        isRead: true,
        status: 'Draft',
        ownerUserId: res.locals.authUser?.id,
        ownerName: fromName,
        sentAt: null,
      },
    });
    res.status(201).json(draft);
  } catch (e) {
    next(e);
  }
});

emailRouter.delete('/messages/:id', async (req, res, next) => {
  try {
    const permanent = req.query.permanent === 'true';
    const message = await prisma.emailMessage.findFirst({
      where: { id: req.params.id, ownerUserId: res.locals.authUser?.id },
    });
    if (!message) return res.status(404).json({ message: 'Email not found.' });

    if (permanent || message.folder === 'trash') {
      await prisma.emailMessage.delete({ where: { id: message.id } });
      return res.json({ success: true, permanent: true });
    }

    const updated = await prisma.emailMessage.update({
      where: { id: message.id },
      data: { folder: 'trash' },
    });
    res.json({ success: true, movedToTrash: true, updated });
  } catch (e) {
    next(e);
  }
});

emailRouter.post('/messages/bulk-delete', async (req, res, next) => {
  try {
    const { ids, permanent } = z.object({
      ids: z.array(z.string().min(1)),
      permanent: z.boolean().optional().default(false),
    }).parse(req.body);

    if (permanent) {
      await prisma.emailMessage.deleteMany({
        where: { id: { in: ids }, ownerUserId: res.locals.authUser?.id },
      });
      return res.json({ success: true, permanent: true, count: ids.length });
    }

    await prisma.emailMessage.updateMany({
      where: { id: { in: ids }, ownerUserId: res.locals.authUser?.id },
      data: { folder: 'trash' },
    });
    res.json({ success: true, movedToTrash: true, count: ids.length });
  } catch (e) {
    next(e);
  }
});

emailRouter.post('/receive-simulated', async (req, res, next) => {
  try {
    const input = z.object({
      module: moduleSchema,
      fromEmail: z.string().email(),
      fromName: z.string().min(1),
      subject: z.string().min(1),
      body: z.string().min(1),
    }).parse(req.body);
    const snippet = input.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    const msg = await prisma.emailMessage.create({
      data: {
        module: input.module,
        folder: 'inbox',
        fromEmail: input.fromEmail,
        fromName: input.fromName,
        toEmail: res.locals.authUser?.email || 'me@europacrm.local',
        subject: input.subject,
        body: input.body,
        snippet,
        isRead: false,
        status: 'Received',
        ownerUserId: res.locals.authUser?.id,
        ownerName: res.locals.authUser?.name,
        sentAt: new Date(),
      },
    });
    emitResourceEvent('email-messages', 'created', msg);
    res.status(201).json(msg);
  } catch (e) {
    next(e);
  }
});

