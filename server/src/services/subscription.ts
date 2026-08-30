/**
 * Subscription lifecycle (PRD §14–15).
 *
 * Entitlements are always derived from verified Subscription rows:
 *   new purchase → renewal → cancellation → expiration → upgrade →
 *   downgrade → payment failure → grace period → account hold →
 *   restoration → refund/revocation.
 */

import { prisma } from '../lib/prisma';
import { Tier } from '@prisma/client';
import { verifySubscriptionPurchase } from './billing';
import { TIER_CONFIG } from './entitlements';
import { trackEvent } from './analytics';

const TIER_RANK: Record<Tier, number> = { FREE: 0, GOLD: 1, ELITE: 2 };

/**
 * Resolve the internal SubscriptionProduct row from a Google product id
 * (`productId` on Subscription is the internal FK, not the store id).
 */
async function resolveProductId(googleProductId: string): Promise<string | null> {
  const row = await prisma.subscriptionProduct.findUnique({
    where: { googleProductId },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Grant (or replace) a subscription from a VERIFIED purchase.
 *
 * Upgrade/downgrade semantics follow Google Play "replacement": the old
 * subscription is superseded. Because Google bills the new plan at the next
 * cycle for downgrades, we grant the new tier immediately when it's an
 * upgrade, and keep entitlement until the old expiry for downgrades — the
 * caller may also pass an explicit startsAt when Play says otherwise.
 */
export async function applyVerifiedSubscription(opts: {
  userId: string;
  tier: Tier;
  productId: string;
  purchaseToken: string;
  providerSubscriptionId?: string | null;
  basePlanId?: string | null;
  expiryTimeMillis?: string | null;
  autoRenew?: boolean;
  startsAt?: Date;
}) {
  const now = new Date();
  const startsAt = opts.startsAt ?? now;
  const expiresAt = opts.expiryTimeMillis
    ? new Date(Number(opts.expiryTimeMillis))
    : new Date(startsAt.getTime() + 31 * 24 * 3600 * 1000);

  // The Subscription.product FK references the internal product row id.
  const internalProductId = await resolveProductId(opts.productId);

  // Find the current active/paid subscription to determine upgrade vs downgrade.
  const current = await prisma.subscription.findFirst({
    where: {
      userId: opts.userId,
      OR: [{ status: 'ACTIVE' }, { status: 'IN_GRACE_PERIOD' }, { status: 'ON_HOLD' }],
    },
    orderBy: { startedAt: 'desc' },
  });

  const isUpgrade = current ? TIER_RANK[opts.tier] > TIER_RANK[current.tier] : true;
  const isDowngrade = current ? TIER_RANK[opts.tier] < TIER_RANK[current.tier] : false;

  // Revoke the old subscription rows for this user (replacement semantics).
  if (current) {
    await prisma.subscription.update({
      where: { id: current.id },
      data: { status: 'CANCELLED', autoRenew: false },
    });
  }

  // An upgrade takes effect immediately; a downgrade keeps the old entitlement
  // until the old expiry when Google would normally switch the plan.
  const effectiveStart = isDowngrade && current?.expiresAt && current.expiresAt > startsAt
    ? current.expiresAt
    : startsAt;
  const effectiveExpiry = isDowngrade && current?.expiresAt && current.expiresAt > startsAt
    ? new Date(current.expiresAt.getTime() + (expiresAt.getTime() - startsAt.getTime()))
    : expiresAt;

  const subscription = await prisma.subscription.create({
    data: {
      userId: opts.userId,
      tier: opts.tier,
      status: 'ACTIVE',
      provider: 'GOOGLE_PLAY',
      providerSubscriptionId: opts.providerSubscriptionId ?? null,
      productId: internalProductId,
      basePlanId: opts.basePlanId ?? null,
      purchaseToken: opts.purchaseToken,
      startedAt: effectiveStart,
      expiresAt: effectiveExpiry,
      autoRenew: opts.autoRenew ?? true,
    },
  });

  // Elite grants monthly spotlight credits. Refill to the monthly amount on
  // every fresh grant/renewal.
  if (opts.tier === 'ELITE') {
    const credits = TIER_CONFIG.ELITE.monthlySpotlightCredits;
    await prisma.user.update({ where: { id: opts.userId }, data: { spotlightCredits: credits } });
  }

  const eventMap: Record<Tier, 'gold_purchase_completed' | 'elite_purchase_completed'> = {
    GOLD: 'gold_purchase_completed',
    ELITE: 'elite_purchase_completed',
    FREE: 'gold_purchase_completed',
  };
  trackEvent(opts.userId, eventMap[opts.tier], { productId: opts.productId, upgrade: isUpgrade }).catch(() => {});

  return { subscription, immediate: !isDowngrade };
}

/** Mark a subscription cancelled (user-initiated or Play-driven). */
export async function cancelSubscription(userId: string, purchaseToken: string) {
  const sub = await prisma.subscription.findUnique({ where: { purchaseToken } });
  if (!sub || sub.userId !== userId) return null;
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: 'CANCELLED', autoRenew: false },
  });
  trackEvent(userId, 'subscription_cancelled', { productId: sub.productId ?? undefined }).catch(() => {});
  return sub;
}

/** Refund / revocation: entitlement ends immediately. */
export async function revokeSubscription(purchaseToken: string) {
  const sub = await prisma.subscription.findUnique({ where: { purchaseToken } });
  if (!sub) return null;
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: 'EXPIRED', autoRenew: false },
  });
  return sub;
}

/**
 * Full verification + grant pipeline for a subscription purchase.
 * Returns ok=false when Google says the purchase is not valid.
 */
export async function verifyAndGrantSubscription(opts: {
  userId: string;
  tier: Tier;
  productId: string;
  purchaseToken: string;
  basePlanId?: string | null;
}) {
  const verification = await verifySubscriptionPurchase(opts.userId, opts.productId, opts.purchaseToken);
  if (!verification.ok) {
    return { ok: false as const, reason: verification.reason ?? 'purchase could not be verified' };
  }
  const result = await applyVerifiedSubscription({
    userId: opts.userId,
    tier: opts.tier,
    productId: opts.productId,
    purchaseToken: opts.purchaseToken,
    basePlanId: opts.basePlanId ?? null,
    expiryTimeMillis: verification.expiryTimeMillis,
    autoRenew: verification.autoRenewing,
  });
  return { ok: true as const, result };
}
