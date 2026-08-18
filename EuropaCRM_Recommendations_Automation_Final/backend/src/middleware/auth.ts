import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export type AuthenticatedUser = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: string;
  permissions: unknown;
};

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const token = authorization.slice(7).trim();
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const session = await (prisma as any).authSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
      if (session) await (prisma as any).authSession.delete({ where: { id: session.id } }).catch(() => undefined);
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }
    res.locals.authUser = {
      id: session.user.id,
      name: session.user.name,
      username: session.user.username,
      email: session.user.email,
      role: session.user.role,
      permissions: session.user.permissions,
    } satisfies AuthenticatedUser;
    res.locals.authSessionId = session.id;
    next();
  } catch (error) {
    next(error);
  }
}
