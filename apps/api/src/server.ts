import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { initSocketServer } from './sockets/index.js';

const app = createApp();
const server = http.createServer(app);
initSocketServer(server);

server.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, frontendUrl: env.FRONTEND_URL },
    `FlowBoard API listening on http://localhost:${env.PORT}`
  );
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down FlowBoard API...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
