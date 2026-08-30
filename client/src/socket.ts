import { io, Socket } from 'socket.io-client';
import { api } from './api';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket) return socket;
  const { token } = await api.get<{ token: string }>('/auth/token');
  socket = io('/', {
    withCredentials: true,
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
