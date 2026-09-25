import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { readSystemSettings } from '../routes/settings.js';

import { prisma } from '../lib/prisma.js';
import { sendViaGoogleGmail } from './googleGmail.js';

type MailModule = 'sales' | 'it' | 'bench' | 'ai';
const moduleConfig = {
  sales: { env: 'SALES', settings: 'sales' },
  it: { env: 'RECRUITER', settings: 'recruiter' },
  bench: { env: 'BENCHSALES', settings: 'benchsales' },
  ai: { env: 'AITEAM', settings: 'aiteam' },
} as const;
function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }

async function configuration(module: MailModule, userObject?: any) {
  const settings = await readSystemSettings().catch(() => null) as Record<string, unknown> | null;
  const config = moduleConfig[module];
  const envMap = env as unknown as Record<string, unknown>;

  // 1. Try personal user-specific SMTP settings first
  let host = text(userObject?.smtpHost);
  let configuredPort = Number(userObject?.smtpPort || 0);
  let user = text(userObject?.smtpUser);
  let pass = text(userObject?.smtpPass);
  let from = text(userObject?.smtpFrom);

  // 2. Fall back to department-specific settings
  if (!host) host = text(settings?.[`${config.settings}SmtpHost`]) || text(envMap[`${config.env}_SMTP_HOST`]);
  if (!configuredPort) configuredPort = Number(text(settings?.[`${config.settings}SmtpPort`]) || envMap[`${config.env}_SMTP_PORT`]);
  if (!user) user = text(settings?.[`${config.settings}SmtpUser`]) || text(envMap[`${config.env}_SMTP_USER`]);
  if (!pass) pass = text(settings?.[`${config.settings}SmtpPass`]) || text(envMap[`${config.env}_SMTP_PASS`]);
  if (!from) from = text(settings?.[`${config.settings}SmtpFrom`]) || text(envMap[`${config.env}_SMTP_FROM`]);

  // 3. Fall back to global settings or any configured department
  if (!host) host = text(settings?.smtpHost) || text(envMap.SMTP_HOST) || text(envMap.BENCHSALES_SMTP_HOST) || text(envMap.SALES_SMTP_HOST) || 'smtp.gmail.com';
  if (!configuredPort) configuredPort = Number(text(settings?.smtpPort) || envMap.SMTP_PORT || envMap.BENCHSALES_SMTP_PORT || envMap.SALES_SMTP_PORT || 587);
  if (!user) user = text(settings?.smtpUser) || text(envMap.SMTP_USER) || text(envMap.BENCHSALES_SMTP_USER) || text(envMap.SALES_SMTP_USER);
  if (!pass) pass = text(settings?.smtpPass) || text(envMap.SMTP_PASS) || text(envMap.BENCHSALES_SMTP_PASS) || text(envMap.SALES_SMTP_PASS);
  if (!from) from = text(settings?.smtpFrom) || text(envMap.SMTP_FROM) || text(envMap.BENCHSALES_SMTP_FROM) || text(envMap.SALES_SMTP_FROM) || user;

  const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 587;

  if (!host || !user || !pass || !from) {
    throw Object.assign(new Error(`Outbound email credentials are not configured. To send real emails, please provide your email & App Password in Settings → SMTP Setup or in backend/.env`), { statusCode: 503 });
  }
  return { host, port, user, pass, from };
}

async function transport(module: MailModule, userObject?: any) {
  const config = await configuration(module, userObject);
  const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, auth: { user: config.user, pass: /(^|\.)gmail\.com$/i.test(config.host) ? config.pass.replace(/\s+/g, '') : config.pass }, requireTLS: config.port === 587, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000, tls: { minVersion: 'TLSv1.2', servername: config.host } });
  return { transporter, config };
}

export async function checkMailConnection(module: MailModule, userObject?: any) {
  if (userObject?.id) {
    const googleAccount = await prisma.emailAccount.findFirst({
      where: { userId: userObject.id, provider: 'GOOGLE', isActive: true },
    });
    if (googleAccount) {
      return { success: true, sender: googleAccount.emailAddress, module, provider: 'GOOGLE' };
    }
  }

  try {
    const { transporter, config } = await transport(module, userObject);
    try {
      await transporter.verify();
      return { success: true, sender: config.from, module, provider: 'SMTP' };
    } finally {
      transporter.close();
    }
  } catch (err) {
    console.log(`[MOCK SMTP CHECK] Module ${module} is using mock fallback: ${(err as Error).message}`);
    return { success: true, sender: `mock-${module}@europacrm.local`, module, provider: 'MOCK' };
  }
}

export async function sendMail(module: MailModule, to: string, subject: string, body: string, cc?: string | string[], attachments?: Array<{ filename: string; content: string; contentType?: string }>, userObject?: any, fromAddress?: string) {
  // 1. If the logged in CRM user has connected their Gmail account via Google OAuth, send using Gmail API!
  if (userObject?.id) {
    const googleAccount = await prisma.emailAccount.findFirst({
      where: { userId: userObject.id, provider: 'GOOGLE', isActive: true },
    });

    if (googleAccount) {
      try {
        console.log(`[Email] Dispatching via Gmail OAuth for user ${userObject.name || userObject.id} (${googleAccount.emailAddress})`);
        const result = await sendViaGoogleGmail(googleAccount, to, subject, body, cc, attachments, userObject);
        return { ...result, module };
      } catch (gmailError) {
        console.error('[Email] Gmail OAuth sending failed:', gmailError);
        const errorMsg = gmailError instanceof Error ? gmailError.message : 'Unknown Gmail API error';
        throw Object.assign(new Error(`Failed to deliver email through connected Gmail account (${googleAccount.emailAddress}): ${errorMsg}`), { statusCode: 400 });
      }
    }
  }

  // 2. Otherwise fall back to SMTP transport
  const senderEmail = fromAddress?.trim() || userObject?.email || `bench@europacrm.local`;
  let transporterInfo;
  try {
    transporterInfo = await transport(module, userObject);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'SMTP is not configured';
    throw Object.assign(new Error(`Cannot deliver email to ${to}: ${errorMsg}. Please connect your personal Gmail account in Settings → Email Accounts, or configure SMTP credentials.`), { statusCode: 400 });
  }

  const { transporter, config } = transporterInfo;
  try {
    const activeFrom = fromAddress?.trim() ? `"${fromAddress.split('@')[0]}" <${config.user || config.from}>` : config.from;
    const info = await transporter.sendMail({
      from: activeFrom,
      to,
      cc,
      replyTo: fromAddress?.trim() || config.from,
      subject,
      text: body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      html: body,
      attachments: attachments?.map((item) => ({ filename: item.filename, content: item.content, contentType: item.contentType, encoding: 'base64' })),
    });
    return { success: true, messageId: info.messageId, sender: activeFrom, module };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown SMTP transmission error';
    throw Object.assign(new Error(`Email delivery to ${to} failed on SMTP server (${config.host}:${config.port}): ${detail}. Check your email address, port, and App Password.`), { statusCode: 400 });
  } finally {
    transporter.close();
  }
}
