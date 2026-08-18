import type { Server } from 'socket.io';
let io: Server | null = null;
export function setSocketServer(server: Server) { io = server; }
export function emitResourceEvent(resource: string, action: 'created' | 'updated' | 'deleted', payload: unknown) { io?.emit(`${resource}:${action}`, payload); }
