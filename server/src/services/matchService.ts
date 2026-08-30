import { prisma } from '../lib/prisma';
import {
  calculateMatchScore,
  isRecommended,
  MatcherProfile,
  MatchResult,
  MIN_MATCH_SCORE,
} from './matching';
import { HttpError } from '../middleware/validate';
import { TIER_CONFIG, ACTIVE_BOOST_BONUS, getFeatureFlags } from './entitlements';
import type { Tier } from './entitlements';
import { rankByVisibility } from './visibility';

export async function toMatcherProfile(userId: string): Promise<MatcherProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, skills: { include: { skill: true } } },
  });
  if (!user) throw new HttpError(404, 'User not found');
  return {
    id: user.id,
    displayName: user.displayName,
    university: user.profile?.university ?? null,
    days: user.profile?.days ?? [],
    dayParts: user.profile?.dayParts ?? [],
    format: (user.profile?.format as MatcherProfile['format']) ?? 'EITHER',
    skills: user.skills.map((us) => ({
      id: us.skillId,
      name: us.skill.name,
      type: us.type,
      level: us.level,
    })),
  };
}

/**
 * Compute the paid visibility layer for discovery candidates.
 *
 * The genuine compatibility score is NEVER modified. Instead each candidate
 * gets a separate `visibilityScore` used only for ordering:
 *
 *   visibilityScore = tier bonus (GOLD +10 / ELITE +20) + active boost (+15)
 *
 * Final ordering balances both so paid placement can never push a 25%
 * match above a highly compatible one (PRD §7–9).
 */
export async function getVisibilityLayer(candidateIds: string[]) {
  const now = new Date();
  const flags = getFeatureFlags();

  const [subs, boosts, spotlights] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        userId: { in: candidateIds },
        OR: [{ status: 'ACTIVE' }, { status: 'IN_GRACE_PERIOD' }],
      },
      select: { userId: true, tier: true },
    }),
    flags.boostsEnabled
      ? prisma.userBoost.findMany({
          where: { userId: { in: candidateIds }, status: 'ACTIVE', expiresAt: { gt: now } },
          select: { userId: true },
        })
      : Promise.resolve([] as { userId: string }[]),
    prisma.spotlightRun.findMany({
      where: { userId: { in: candidateIds }, expiresAt: { gt: now } },
      select: { userId: true },
    }),
  ]);

  const tierByUser = new Map<string, Tier>();
  for (const s of subs) {
    const current = tierByUser.get(s.userId);
    const rank: Record<Tier, number> = { FREE: 0, GOLD: 1, ELITE: 2 };
    if (!current || rank[s.tier as Tier] > rank[current]) tierByUser.set(s.userId, s.tier as Tier);
  }
  const boosted = new Set(boosts.map((b) => b.userId));
  const spotlighted = new Set(spotlights.map((s) => s.userId));

  const layer = new Map<
    string,
    { visibilityBonus: number; boosted: boolean; spotlighted: boolean; tier: Tier }
  >();
  for (const id of candidateIds) {
    const tier = tierByUser.get(id) ?? 'FREE';
    const bonus = TIER_CONFIG[tier].visibilityBonus + (boosted.has(id) ? ACTIVE_BOOST_BONUS : 0);
    layer.set(id, {
      visibilityBonus: (flags.goldEnabled || flags.eliteEnabled ? bonus : 0),
      boosted: boosted.has(id),
      spotlighted: spotlighted.has(id),
      tier,
    });
  }
  return layer;
}

/**
 * Balanced final ordering lives in the pure `visibility` module so it stays
 * unit-testable: compatibility dominates; visibility is a tiebreaker and a
 * mild lift, capped so it can never outrank genuine compatibility by a
 * wide margin.
 */
export { rankByVisibility };

export interface MatchFilters {
  minScore?: number;
  university?: string;
  format?: 'ONLINE' | 'IN_PERSON' | 'EITHER';
  dayPart?: string;
  day?: string;
  skill?: string;
}

/**
 * Compute matches for a user against the whole active community.
 * Excludes: self, inactive users, blocked users (either direction),
 * users already in an active exchange with the requester, and users
 * scoring below MIN_MATCH_SCORE.
 *
 * Advanced filters (university/format/availability) are Gold/Elite only.
 */
export async function getMatchesForUser(
  userId: string,
  minScore = MIN_MATCH_SCORE,
  filters: MatchFilters = {}
) {
  const me = await toMatcherProfile(userId);

  const [blocks, blockedMe, activeExchanges, candidates] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
    prisma.exchange.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: { userAId: true, userBId: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, NOT: { id: userId } },
      include: { profile: true, skills: { include: { skill: true } } },
    }),
  ]);

  const excluded = new Set<string>([
    ...blocks.map((b) => b.blockedId),
    ...blockedMe.map((b) => b.blockerId),
    ...activeExchanges.map((e) => (e.userAId === userId ? e.userBId : e.userAId)),
  ]);

  const results: Array<{ user: MatcherProfile & { avatarColor?: string }; match: MatchResult }> = [];
  for (const candidate of candidates) {
    if (excluded.has(candidate.id)) continue;
    const profile: MatcherProfile = {
      id: candidate.id,
      displayName: candidate.displayName,
      university: candidate.profile?.university ?? null,
      days: candidate.profile?.days ?? [],
      dayParts: candidate.profile?.dayParts ?? [],
      format: (candidate.profile?.format as MatcherProfile['format']) ?? 'EITHER',
      skills: candidate.skills.map((us) => ({
        id: us.skillId,
        name: us.skill.name,
        type: us.type,
        level: us.level,
      })),
    };

    // Premium filters (Gold+)
    if (filters.university && profile.university !== filters.university) continue;
    if (filters.format && profile.format !== filters.format && profile.format !== 'EITHER') continue;
    if (filters.day && !(profile.days || []).includes(filters.day)) continue;
    if (filters.dayPart && !(profile.dayParts || []).includes(filters.dayPart)) continue;
    if (
      filters.skill &&
      !profile.skills.some((s) => s.name.toLowerCase() === filters.skill!.toLowerCase())
    )
      continue;

    const match = calculateMatchScore(me, profile);
    if (match.score >= minScore) {
      results.push({
        user: { ...profile, avatarColor: candidate.profile?.avatarColor ?? 'coral' },
        match,
      });
    }
  }

  // Paid visibility affects ORDER only — never the shown compatibility score.
  const layer = await getVisibilityLayer(results.map((r) => r.user.id));
  const ranked = rankByVisibility(results, layer);

  return {
    matches: ranked.map((r) => ({
      ...r,
      premium: layer.get(r.user.id) ?? null,
    })),
  };
}

export async function getMatchWithUser(userId: string, otherId: string) {
  if (userId === otherId) throw new HttpError(400, 'You cannot match with yourself');
  const [me, other] = await Promise.all([toMatcherProfile(userId), toMatcherProfile(otherId)]);
  const otherRow = await prisma.user.findUnique({
    where: { id: otherId },
    include: { profile: true },
  });
  if (!otherRow || !otherRow.isActive) throw new HttpError(404, 'User not found');
  const blocked =
    (await prisma.block.count({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherId },
          { blockerId: otherId, blockedId: userId },
        ],
      },
    })) > 0;
  if (blocked) throw new HttpError(403, 'This match is unavailable');
  return { user: other, match: calculateMatchScore(me, other) };
}

export { calculateMatchScore, isRecommended };
