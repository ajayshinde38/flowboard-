import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@flowboard/shared';

function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/prisma.js';
import { COOKIE_NAMES, verifyAccessToken } from '../utils/auth.js';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    name: string;
    workspaceIds: Set<string>;
  };
}

let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      const parsedCookies = rawCookie ? parseCookieHeader(rawCookie) : {};
      const token =
        parsedCookies[COOKIE_NAMES.ACCESS_TOKEN] ||
        (typeof socket.handshake.auth?.token === 'string'
          ? socket.handshake.auth.token
          : undefined);

      if (!token) {
        next(new Error('UNAUTHORIZED'));
        return;
      }

      const payload = verifyAccessToken(token);
      (socket as AuthenticatedSocket).data = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        workspaceIds: new Set<string>(),
      };
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userId = socket.data.userId;

    // Personal room for targeted notifications
    socket.join(`user:${userId}`);
    logger.debug({ userId, socketId: socket.id }, 'Socket client connected');

    socket.on(
      SOCKET_EVENTS.WORKSPACE_JOIN,
      async (workspaceId: string, ack?: (res: { ok: boolean; error?: string }) => void) => {
        if (typeof workspaceId !== 'string' || !workspaceId) {
          ack?.({ ok: false, error: 'Invalid workspaceId' });
          return;
        }
        try {
          const membership = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } },
            select: { workspaceId: true },
          });
          if (!membership) {
            ack?.({ ok: false, error: 'Forbidden' });
            return;
          }
          await socket.join(`workspace:${workspaceId}`);
          socket.data.workspaceIds.add(workspaceId);
          ack?.({ ok: true });
        } catch (err) {
          logger.error({ err, userId, workspaceId }, 'Failed to join workspace room');
          ack?.({ ok: false, error: 'Server error' });
        }
      }
    );

    socket.on(SOCKET_EVENTS.WORKSPACE_LEAVE, async (workspaceId: string) => {
      if (typeof workspaceId !== 'string') return;
      await socket.leave(`workspace:${workspaceId}`);
      socket.data.workspaceIds.delete(workspaceId);
    });

    socket.on('disconnect', () => {
      logger.debug({ userId, socketId: socket.id }, 'Socket client disconnected');
    });
  });

  ioInstance = io;
  return io;
}

export function emitToWorkspace(workspaceId: string, event: string, payload: unknown): void {
  if (!ioInstance) return;
  ioInstance.to(`workspace:${workspaceId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
}
