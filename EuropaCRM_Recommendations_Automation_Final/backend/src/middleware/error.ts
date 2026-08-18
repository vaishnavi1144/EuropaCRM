import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  if (error instanceof ZodError) return res.status(400).json({ message: error.issues.map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`).join(', '), errors: error.flatten() });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'Record not found' });
    if (error.code === 'P2002') return res.status(409).json({ message: 'A record with the same unique value already exists.' });
    if (error.code === 'P2003') return res.status(409).json({ message: 'This record is linked to another record and cannot be deleted.' });
  }
  const statusCode = typeof (error as any)?.statusCode === 'number' ? (error as any).statusCode : 500;
  return res.status(statusCode).json({ message: error instanceof Error ? error.message : 'Internal server error' });
};
