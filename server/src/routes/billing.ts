import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { withEntitlement } from '../middleware/tier';
import { validate, HttpError } from '../middleware/validate';
import {
  TIER_CONFIG,
  getFeatureFlags,
  getEntitlement,
  tryConsume,
  peekLimit,
  UsageKey,
} from '../services/entitlements';
import {
  verifyAndGrantSubscription,
  cancelSubscription,
} from '../services/subscription';
import {
  verifyProductPurchase,
  billingConfigured,
  devIssueToken,
} from '../services/billing';
import { trackEvent } from '../services/analytics';
import { z } from 'zod';

const router = Router();

router.use(requireAuth);

// ---------------------------------------------------------------------------
// Catalogue: plans & boosts (prices shown from server config; Play is the
// source of truth at checkout — PRD §12, §35)
// ---------------------------------------------------------------------------

router.get('/billing/catalog', withEntitlement, async (req, res) => {
  const ent = req.entitlement!;
  const flags = getFeatureFlags();
  const [plans, boosts] = await Promise.all([
    prisma.subscriptionProduct.findMany({
      where: { isActive: true },
      orderBy: [{ tier: 'asc' }, { billingPeriod: 'asc' }],
    }),
    flags.boostsEnabled
      ? prisma.boostProduct.findMany({ where: { isActive: true } })
      : Promise.resolve([]),
  ]);
  res.json({
    plans: plans
      .filter((p) => (p.tier === 'GOLD' ? flags.goldEnabled : flags.eliteEnabled))
      .map((p) => ({
        id: p.id,
        tier: p.tier,
        billingPeriod: p.billingPeriod,
        googleProductId: p.googleProductId,
        displayPrice: p.displayPrice,
      })),
    boosts: boosts.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      type: b.type,
      durationHours: b.durationHours,
      price: b.price,
      googleProductId: b.googleProductId,
    })),
    tiers: TIER_CONFIG,
    currentTier: ent.tier,
    flags,
  });
});

// ---------------------------------------------------------------------------
// Subscription purchase: frontend submits the Play purchase token; the
// backend verifies it with Google and grants the entitlement (PRD §13).
// ---------------------------------------------------------------------------

const purchaseSchema = z.object({
  productId: z.string().min(3).max(120),
  purchaseToken: z.string().min(3).max(2048),
  basePlanId: z.string().max(120).optional().nullable(),
});

const boostPurchaseSchema = z.object({
  productId: z.string().min(3).max(120),
  purchaseToken: z.string().min(3).max(2048),
});

function tierFromProductId(productId: string): 'GOLD' | 'ELITE' | null {
  const p = productId.toLowerCase();
  if (p.includes('gold')) return 'GOLD';
  if (p.includes('elite')) return 'ELITE';
  return null;
}

router.post('/billing/subscriptions', withEntitlement, validate(purchaseSchema), async (req, res) => {
  const { productId, purchaseToken, basePlanId } = req.body;

  const product = await prisma.subscriptionProduct.findUnique({ where: { googleProductId: productId } });
  if (!product || !product.isActive) throw new HttpError(404, 'Unknown subscription product');

  const flags = getFeatureFlags();
  if (product.tier === 'GOLD' && !flags.goldEnabled) throw new HttpError(403, 'Gold is not available');
  if (product.tier === 'ELITE' && !flags.eliteEnabled) throw new HttpError(403, 'Elite is not available');

  trackEvent(req.user!.id, `${product.tier === 'ELITE' ? 'elite' : 'gold'}_purchase_started`, {
    productId,
  }).catch(() => {});

  const result = await verifyAndGrantSubscription({
    userId: req.user!.id,
    tier: product.tier,
    productId,
    purchaseToken,
    basePlanId: basePlanId ?? null,
  });
  if (!result.ok) {
    return res.status(402).json({
      error: 'Google could not verify this purchase',
      code: 'PURCHASE_VERIFICATION_FAILED',
      detail: result.reason,
    });
  }
  const entitlement = await getEntitlement(req.user!.id);
  res.json({ subscription: result.result.subscription, entitlement });
});

