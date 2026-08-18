import { writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const normalize = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  const exceptions: Record<string, unknown>[] = [];
  const accounts = await (prisma as any).account.findMany();
  for (const account of accounts) await (prisma as any).account.update({ where: { id: account.id }, data: { normalizedName: normalize(account.accountName) } });
  const refreshedAccounts = await (prisma as any).account.findMany();
  const accountMap = new Map<string, any[]>();
  for (const account of refreshedAccounts) accountMap.set(account.normalizedName, [...(accountMap.get(account.normalizedName) ?? []), account]);

  for (const contact of await (prisma as any).contact.findMany({ where: { accountId: null } })) {
    const matches = accountMap.get(normalize(contact.company)) ?? [];
    if (matches.length === 1) await (prisma as any).contact.update({ where: { id: contact.id }, data: { accountId: matches[0].id } });
    else exceptions.push({ entity: 'Contact', id: contact.id, display: contact.name, sourceValue: contact.company, reason: matches.length ? 'Ambiguous account match' : 'No account match' });
  }
  for (const opportunity of await (prisma as any).opportunity.findMany({ where: { accountId: null } })) {
    const matches = accountMap.get(normalize(opportunity.accountName)) ?? [];
    if (matches.length === 1) await (prisma as any).opportunity.update({ where: { id: opportunity.id }, data: { accountId: matches[0].id } });
    else exceptions.push({ entity: 'Opportunity', id: opportunity.id, display: opportunity.opportunityName, sourceValue: opportunity.accountName, reason: matches.length ? 'Ambiguous account match' : 'No account match' });
  }
  await writeFile('prisma/link-exceptions.json', JSON.stringify(exceptions, null, 2));
  console.log(`Linking complete. ${exceptions.length} exception(s) written to backend/prisma/link-exceptions.json`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
