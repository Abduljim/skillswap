import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './lib/env';
import { HttpError } from './middleware/validate';

import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import skillRoutes from './routes/skills';
import matchRoutes from './routes/matches';
import requestRoutes from './routes/requests';
import exchangeRoutes from './routes/exchanges';
import notificationRoutes from './routes/notifications';
import safetyRoutes from './routes/safety';
import adminRoutes from './routes/admin';
import billingRoutes from './routes/billing';
import savedMatchRoutes from './routes/savedMatches';
import analyticsRoutes from './routes/analytics';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // basic rate limiting on auth endpoints
  app.use(
    ['/api/auth/login', '/api/auth/signup', '/api/auth/forgot-password', '/api/auth/reset-password'],
    rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false })
  );

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'skillswap' }));

  app.use('/api/auth', authRoutes);
  app.use('/api', profileRoutes);
  app.use('/api', skillRoutes);
  app.use('/api', matchRoutes);
  app.use('/api', requestRoutes);
  app.use('/api', exchangeRoutes);
  app.use('/api', notificationRoutes);
  app.use('/api', safetyRoutes);
  app.use('/api', adminRoutes);
  app.use('/api', billingRoutes);
  app.use('/api', savedMatchRoutes);
  app.use('/api', analyticsRoutes);

  // 404
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
