import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { env } from './config/env.js';
import { crudRouter } from './routes/crud.js';
import { reportsRouter } from './routes/reports.js';
import { uploadsRouter } from './routes/uploads.js';
import { emailRouter } from './routes/email.js';
import { errorHandler } from './middleware/error.js';
import { settingsRouter } from './routes/settings.js';
import { searchRouter } from './routes/search.js';
import { authRouter } from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';
import { prisma } from './lib/prisma.js';
import { workflowsRouter } from './routes/workflows.js';

export const app = express();
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow cross-origin static file serving
}));
const configuredOrigins = (env.CORS_ORIGIN ?? env.FRONTEND_URL)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174', 'http://localhost:5175', 'http://127.0.0.1:5175'];
const allowedOrigins = new Set([...configuredOrigins, ...localOrigins]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '16mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.get('/', (_req, res) => res.json({ ok: true, service: 'Europa CRM API', ui: 'http://localhost:5173', health: '/api/health' }));
app.get('/api/health', async (_req, res) => {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'europa-crm-api', database: 'connected', latencyMs: Date.now() - started, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ ok: false, service: 'europa-crm-api', database: 'unavailable', message: error instanceof Error ? error.message : 'Database connection failed', timestamp: new Date().toISOString() });
  }
});
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);
app.use('/api/workflows', workflowsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/email', emailRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/search', searchRouter);
app.use('/api', crudRouter);
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));
app.use(errorHandler);
