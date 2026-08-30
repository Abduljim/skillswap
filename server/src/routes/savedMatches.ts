import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { withEntitlement } from '../middleware/tier';
import { HttpError } from '../middleware/validate';
import { tryConsume } from '../services/entitlements';

const router = Router();

router.use(requireAuth);

/** List saved matches ("bookmark" people you want to come back to). */
router.get('/saved-matches', async (req, res) => {
  const saved = await prisma.savedMatch.findMany({
    where: { userId: req.user!.id },
    include: {
      target: {
        select: {
          id: true,
          displayName: true,
          profile: true,
          skills: { include: { skill: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ saved });
});

/** Save a match (limited for Free users). */
router.post('/saved-matches', withEntitlement, async (req, res) => {
  const targetId = String(req.body?.targetId || '');
  const ent = req.entitlement!;
  if (targetId === req.user!.id) throw new HttpError(400, 'You cannot save yourself');

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target || !target.isActive) throw new HttpError(404, 'User not found');

  const existing = await prisma.savedMatch.findUnique({
    where: { userId_targetId: { userId: req.user!.id, targetId } },
  });
  if (existing) return res.json({ saved: existing });

  // Free-tier monthly saved-match limit.
  if (ent.limits.saved_match !== null) {
    const allowance = await tryConsume(req.user!.id, 'saved_match');
    if (!allowance.ok) {
      return res.status(402).json({
        error: `You've used your ${allowance.limit} saved-match slots this month.`,
        code: 'SAVED_MATCH_LIMIT_REACHED',
        usage: allowance.usage,
        limit: allowance.limit,
      });
    }
  }

  const saved = await prisma.savedMatch.create({
    data: { userId: req.user!.id, targetId },
  });
  res.status(201).json({ saved });
});

router.delete('/saved-matches/:targetId', async (req, res) => {
  await prisma.savedMatch.deleteMany({
    where: { userId: req.user!.id, targetId: req.params.targetId },
  });
  res.json({ ok: true });
});

export default router;
