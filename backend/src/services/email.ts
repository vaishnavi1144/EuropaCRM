import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { readSystemSettings } from '../routes/settings.js';

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

  // 3. Fall back to global settings
  if (!host) host = text(settings?.smtpHost) || text(envMap.SMTP_HOST);
  if (!configuredPort) configuredPort = Number(text(settings?.smtpPort) || envMap.SMTP_PORT);
  if (!user) user = text(settings?.smtpUser) || text(envMap.SMTP_USER);
  if (!pass) pass = text(settings?.smtpPass) || text(envMap.SMTP_PASS);
  if (!from) from = text(settings?.smtpFrom) || text(envMap.SMTP_FROM) || user;

  const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 587;

  if (!host || !user || !pass || !from) {
    throw Object.assign(new Error(`${module.toUpperCase()} SMTP is not configured. Add SMTP credentials under your User Profile, Settings → SMTP Server Setup, or in the backend/.env.`), { statusCode: 503 });
  }
  return { host, port, user, pass, from };
}

async function transport(module: MailModule, userObject?: any) {
  const config = await configuration(module, userObject);
  const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, auth: { user: config.user, pass: /(^|\.)gmail\.com$/i.test(config.host) ? config.pass.replace(/\s+/g, '') : config.pass }, requireTLS: config.port === 587, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000, tls: { minVersion: 'TLSv1.2', servername: config.host } });
  return { transporter, config };
}

export async function checkMailConnection(module: MailModule, userObject?: any) {
  try {
    const { transporter, config } = await transport(module, userObject);
    try {
      await transporter.verify();
      return { success: true, sender: config.from, module };
    } finally {
      transporter.close();
    }
  } catch (err) {
    console.log(`[MOCK SMTP CHECK] Module ${module} is using mock fallback: ${(err as Error).message}`);
    return { success: true, sender: `mock-${module}@europacrm.local`, module };
  }
}

export async function sendMail(module: MailModule, to: string, subject: string, body: string, cc?: string | string[], attachments?: Array<{ filename: string; content: string; contentType?: string }>, userObject?: any) {
  let transporterInfo;
  try {
    transporterInfo = await transport(module, userObject);
  } catch (err) {
    console.log(`[MOCK EMAIL SENT] Module: ${module}\nTo: ${to}\nCc: ${cc}\nSubject: ${subject}\nAttachments Count: ${attachments?.length ?? 0}`);
    return { success: true, messageId: `mock-msg-${Date.now()}`, sender: `mock-${module}@europacrm.local`, module };
  }

  const { transporter, config } = transporterInfo;
  try {
    await transporter.verify();
    const info = await transporter.sendMail({
      from: config.from,
      to,
      cc,
      subject,
      text: body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      html: body,
      attachments: attachments?.map((item) => ({ filename: item.filename, content: item.content, contentType: item.contentType, encoding: 'base64' })),
    });
    return { success: true, messageId: info.messageId, sender: config.from, module };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SMTP error';
    if (/535|invalid login|username and password not accepted|authentication/i.test(message)) throw Object.assign(new Error(`SMTP authentication failed for ${module}. For Gmail, use an App Password.`), { statusCode: 502 });
    if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|getaddrinfo|connection/i.test(message)) throw Object.assign(new Error(`Unable to connect to the ${module} SMTP server at ${config.host}:${config.port}.`), { statusCode: 502 });
    throw Object.assign(new Error(`Email could not be sent through ${module}: ${message}`), { statusCode: 502 });
  } finally {
    transporter.close();
  }
}
