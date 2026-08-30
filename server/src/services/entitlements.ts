/**
 * SkillSwap entitlement service.
 *
 * Single source of truth for what a user is allowed to do. Server-side only —
 * the frontend is never trusted for tier state (PRD §1, §31).
 *
 * Fairness rules (PRD §32): paid tiers buy discovery, visibility, analytics
 * and convenience — never fake compatibility scores, guaranteed matches, or
 * the ability to bypass blocks.
 */

import { prisma } from '../lib/prisma';
import type { Tier } from '@prisma/client';

export type { Tier };

// ---------------------------------------------------------------------------
// Feature flags (PRD §27) — allow gradual rollout of monetization surfaces.
// ---------------------------------------------------------------------------

export interface FeatureFlags {
  goldEnabled: boolean;
  eliteEnabled: boolean;
  boostsEnabled: boolean;
  adsEnabled: boolean;
  referralsEnabled: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    goldEnabled: process.env.GOLD_ENABLED !== 'false',
    eliteEnabled: process.env.ELITE_ENABLED !== 'false',
    boostsEnabled: process.env.BOOSTS_ENABLED !== 'false',
    adsEnabled: process.env.ADS_ENABLED === 'true',
    referralsEnabled: process.env.REFERRALS_ENABLED !== 'false',
  };
}

// ---------------------------------------------------------------------------
// Tier configuration — configurable, never hardcoded in React (PRD §35).
// ---------------------------------------------------------------------------

export const TIER_CONFIG: Record<
  Tier,
  {
    label: string;
    tagline: string;
    /** Discovery visibility bonus added to ranking (NOT to compatibility). */
    visibilityBonus: number;
    limits: { requestSent: number | null; matchUnlock: number | null; savedMatch: number | null };
    /** Monthly spotlight credits granted with the tier. */
    monthlySpotlightCredits: number;
    /** Advanced discovery filters unlocked. */
    advancedFilters: boolean;
    profileAnalytics: boolean;
    demandAnalytics: boolean;
  }
> = {
  FREE: {
    label: 'Free',
    tagline: 'Start swapping.',
    visibilityBonus: 0,
    limits: { requestSent: 5, matchUnlock: 10, savedMatch: 10 },
    monthlySpotlightCredits: 0,
    advancedFilters: false,
    profileAnalytics: false,
    demandAnalytics: false,
  },
  GOLD: {
    label: 'Gold',
    tagline: 'Get discovered.',
    visibilityBonus: 10,
    limits: { requestSent: null, matchUnlock: null, savedMatch: null },
    monthlySpotlightCredits: 0,
    advancedFilters: true,
    profileAnalytics: true,
    demandAnalytics: false,
  },
  ELITE: {
    label: 'Elite',
    tagline: 'Become a top skill partner.',
    visibilityBonus: 20,
    limits: { requestSent: null, matchUnlock: null, savedMatch: null },
    monthlySpotlightCredits: 2,
    advancedFilters: true,
    profileAnalytics: true,
    demandAnalytics: true,
  },
};

export const ACTIVE_BOOST_BONUS = 15; // visibility points for an active boost

export type UsageKey = 'request_sent' | 'match_unlock' | 'saved_match';

export interface Entitlement {
  tier: Tier;
  flags: FeatureFlags;
  limits: Record<UsageKey, number | null>;
  usage: Record<UsageKey, number>;
  /** True when the tier is paid and its flag is on. */
  gold: boolean;
  elite: boolean;
  advancedFilters: boolean;
  profileAnalytics: boolean;
  demandAnalytics: boolean;
  monthlySpotlightCredits: number;
  spotlightCredits: number;
  activeBoost: { type: string; expiresAt: Date } | null;
  activeSpotlight: { expiresAt: Date } | null;
}

