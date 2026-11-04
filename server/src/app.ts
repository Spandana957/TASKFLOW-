import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { config, emailConfigured, pushConfigured } from './config.js';
import { schedulerMode } from './services/reminders.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import noteRoutes from './routes/notes.js';
import reminderRoutes, { notifications } from './routes/reminders.js';
import { analytics, goals, time } from './routes/productivity.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(db === 'connected' ? 200 : 503).json({
      ok: db === 'connected',
      db,
      email: emailConfigured() ? 'configured' : 'not_configured',
      push: pushConfigured() ? 'configured' : 'not_configured',
      scheduler: schedulerMode(),
    });
  });
  app.use(
    '/api/auth',
    rateLimit({ windowMs: 15 * 60_000, limit: 100, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' }),
    authRoutes,
  );
  app.use('/api/tasks', requireAuth, taskRoutes);
  app.use('/api/notes', requireAuth, noteRoutes);
  app.use('/api/reminders', requireAuth, reminderRoutes);
  app.use('/api/notifications', requireAuth, notifications);
  app.use('/api/time', requireAuth, time);
  app.use('/api/goals', requireAuth, goals);
  app.use('/api/analytics', requireAuth, analytics);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
