import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validate, HttpError } from '../middleware/validate';
import { requestSchema } from '../validation/schemas';
import { notify } from '../services/notify';
import { tryConsume } from '../services/entitlements';
import { trackEvent } from '../services/analytics';
import { RequestStatus } from '@prisma/client';

const router = Router();

router.use(requireAuth);

router.post(
  '/exchange-requests',
  validate(requestSchema),
  async (req, res) => {
    const { recipientId, message, skillOffered, skillWanted } = req.body;
    if (recipientId === req.user!.id) throw new HttpError(400, 'You cannot request yourself');

    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient || !recipient.isActive) throw new HttpError(404, 'User not found');

    const blocked =
      (await prisma.block.count({
        where: {
          OR: [
            { blockerId: req.user!.id, blockedId: recipientId },
            { blockerId: recipientId, blockedId: req.user!.id },
          ],
        },
      })) > 0;
    if (blocked) throw new HttpError(403, 'You cannot send a request to this user');

    const existing = await prisma.exchangeRequest.findUnique({
      where: { senderId_recipientId: { senderId: req.user!.id, recipientId } },
    });
    if (existing && existing.status === 'PENDING') {
      throw new HttpError(409, 'You already have a pending request with this person');
    }

    // Free-tier monthly outgoing-request limit (incoming never counts).
    // Resending to the same person doesn't double-charge the quota.
    const isNewTarget = !existing;
    if (isNewTarget) {
      const allowance = await tryConsume(req.user!.id, 'request_sent');
      if (!allowance.ok) {
        return res.status(402).json({
          error: `You've used your ${allowance.limit} free exchange requests this month.`,
          code: 'REQUEST_LIMIT_REACHED',
          usage: allowance.usage,
          limit: allowance.limit,
        });
      }
    }

    const request = await prisma.exchangeRequest.upsert({
      where: { senderId_recipientId: { senderId: req.user!.id, recipientId } },
      create: { senderId: req.user!.id, recipientId, message, skillOffered, skillWanted },
      update: { message, skillOffered, skillWanted, status: 'PENDING' },
      include: { sender: { select: { id: true, displayName: true } } },
    });

    await notify(
      recipientId,
      'EXCHANGE_REQUEST',
      'New exchange request',
      `${req.user!.displayName} wants to exchange skills with you.`,
      '/requests'
    );
    trackEvent(req.user!.id, 'match_request_sent', { recipientId }).catch(() => {});
    res.status(201).json({ request });
  }
);

router.get('/exchange-requests', async (req, res) => {
  const [incoming, outgoing] = await Promise.all([
    prisma.exchangeRequest.findMany({
      where: { recipientId: req.user!.id },
      include: { sender: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.exchangeRequest.findMany({
      where: { senderId: req.user!.id },
      include: { recipient: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  res.json({ incoming, outgoing });
});

router.post('/exchange-requests/:id/accept', async (req, res) => {
  const request = await prisma.exchangeRequest.findUnique({ where: { id: req.params.id } });
  if (!request) throw new HttpError(404, 'Request not found');
  if (request.recipientId !== req.user!.id) {
    throw new HttpError(403, 'Only the recipient can accept this request');
  }
  if (request.status !== 'PENDING') {
    throw new HttpError(400, `This request is already ${request.status.toLowerCase()}`);
  }

  // Create the exchange (idempotent via unique requestId)
  const exchange = await prisma.exchange.upsert({
    where: { requestId: request.id },
    create: {
      userAId: request.senderId,
      userBId: request.recipientId,
      skillATeaches: request.skillOffered || 'Skills',
      skillBTeaches: request.skillWanted || 'Skills',
      requestId: request.id,
    },
    update: {},
  });

  await prisma.exchangeRequest.update({
    where: { id: request.id },
    data: { status: RequestStatus.ACCEPTED },
  });

  await notify(
    request.senderId,
    'REQUEST_ACCEPTED',
    'Request accepted',
    `${req.user!.displayName} accepted your exchange request. Your exchange workspace is ready.`,
    `/exchanges/${exchange.id}`
  );
  trackEvent(request.senderId, 'exchange_started', { exchangeId: exchange.id }).catch(() => {});
  trackEvent(request.recipientId, 'exchange_started', { exchangeId: exchange.id }).catch(() => {});
  res.json({ exchange });
});

router.post('/exchange-requests/:id/reject', async (req, res) => {
  const request = await prisma.exchangeRequest.findUnique({ where: { id: req.params.id } });
  if (!request) throw new HttpError(404, 'Request not found');
  if (request.recipientId !== req.user!.id) {
    throw new HttpError(403, 'Only the recipient can reject this request');
  }
  if (request.status !== 'PENDING') throw new HttpError(400, 'Request is not pending');
  await prisma.exchangeRequest.update({
    where: { id: request.id },
    data: { status: RequestStatus.REJECTED },
  });
  await notify(
    request.senderId,
    'REQUEST_REJECTED',
    'Request declined',
    `${req.user!.displayName} declined your exchange request.`,
    '/requests'
  );
  res.json({ ok: true });
});

router.post('/exchange-requests/:id/cancel', async (req, res) => {
  const request = await prisma.exchangeRequest.findUnique({ where: { id: req.params.id } });
  if (!request) throw new HttpError(404, 'Request not found');
  if (request.senderId !== req.user!.id) {
    throw new HttpError(403, 'Only the sender can cancel this request');
  }
  if (request.status !== 'PENDING') throw new HttpError(400, 'Request is not pending');
  await prisma.exchangeRequest.update({
    where: { id: request.id },
    data: { status: RequestStatus.CANCELLED },
  });
  res.json({ ok: true });
});

export default router;
