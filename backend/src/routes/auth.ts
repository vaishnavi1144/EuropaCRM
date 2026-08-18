import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { normalizeRole, sanitizePermissionsForRole } from '../lib/permissions.js';
import { hashSessionToken, requireAuth } from '../middleware/auth.js';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(true),
});

const googleSchema = z.object({ credential: z.string().min(20), rememberMe: z.boolean().optional().default(true) });

export const authRouter = Router();

function publicUser(user: { id: string; name: string; username: string | null; email: string; role: string; permissions?: unknown; avatarUrl: string | null }) {
  const role = normalizeRole(user.role);
  const permissions = role === 'SUPER_ADMIN' ? null : sanitizePermissionsForRole(role, user.permissions);
  return { id: user.id, name: user.name, username: user.username, email: user.email, role, permissions, avatarUrl: user.avatarUrl };
}

async function ensureDefaultAdmin(username: string, password: string) {
  if (username.toLowerCase() !== env.ADMIN_USERNAME.toLowerCase() || password !== env.ADMIN_PASSWORD) return null;
  const userModel = (prisma as any).user;
  const existing = await userModel.findFirst({ where: { OR: [{ username: env.ADMIN_USERNAME }, { email: env.ADMIN_EMAIL }] } });
  if (existing) {
    return userModel.update({ where: { id: existing.id }, data: { name: env.ADMIN_NAME, username: env.ADMIN_USERNAME, email: env.ADMIN_EMAIL, isActive: true, role: 'SUPER_ADMIN', passwordHash: hashPassword(env.ADMIN_PASSWORD) } });
  }
  return userModel.create({ data: { name: env.ADMIN_NAME, username: env.ADMIN_USERNAME, email: env.ADMIN_EMAIL, role: 'SUPER_ADMIN', passwordHash: hashPassword(env.ADMIN_PASSWORD), isActive: true } });
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    // The configured administrator credentials are also a recovery path. This repairs
    // an older/stale admin record before password verification instead of failing login.
    let user = await ensureDefaultAdmin(input.username, input.password);
    if (!user) {
      user = await (prisma as any).user.findFirst({
        where: {
          OR: [
            { username: { equals: input.username, mode: 'insensitive' } },
            { email: { equals: input.username, mode: 'insensitive' } },
          ],
        },
      });
    }
    if (!user?.passwordHash || !user.isActive || !verifyPassword(input.password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + (input.rememberMe ? 12 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000));
    await prisma.$transaction([
      (prisma as any).authSession.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt } }),
      (prisma as any).user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      (prisma as any).authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    ]);
    res.json({ token, expiresAt: expiresAt.toISOString(), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});



authRouter.post('/google', async (req, res, next) => {
  try {
    const input = googleSchema.parse(req.body);
    if (!env.GOOGLE_CLIENT_ID) return res.status(503).json({ message: 'Google login is not configured on the server.' });
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(input.credential)}`);
    if (!response.ok) return res.status(401).json({ message: 'Google could not verify this sign-in.' });
    const profile = await response.json() as { aud?: string; email?: string; email_verified?: string; name?: string; picture?: string };
    if (profile.aud !== env.GOOGLE_CLIENT_ID || profile.email_verified !== 'true' || !profile.email) {
      return res.status(401).json({ message: 'This Google account could not be verified.' });
    }
    const user = await (prisma as any).user.findFirst({ where: { email: { equals: profile.email, mode: 'insensitive' } } });
    if (!user?.isActive) return res.status(403).json({ message: 'No active Europa CRM account is linked to this Google email. Ask an administrator to create the user with the same email address.' });
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + (input.rememberMe ? 12 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000));
    const updatedUser = await (prisma as any).user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), avatarUrl: user.avatarUrl || profile.picture || null } });
    await prisma.$transaction([
      (prisma as any).authSession.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt } }),
      (prisma as any).authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    ]);
    res.json({ token, expiresAt: expiresAt.toISOString(), user: publicUser(updatedUser) });
  } catch (error) { next(error); }
});

authRouter.get('/me', requireAuth, async (_req, res) => {
  const authUser = res.locals.authUser;
  const user = await (prisma as any).user.findUnique({ where: { id: authUser.id } });
  if (!user) return res.status(401).json({ message: 'User account not found' });
  res.json({ user: publicUser(user) });
});

authRouter.post('/logout', requireAuth, async (_req, res) => {
  await (prisma as any).authSession.delete({ where: { id: res.locals.authSessionId } }).catch(() => undefined);
  res.json({ success: true });
});
