import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validate, HttpError } from '../middleware/validate';
import { sessionSchema, sessionUpdateSchema, reviewSchema } from '../validation/schemas';
import { notify } from '../services/notify';
import { trackEvent } from '../services/analytics';
import { io } from '../socket';

const router = Router();

router.use(requireAuth);

/** Loads an exchange and enforces participant access. */
async function loadExchange(exchangeId: string, userId: string) {
  const exchange = await prisma.exchange.findUnique({
    where: { id: exchangeId },
    include: {
      userA: { include: { profile: true } },
      userB: { include: { profile: true } },
    },
  });
  if (!exchange) throw new HttpError(404, 'Exchange not found');
  if (exchange.userAId !== userId && exchange.userBId !== userId) {
    throw new HttpError(403, 'You are not a participant in this exchange');
  }
  return exchange;
}

function otherIdOf(exchange: { userAId: string; userBId: string }, userId: string) {
  return exchange.userAId === userId ? exchange.userBId : exchange.userAId;
}

router.get('/exchanges', async (req, res) => {
  const exchanges = await prisma.exchange.findMany({
    where: { OR: [{ userAId: req.user!.id }, { userBId: req.user!.id }] },
    include: {
      userA: { include: { profile: true } },
      userB: { include: { profile: true } },
      sessions: { where: { status: 'SCHEDULED' }, orderBy: { scheduledAt: 'asc' } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      reviews: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const status = String(req.query.status || '');
  const filtered = status ? exchanges.filter((e) => e.status === status) : exchanges;

  const shaped = filtered.map((e) => {
    const other = e.userAId === req.user!.id ? e.userB : e.userA;
    const lastMessage = e.messages[0] || null;
    return {
      id: e.id,
      status: e.status,
      createdAt: e.createdAt,
      skillYouTeach: e.userAId === req.user!.id ? e.skillATeaches : e.skillBTeaches,
      skillYouLearn: e.userAId === req.user!.id ? e.skillBTeaches : e.skillATeaches,
      completeYou: e.userAId === req.user!.id ? e.completeA : e.completeB,
      completeOther: e.userAId === req.user!.id ? e.completeB : e.completeA,
      partner: { id: other.id, displayName: other.displayName, profile: other.profile },
      nextSession: e.sessions[0] || null,
      lastMessage: lastMessage
        ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId,
          }
        : null,
      myReview: e.reviews.find((r) => r.reviewerId === req.user!.id) || null,
    };
  });
  res.json({ exchanges: shaped });
});

router.get('/exchanges/:id', async (req, res) => {
  const exchange = await loadExchange(req.params.id, req.user!.id);
  const other = exchange.userAId === req.user!.id ? exchange.userB : exchange.userA;
  const nextSession = await prisma.session.findFirst({
    where: { exchangeId: exchange.id, status: 'SCHEDULED', scheduledAt: { gte: new Date() } },
    orderBy: { scheduledAt: 'asc' },
  });
  const [completedCount, messageCount, reviews] = await Promise.all([
    prisma.session.count({ where: { exchangeId: exchange.id, status: 'COMPLETED' } }),
    prisma.message.count({ where: { exchangeId: exchange.id } }),
    prisma.review.findMany({
      where: { exchangeId: exchange.id },
      include: { reviewer: { select: { id: true, displayName: true } } },
    }),
  ]);
  const youAreA = exchange.userAId === req.user!.id;
  res.json({
    exchange: {
      id: exchange.id,
      status: exchange.status,
      createdAt: exchange.createdAt,
      you: {
        teaching: youAreA ? exchange.skillATeaches : exchange.skillBTeaches,
        learning: youAreA ? exchange.skillBTeaches : exchange.skillATeaches,
        completeConfirmed: youAreA ? exchange.completeA : exchange.completeB,
      },
      partner: {
        teaching: youAreA ? exchange.skillBTeaches : exchange.skillATeaches,
        learning: youAreA ? exchange.skillATeaches : exchange.skillBTeaches,
        completeConfirmed: youAreA ? exchange.completeB : exchange.completeA,
        id: other.id,
        displayName: other.displayName,
        profile: other.profile,
      },
      nextSession,
      completedSessions: completedCount,
      messageCount,
      reviews,
    },
  });
});

router.post('/exchanges/:id/complete', async (req, res) => {
  const exchange = await loadExchange(req.params.id, req.user!.id);
  if (exchange.status !== 'ACTIVE') throw new HttpError(400, 'Exchange is not active');
  const youAreA = exchange.userAId === req.user!.id;
  const otherId = otherIdOf(exchange, req.user!.id);

  const completeA = youAreA ? true : exchange.completeA;
  const completeB = youAreA ? exchange.completeB : true;
  const nowBoth = completeA && completeB;
  const wasBoth = exchange.completeA && exchange.completeB;

  const updated = await prisma.exchange.update({
    where: { id: exchange.id },
    data: {
      completeA,
      completeB,
      ...(nowBoth ? { status: 'COMPLETED', completedAt: new Date() } : {}),
    },
  });

  if (nowBoth && !wasBoth) {
    await Promise.all([
      prisma.user.update({
        where: { id: exchange.userAId },
        data: { completedCount: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: exchange.userBId },
        data: { completedCount: { increment: 1 } },
      }),
      notify(
        otherId,
        'EXCHANGE_COMPLETED',
        'Exchange completed',
        `Your exchange with ${req.user!.displayName} is complete. Leave a review!`,
        `/exchanges/${exchange.id}`
      ),
    ]);
    trackEvent(req.user!.id, 'exchange_completed', { exchangeId: exchange.id }).catch(() => {});
    trackEvent(otherId, 'exchange_completed', { exchangeId: exchange.id }).catch(() => {});
  } else {
    await notify(
      otherId,
      'EXCHANGE_COMPLETED',
      'Exchange completion requested',
      `${req.user!.displayName} marked your exchange as complete. Confirm when you're ready.`,
      `/exchanges/${exchange.id}`
    );
  }

  res.json({ exchange: updated });
});

router.post('/exchanges/:id/cancel', async (req, res) => {
  const exchange = await loadExchange(req.params.id, req.user!.id);
  if (exchange.status !== 'ACTIVE') throw new HttpError(400, 'Exchange is not active');
  const updated = await prisma.exchange.update({
    where: { id: exchange.id },
    data: { status: 'CANCELLED' },
  });
  const otherId = otherIdOf(exchange, req.user!.id);
  await notify(
    otherId,
    'EXCHANGE_CANCELLED',
    'Exchange cancelled',
    `${req.user!.displayName} cancelled your exchange.`,
    `/exchanges/${exchange.id}`
  );
  res.json({ exchange: updated });
});

// ---------- messages ----------

router.get('/exchanges/:id/messages', async (req, res) => {
  const exchange = await loadExchange(req.params.id, req.user!.id);
  const messages = await prisma.message.findMany({
    where: { exchangeId: exchange.id },
    include: { sender: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: 'asc' },
  });
  await prisma.message.updateMany({
    where: { exchangeId: exchange.id, readAt: null, NOT: { senderId: req.user!.id } },
    data: { readAt: new Date() },
  });
  res.json({ messages });
});

router.post('/exchanges/:id/messages', async (req, res) => {
  const exchange = await loadExchange(req.params.id, req.user!.id);
  if (exchange.status !== 'ACTIVE') throw new HttpError(400, 'Exchange is not active');
  const content = String(req.body?.content || '').trim();
  if (!content || content.length > 2000) throw new HttpError(400, 'Invalid message');
  const message = await prisma.message.create({
    data: { exchangeId: exchange.id, senderId: req.user!.id, content },
    include: { sender: { select: { id: true, displayName: true } } },
  });
  const otherId = otherIdOf(exchange, req.user!.id);
  io?.to(`user:${otherId}`).emit('message', message);
  await notify(
    otherId,
    'NEW_MESSAGE',
    `New message from ${req.user!.displayName}`,
    content.slice(0, 80),
    `/exchanges/${exchange.id}/chat`
  );
  res.status(201).json({ message });
});

// ---------- sessions ----------

router.get('/exchanges/:id/sessions', async (req, res) => {
  const exchange = await loadExchange(req.params.id, req.user!.id);
  const sessions = await prisma.session.findMany({
    where: { exchangeId: exchange.id },
    orderBy: { scheduledAt: 'desc' },
  });
  res.json({ sessions });
});

router.post('/exchanges/:id/sessions', validate(sessionSchema), async (req, res) => {
  const exchange = await loadExchange(req.params.id, req.user!.id);
  if (exchange.status !== 'ACTIVE') throw new HttpError(400, 'Exchange is not active');
  const session = await prisma.session.create({
    data: {
      exchangeId: exchange.id,
      createdBy: req.user!.id,
      title: req.body.title,
      scheduledAt: new Date(req.body.scheduledAt),
      durationMinutes: req.body.durationMinutes,
      mode: req.body.mode,
      meetingLink: req.body.meetingLink || null,
      location: req.body.location || null,
      notes: req.body.notes || null,
    },
  });
  const otherId = otherIdOf(exchange, req.user!.id);
  await notify(
    otherId,
    'SESSION_SCHEDULED',
    'Session scheduled',
    `${req.user!.displayName} scheduled "${session.title}".`,
    `/exchanges/${exchange.id}/sessions`
  );
  res.status(201).json({ session });
});

router.put('/sessions/:id', validate(sessionUpdateSchema), async (req, res) => {
  const session = await prisma.session.findUnique({ where: { id: req.params.id } });
  if (!session) throw new HttpError(404, 'Session not found');
  await loadExchange(session.exchangeId, req.user!.id); // authorization
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      ...(req.body.title !== undefined ? { title: req.body.title } : {}),
      ...(req.body.scheduledAt !== undefined
        ? { scheduledAt: new Date(req.body.scheduledAt) }
        : {}),
      ...(req.body.durationMinutes !== undefined
        ? { durationMinutes: req.body.durationMinutes }
        : {}),
      ...(req.body.mode !== undefined ? { mode: req.body.mode } : {}),
      ...(req.body.meetingLink !== undefined ? { meetingLink: req.body.meetingLink } : {}),
      ...(req.body.location !== undefined ? { location: req.body.location } : {}),
      ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
      ...(req.body.status !== undefined ? { status: req.body.status } : {}),
    },
  });
  res.json({ session: updated });
});

