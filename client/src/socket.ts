import { io, Socket } from 'socket.io-client';
import { api, API_BASE } from './api';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket) return socket;
  const { token } = await api.get<{ token: string }>('/auth/token');
  socket = io(API_BASE || '/', {
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
