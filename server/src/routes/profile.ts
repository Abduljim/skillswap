import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { requireAuth, signToken, setAuthCookie } from '../middleware/auth';
import { validate, HttpError } from '../middleware/validate';
import { profileSchema } from '../validation/schemas';
import { toMatcherProfile } from '../services/matchService';
import { calculateMatchScore } from '../services/matching';

const router = Router();

router.use(requireAuth);

function publicUser(user: { id: string; email: string; displayName: string; role: 'USER' | 'ADMIN' }) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

router.get('/profile', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { profile: true, skills: { include: { skill: true } } },
  });
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user: { ...publicUser(user), profile: user.profile, skills: user.skills } });
});

router.put('/profile', validate(profileSchema), async (req, res) => {
  const { displayName, ...profileData } = req.body;
  const data: Record<string, unknown> = {};
  if (displayName) data.displayName = displayName;
  if (Object.keys(profileData).length > 0) {
    data.profile = { update: profileData };
  }
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data,
    include: { profile: true, skills: { include: { skill: true } } },
  });
  if (displayName) {
    const token = signToken(publicUser(user));
    setAuthCookie(res, token);
  }
  res.json({ user: { ...publicUser(user), profile: user.profile, skills: user.skills } });
});


router.get('/users/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const university = String(req.query.university || '').trim();
  const department = String(req.query.department || '').trim();
  const skill = String(req.query.skill || '').trim();
  const format = String(req.query.format || '').trim();
  const sort = String(req.query.sort || 'best');

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      NOT: { id: req.user!.id },
      ...(university ? { profile: { is: { university } } } : {}),
      ...(department ? { profile: { is: { department } } } : {}),
      ...(format
        ? { profile: { is: { format: format as 'ONLINE' | 'IN_PERSON' | 'EITHER' } } }
        : {}),
      ...(skill
        ? { skills: { some: { skill: { name: { equals: skill, mode: 'insensitive' } } } } }
        : {}),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { profile: { is: { university: { contains: q, mode: 'insensitive' } } } },
              { profile: { is: { department: { contains: q, mode: 'insensitive' } } } },
              { skills: { some: { skill: { name: { contains: q, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    },
    include: {
      profile: true,
      skills: { include: { skill: true } },
      reviewsReceived: { select: { rating: true } },
      _count: { select: { reviewsReceived: true } },
    },
    take: 50,
  });

  const me = await toMatcherProfile(req.user!.id);
  const results = users.map((u) => {
    const profile = {
      id: u.id,
      displayName: u.displayName,
      university: u.profile?.university ?? null,
      days: u.profile?.days ?? [],
      dayParts: u.profile?.dayParts ?? [],
      format: (u.profile?.format as 'ONLINE' | 'IN_PERSON' | 'EITHER') ?? 'EITHER',
      skills: u.skills.map((us) => ({
        id: us.skillId,
        name: us.skill.name,
        type: us.type,
        level: us.level,
      })),
    };
    const ratings = u.reviewsReceived.map((r) => r.rating);
    return {
      user: {
        id: u.id,
        displayName: u.displayName,
        profile: u.profile,
        skills: u.skills,
        rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
        reviewCount: u._count.reviewsReceived,
      },
      match: calculateMatchScore(me, profile),
    };
  });

  if (sort === 'best') results.sort((a, b) => b.match.score - a.match.score);
  else if (sort === 'rating') results.sort((a, b) => (b.user.rating ?? 0) - (a.user.rating ?? 0));

  res.json({ results });
});

router.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
      skills: { include: { skill: true } },
      reviewsReceived: {
        include: { reviewer: { select: { id: true, displayName: true, profile: true } } },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { reviewsReceived: true } },
    },
  });
  if (!user || !user.isActive) throw new HttpError(404, 'User not found');

  const ratings = user.reviewsReceived.map((r) => r.rating);
  const rating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  const me = await toMatcherProfile(req.user!.id);
  const other = await toMatcherProfile(id);
  const match = id === req.user!.id ? null : calculateMatchScore(me, other);

  const blocked =
    (await prisma.block.count({ where: { blockerId: req.user!.id, blockedId: id } })) > 0;

  res.json({
    user: {
      id: user.id,
      displayName: user.displayName,
      profile: user.profile,
      skills: user.skills,
      rating,
      reviewCount: user._count.reviewsReceived,
      completedCount: user.completedCount,
      reviews: user.reviewsReceived,
    },
    match,
    blocked,
  });
});

router.post('/users/:id/block', async (req, res) => {
  const { id } = req.params;
  if (id === req.user!.id) throw new HttpError(400, 'You cannot block yourself');
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, 'User not found');
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: req.user!.id, blockedId: id } },
    create: { blockerId: req.user!.id, blockedId: id },
    update: {},
  });
  res.json({ ok: true });
});

router.delete('/users/:id/block', async (req, res) => {
  const { id } = req.params;
  await prisma.block.deleteMany({ where: { blockerId: req.user!.id, blockedId: id } });
  res.json({ ok: true });
});

router.get('/users/:id/reviews', async (req, res) => {
  const { id } = req.params;
  const reviews = await prisma.review.findMany({
    where: { revieweeId: id },
    include: { reviewer: { select: { id: true, displayName: true, profile: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ reviews });
});

export default router;
