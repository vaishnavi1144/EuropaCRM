import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { Stream } from 'node:stream';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/crypto.js';

export function getOAuth2Client() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth Client ID and Secret are not configured in backend/.env');
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

export function generateGoogleAuthUrl(userId: string): string {
  const oauth2Client = getOAuth2Client();
  const state = encrypt(JSON.stringify({ userId, timestamp: Date.now() }));
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
    state,
  });
}

export async function handleGoogleOAuthCallback(code: string, state: string) {
  const decryptedState = decrypt(state);
  let parsedState: { userId: string; timestamp: number };
  try {
    parsedState = JSON.parse(decryptedState);
  } catch {
    throw new Error('Invalid or corrupted OAuth state. Please try connecting again.');
  }

  const { userId } = parsedState;
  if (!userId) {
    throw new Error('User identity missing in OAuth state.');
  }

  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const grantedScope = tokens.scope || '';
  const hasGmailSend =
    grantedScope.includes('gmail.send') ||
    grantedScope.includes('mail.google.com') ||
    grantedScope.includes('gmail.modify');

  if (!hasGmailSend) {
    throw new Error(
      "Gmail send permission was not granted. When Google prompts for permissions, ensure you select all checkboxes (Send email and View email messages) before clicking Continue."
    );
  }

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: userInfo } = await oauth2.userinfo.get();
  const emailAddress = userInfo.email;

  if (!emailAddress) {
    throw new Error('Could not retrieve email address from Google.');
  }

  const existing = await prisma.emailAccount.findFirst({
    where: { userId, provider: 'GOOGLE' },
  });

  const encryptedRefreshToken = tokens.refresh_token
    ? encrypt(tokens.refresh_token)
    : existing?.refreshToken;

  if (!encryptedRefreshToken) {
    throw new Error('Google did not return a refresh token. Please revoke access in your Google Account security settings and reconnect.');
  }

  const emailAccount = await prisma.emailAccount.upsert({
    where: {
      userId_provider: { userId, provider: 'GOOGLE' },
    },
    update: {
      emailAddress,
      accessToken: tokens.access_token || null,
      refreshToken: encryptedRefreshToken,
      scope: tokens.scope || null,
      tokenType: tokens.token_type || null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      isActive: true,
    },
    create: {
      userId,
      provider: 'GOOGLE',
      emailAddress,
      accessToken: tokens.access_token || null,
      refreshToken: encryptedRefreshToken,
      scope: tokens.scope || null,
      tokenType: tokens.token_type || null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      isActive: true,
    },
  });

  return { emailAccount, emailAddress };
}

async function streamToBuffer(stream: Stream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}

export async function sendViaGoogleGmail(
  emailAccount: any,
  to: string,
  subject: string,
  body: string,
  cc?: string | string[],
  attachments?: Array<{ filename: string; content: string; contentType?: string }>,
  userObject?: any
) {
  const refreshToken = decrypt(emailAccount.refreshToken);
  if (!refreshToken) {
    throw new Error('Google refresh token is missing. Please reconnect your Gmail account in Settings.');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: emailAccount.accessToken || undefined,
  });

  const gmail = google.gmail({
    version: 'v1',
    auth: oauth2Client,
  });

  const senderName = userObject?.name || 'Europa CRM';
  const senderEmail = emailAccount.emailAddress;
  const activeFrom = `"${senderName}" <${senderEmail}>`;

  // Build RFC 2822 MIME message using Nodemailer stream transport
  const streamTransporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'windows',
  });

  const mailOptions = {
    from: activeFrom,
    to,
    cc,
    subject,
    text: body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    html: body,
    attachments: attachments?.map((item) => ({
      filename: item.filename,
      content: item.content,
      contentType: item.contentType,
      encoding: 'base64',
    })),
  };

  const mailInfo = await streamTransporter.sendMail(mailOptions);
  const rawBuffer = await streamToBuffer(mailInfo.message as Stream);
  const encodedMessage = rawBuffer.toString('base64url');

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  return {
    success: true,
    messageId: result.data.id || result.data.threadId || `gmail-${Date.now()}`,
    threadId: result.data.threadId || null,
    sender: activeFrom,
    provider: 'GOOGLE',
  };
}

