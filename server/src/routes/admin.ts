import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validate, HttpError } from '../middleware/validate';
import { skillSchema } from '../validation/schemas';

const planSchema = z.object({
  tier: z.enum(['GOLD', 'ELITE']),
  billingPeriod: z.enum(['MONTHLY', 'YEARLY']),
  googleProductId: z.string().min(3).max(120),
  displayPrice: z.string().min(1).max(40),
});

const boostProductSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(200),
  type: z.enum(['MATCH_BOOST', 'SPOTLIGHT', 'WEEKLY_SPOTLIGHT']),
  durationHours: z.number().int().min(1).max(24 * 30),
  price: z.number().int().min(100),
  googleProductId: z.string().min(3).max(120),
});

const router = Router();

// Scope the admin gate to /admin/* paths only — this router is mounted at
// /api, and a router-level use() would otherwise run for every request that
// flows through it, even non-admin routes mounted after this one.
router.use('/admin', requireAuth, requireAdmin);

router.get('/admin/stats', async (_req, res) => {
  const [users, activeExchanges, completedExchanges, pendingReports, skills] = await Promise.all([
    prisma.user.count(),
    prisma.exchange.count({ where: { status: 'ACTIVE' } }),
    prisma.exchange.count({ where: { status: 'COMPLETED' } }),
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.skill.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { users: { _count: 'desc' } },
      take: 10,
    }),
  ]);
  res.json({
    stats: {
      users,
      activeExchanges,
      completedExchanges,
      pendingReports,
      popularSkills: skills.map((s) => ({ name: s.name, category: s.category, count: s._count.users })),
    },
  });
});

router.get('/admin/users', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { displayName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {},
    include: { profile: true, _count: { select: { exchangesAsA: true, exchangesAsB: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      isActive: u.isActive,
      university: u.profile?.university ?? null,
      exchanges: u._count.exchangesAsA + u._count.exchangesAsB,
      createdAt: u.createdAt,
    })),
  });
});

router.post('/admin/users/:id/deactivate', async (req, res) => {
  if (req.params.id === req.user!.id) throw new HttpError(400, 'You cannot deactivate yourself');
  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

router.post('/admin/users/:id/reactivate', async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: true } });
  res.json({ ok: true });
});

router.get('/admin/skills', async (_req, res) => {
  const skills = await prisma.skill.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { category: 'asc' },
  });
  res.json({ skills });
});

router.post('/admin/skills', validate(skillSchema), async (req, res) => {
  const existing = await prisma.skill.findUnique({ where: { name: req.body.name } });
  if (existing) throw new HttpError(409, 'A skill with this name already exists');
  const skill = await prisma.skill.create({ data: req.body });
  res.status(201).json({ skill });
});

