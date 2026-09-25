import * as PrismaPackage from '@prisma/client';
const PrismaClient = (PrismaPackage as unknown as { PrismaClient: new () => any }).PrismaClient;
export const prisma = new PrismaClient();
