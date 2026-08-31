import 'dotenv/config';

const extraOrigins = (process.env.EXTRA_CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const env = {
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  serverUrl: process.env.SERVER_URL || 'http://localhost:4000',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  // The Android app (Capacitor, scheme https) calls the API from this origin.
  corsOrigins: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'https://app.skillswap.mobile',
    ...extraOrigins,
  ],
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'SkillSwap <no-reply@skillswap.app>',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
