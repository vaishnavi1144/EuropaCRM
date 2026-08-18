import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function audit(input: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
}) {
  return (prisma as any).auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeData: input.beforeData as Prisma.InputJsonValue | undefined,
      afterData: input.afterData as Prisma.InputJsonValue | undefined,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function notifyUsers(userIds: string[], input: { type: string; title: string; message: string; entityType?: string; entityId?: string; metadata?: unknown }) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return { count: 0 };
  return (prisma as any).notification.createMany({
    data: unique.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    })),
  });
}