export async function syncIncomingGmailMessages(userId: string, module: string) {
  const emailAccount = await prisma.emailAccount.findFirst({
    where: { userId, provider: 'GOOGLE', isActive: true },
  });
  if (!emailAccount) return { synced: 0, reason: 'no_connected_account' };

  const refreshToken = decrypt(emailAccount.refreshToken);
  if (!refreshToken) return { synced: 0, reason: 'missing_refresh_token' };

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: emailAccount.accessToken || undefined,
  });

  oauth2Client.on('tokens', async (newTokens) => {
    try {
      await prisma.emailAccount.update({
        where: { id: emailAccount.id },
        data: {
          accessToken: newTokens.access_token || emailAccount.accessToken,
          expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : undefined,
        },
      });
    } catch (_) {}
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'label:INBOX',
      maxResults: 25,
    });

    const messages = listRes.data.messages || [];
    let syncedCount = 0;

    for (const item of messages) {
      if (!item.id) continue;

      const existing = await prisma.emailMessage.findFirst({
        where: { messageId: item.id },
      });
      if (existing) continue;

      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: item.id,
        format: 'full',
      });

      const headers = detail.data.payload?.headers || [];
      const getHeader = (name: string) => {
        const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
        return h?.value || '';
      };

      const fromRaw = getHeader('From');
      const toRaw = getHeader('To') || emailAccount.emailAddress;
      const ccRaw = getHeader('Cc') || null;
      const subject = getHeader('Subject') || '(No Subject)';
      const dateRaw = getHeader('Date');
      const sentAt = dateRaw ? new Date(dateRaw) : new Date();

      let fromName: string | null = null;
      let fromEmail = fromRaw;
      const match = fromRaw.match(/^(.*?)\s*<(.+?)>$/);
      if (match) {
        fromName = match[1].replace(/["']/g, '').trim();
        fromEmail = match[2].trim();
      }

      let body = '';
      const extractBody = (part: any): string => {
        if (!part) return '';
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64url').toString('utf-8');
        }
        if (part.mimeType === 'text/plain' && part.body?.data && !body) {
          return Buffer.from(part.body.data, 'base64url').toString('utf-8');
        }
        if (part.parts && Array.isArray(part.parts)) {
          for (const subPart of part.parts) {
            const found = extractBody(subPart);
            if (found) return found;
          }
        }
        return '';
      };

      body = extractBody(detail.data.payload);
      if (!body && detail.data.snippet) {
        body = detail.data.snippet;
      }

      const attachments: Array<{ filename: string; contentType?: string; sizeText?: string }> = [];
      const collectAttachments = (part: any) => {
        if (!part) return;
        if (part.filename && part.body?.attachmentId) {
          const sizeBytes = part.body.size || 0;
          const sizeText = sizeBytes > 1024 * 1024
            ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
          attachments.push({
            filename: part.filename,
            contentType: part.mimeType,
            sizeText,
          });
        }
        if (part.parts && Array.isArray(part.parts)) {
          for (const p of part.parts) collectAttachments(p);
        }
      };
      collectAttachments(detail.data.payload);

      const isRead = !detail.data.labelIds?.includes('UNREAD');
      const isStarred = Boolean(detail.data.labelIds?.includes('STARRED'));
      const snippet = detail.data.snippet || body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);

      await prisma.emailMessage.create({
        data: {
          module,
          folder: 'inbox',
          fromEmail,
          fromName,
          toEmail: toRaw,
          ccEmail: ccRaw,
          subject,
          body,
          snippet,
          attachments: attachments.length ? attachments : null,
          isRead,
          isStarred,
          status: 'Received',
          messageId: item.id,
          customData: (item.threadId || detail.data.threadId) ? { threadId: item.threadId || detail.data.threadId } : null,
          ownerUserId: userId,
          ownerName: fromName || fromEmail,
          sentAt,
        },
      });
      syncedCount++;
    }

    return { synced: syncedCount, total: messages.length };
  } catch (err: any) {
    if (err.code === 403 || err.message?.includes('insufficient') || err.message?.includes('permission')) {
      console.warn('[Gmail Sync] Missing gmail.readonly scope. Reconnect required in Settings.');
      return { synced: 0, reason: 'insufficient_scope' };
    }
    console.error('[Gmail Sync Error]:', err.message);
    return { synced: 0, error: err.message };
  }
}

