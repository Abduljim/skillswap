import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { withEntitlement } from '../middleware/tier';
import { getMatchesForUser, getMatchWithUser, MatchFilters } from '../services/matchService';
import { peekLimit, tryConsume, UsageKey } from '../services/entitlements';
import { trackEvent } from '../services/analytics';

const router = Router();

router.use(requireAuth);

router.get('/matches', withEntitlement, async (req, res) => {
  const ent = req.entitlement!;

  // Advanced filters are a Gold/Elite perk (PRD §19). Standard view stays free.
  const q = req.query;
  const filters: MatchFilters = {};
  if (ent.advancedFilters) {
    if (q.university) filters.university = String(q.university);
    if (q.format) filters.format = String(q.format) as MatchFilters['format'];
    if (q.day) filters.day = String(q.day);
    if (q.dayPart) filters.dayPart = String(q.dayPart);
    if (q.skill) filters.skill = String(q.skill);
  }
  const minScore = q.min ? Number(q.min) : 40;

  const { matches } = await getMatchesForUser(req.user!.id, minScore, filters);

  // Free-tier expanded-match allowance: the top N unlocked matches are shown;
  // the rest are count-locked but never hidden from the total.
  let visible = matches;
  let unlockQuota: { usage: number; limit: number | null; remaining: number | null } | null = null;
  if (ent.limits.match_unlock !== null) {
    const quota = await peekLimit(req.user!.id, 'match_unlock');
    unlockQuota = quota;
    visible = matches.slice(0, Math.max(0, quota.remaining ?? 0));
  }

  const requestQuota = await peekLimit(req.user!.id, 'request_sent');

  res.json({
    matches: visible,
    totalFound: matches.length,
    lockedCount: Math.max(0, matches.length - visible.length),
    unlockQuota,
    requestQuota,
    filtersAvailable: ent.advancedFilters,
    tier: ent.tier,
  });
});

router.get('/matches/:userId', withEntitlement, async (req, res) => {
  const { user, match } = await getMatchWithUser(req.user!.id, req.params.userId);
  const ent = req.entitlement!;

  // Free users spend one monthly unlock per unique target; revisits are free.
  let unlockQuota: { usage: number; limit: number | null; remaining: number | null } | null = null;
  if (ent.limits.match_unlock !== null) {
    const quota = await peekLimit(req.user!.id, 'match_unlock');
    unlockQuota = quota;
    if ((quota.remaining ?? 0) > 0) {
      const now = new Date();
      const already = await prisma.matchUnlock.findFirst({
        where: {
          userId: req.user!.id,
          targetId: req.params.userId,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
      });
      if (!already) {
        await prisma.$transaction([
          prisma.matchUnlock.create({
            data: {
              userId: req.user!.id,
              targetId: req.params.userId,
              month: now.getMonth() + 1,
              year: now.getFullYear(),
            },
          }),
          prisma.usageCounter.upsert({
            where: {
              userId_key_month_year: {
                userId: req.user!.id,
                key: 'match_unlock' as UsageKey,
                month: now.getMonth() + 1,
                year: now.getFullYear(),
              },
            },
            create: {
              userId: req.user!.id,
              key: 'match_unlock' as UsageKey,
              month: now.getMonth() + 1,
              year: now.getFullYear(),
              count: 1,
            },
            update: { count: { increment: 1 } },
          }),
        ]);
        unlockQuota = await peekLimit(req.user!.id, 'match_unlock');
      }
    }
  }

  await trackEvent(req.user!.id, 'match_viewed', { targetId: req.params.userId });
  res.json({ user, match, unlockQuota });
});

export default router;