router.delete('/admin/skills/:id', async (req, res) => {
  await prisma.skill.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/admin/reports', async (_req, res) => {
  const reports = await prisma.report.findMany({
    include: {
      reporter: { select: { id: true, displayName: true } },
      target: { select: { id: true, displayName: true, isActive: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ reports });
});

router.post('/admin/reports/:id/resolve', async (req, res) => {
  await prisma.report.update({
    where: { id: req.params.id },
    data: { status: 'RESOLVED' },
  });
  res.json({ ok: true });
});

router.post('/admin/reports/:id/dismiss', async (req, res) => {
  await prisma.report.update({
    where: { id: req.params.id },
    data: { status: 'DISMISSED' },
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Monetization dashboard (PRD §26)
// ---------------------------------------------------------------------------

router.get('/admin/monetization', async (_req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalSubscribers,
    goldSubscribers,
    eliteSubscribers,
    activeBoosts,
    spotlightRuns,
    boostPurchases30d,
    newGoldThisMonth,
    upgradeGoldToEliteThisMonth,
    churnedSubs,
    totalUsers,
  ] = await Promise.all([
    prisma.subscription.count({ where: { status: 'ACTIVE', tier: { in: ['GOLD', 'ELITE'] } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', tier: 'GOLD' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', tier: 'ELITE' } }),
    prisma.userBoost.count({ where: { status: 'ACTIVE', expiresAt: { gt: now } } }),
    prisma.spotlightRun.count({ where: { expiresAt: { gt: now } } }),
    prisma.userBoost.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * 24 * 3600 * 1000) } } }),
    prisma.subscription.count({ where: { tier: 'GOLD', startedAt: { gte: monthStart } } }),
    prisma.subscription.count({
      where: { tier: 'ELITE', startedAt: { gte: monthStart } },
    }),
    prisma.subscription.count({
      where: { status: { in: ['CANCELLED', 'EXPIRED'] }, updatedAt: { gte: monthStart } },
    }),
    prisma.user.count(),
  ]);

  // Revenue by product (estimates from configured display prices — Play
  // Console remains the financial source of truth; no sensitive payment info).
  const [planRows, boostRows] = await Promise.all([
    prisma.subscriptionProduct.findMany(),
    prisma.boostProduct.findMany(),
  ]);
  const planPrice = new Map(
    planRows.map((p) => [
      p.googleProductId,
      { tier: p.tier, period: p.billingPeriod, displayPrice: p.displayPrice },
    ])
  );
  const activeSubs = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', tier: { in: ['GOLD', 'ELITE'] } },
    select: { productId: true },
  });
  const monthlyFactor = (p: { period: string }) => (p.period === 'YEARLY' ? 1 / 12 : 1);
  const priceNumeric = (d: string) => {
    const n = Number(d.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const mrr = activeSubs.reduce((sum, s) => {
    const plan = s.productId ? planPrice.get(s.productId) : undefined;
    if (!plan) return sum;
    return sum + priceNumeric(plan.displayPrice) * monthlyFactor(plan);
  }, 0);

  // Boost revenue by product (last 30 days).
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const recentBoosts = await prisma.userBoost.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { boostProductId: true },
  });
  const boostPrice = new Map(boostRows.map((b) => [b.id, { name: b.name, price: b.price }]));
  const revenueByProduct = new Map<string, { name: string; count: number; revenue: number }>();
  for (const b of recentBoosts) {
    const product = boostPrice.get(b.boostProductId);
    if (!product) continue;
    const key = product.name;
    const entry = revenueByProduct.get(key) ?? { name: product.name, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += product.price / 100; // kobo → naira
    revenueByProduct.set(key, entry);
  }

  res.json({
    monetization: {
      totalSubscribers,
      goldSubscribers,
      eliteSubscribers,
      monthlyRecurringRevenue: Math.round(mrr),
      subscriptionConversion: totalUsers > 0 ? Math.round((totalSubscribers / totalUsers) * 100) : 0,
      freeToGoldThisMonth: newGoldThisMonth,
      goldToEliteThisMonth: upgradeGoldToEliteThisMonth,
      churnedThisMonth: churnedSubs,
      activeBoosts,
      spotlightRunsActive: spotlightRuns,
      boostPurchases30d,
      revenueByProduct: [...revenueByProduct.values()],
      currency: 'NGN',
    },
  });
});

/** Admin: manage subscription products (prices configurable, PRD §35). */
router.get('/admin/products', async (_req, res) => {
  const [plans, boosts] = await Promise.all([
    prisma.subscriptionProduct.findMany({ orderBy: [{ tier: 'asc' }, { billingPeriod: 'asc' }] }),
    prisma.boostProduct.findMany({ orderBy: { type: 'asc' } }),
  ]);
  res.json({ plans, boosts });
});

router.post('/admin/products/plans', validate(planSchema), async (req, res) => {
  const { tier, billingPeriod, googleProductId, displayPrice } = req.body;
  const plan = await prisma.subscriptionProduct.upsert({
    where: { googleProductId },
    create: { tier, billingPeriod, googleProductId, displayPrice },
    update: { tier, billingPeriod, displayPrice },
  });
  res.status(201).json({ plan });
});

router.post('/admin/products/boosts', validate(boostProductSchema), async (req, res) => {
  const { name, description, type, durationHours, price, googleProductId } = req.body;
  const boost = await prisma.boostProduct.upsert({
    where: { googleProductId },
    create: { name, description, type, durationHours, price, googleProductId },
    update: { name, description, durationHours, price },
  });
  res.status(201).json({ boost });
});

export default router;
