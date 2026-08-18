import { startBenchScheduler } from './services/benchScheduler.js';
import http from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { setSocketServer } from './lib/socket.js';
import { ensureDatabaseCompatibility } from './lib/databaseCompatibility.js';

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: env.FRONTEND_URL, credentials: true } });
setSocketServer(io);
io.on('connection', (socket) => { socket.emit('connected', { message: 'Europa CRM real-time channel connected' }); });

await prisma.$connect();
await ensureDatabaseCompatibility();
startBenchScheduler();

server.listen(env.PORT, () => console.log(`Europa CRM API running at http://localhost:${env.PORT}`));

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down...`);
  io.close();
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
