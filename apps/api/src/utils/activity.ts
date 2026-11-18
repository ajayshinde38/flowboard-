import type { Prisma } from '@prisma/client';
import { SOCKET_EVENTS, type NotificationType } from '@flowboard/shared';
import { prisma } from '../config/prisma.js';
import { emitToUser, emitToWorkspace } from '../sockets/index.js';

export const USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarColor: true,
  jobTitle: true,
} as const;

export async function recordActivity(params: {
  workspaceId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  projectId?: string | null;
  taskId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const activity = await prisma.activityLog.create({
    data: {
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.summary,
      projectId: params.projectId ?? null,
      taskId: params.taskId ?? null,
      metadata: params.metadata ?? undefined,
    },
    include: {
      actor: { select: USER_SUMMARY_SELECT },
    },
  });

  emitToWorkspace(params.workspaceId, SOCKET_EVENTS.ACTIVITY_CREATED, {
    ...activity,
    createdAt: activity.createdAt.toISOString(),
  });

  return activity;
}

export async function createNotification(params: {
  workspaceId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
    },
  });

  emitToUser(params.userId, SOCKET_EVENTS.NOTIFICATION_CREATED, {
    ...notification,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  });

  return notification;
}