router.delete('/sessions/:id', async (req, res) => {
  const session = await prisma.session.findUnique({ where: { id: req.params.id } });
  if (!session) throw new HttpError(404, 'Session not found');
  await loadExchange(session.exchangeId, req.user!.id); // authorization
  if (session.createdBy !== req.user!.id) {
    throw new HttpError(403, 'Only the creator can delete a session');
  }
  await prisma.session.delete({ where: { id: session.id } });
  res.json({ ok: true });
});

router.post('/sessions/:id/complete', async (req, res) => {
  const session = await prisma.session.findUnique({ where: { id: req.params.id } });
  if (!session) throw new HttpError(404, 'Session not found');
  const exchange = await loadExchange(session.exchangeId, req.user!.id); // authorization
  if (session.status === 'COMPLETED') throw new HttpError(400, 'Session already completed');
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { status: 'COMPLETED' },
  });
  const otherId = otherIdOf(exchange, req.user!.id);
  await notify(
    otherId,
    'SESSION_COMPLETED',
    'Session completed',
    `"${session.title}" was marked complete by ${req.user!.displayName}.`,
    `/exchanges/${exchange.id}/sessions`
  );
  res.json({ session: updated });
});

// ---------- reviews ----------

router.post('/exchanges/:id/review', validate(reviewSchema), async (req, res) => {
  const exchange = await loadExchange(req.params.id, req.user!.id);
  if (exchange.status !== 'COMPLETED') {
    throw new HttpError(400, 'You can only review completed exchanges');
  }
  const revieweeId = otherIdOf(exchange, req.user!.id);
  const existing = await prisma.review.findUnique({
    where: { exchangeId_reviewerId: { exchangeId: exchange.id, reviewerId: req.user!.id } },
  });
  if (existing) throw new HttpError(409, 'You have already reviewed this exchange');
  const review = await prisma.review.create({
    data: {
      exchangeId: exchange.id,
      reviewerId: req.user!.id,
      revieweeId,
      rating: req.body.rating,
      comment: req.body.comment || null,
    },
  });
  await notify(
    revieweeId,
    'NEW_REVIEW',
    'You received a review',
    `${req.user!.displayName} left you a ${req.body.rating}-star review.`,
    `/profile/${revieweeId}`
  );
  res.status(201).json({ review });
});

export default router;