// ---------------------------------------------------------------------------
// Boost purchase: verified one-time product (PRD §9–10)
// ---------------------------------------------------------------------------

router.post('/billing/boosts', withEntitlement, validate(boostPurchaseSchema), async (req, res) => {
  const { productId, purchaseToken } = req.body;
  const ent = req.entitlement!;
  const flags = getFeatureFlags();
  if (!flags.boostsEnabled) throw new HttpError(403, 'Boosts are not available');

  const product = await prisma.boostProduct.findUnique({ where: { googleProductId: productId } });
  if (!product || !product.isActive) throw new HttpError(404, 'Unknown boost product');

  trackEvent(req.user!.id, 'boost_purchase_started', { productId }).catch(() => {});

  const verification = await verifyProductPurchase(req.user!.id, productId, purchaseToken);
  if (!verification.ok) {
    return res.status(402).json({
      error: 'Google could not verify this purchase',
      code: 'PURCHASE_VERIFICATION_FAILED',
      detail: verification.reason,
    });
  }

  // One active boost of each type per user.
  await prisma.userBoost.updateMany({
    where: { userId: req.user!.id, boostProductId: product.id, status: 'ACTIVE' },
    data: { status: 'CANCELLED' },
  });

  const now = new Date();
  const boost = await prisma.userBoost.create({
    data: {
      userId: req.user!.id,
      boostProductId: product.id,
      startsAt: now,
      expiresAt: new Date(now.getTime() + product.durationHours * 3600 * 1000),
      status: 'ACTIVE',
      purchaseToken,
    },
    include: { product: true },
  });

  // Spotlight boosts also create a featured run for the same window.
  if (product.type !== 'MATCH_BOOST') {
    await prisma.spotlightRun.create({
      data: {
        userId: req.user!.id,
        startsAt: now,
        expiresAt: boost.expiresAt,
        source: 'boost',
      },
    });
  }

  trackEvent(req.user!.id, 'boost_purchase_completed', { productId, type: product.type }).catch(() => {});
  res.status(201).json({ boost });
});

// ---------------------------------------------------------------------------
// Current subscription state + Play management handoff
// ---------------------------------------------------------------------------

router.get('/billing/status', withEntitlement, async (req, res) => {
  const ent = req.entitlement!;
  const subscription = await prisma.subscription.findFirst({
    where: { userId: req.user!.id, OR: [{ status: 'ACTIVE' }, { status: 'IN_GRACE_PERIOD' }] },
    include: { product: true },
    orderBy: { startedAt: 'desc' },
  });
  res.json({
    tier: ent.tier,
    subscription: subscription
      ? {
          tier: subscription.tier,
          status: subscription.status,
          expiresAt: subscription.expiresAt,
          autoRenew: subscription.autoRenew,
          productId: subscription.productId,
          provider: subscription.provider,
        }
      : null,
    entitlement: ent,
    billingConfigured: billingConfigured(),
  });
});

/** Dev-only helper to mint test purchase tokens (no Google needed). */
router.post('/billing/dev-token', withEntitlement, async (req, res) => {
  const token = devIssueToken(req.user!.id, String(req.body?.productId || ''));
  if (!token) throw new HttpError(403, 'Dev tokens are only available in development');
  res.json({ purchaseToken: token });
});

// ---------------------------------------------------------------------------
// Spotlight activation with Elite credits (PRD §23)
// ---------------------------------------------------------------------------

const spotlightSchema = z.object({ durationHours: z.number().int().min(1).max(168).default(24) });

