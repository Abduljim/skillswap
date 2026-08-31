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
import { sendMail, passwordResetEmail, mailConfigured } from '../services/mailer';

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
 * Forgot password. Always returns ok (never reveals account existence).
 * Sends a branded reset email via SMTP when configured; in development the
 * reset link is also returned in the response so the flow is testable.
 */
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // Invalidate any previous pending tokens for this user.
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 3600_000); // 1 hour

    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetUrl = `${env.clientUrl}/reset-password?token=${token}`;
    const mail = passwordResetEmail(resetUrl, user.displayName);
    await sendMail({ to: user.email, ...mail });

    return res.json({
      ok: true,
      // Dev convenience only — never leak the token in production.
      ...(env.nodeEnv !== 'production' ? { resetToken: token } : {}),
      ...(mailConfigured() ? {} : { note: 'SMTP not configured; email logged to server console.' }),
    });
  }

  // Do not reveal account existence.
  return res.json({ ok: true });
});

router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const entry = await prisma.passwordReset.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!entry || entry.usedAt || entry.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, 'Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: entry.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: entry.id }, data: { usedAt: new Date() } }),
  ]);

  res.json({ ok: true });
});

export default router;
