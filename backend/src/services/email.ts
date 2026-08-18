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

async function configuration(module: MailModule) {
  const settings = await readSystemSettings().catch(() => null) as Record<string, unknown> | null;
  const config = moduleConfig[module];
  const envMap = env as unknown as Record<string, unknown>;
  const configuredPort = Number(text(settings?.[`${config.settings}SmtpPort`]) || envMap[`${config.env}_SMTP_PORT`]);
  const host = text(settings?.[`${config.settings}SmtpHost`]) || text(envMap[`${config.env}_SMTP_HOST`]);
  const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 587;
  const user = text(settings?.[`${config.settings}SmtpUser`]) || text(envMap[`${config.env}_SMTP_USER`]);
  const pass = text(settings?.[`${config.settings}SmtpPass`]) || text(envMap[`${config.env}_SMTP_PASS`]);
  const from = text(settings?.[`${config.settings}SmtpFrom`]) || text(envMap[`${config.env}_SMTP_FROM`]) || user;
  if (!host || !user || !pass || !from) throw Object.assign(new Error(`${module.toUpperCase()} SMTP is not configured. Add its SMTP HOST, PORT, USER, PASS and FROM values in backend/.env.`), { statusCode: 503 });
  return { host, port, user, pass, from };
}

async function transport(module: MailModule) {
  const config = await configuration(module);
  const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, auth: { user: config.user, pass: /(^|\.)gmail\.com$/i.test(config.host) ? config.pass.replace(/\s+/g, '') : config.pass }, requireTLS: config.port === 587, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000, tls: { minVersion: 'TLSv1.2', servername: config.host } });
  return { transporter, config };
}

export async function checkMailConnection(module: MailModule) {
  const { transporter, config } = await transport(module);
  try { await transporter.verify(); return { success: true, sender: config.from, module }; }
  finally { transporter.close(); }
}

export async function sendMail(module: MailModule, to: string, subject: string, body: string, cc?: string | string[], attachments?: Array<{ filename: string; content: string; contentType?: string }>) {
  const { transporter, config } = await transport(module);
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
  } finally { transporter.close(); }
}