router.post('/billing/spotlight', withEntitlement, validate(spotlightSchema), async (req, res) => {
  const ent = req.entitlement!;
  if (!ent.elite) {
    return res.status(403).json({
      error: 'Spotlight is an Elite feature',
      code: 'TIER_REQUIRED',
      requiredTier: 'ELITE',
      currentTier: ent.tier,
    });
  }
  if (ent.spotlightCredits < 1) {
    return res.status(402).json({
      error: 'You have no spotlight credits left this month',
      code: 'NO_SPOTLIGHT_CREDITS',
    });
  }
  const hours = req.body.durationHours ?? 24;
  const now = new Date();
  const [run] = await prisma.$transaction([
    prisma.spotlightRun.create({
      data: {
        userId: req.user!.id,
        startsAt: now,
        expiresAt: new Date(now.getTime() + hours * 3600 * 1000),
        source: 'credit',
      },
    }),
    prisma.user.update({
      where: { id: req.user!.id },
      data: { spotlightCredits: { decrement: 1 } },
    }),
  ]);
  trackEvent(req.user!.id, 'spotlight_activated', { durationHours: hours }).catch(() => {});
  res.status(201).json({ spotlight: run, creditsLeft: ent.spotlightCredits - 1 });
});

// ---------------------------------------------------------------------------
// Referrals (PRD §25) — both sides get a Match Boost after the referred user
// completes onboarding. No unlimited premium through referrals.
// ---------------------------------------------------------------------------

const referralSchema = z.object({ code: z.string().min(4).max(32) });

function generateReferralCode(userId: string) {
  // Deterministic, short, non-identifying.
  return `ss-${userId.replace(/-/g, '').slice(0, 8)}`;
}

router.get('/referrals', async (req, res) => {
  const flags = getFeatureFlags();
  if (!flags.referralsEnabled) return res.json({ enabled: false, referral: null, invited: 0 });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  let code = user?.referralCode;
  if (!code) {
    code = generateReferralCode(req.user!.id);
    await prisma.user.update({ where: { id: req.user!.id }, data: { referralCode: code } });
  }
  const invited = await prisma.referral.count({ where: { referrerId: req.user!.id } });
  res.json({ enabled: true, referralCode: code, invited });
});

router.post('/referrals/redeem', validate(referralSchema), async (req, res) => {
  const flags = getFeatureFlags();
  if (!flags.referralsEnabled) throw new HttpError(403, 'Referrals are not available');

  const referrer = await prisma.user.findUnique({ where: { referralCode: req.body.code } });
  if (!referrer || referrer.id === req.user!.id) throw new HttpError(404, 'Invalid referral code');
  const existing = await prisma.referral.findUnique({ where: { referredUserId: req.user!.id } });
  if (existing) throw new HttpError(409, 'You have already used a referral code');

  await prisma.referral.create({
    data: { referrerId: referrer.id, referredUserId: req.user!.id, status: 'PENDING' },
  });
  res.status(201).json({ ok: true });
});

/** Grants both sides a free Match Boost once the referred user onboarded. */
export async function completeReferral(referredUserId: string) {
  const referral = await prisma.referral.findUnique({ where: { referredUserId } });
  if (!referral || referral.status !== 'PENDING') return;

  const boostProduct = await prisma.boostProduct.findFirst({
    where: { type: 'MATCH_BOOST', isActive: true },
  });
  if (!boostProduct) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 3600 * 1000);
  await prisma.$transaction([
    prisma.referral.update({
      where: { id: referral.id },
      data: { status: 'REWARDED', completedAt: now },
    }),
    prisma.userBoost.create({
      data: {
        userId: referral.referrerId,
        boostProductId: boostProduct.id,
        startsAt: now,
        expiresAt,
        status: 'ACTIVE',
      },
    }),
    prisma.userBoost.create({
      data: {
        userId: referral.referredUserId,
        boostProductId: boostProduct.id,
        startsAt: now,
        expiresAt,
        status: 'ACTIVE',
      },
    }),
  ]);
}

export default router;
