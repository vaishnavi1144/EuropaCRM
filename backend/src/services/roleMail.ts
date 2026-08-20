import { prisma } from '../lib/prisma.js';
import {
  GmailError,
  buildRawMessage,
  getConnectedAccount,
  gmailCreateDraft,
  gmailGetAttachment,
  gmailGetMessage,
  gmailListMessageIds,
  gmailModify,
  gmailSend,
  gmailTrash,
  requireConnectedAccount,
} from './gmail.js';

export const MAIL_MODULES = ['sales', 'it', 'bench', 'ai'] as const;
export type MailModule = (typeof MAIL_MODULES)[number];

export const MODULE_PERMISSION_PREFIX: Record<MailModule, string> = {
  sales: 'sales-mail',
  it: 'recruitment-mail',
  bench: 'bench-mail',
  ai: 'ai-mail',
};

export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'archived' | 'trash';

type ListInput = { folder?: string; search?: string; labelId?: string; entityType?: string; page?: number; limit?: number };

function folderFilter(folder: string) {
  switch (folder) {
    case 'sent':
      return { direction: 'OUTBOUND', isDraft: false, isTrashed: false };
    case 'drafts':
      return { isDraft: true, isTrashed: false };
    case 'starred':
      return { isStarred: true, isTrashed: false };
    case 'archived':
      return { isArchived: true, isTrashed: false };
    case 'trash':
      return { isTrashed: true };
    case 'inbox':
    default:
      return { direction: 'INBOUND', isDraft: false, isTrashed: false, isArchived: false };
  }
}

const messageSelect = {
  id: true,
  module: true,
  gmailId: true,
  gmailThreadId: true,
  direction: true,
  folder: true,
  fromAddress: true,
  toAddresses: true,
  ccAddresses: true,
  bccAddresses: true,
  subject: true,
  snippet: true,
  bodyText: true,
  bodyHtml: true,
  attachments: true,
  isRead: true,
  isStarred: true,
  isDraft: true,
  isTrashed: true,
  isArchived: true,
  sentAt: true,
  receivedAt: true,
  linkedEntityType: true,
  linkedEntityId: true,
  submissionId: true,
  benchConsultantId: true,
  jobId: true,
  labels: { select: { label: { select: { id: true, name: true, color: true } } } },
} as const;

export async function getFolderCounts(userId: string, module: MailModule) {
  const base = { userId, module };
  const [inbox, unread, sent, drafts, starred, archived, trash] = await Promise.all([
    prisma.mailMessage.count({ where: { ...base, ...folderFilter('inbox') } }),
    prisma.mailMessage.count({ where: { ...base, ...folderFilter('inbox'), isRead: false } }),
    prisma.mailMessage.count({ where: { ...base, ...folderFilter('sent') } }),
    prisma.mailMessage.count({ where: { ...base, ...folderFilter('drafts') } }),
    prisma.mailMessage.count({ where: { ...base, ...folderFilter('starred') } }),
    prisma.mailMessage.count({ where: { ...base, ...folderFilter('archived') } }),
    prisma.mailMessage.count({ where: { ...base, ...folderFilter('trash') } }),
  ]);
  return { inbox, unread, sent, drafts, starred, archived, trash };
}

