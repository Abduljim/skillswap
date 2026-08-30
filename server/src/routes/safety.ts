import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validate, HttpError } from '../middleware/validate';
import { reportSchema } from '../validation/schemas';
import { notify } from '../services/notify';

const router = Router();

router.use(requireAuth);

router.post('/reports', validate(reportSchema), async (req, res) => {
  const { targetId, reason, details } = req.body;
  if (targetId === req.user!.id) throw new HttpError(400, 'You cannot report yourself');
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new HttpError(404, 'User not found');
  const report = await prisma.report.create({
    data: { reporterId: req.user!.id, targetId, reason, details },
  });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  for (const admin of admins) {
    await notify(
      admin.id,
      'REPORT',
      'New report submitted',
      `${req.user!.displayName} reported ${target.displayName}: ${reason}`,
      '/admin/reports'
    );
  }
  res.status(201).json({ report });
});

export default router;
