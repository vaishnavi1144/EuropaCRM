import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export type GmailAddress = { name?: string; email: string };

export type GmailMessagePayload = {
  id: string;
  threadId: string;
  snippet: string;
  labelIds: string[];
  internalDate: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string;
  attachments: { filename: string; mimeType: string; size: number; attachmentId: string }[];
};

export class GmailError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.statusCode = statusCode;
  }
}

function encryptionKey() {
  const secret = env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new GmailError('GOOGLE_TOKEN_ENCRYPTION_KEY must be set to at least 32 characters to store Gmail tokens.', 500);
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptToken(value: string) {
  const [iv, tag, payload] = value.split(':');
  if (!iv || !tag || !payload) throw new GmailError('Stored Gmail token is corrupted. Reconnect the account.', 500);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]).toString('utf8');
}

export function assertGoogleOAuthConfigured() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new GmailError('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', 500);
  }
}

export function buildAuthUrl(state: string) {
  assertGoogleOAuthConfigured();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID as string,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GMAIL_SCOPES.join(' '),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string; token_type: string };

async function tokenRequest(body: Record<string, string>) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const payload = (await response.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!response.ok) throw new GmailError(payload.error_description ?? payload.error ?? 'Google token request failed');
  return payload;
}

export async function exchangeCodeForTokens(code: string) {
  assertGoogleOAuthConfigured();
  return tokenRequest({
    code,
    client_id: env.GOOGLE_CLIENT_ID as string,
    client_secret: env.GOOGLE_CLIENT_SECRET as string,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    grant_type: 'authorization_code',
  });
}

async function refreshAccessToken(refreshToken: string) {
  assertGoogleOAuthConfigured();
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: env.GOOGLE_CLIENT_ID as string,
    client_secret: env.GOOGLE_CLIENT_SECRET as string,
    grant_type: 'refresh_token',
  });
}

export type StoredEmailAccount = {
  id: string;
  email: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
};

export async function getConnectedAccount(userId: string) {
  return prisma.emailAccount.findFirst({ where: { userId, provider: 'GMAIL', isActive: true }, orderBy: { updatedAt: 'desc' } });
}

export async function requireConnectedAccount(userId: string) {
  const account = await getConnectedAccount(userId);
  if (!account) throw new GmailError('No Gmail account connected. Connect one from Settings → Email Accounts.', 412);
  return account;
}

export async function getAccessToken(account: StoredEmailAccount) {
  const expiresAt = account.tokenExpiresAt?.getTime() ?? 0;
  if (account.accessToken && expiresAt - 60_000 > Date.now()) return decryptToken(account.accessToken);
  if (!account.refreshToken) throw new GmailError('Gmail authorization expired. Reconnect the account.', 401);
  const refreshed = await refreshAccessToken(decryptToken(account.refreshToken));
  await prisma.emailAccount.update({
    where: { id: account.id },
    data: {
      accessToken: encryptToken(refreshed.access_token),
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });
  return refreshed.access_token;
}

async function gmailFetch<T>(account: StoredEmailAccount, path: string, init: RequestInit = {}) {
  const token = await getAccessToken(account);
  const response = await fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as any)?.error?.message ?? 'Gmail request failed';
    throw new GmailError(message, response.status === 401 ? 401 : 502);
  }
  return payload as T;
}

