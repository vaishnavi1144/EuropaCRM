import { prisma } from '../lib/prisma.js';

export type MailModule = 'sales' | 'it' | 'bench' | 'ai';
export type EntityRef = { entityType: string; entityId: string };
export type Recipient = EntityRef & { name: string; email: string };

const allowed: Record<MailModule, string[]> = {
  sales: ['lead', 'contact', 'account', 'custom'],
  it: ['candidate', 'custom'],
  bench: ['candidate', 'custom'],
  ai: ['contact', 'account', 'user', 'custom'],
};

export function assertEntityAllowed(module: MailModule, entityType: string) {
  if (!allowed[module].includes(entityType)) throw new Error(`The ${entityType} entity is not available in this mail module.`);
}

function ownerWhere(userId: string, role: string) {
  return role === 'SUPER_ADMIN' ? {} : { OR: [{ ownerId: userId }, { ownerId: null }] };
}

export async function searchRecipients(module: MailModule, entityType: string, query: string, user: any): Promise<Recipient[]> {
  assertEntityAllowed(module, entityType);
  if (entityType === 'custom') return [];
  const q = query.trim();
  const contains = q ? { contains: q, mode: 'insensitive' as const } : undefined;
  let rows: any[] = [];
  if (entityType === 'lead') rows = await prisma.lead.findMany({ where: { ...ownerWhere(user.id, user.role), ...(q ? { OR: [{ name: contains }, { company: contains }, { email: contains }] } : {}) }, take: 30, orderBy: { createdAt: 'desc' } });
  if (entityType === 'contact') rows = await prisma.contact.findMany({ where: { ...ownerWhere(user.id, user.role), ...(q ? { OR: [{ name: contains }, { company: contains }, { email: contains }] } : {}) }, take: 30, orderBy: { createdAt: 'desc' } });
  if (entityType === 'account') rows = await prisma.account.findMany({ where: { ...ownerWhere(user.id, user.role), email: { not: null }, ...(q ? { OR: [{ accountName: contains }, { email: contains }] } : {}) }, take: 30, orderBy: { createdAt: 'desc' } });
  if (entityType === 'candidate') rows = await prisma.candidate.findMany({ where: q ? { OR: [{ name: contains }, { email: contains }, { skills: contains }] } : {}, take: 30, orderBy: { createdAt: 'desc' } });
  if (entityType === 'user') rows = await prisma.user.findMany({ where: { isActive: true, ...(q ? { OR: [{ name: contains }, { email: contains }] } : {}) }, take: 30, orderBy: { createdAt: 'desc' } });
  return rows.filter(r => r.email).map(r => ({ entityType, entityId: r.id, name: r.name ?? r.accountName, email: String(r.email).toLowerCase() }));
}

export async function resolveRecipients(module: MailModule, refs: EntityRef[], user: any): Promise<{ recipients: Recipient[]; unavailable: EntityRef[] }> {
  const recipients: Recipient[] = []; const unavailable: EntityRef[] = [];
  for (const ref of refs) {
    if (ref.entityType === 'custom') {
      recipients.push({
        entityType: 'custom',
        entityId: ref.entityId,
        name: ref.entityId.split('@')[0],
        email: ref.entityId.toLowerCase(),
      });
      continue;
    }
    try {
      const found = (await searchRecipients(module, ref.entityType, '', user)).find(x => x.entityId === ref.entityId);
      if (found) recipients.push(found); else unavailable.push(ref);
    } catch { unavailable.push(ref); }
  }
  const seen = new Set<string>();
  return { recipients: recipients.filter(r => !seen.has(r.email) && seen.add(r.email)), unavailable };
}
