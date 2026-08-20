import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { GmailError, buildAuthUrl, encryptToken, exchangeCodeForTokens, fetchProfileEmail } from '../services/gmail.js';

export const emailAccountsRouter = Router();
export const emailAccountsPublicRouter = Router();

const pendingStates = new Map<string, { userId: string; expiresAt: number }>();

function rememberState(userId: string) {
  const state = randomBytes(24).toString('hex');
  pendingStates.set(state, { userId, expiresAt: Date.now() + 10 * 60_000 });
  for (const [key, value] of pendingStates) if (value.expiresAt <= Date.now()) pendingStates.delete(key);
  return state;
}

emailAccountsRouter.get('/', async (req, res, next) => {
  try {
    const data = await prisma.emailAccount.findMany({
      where: { userId: res.locals.authUser.id },
      select: { id: true, provider: true, email: true, displayName: true, isActive: true, lastSyncedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data, oauthConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) });
  } catch (error) {
    next(error);
  }
});

emailAccountsRouter.post('/oauth/start', async (req, res, next) => {
  try {
    res.json({ url: buildAuthUrl(rememberState(res.locals.authUser.id)) });
  } catch (error) {
    next(error);
  }
});

emailAccountsRouter.delete('/:id', async (req, res, next) => {
  try {
    const account = await prisma.emailAccount.findFirst({ where: { id: String(req.params.id), userId: res.locals.authUser.id } });
    if (!account) return res.status(404).json({ message: 'Email account not found' });
    await prisma.emailAccount.delete({ where: { id: account.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Google redirects the browser here without the app's bearer token, so this route is mounted
 * before `requireAuth` and authenticates through the one-time OAuth state instead.
 */
emailAccountsPublicRouter.get('/oauth/callback', async (req, res, next) => {
  try {
    const query = z.object({ code: z.string().min(1).optional(), state: z.string().min(1).optional(), error: z.string().optional() }).parse(req.query);
    const redirect = (status: string, message?: string) =>
      res.redirect(`${env.FRONTEND_URL}/settings?gmail=${status}${message ? `&message=${encodeURIComponent(message)}` : ''}`);
    if (query.error) return redirect('error', query.error);
    if (!query.code || !query.state) return redirect('error', 'Missing authorization code');
    const pending = pendingStates.get(query.state);
    pendingStates.delete(query.state);
    if (!pending || pending.expiresAt <= Date.now()) return redirect('error', 'Authorization link expired. Try connecting again.');

    const tokens = await exchangeCodeForTokens(query.code);
    const profile = await fetchProfileEmail(tokens.access_token);
    const data = {
      accessToken: encryptToken(tokens.access_token),
      ...(tokens.refresh_token ? { refreshToken: encryptToken(tokens.refresh_token) } : {}),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope ?? null,
      displayName: profile.name ?? null,
      isActive: true,
    };
    await prisma.emailAccount.upsert({
      where: { userId_provider_email: { userId: pending.userId, provider: 'GMAIL', email: profile.email } },
      update: data,
      create: { userId: pending.userId, provider: 'GMAIL', email: profile.email, ...data },
    });
    return redirect('connected');
  } catch (error) {
    if (error instanceof GmailError) {
      return res.redirect(`${env.FRONTEND_URL}/settings?gmail=error&message=${encodeURIComponent(error.message)}`);
    }
    next(error);
  }
});