export async function fetchProfileEmail(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  const payload = (await response.json()) as { email?: string; name?: string };
  if (!response.ok || !payload.email) throw new GmailError('Unable to read the Google account profile.');
  return { email: payload.email, name: payload.name };
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

export function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function splitAddresses(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type RawPart = { mimeType?: string; filename?: string; headers?: { name: string; value: string }[]; body?: { size?: number; data?: string; attachmentId?: string }; parts?: RawPart[] };

function walkParts(part: RawPart | undefined, result: { text: string; html: string; attachments: GmailMessagePayload['attachments'] }) {
  if (!part) return;
  const { mimeType, filename, body, parts } = part;
  if (filename && body?.attachmentId) {
    result.attachments.push({ filename, mimeType: mimeType ?? 'application/octet-stream', size: body.size ?? 0, attachmentId: body.attachmentId });
  } else if (body?.data && mimeType === 'text/plain') {
    result.text += decodeBase64Url(body.data);
  } else if (body?.data && mimeType === 'text/html') {
    result.html += decodeBase64Url(body.data);
  }
  parts?.forEach((child) => walkParts(child, result));
}

export function parseGmailMessage(raw: any): GmailMessagePayload {
  const headers: { name: string; value: string }[] = raw?.payload?.headers ?? [];
  const header = (name: string) => headers.find((item) => item.name.toLowerCase() === name)?.value ?? '';
  const content = { text: '', html: '', attachments: [] as GmailMessagePayload['attachments'] };
  walkParts(raw?.payload, content);
  return {
    id: raw.id,
    threadId: raw.threadId,
    snippet: raw.snippet ?? '',
    labelIds: raw.labelIds ?? [],
    internalDate: raw.internalDate ?? String(Date.now()),
    from: header('from'),
    to: splitAddresses(header('to')),
    cc: splitAddresses(header('cc')),
    bcc: splitAddresses(header('bcc')),
    subject: header('subject'),
    bodyText: content.text,
    bodyHtml: content.html,
    attachments: content.attachments,
  };
}

export function buildRawMessage(input: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
  attachments?: { filename: string; content: string; contentType?: string }[];
}) {
  const boundary = `europa_${randomBytes(12).toString('hex')}`;
  const attachments = input.attachments ?? [];
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to.join(', ')}`,
    ...(input.cc?.length ? [`Cc: ${input.cc.join(', ')}`] : []),
    ...(input.bcc?.length ? [`Bcc: ${input.bcc.join(', ')}`] : []),
    `Subject: ${input.subject}`,
    ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`, `References: ${input.references ?? input.inReplyTo}`] : []),
    'MIME-Version: 1.0',
  ];
  if (!attachments.length) {
    return encodeBase64Url([...headers, 'Content-Type: text/html; charset="UTF-8"', '', input.body].join('\r\n'));
  }
  const parts = [
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    input.body,
    ...attachments.flatMap((attachment) => [
      `--${boundary}`,
      `Content-Type: ${attachment.contentType ?? 'application/octet-stream'}; name="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      attachment.content,
    ]),
    `--${boundary}--`,
  ];
  return encodeBase64Url([...headers, ...parts].join('\r\n'));
}

export async function gmailSend(account: StoredEmailAccount, raw: string, threadId?: string | null) {
  return gmailFetch<{ id: string; threadId: string }>(account, '/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
  });
}

export async function gmailCreateDraft(account: StoredEmailAccount, raw: string, threadId?: string | null) {
  return gmailFetch<{ id: string; message: { id: string; threadId: string } }>(account, '/drafts', {
    method: 'POST',
    body: JSON.stringify({ message: { raw, ...(threadId ? { threadId } : {}) } }),
  });
}

export async function gmailListMessageIds(account: StoredEmailAccount, query: string, maxResults = 50) {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (query) params.set('q', query);
  const payload = await gmailFetch<{ messages?: { id: string; threadId: string }[] }>(account, `/messages?${params.toString()}`);
  return payload?.messages ?? [];
}

export async function gmailGetMessage(account: StoredEmailAccount, id: string) {
  return parseGmailMessage(await gmailFetch<any>(account, `/messages/${id}?format=full`));
}

export async function gmailModify(account: StoredEmailAccount, id: string, addLabelIds: string[], removeLabelIds: string[]) {
  return gmailFetch<any>(account, `/messages/${id}/modify`, { method: 'POST', body: JSON.stringify({ addLabelIds, removeLabelIds }) });
}

export async function gmailTrash(account: StoredEmailAccount, id: string) {
  return gmailFetch<any>(account, `/messages/${id}/trash`, { method: 'POST' });
}

export async function gmailGetAttachment(account: StoredEmailAccount, messageId: string, attachmentId: string) {
  return gmailFetch<{ data: string; size: number }>(account, `/messages/${messageId}/attachments/${attachmentId}`);
}
