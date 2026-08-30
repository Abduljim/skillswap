import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validate, HttpError } from '../middleware/validate';
import { addUserSkillSchema, skillSchema } from '../validation/schemas';
import { trackEvent } from '../services/analytics';
import { completeReferral } from './billing';

const router = Router();

router.get('/skills', async (_req, res) => {
  const skills = await prisma.skill.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  res.json({ skills });
});

router.use(requireAuth);

router.post('/skills', validate(skillSchema), async (req, res) => {
  const { name, category } = req.body;
  const existing = await prisma.skill.findUnique({ where: { name } });
  if (existing) throw new HttpError(409, 'A skill with this name already exists');
  const skill = await prisma.skill.create({ data: { name, category } });
  res.status(201).json({ skill });
});

router.post('/skills/:id/add', validate(addUserSkillSchema), async (req, res) => {
  const skill = await prisma.skill.findUnique({ where: { id: req.params.id } });
  if (!skill) throw new HttpError(404, 'Skill not found');
  const { type, level } = req.body;
  const existing = await prisma.userSkill.findUnique({
    where: { userId_skillId_type: { userId: req.user!.id, skillId: skill.id, type } },
  });
  if (existing) {
    const updated = await prisma.userSkill.update({
      where: { id: existing.id },
      data: { level },
      include: { skill: true },
    });
    return res.json({ userSkill: updated });
  }
  const userSkill = await prisma.userSkill.create({
    data: { userId: req.user!.id, skillId: skill.id, type, level },
    include: { skill: true },
  });

  trackEvent(req.user!.id, 'skill_added', { skill: skill.name, type }).catch(() => {});

  // Onboarding completes once the user has at least one TEACH and one WANT
  // skill — fire the event and settle any pending referral reward.
  const [teachCount, wantCount] = await Promise.all([
    prisma.userSkill.count({ where: { userId: req.user!.id, type: 'TEACH' } }),
    prisma.userSkill.count({ where: { userId: req.user!.id, type: 'WANT' } }),
  ]);
  if (teachCount === 1 && wantCount === 1) {
    trackEvent(req.user!.id, 'onboarding_completed', {}).catch(() => {});
    completeReferral(req.user!.id).catch(() => {});
  }

  res.status(201).json({ userSkill });
});

router.delete('/skills/:id/remove', async (req, res) => {
  const type = String(req.query.type || 'TEACH') as 'TEACH' | 'WANT';
  await prisma.userSkill.deleteMany({
    where: { userId: req.user!.id, skillId: req.params.id, type },
  });
  res.json({ ok: true });
});

export default router;
