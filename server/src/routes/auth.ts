import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import {
  requireAuth,
  setAuthCookie,
  clearAuthCookie,
  signToken,
  COOKIE_NAME,
  verifyToken,
} from '../middleware/auth';
import { validate, HttpError } from '../middleware/validate';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validation/schemas';
import { getEntitlement } from '../services/entitlements';
import { trackEvent } from '../services/analytics';
import { completeReferral } from './billing';

const router = Router();

function publicUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
}) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

router.post('/signup', validate(signupSchema), async (req, res) => {
  const { email, password, displayName } = req.body;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName, profile: { create: {} } },
  });
  const token = signToken(publicUser(user));
  setAuthCookie(res, token);
  trackEvent(user.id, 'signup_completed', {}).catch(() => {});
  // Bearer token for the native app (web keeps using the HTTP-only cookie).
  res.status(201).json({ user: publicUser(user), token });
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new HttpError(403, 'This account has been deactivated');
  const token = signToken(publicUser(user));
  setAuthCookie(res, token);
  // Bearer token for the native app (web keeps using the HTTP-only cookie).
  res.json({ user: publicUser(user), token });
});

router.get('/token', requireAuth, async (req, res) => {
  // Issues the current JWT so the socket.io client can authenticate its handshake.
  res.json({ token: signToken(publicUser(req.user!)) });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const [user, entitlement] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { profile: true, skills: { include: { skill: true } } },
    }),
    getEntitlement(req.user!.id),
  ]);
  if (!user) throw new HttpError(404, 'User not found');
  res.json({
    user: {
      ...publicUser(user),
      profile: user.profile,
      skills: user.skills,
      tier: entitlement.tier,
      entitlement: {
        tier: entitlement.tier,
        gold: entitlement.gold,
        elite: entitlement.elite,
        spotlightCredits: entitlement.spotlightCredits,
        activeBoost: entitlement.activeBoost,
        activeSpotlight: entitlement.activeSpotlight,
        limits: entitlement.limits,
        usage: entitlement.usage,
        advancedFilters: entitlement.advancedFilters,
        profileAnalytics: entitlement.profileAnalytics,
        demandAnalytics: entitlement.demandAnalytics,
      },
    },
  });
});

/**
 * Forgot password. Without an email provider, we return the reset token
 * directly in development so the flow is testable end-to-end.
 */
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Do not reveal account existence.
    return res.json({ ok: true });
  }
  const token = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  getResets().set(resetTokenHash, { userId: user.id, expires: Date.now() + 3600_000 });
  res.json({
    ok: true,
    ...(env.nodeEnv !== 'production' ? { resetToken: token } : {}),
  });
});

router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body;
  const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const entry = getResets().get(resetTokenHash);
  if (!entry || entry.expires < Date.now()) {
    throw new HttpError(400, 'Invalid or expired reset token');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: entry.userId }, data: { passwordHash } });
  getResets().delete(resetTokenHash);
  res.json({ ok: true });
});

function getResets(): Map<string, { userId: string; expires: number }> {
  const g = globalThis as unknown as {
    __passwordResets?: Map<string, { userId: string; expires: number }>;
  };
  if (!g.__passwordResets) g.__passwordResets = new Map();
  return g.__passwordResets;
}

export default router;
