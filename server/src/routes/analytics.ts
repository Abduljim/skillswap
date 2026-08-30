import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { withEntitlement, requireTier } from '../middleware/tier';
import { HttpError } from '../middleware/validate';
import { trackEvent } from '../services/analytics';

const router = Router();

router.use(requireAuth);

/**
 * Gold: profile analytics — views, requests received, completed exchanges,
 * rating trend. Elite adds demand insights ("people looking for your skills"),
 * impressions, conversion and weekly trends (PRD §21–22). Only aggregated
 * statistics — never individual viewer identities.
 */
router.get('/analytics/profile', withEntitlement, async (req, res) => {
  const ent = req.entitlement!;
  if (!ent.profileAnalytics) {
    return res.status(403).json({
      error: 'Profile analytics are available on Gold and Elite',
      code: 'TIER_REQUIRED',
      requiredTier: 'GOLD',
      currentTier: ent.tier,
    });
  }

  const userId = req.user!.id;
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 3600 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalViews,
    views30d,
    requestsReceived,
    requestsReceived30d,
    completedExchanges,
    reviews,
    spotlightRuns,
    activeBoost,
  ] = await Promise.all([
    prisma.profileView.count({ where: { targetId: userId } }),
    prisma.profileView.count({ where: { targetId: userId, createdAt: { gte: daysAgo(30) } } }),
    prisma.exchangeRequest.count({ where: { recipientId: userId } }),
    prisma.exchangeRequest.count({ where: { recipientId: userId, createdAt: { gte: daysAgo(30) } } }),
    prisma.exchange.count({ where: { OR: [{ userAId: userId }, { userBId: userId }], status: 'COMPLETED' } }),
    prisma.review.findMany({
      where: { revieweeId: userId },
      select: { rating: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.spotlightRun.count({ where: { userId, startsAt: { gte: monthStart } } }),
    prisma.userBoost.findFirst({ where: { userId, status: 'ACTIVE' }, include: { product: true } }),
  ]);

  // Rating trend: average over chronological review buckets.
  let running = 0;
  const ratingTrend = reviews.map((r, i) => {
    running += r.rating;
    return { at: r.createdAt, average: Math.round((running / (i + 1)) * 10) / 10 };
  });
  const averageRating = reviews.length
    ? Math.round((reviews.reduce((a, b) => a + b.rating, 0) / reviews.length) * 10) / 10
    : null;

  const gold: {
    totalViews: number;
    views30d: number;
    requestsReceived: number;
    requestsReceived30d: number;
    completedExchanges: number;
    averageRating: number | null;
    ratingTrend: Array<{ at: Date; average: number }>;
    activeBoost: { type: string; expiresAt: Date } | null;
  } = {
    totalViews,
    views30d,
    requestsReceived,
    requestsReceived30d,
    completedExchanges,
    averageRating,
    ratingTrend,
    activeBoost: activeBoost
      ? { type: activeBoost.product.type, expiresAt: activeBoost.expiresAt }
      : null,
  };

  if (!ent.demandAnalytics) {
    return res.json({ tier: ent.tier, gold });
  }

  // ------------------------------------------------------------------
  // Elite: demand analytics — "People looking for your skills", real
  // aggregated database data. No AI, no fabricated statistics.
  // ------------------------------------------------------------------
  const myTeachSkills = await prisma.userSkill.findMany({
    where: { userId, type: 'TEACH' },
    include: { skill: true },
  });

  const weekAhead = ['Sat', 'Sun'] as const;
  const myProfile = await prisma.profile.findUnique({ where: { userId } });
  const demand = await Promise.all(
    myTeachSkills.map(async (us) => {
      // People who WANT this skill, active, not me. All real counts — no AI,
      // no fabricated statistics (PRD §22).
      const [peopleWanting, strongMatches, nearUniversity, availableSoon] = await Promise.all([
        prisma.userSkill.count({
          where: { skillId: us.skillId, type: 'WANT', user: { isActive: true } },
        }),
        // Strong potential matches: wanters who also teach something (reciprocal possible).
        prisma.userSkill.count({
          where: {
            skillId: us.skillId,
            type: 'WANT',
            user: { isActive: true, skills: { some: { type: 'TEACH' } } },
          },
        }),
        // Wanters near my university.
        myProfile?.university
          ? prisma.userSkill.count({
              where: {
                skillId: us.skillId,
                type: 'WANT',
                user: { isActive: true, profile: { is: { university: myProfile.university } } },
              },
            })
          : Promise.resolve(0),
        // Wanters with weekend availability.
        prisma.userSkill.count({
          where: {
            skillId: us.skillId,
            type: 'WANT',
            user: {
              isActive: true,
              profile: { is: { days: { hasSome: [...weekAhead] } } },
            },
          },
        }),
      ]);
      return {
        skill: us.skill.name,
        peopleWanting,
        strongMatches,
        nearUniversity,
        availableSoon,
      };
    })
  );

  // Requests received vs matches viewed → conversion.
  const [matchViews, impressions] = await Promise.all([
    prisma.analyticsEvent.count({
      where: { name: 'match_viewed', data: { path: ['targetId'], equals: userId } },
    }),
    prisma.profileView.count({ where: { targetId: userId, createdAt: { gte: daysAgo(7) } } }),
  ]);
  const conversion = matchViews > 0 ? Math.round((requestsReceived / matchViews) * 100) : null;

  const accepted = await prisma.exchangeRequest.count({
    where: { recipientId: userId, status: 'ACCEPTED' },
  });
  const acceptanceRate = requestsReceived > 0 ? Math.round((accepted / requestsReceived) * 100) : null;

  // Weekly views trend (last 8 weeks).
  const weeklyTrend: Array<{ weekStart: Date; views: number }> = [];
  for (let w = 7; w >= 0; w--) {
    const start = new Date(now.getTime() - (w + 1) * 7 * 24 * 3600 * 1000);
    const end = new Date(now.getTime() - w * 7 * 24 * 3600 * 1000);
    const views = await prisma.profileView.count({
      where: { targetId: userId, createdAt: { gte: start, lt: end } },
    });
    weeklyTrend.push({ weekStart: start, views });
  }

  const elite = {
    demand: demand.filter((d) => d.peopleWanting > 0).sort((a, b) => b.peopleWanting - a.peopleWanting),
    weeklyViewsTrend: weeklyTrend,
    impressions7d: impressions,
    matchViews,
    requestConversionRate: conversion,
    requestAcceptanceRate: acceptanceRate,
    spotlightRunsThisMonth: spotlightRuns,
  };

  res.json({ tier: ent.tier, gold, elite });
});

/** Record a profile view (self-views excluded). Feeds Gold/Elite analytics. */
router.post('/analytics/profile-view', async (req, res) => {
  const targetId = String(req.body?.targetId || '');
  if (targetId && targetId !== req.user!.id) {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (target) {
      await prisma.profileView.create({ data: { targetId, viewerId: req.user!.id } });
    }
  }
  res.json({ ok: true });
});

export default router;
