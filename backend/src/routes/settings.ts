import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hasPermission } from '../lib/permissions.js';

export const settingsRouter = Router();
settingsRouter.use((_req, res, next) => {
  if (hasPermission(res.locals.authUser ?? {}, 'settings')) return next();
  return res.status(403).json({ message: 'You do not have access to system settings.' });
});

const settingsSchema = z.object({
  companyName: z.string().min(1).max(200),
  timezone: z.string().min(1).max(100),
  currency: z.string().min(1).max(30),
  smtpHost: z.string().max(200).optional().default(''),
  smtpPort: z.string().regex(/^\d{1,5}$/).optional().default('587'),
  smtpUser: z.string().max(200).optional().default(''),
  smtpPass: z.string().max(500).optional().default(''),
  smtpFrom: z.string().max(200).optional().default(''),
  s3Bucket: z.string().max(200).optional().default(''),
  s3Region: z.string().max(100).optional().default('ap-south-1'),
  s3AccessKey: z.string().max(500).optional().default(''),
  s3SecretKey: z.string().max(500).optional().default(''),
  mfaEnabled: z.boolean().default(false),
  rolePartitioning: z.boolean().default(true),
});

export const defaultSystemSettings = {
  companyName: 'Europa CRM',
  timezone: 'Asia/Kolkata (GMT+05:30)',
  currency: 'INR (₹)',
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  s3Bucket: '',
  s3Region: 'ap-south-1',
  s3AccessKey: '',
  s3SecretKey: '',
  mfaEnabled: false,
  rolePartitioning: true,
};

export async function readSystemSettings() {
  const record = await prisma.appSetting.findUnique({ where: { key: 'system' } });
  const saved = record?.value && typeof record.value === 'object' && !Array.isArray(record.value)
    ? record.value as Record<string, unknown>
    : {};
  return { ...defaultSystemSettings, ...saved };
}

settingsRouter.get('/', async (_req, res, next) => {
  try {
    const settings = await readSystemSettings();
    const { smtpPass, s3AccessKey, s3SecretKey, ...safe } = settings;
    res.json({
      ...safe,
      smtpPass: '',
      s3AccessKey: '',
      s3SecretKey: '',
      smtpPassConfigured: Boolean(smtpPass),
      s3AccessKeyConfigured: Boolean(s3AccessKey),
      s3SecretKeyConfigured: Boolean(s3SecretKey),
    });
  } catch (error) { next(error); }
});

settingsRouter.put('/', async (req, res, next) => {
  try {
    const input = settingsSchema.parse(req.body);
    const current = await readSystemSettings();
    const value = {
      ...current,
      ...input,
      smtpPass: input.smtpPass || current.smtpPass,
      s3AccessKey: input.s3AccessKey || current.s3AccessKey,
      s3SecretKey: input.s3SecretKey || current.s3SecretKey,
    };
    const record = await prisma.appSetting.upsert({
      where: { key: 'system' },
      create: { key: 'system', value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    const saved = record.value as Record<string, unknown>;
    const { smtpPass, s3AccessKey, s3SecretKey, ...safe } = saved;
    res.json({
      ...safe,
      smtpPass: '',
      s3AccessKey: '',
      s3SecretKey: '',
      smtpPassConfigured: Boolean(smtpPass),
      s3AccessKeyConfigured: Boolean(s3AccessKey),
      s3SecretKeyConfigured: Boolean(s3SecretKey),
    });
  } catch (error) { next(error); }
});
