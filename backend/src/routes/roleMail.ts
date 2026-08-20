import { Router } from 'express';
import { z } from 'zod';
import { hasPermission } from '../lib/permissions.js';
import {
  MAIL_MODULES,
  MODULE_PERMISSION_PREFIX,
  type MailModule,
  bulkUpdateMessages,
  checkConnection,
  composeAndSend,
  createLabel,
  deleteLabel,
  downloadAttachment,
  getFolderCounts,
  getMessage,
  getThread,
  linkMessage,
  listLabels,
  listMessages,
  replyToMessage,
  saveDraft,
  syncInbox,
  toggleMessageLabel,
  updateLabel,
  updateMessage,
} from '../services/roleMail.js';

export const roleMailRouter = Router({ mergeParams: true });

const moduleSchema = z.enum(MAIL_MODULES);
const addressSchema = z.union([z.string(), z.array(z.string())]);
const attachmentSchema = z.object({ filename: z.string().min(1), content: z.string().min(1), contentType: z.string().optional() });
const composeSchema = z.object({
  to: addressSchema,
  cc: addressSchema.optional(),
  bcc: addressSchema.optional(),
  subject: z.string().trim().max(500).default(''),
  body: z.string().default(''),
  threadId: z.string().optional().nullable(),
  attachments: z.array(attachmentSchema).optional(),
  linkedEntityType: z.string().optional().nullable(),
  linkedEntityId: z.string().optional().nullable(),
  submissionId: z.string().optional().nullable(),
  benchConsultantId: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
});
const patchSchema = z.object({ isRead: z.boolean().optional(), isStarred: z.boolean().optional(), isArchived: z.boolean().optional(), isTrashed: z.boolean().optional() });
const linkSchema = z.object({
  linkedEntityType: z.string().optional().nullable(),
  linkedEntityId: z.string().optional().nullable(),
  submissionId: z.string().optional().nullable(),
  benchConsultantId: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
});

type Access = { userId: string; module: MailModule };

function resolveAccess(req: any, res: any, action: 'view' | 'compose'): Access | null {
  const parsed = moduleSchema.safeParse(req.params.module);
  if (!parsed.success) {
    res.status(404).json({ message: 'Unknown mail module' });
    return null;
  }
  const module = parsed.data;
  const user = res.locals.authUser;
  if (!hasPermission(user, `${MODULE_PERMISSION_PREFIX[module]}-${action}`)) {
    res.status(403).json({ message: 'You do not have permission for this mail action.' });
    return null;
  }
  return { userId: user.id, module };
}

function handler(action: 'view' | 'compose', run: (access: Access, req: any, res: any) => Promise<unknown>) {
  return async (req: any, res: any, next: any) => {
    try {
      const access = resolveAccess(req, res, action);
      if (!access) return;
      res.json(await run(access, req, res));
    } catch (error) {
      next(error);
    }
  };
}

roleMailRouter.get('/:module/check', handler('view', ({ userId }) => checkConnection(userId)));
roleMailRouter.get('/:module/folders', handler('view', ({ userId, module }) => getFolderCounts(userId, module)));

roleMailRouter.get(
  '/:module/messages',
  handler('view', ({ userId, module }, req) =>
    listMessages(userId, module, {
      folder: String(req.query.folder ?? 'inbox'),
      search: String(req.query.search ?? ''),
      labelId: req.query.labelId ? String(req.query.labelId) : undefined,
      entityType: req.query.entityType ? String(req.query.entityType) : undefined,
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 25),
    }),
  ),
);

roleMailRouter.get('/:module/messages/:id', handler('view', ({ userId, module }, req) => getMessage(userId, module, String(req.params.id))));
roleMailRouter.get('/:module/threads/:threadId', handler('view', ({ userId, module }, req) => getThread(userId, module, String(req.params.threadId))));
roleMailRouter.get(
  '/:module/messages/:id/attachments/:attachmentId',
  handler('view', ({ userId, module }, req) => downloadAttachment(userId, module, String(req.params.id), String(req.params.attachmentId))),
);

roleMailRouter.post('/:module/compose', handler('compose', ({ userId, module }, req) => composeAndSend(userId, module, composeSchema.parse(req.body))));
roleMailRouter.post(
  '/:module/reply',
  handler('compose', ({ userId, module }, req) =>
    replyToMessage(userId, module, composeSchema.extend({ messageId: z.string().min(1) }).parse(req.body)),
  ),
);
roleMailRouter.post('/:module/draft', handler('compose', ({ userId, module }, req) => saveDraft(userId, module, composeSchema.parse(req.body))));

roleMailRouter.patch(
  '/:module/messages/bulk',
  handler('view', ({ userId, module }, req) => {
    const body = patchSchema.extend({ ids: z.array(z.string().min(1)).min(1) }).parse(req.body);
    const { ids, ...patch } = body;
    return bulkUpdateMessages(userId, module, ids, patch);
  }),
);
roleMailRouter.patch('/:module/messages/:id', handler('view', ({ userId, module }, req) => updateMessage(userId, module, String(req.params.id), patchSchema.parse(req.body))));
roleMailRouter.post('/:module/messages/:id/link', handler('view', ({ userId, module }, req) => linkMessage(userId, module, String(req.params.id), linkSchema.parse(req.body))));

roleMailRouter.get('/:module/labels', handler('view', async ({ userId, module }) => ({ data: await listLabels(userId, module) })));
roleMailRouter.post(
  '/:module/labels',
  handler('view', ({ userId, module }, req) => createLabel(userId, module, z.object({ name: z.string().trim().min(1).max(60), color: z.string().optional() }).parse(req.body))),
);
roleMailRouter.patch(
  '/:module/labels/:id',
  handler('view', ({ userId, module }, req) =>
    updateLabel(userId, module, String(req.params.id), z.object({ name: z.string().trim().min(1).max(60).optional(), color: z.string().optional() }).parse(req.body)),
  ),
);
roleMailRouter.delete('/:module/labels/:id', handler('view', ({ userId, module }, req) => deleteLabel(userId, module, String(req.params.id))));
roleMailRouter.post(
  '/:module/messages/:messageId/labels/:labelId',
  handler('view', ({ userId, module }, req) => toggleMessageLabel(userId, module, String(req.params.messageId), String(req.params.labelId))),
);

roleMailRouter.post('/:module/sync', handler('view', ({ userId, module }, req) => syncInbox(userId, module, Number(req.body?.maxResults ?? 25))));
