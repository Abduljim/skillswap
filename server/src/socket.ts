import type { Server as SocketServer } from 'socket.io';

/** Global socket.io handle so services can emit events. */
export let io: SocketServer | null = null;

export function setIo(server: SocketServer) {
  io = server;
}