/**
 * Resolve a user's CURRENT entitlement from verified server state.
 * Expired subscriptions and boosts are lazily swept to EXPIRED here, so a
 * stale cache can never keep granting entitlements (PRD §14).
 */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const now = new Date();
  const flags = getFeatureFlags();

  const [user, subs, boosts, spotlights] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { spotlightCredits: true } }),
    prisma.subscription.findMany({ where: { userId }, orderBy: [{ startedAt: 'desc' }] }),
    prisma.userBoost.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { startsAt: 'desc' },
    }),
    prisma.spotlightRun.findMany({ where: { userId }, orderBy: { startsAt: 'desc' } }),
  ]);

  // Expire stale subscriptions (grace period is treated as still-active).
  for (const sub of subs) {
    const expired =
      sub.status === 'ACTIVE' &&
      sub.expiresAt !== null &&
      sub.expiresAt.getTime() <= now.getTime();
    if (expired) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED', autoRenew: false },
      });
      sub.status = 'EXPIRED';
    }
  }

  // Expire stale boosts.
  for (const b of boosts) {
    if (b.status === 'ACTIVE' && b.expiresAt.getTime() <= now.getTime()) {
      await prisma.userBoost.update({ where: { id: b.id }, data: { status: 'EXPIRED' } });
      b.status = 'EXPIRED';
    }
  }
  for (const s of spotlights) {
    if (s.expiresAt.getTime() <= now.getTime()) {
      await prisma.spotlightRun.delete({ where: { id: s.id } }).catch(() => {});
    }
  }

  // Highest ACTIVE tier wins. Grace period keeps entitlements during a
  // temporary payment failure.
  const activeSub = subs.find((s) => s.status === 'ACTIVE' || s.status === 'IN_GRACE_PERIOD');
  let tier: Tier = 'FREE';
  if (activeSub) {
    if (activeSub.tier === 'ELITE') tier = 'ELITE';
    else if (activeSub.tier === 'GOLD') tier = 'GOLD';
  }
  if (tier === 'GOLD' && !flags.goldEnabled) tier = 'FREE';
  if (tier === 'ELITE' && !flags.eliteEnabled) tier = 'GOLD';

  const cfg = TIER_CONFIG[tier];
  const activeBoost = boosts.find((b) => b.status === 'ACTIVE');
  const activeSpotlight = spotlights.find((s) => s.expiresAt.getTime() > now.getTime());

  const usage = await getUsage(userId);

  return {
    tier,
    flags,
    limits: {
      request_sent: cfg.limits.requestSent,
      match_unlock: cfg.limits.matchUnlock,
      saved_match: cfg.limits.savedMatch,
    },
    usage,
    gold: tier === 'GOLD' || tier === 'ELITE',
    elite: tier === 'ELITE',
    advancedFilters: cfg.advancedFilters,
    profileAnalytics: cfg.profileAnalytics,
    demandAnalytics: cfg.demandAnalytics,
    monthlySpotlightCredits: cfg.monthlySpotlightCredits,
    spotlightCredits: user?.spotlightCredits ?? 0,
    activeBoost: activeBoost
      ? { type: activeBoost.product.type, expiresAt: activeBoost.expiresAt }
      : null,
    activeSpotlight: activeSpotlight ? { expiresAt: activeSpotlight.expiresAt } : null,
  };
}

// ---------------------------------------------------------------------------
// Monthly usage counters with automatic window rollover.
// ---------------------------------------------------------------------------

function currentWindow() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

async function getUsage(userId: string): Promise<Record<UsageKey, number>> {
  const { month, year } = currentWindow();
  const counters = await prisma.usageCounter.findMany({
    where: { userId, month, year },
  });
  const usage: Record<UsageKey, number> = { request_sent: 0, match_unlock: 0, saved_match: 0 };
  for (const c of counters) usage[c.key as UsageKey] = c.count;
  return usage;
}

/** Increment a counter, rolling over to a fresh window when needed. */
export async function consumeUsage(userId: string, key: UsageKey, by = 1): Promise<number> {
  const { month, year } = currentWindow();
  const counter = await prisma.usageCounter.upsert({
    where: { userId_key_month_year: { userId, key, month, year } },
    create: { userId, key, month, year, count: by },
    update: { count: { increment: by } },
  });
  return counter.count;
}

/**
 * Check + consume in one step. Returns ok=false when the Free limit is hit.
 * Premium tiers (null limit) always pass.
 */
export async function tryConsume(
  userId: string,
  key: UsageKey
): Promise<{ ok: boolean; usage: number; limit: number | null }> {
  const ent = await getEntitlement(userId);
  const limit = ent.limits[key];
  if (limit === null) {
    return { ok: true, usage: ent.usage[key], limit: null };
  }
  if (ent.usage[key] >= limit) {
    return { ok: false, usage: ent.usage[key], limit };
  }
  const usage = await consumeUsage(userId, key);
  return { ok: true, usage, limit };
}

/** Peek at a limit without consuming (for UI hints). */
export async function peekLimit(
  userId: string,
  key: UsageKey
): Promise<{ usage: number; limit: number | null; remaining: number | null }> {
  const ent = await getEntitlement(userId);
  const limit = ent.limits[key];
  return {
    usage: ent.usage[key],
    limit,
    remaining: limit === null ? null : Math.max(0, limit - ent.usage[key]),
  };
}

/** Reset a counter (admin/debug). */
export async function resetUsage(userId: string, key: UsageKey) {
  const { month, year } = currentWindow();
  await prisma.usageCounter.deleteMany({ where: { userId, key, month, year } });
}
