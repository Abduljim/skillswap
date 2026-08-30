import { prisma } from '../lib/prisma';
import { io } from '../socket';

export async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string
) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, link },
  });
  io?.to(`user:${userId}`).emit('notification', notification);
  return notification;
}
