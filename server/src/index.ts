import http from 'http';
import { Server } from 'socket.io';
import { createApp } from './app';
import { env } from './lib/env';
import { setIo } from './socket';
import { verifyToken } from './middleware/auth';

const app = createApp();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: env.corsOrigins, credentials: true },
});

setIo(io);

// Socket.IO auth + rooms
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  const user = token ? verifyToken(token) : null;
  if (!user) return next(new Error('Unauthorized'));
  socket.data.userId = user.id;
  socket.join(`user:${user.id}`);
  next();
});

io.on('connection', (socket) => {
  // typing indicator relay inside exchange rooms
  socket.on('typing', ({ exchangeId, isTyping }: { exchangeId: string; isTyping: boolean }) => {
    socket.to(`exchange:${exchangeId}`).emit('typing', {
      userId: socket.data.userId,
      isTyping,
    });
  });

  socket.on('join-exchange', (exchangeId: string) => {
    socket.join(`exchange:${exchangeId}`);
  });

  socket.on('leave-exchange', (exchangeId: string) => {
    socket.leave(`exchange:${exchangeId}`);
  });
});

server.listen(env.port, () => {
  console.log(`SkillSwap API listening on ${env.serverUrl} (env: ${env.nodeEnv})`);
});

export { server, io };