export async function listMessages(userId: string, module: MailModule, input: ListInput) {
  const page = Math.max(1, Number(input.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(input.limit ?? 25)));
  const search = (input.search ?? '').trim();
  const where = {
    userId,
    module,
    ...folderFilter(input.folder ?? 'inbox'),
    ...(input.labelId ? { labels: { some: { labelId: input.labelId } } } : {}),
    ...(input.entityType ? { linkedEntityType: input.entityType } : {}),
    ...(search
      ? {
          OR: [
            { subject: { contains: search, mode: 'insensitive' as const } },
            { snippet: { contains: search, mode: 'insensitive' as const } },
            { bodyText: { contains: search, mode: 'insensitive' as const } },
            { fromAddress: { contains: search, mode: 'insensitive' as const } },
            { toAddresses: { has: search } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.mailMessage.findMany({ where, select: messageSelect, orderBy: { receivedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.mailMessage.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getMessage(userId: string, module: MailModule, id: string) {
  const message = await prisma.mailMessage.findFirst({ where: { id, userId, module }, select: messageSelect });
  if (!message) throw new GmailError('Message not found', 404);
  if (!message.isRead) await prisma.mailMessage.update({ where: { id }, data: { isRead: true } });
  return { ...message, isRead: true };
}

export async function getThread(userId: string, module: MailModule, threadId: string) {
  const data = await prisma.mailMessage.findMany({
    where: { userId, module, gmailThreadId: threadId },
    select: messageSelect,
    orderBy: { receivedAt: 'asc' },
  });
  return { data };
}

function normalizeAddresses(value: string | string[] | undefined) {
  if (!value) return [];
  return (Array.isArray(value) ? value : value.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export type ComposeInput = {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  attachments?: { filename: string; content: string; contentType?: string }[];
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  submissionId?: string | null;
  benchConsultantId?: string | null;
  jobId?: string | null;
};

export async function composeAndSend(userId: string, module: MailModule, input: ComposeInput) {
  const account = await requireConnectedAccount(userId);
  const to = normalizeAddresses(input.to);
  if (!to.length) throw new GmailError('At least one recipient is required.', 400);
  const cc = normalizeAddresses(input.cc);
  const bcc = normalizeAddresses(input.bcc);
  const raw = buildRawMessage({
    from: account.email,
    to,
    cc,
    bcc,
    subject: input.subject,
    body: input.body,
    inReplyTo: input.inReplyTo,
    attachments: input.attachments,
  });
  const sent = await gmailSend(account, raw, input.threadId ?? undefined);
  return prisma.mailMessage.create({
    data: {
      userId,
      accountId: account.id,
      module,
      gmailId: sent.id,
      gmailThreadId: sent.threadId,
      direction: 'OUTBOUND',
      folder: 'SENT',
      fromAddress: account.email,
      toAddresses: to,
      ccAddresses: cc,
      bccAddresses: bcc,
      subject: input.subject,
      snippet: input.body.replace(/<[^>]+>/g, ' ').trim().slice(0, 240),
      bodyHtml: input.body,
      bodyText: input.body.replace(/<[^>]+>/g, ' ').trim(),
      attachments: input.attachments?.map(({ filename, contentType }) => ({ filename, mimeType: contentType ?? 'application/octet-stream' })) ?? undefined,
      isRead: true,
      sentAt: new Date(),
      receivedAt: new Date(),
      linkedEntityType: input.linkedEntityType ?? null,
      linkedEntityId: input.linkedEntityId ?? null,
      submissionId: input.submissionId ?? null,
      benchConsultantId: input.benchConsultantId ?? null,
      jobId: input.jobId ?? null,
    },
    select: messageSelect,
  });
}

export async function replyToMessage(userId: string, module: MailModule, input: ComposeInput & { messageId: string }) {
  const original = await prisma.mailMessage.findFirst({ where: { id: input.messageId, userId, module } });
  if (!original) throw new GmailError('Message not found', 404);
  return composeAndSend(userId, module, {
    ...input,
    subject: input.subject || `Re: ${original.subject ?? ''}`.trim(),
    threadId: original.gmailThreadId,
    inReplyTo: original.gmailId,
    submissionId: input.submissionId ?? original.submissionId,
    benchConsultantId: input.benchConsultantId ?? original.benchConsultantId,
    jobId: input.jobId ?? original.jobId,
  });
}

export async function saveDraft(userId: string, module: MailModule, input: ComposeInput) {
  const account = await requireConnectedAccount(userId);
  const to = normalizeAddresses(input.to);
  const raw = buildRawMessage({ from: account.email, to, cc: normalizeAddresses(input.cc), subject: input.subject, body: input.body, attachments: input.attachments });
  const draft = await gmailCreateDraft(account, raw, input.threadId ?? undefined);
  return prisma.mailMessage.create({
    data: {
      userId,
      accountId: account.id,
      module,
      gmailId: draft.message?.id ?? draft.id,
      gmailThreadId: draft.message?.threadId ?? null,
      direction: 'OUTBOUND',
      folder: 'DRAFTS',
      fromAddress: account.email,
      toAddresses: to,
      ccAddresses: normalizeAddresses(input.cc),
      bccAddresses: normalizeAddresses(input.bcc),
      subject: input.subject,
      snippet: input.body.replace(/<[^>]+>/g, ' ').trim().slice(0, 240),
      bodyHtml: input.body,
      isDraft: true,
      isRead: true,
    },
    select: messageSelect,
  });
}

export type MessagePatch = { isRead?: boolean; isStarred?: boolean; isArchived?: boolean; isTrashed?: boolean };

async function syncFlagsToGmail(userId: string, gmailId: string | null, patch: MessagePatch) {
  if (!gmailId) return;
  const account = await getConnectedAccount(userId);
  if (!account) return;
  const add: string[] = [];
  const remove: string[] = [];
  if (patch.isRead === true) remove.push('UNREAD');
  if (patch.isRead === false) add.push('UNREAD');
  if (patch.isStarred === true) add.push('STARRED');
  if (patch.isStarred === false) remove.push('STARRED');
  if (patch.isArchived === true) remove.push('INBOX');
  if (patch.isArchived === false) add.push('INBOX');
  try {
    if (patch.isTrashed === true) await gmailTrash(account, gmailId);
    if (add.length || remove.length) await gmailModify(account, gmailId, add, remove);
  } catch {
    // Local state stays authoritative when Gmail rejects the flag change.
  }
}

export async function updateMessage(userId: string, module: MailModule, id: string, patch: MessagePatch) {
  const existing = await prisma.mailMessage.findFirst({ where: { id, userId, module } });
  if (!existing) throw new GmailError('Message not found', 404);
  await syncFlagsToGmail(userId, existing.gmailId, patch);
  return prisma.mailMessage.update({ where: { id }, data: patch, select: messageSelect });
}

export async function bulkUpdateMessages(userId: string, module: MailModule, ids: string[], patch: MessagePatch) {
  const messages: { id: string; gmailId: string | null }[] = await prisma.mailMessage.findMany({
    where: { id: { in: ids }, userId, module },
    select: { id: true, gmailId: true },
  });
  await Promise.all(messages.map((message) => syncFlagsToGmail(userId, message.gmailId, patch)));
  const result = await prisma.mailMessage.updateMany({ where: { id: { in: messages.map((message) => message.id) } }, data: patch });
  return { updated: result.count };
}

export async function linkMessage(
  userId: string,
  module: MailModule,
  id: string,
  links: { linkedEntityType?: string | null; linkedEntityId?: string | null; submissionId?: string | null; benchConsultantId?: string | null; jobId?: string | null },
) {
  const existing = await prisma.mailMessage.findFirst({ where: { id, userId, module } });
  if (!existing) throw new GmailError('Message not found', 404);
  return prisma.mailMessage.update({ where: { id }, data: links, select: messageSelect });
}

export async function listLabels(userId: string, module: MailModule) {
  return prisma.mailLabel.findMany({ where: { userId, module }, orderBy: { name: 'asc' } });
}

export async function createLabel(userId: string, module: MailModule, data: { name: string; color?: string }) {
  return prisma.mailLabel.create({ data: { userId, module, name: data.name, ...(data.color ? { color: data.color } : {}) } });
}

export async function updateLabel(userId: string, module: MailModule, id: string, data: { name?: string; color?: string }) {
  const existing = await prisma.mailLabel.findFirst({ where: { id, userId, module } });
  if (!existing) throw new GmailError('Label not found', 404);
  return prisma.mailLabel.update({ where: { id }, data });
}

export async function deleteLabel(userId: string, module: MailModule, id: string) {
  const existing = await prisma.mailLabel.findFirst({ where: { id, userId, module } });
  if (!existing) throw new GmailError('Label not found', 404);
  await prisma.mailLabel.delete({ where: { id } });
  return { success: true };
}

export async function toggleMessageLabel(userId: string, module: MailModule, messageId: string, labelId: string) {
  const [message, label] = await Promise.all([
    prisma.mailMessage.findFirst({ where: { id: messageId, userId, module }, select: { id: true } }),
    prisma.mailLabel.findFirst({ where: { id: labelId, userId, module }, select: { id: true } }),
  ]);
  if (!message || !label) throw new GmailError('Message or label not found', 404);
  const existing = await prisma.mailMessageLabel.findUnique({ where: { messageId_labelId: { messageId, labelId } } });
  if (existing) {
    await prisma.mailMessageLabel.delete({ where: { messageId_labelId: { messageId, labelId } } });
    return { attached: false };
  }
  await prisma.mailMessageLabel.create({ data: { messageId, labelId } });
  return { attached: true };
}

/**
 * Links an inbound reply back to the submission of the outbound message it answers.
 */
async function autoMatchReply(userId: string, module: MailModule, threadId: string | null) {
  if (!threadId) return null;
  return prisma.mailMessage.findFirst({
    where: { userId, module, gmailThreadId: threadId, direction: 'OUTBOUND', NOT: { submissionId: null } },
    select: { submissionId: true, benchConsultantId: true, jobId: true, linkedEntityType: true, linkedEntityId: true },
  });
}

export async function syncInbox(userId: string, module: MailModule, maxResults = 25) {
  const account = await requireConnectedAccount(userId);
  const ids = await gmailListMessageIds(account, 'in:inbox', maxResults);
  let imported = 0;
  for (const { id } of ids) {
    const existing = await prisma.mailMessage.findFirst({ where: { userId, module, gmailId: id }, select: { id: true } });
    if (existing) continue;
    const message = await gmailGetMessage(account, id);
    const match = await autoMatchReply(userId, module, message.threadId);
    await prisma.mailMessage.create({
      data: {
        userId,
        accountId: account.id,
        module,
        gmailId: message.id,
        gmailThreadId: message.threadId,
        direction: 'INBOUND',
        folder: 'INBOX',
        fromAddress: message.from,
        toAddresses: message.to,
        ccAddresses: message.cc,
        bccAddresses: message.bcc,
        subject: message.subject,
        snippet: message.snippet,
        bodyText: message.bodyText,
        bodyHtml: message.bodyHtml,
        attachments: message.attachments.length ? message.attachments : undefined,
        isRead: !message.labelIds.includes('UNREAD'),
        isStarred: message.labelIds.includes('STARRED'),
        receivedAt: new Date(Number(message.internalDate)),
        submissionId: match?.submissionId ?? null,
        benchConsultantId: match?.benchConsultantId ?? null,
        jobId: match?.jobId ?? null,
        linkedEntityType: match?.linkedEntityType ?? null,
        linkedEntityId: match?.linkedEntityId ?? null,
      },
    });
    imported += 1;
  }
  await prisma.emailAccount.update({ where: { id: account.id }, data: { lastSyncedAt: new Date() } });
  return { imported, scanned: ids.length, lastSyncedAt: new Date().toISOString() };
}

export async function checkConnection(userId: string) {
  const account = await getConnectedAccount(userId);
  if (!account) return { connected: false as const };
  return { connected: true as const, email: account.email, lastSyncedAt: account.lastSyncedAt };
}

export async function downloadAttachment(userId: string, module: MailModule, messageId: string, attachmentId: string) {
  const account = await requireConnectedAccount(userId);
  const message = await prisma.mailMessage.findFirst({ where: { id: messageId, userId, module }, select: { gmailId: true } });
  if (!message?.gmailId) throw new GmailError('Message not found', 404);
  const attachment = await gmailGetAttachment(account, message.gmailId, attachmentId);
  return { data: attachment.data, size: attachment.size };
}
