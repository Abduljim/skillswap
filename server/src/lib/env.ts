import 'dotenv/config';

const extraOrigins = (process.env.EXTRA_CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const env = {
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  serverUrl: process.env.SERVER_URL || 'http://localhost:4000',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  // The Android app (Capacitor, scheme https) calls the API from this origin.
  corsOrigins: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'https://app.skillswap.mobile',
    ...extraOrigins,
  ],
};
