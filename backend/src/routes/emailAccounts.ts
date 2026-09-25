import { Router } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import {
  generateGoogleAuthUrl,
  handleGoogleOAuthCallback,
} from '../services/googleGmail.js';

export const emailAccountsRouter = Router();

// Public callback endpoint from Google OAuth
emailAccountsRouter.get('/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('Google OAuth error:', error);
    return res.redirect(`${env.FRONTEND_URL}/settings?tab=email-accounts&error=${encodeURIComponent(String(error))}`);
  }

  if (!code || !state) {
    return res.redirect(`${env.FRONTEND_URL}/settings?tab=email-accounts&error=missing_code_or_state`);
  }

  try {
    const { emailAddress, emailAccount } = await handleGoogleOAuthCallback(String(code), String(state));
    console.log(`[Google OAuth] Connected Gmail account: ${emailAddress}`);
    const user = await prisma.user.findUnique({ where: { id: emailAccount.userId } });
    const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
    const redirectUrl = isAdmin
      ? `${env.FRONTEND_URL}/settings?tab=email-accounts&connected=google&email=${encodeURIComponent(emailAddress)}`
      : `${env.FRONTEND_URL}/?connected=google&email=${encodeURIComponent(emailAddress)}`;
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('[Google OAuth] Callback failed:', err);
    const message = err instanceof Error ? err.message : 'Authentication failed';
    return res.redirect(
      `${env.FRONTEND_URL}/?error=${encodeURIComponent(message)}`
    );
  }
});

// All following endpoints require authenticated user session
emailAccountsRouter.use(requireAuth);

// Get current user's connected email accounts
emailAccountsRouter.get('/', async (_req, res, next) => {
  try {
    const accounts = await prisma.emailAccount.findMany({
      where: {
        userId: res.locals.authUser.id,
        isActive: true,
      },
      select: {
        id: true,
        provider: true,
        emailAddress: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ data: accounts });
  } catch (e) {
    next(e);
  }
});

// Get Google OAuth connect URL
emailAccountsRouter.get('/google/connect', async (_req, res, next) => {
  try {
    const url = generateGoogleAuthUrl(res.locals.authUser.id);
    res.json({ url });
  } catch (e) {
    next(e);
  }
});

// Disconnect Google account
emailAccountsRouter.post('/google/disconnect', async (_req, res, next) => {
  try {
    await prisma.emailAccount.deleteMany({
      where: {
        userId: res.locals.authUser.id,
        provider: 'GOOGLE',
      },
    });

    res.json({ success: true, message: 'Google account disconnected successfully.' });
  } catch (e) {
    next(e);
  }
});
