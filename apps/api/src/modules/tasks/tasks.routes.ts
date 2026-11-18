import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  bulkUpdateTasksSchema,
  computeNewPosition,
  createCommentSchema,
  createTaskSchema,
  generateRebalancedPositions,
  moveTaskSchema,
  POSITION_STEP,
  SOCKET_EVENTS,
  TASK_STATUS_META,
  updateTaskSchema,
  type TaskStatus,
} from '@flowboard/shared';
import { prisma } from '../../config/prisma.js';
import {
  assertWorkspaceAccess,
  extractWorkspaceId,
  requireAuth,
  type AuthenticatedRequest,
} from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import {
  createNotification,
  recordActivity,
  USER_SUMMARY_SELECT,
} from '../../utils/activity.js';
import { emitToWorkspace } from '../../sockets/index.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors.js';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const TASK_INCLUDE = {
  assignee: { select: USER_SUMMARY_SELECT },
  creator: { select: USER_SUMMARY_SELECT },
  project: { select: { id: true, name: true, key: true, color: true } },
  labels: { include: { label: true } },
  _count: { select: { comments: true } },
} as const;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

function serializeTask(task: TaskWithRelations) {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    identifier: task.identifier,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    position: task.position,
    version: task.version,
    dueDate: task.dueDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    assigneeId: task.assigneeId,
    assignee: task.assignee,
    creatorId: task.creatorId,
    creator: task.creator,
    project: task.project,
    labels: task.labels.map((tl) => ({
      id: tl.label.id,
      workspaceId: tl.label.workspaceId,
      name: tl.label.name,
      color: tl.label.color,
    })),
    commentCount: task._count.comments,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

tasksRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = extractWorkspaceId(req);
    if (!workspaceId) throw new BadRequestError('workspaceId query parameter is required');
    await assertWorkspaceAccess(req.user!.id, workspaceId, 'MEMBER');

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const priority = req.query.priority ? String(req.query.priority) : undefined;
    const assigneeId = req.query.assigneeId ? String(req.query.assigneeId) : undefined;
    const labelId = req.query.labelId ? String(req.query.labelId) : undefined;
    const overdue = req.query.overdue === 'true';
    const sortBy = String(req.query.sortBy || 'position');
    const sortDir = req.query.sortDir === 'desc' ? 'desc' : 'asc';

    const where: Prisma.TaskWhereInput = {
      workspaceId,
      ...(projectId ? { projectId } : {}),
      ...(status ? { status: status as Prisma.EnumTaskStatusFilter } : {}),
      ...(priority ? { priority: priority as Prisma.EnumPriorityFilter } : {}),
      ...(assigneeId
        ? assigneeId === 'me'
          ? { assigneeId: req.user!.id }
          : assigneeId === 'unassigned'
            ? { assigneeId: null }
            : { assigneeId }
        : {}),
      ...(labelId ? { labels: { some: { labelId } } } : {}),
      ...(overdue ? { dueDate: { lt: new Date() }, status: { not: 'DONE' } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { identifier: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderByMap: Record<string, Prisma.TaskOrderByWithRelationInput[]> = {
      position: [{ status: 'asc' }, { position: 'asc' }],
      dueDate: [{ dueDate: sortDir }, { position: 'asc' }],
      priority: [{ priority: sortDir }, { position: 'asc' }],
      createdAt: [{ createdAt: sortDir }],
      updatedAt: [{ updatedAt: sortDir }],
      title: [{ title: sortDir }],
    };

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: orderByMap[sortBy] ?? orderByMap.position,
        skip: (page - 1) * limit,
        take: limit,
        include: TASK_INCLUDE,
      }),
      prisma.task.count({ where }),
    ]);

    res.json({
      items: items.map(serializeTask),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

tasksRouter.post(
  '/',
  validateBody(createTaskSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        workspaceId,
        projectId,
        title,
        description,
        status,
        priority,
        assigneeId,
        dueDate,
        labelIds,
      } = req.body;
      const userId = req.user!.id;

      await assertWorkspaceAccess(userId, workspaceId, 'MEMBER');

      const project = await prisma.project.findFirst({
        where: { id: projectId, workspaceId },
      });
      if (!project) {
        throw new NotFoundError('Project not found in this workspace');
      }

      if (assigneeId) {
        const assigneeMember = await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
        });
        if (!assigneeMember) {
          throw new BadRequestError('Assignee must be a member of this workspace');
        }
      }

      const task = await prisma.$transaction(async (tx) => {
        const updatedProject = await tx.project.update({
          where: { id: projectId },
          data: { taskCounter: { increment: 1 } },
          select: { key: true, taskCounter: true },
        });

        const lastInCol = await tx.task.findFirst({
          where: { workspaceId, projectId, status },
          orderBy: { position: 'desc' },
          select: { position: true },
        });

        const position = (lastInCol?.position ?? 0) + POSITION_STEP;
        const identifier = `${updatedProject.key}-${updatedProject.taskCounter}`;

        let validLabelIds: string[] = [];
        if (labelIds && labelIds.length > 0) {
          const labels = await tx.label.findMany({
            where: { workspaceId, id: { in: labelIds } },
            select: { id: true },
          });
          validLabelIds = labels.map((l) => l.id);
        }

        return tx.task.create({
          data: {
            workspaceId,
            projectId,
            creatorId: userId,
            assigneeId: assigneeId ?? null,
            identifier,
            title,
            description: description ?? null,
            status,
            priority,
            position,
            dueDate: dueDate ? new Date(dueDate) : null,
            completedAt: status === 'DONE' ? new Date() : null,
            ...(validLabelIds.length > 0
              ? { labels: { create: validLabelIds.map((labelId) => ({ labelId })) } }
              : {}),
          },
          include: TASK_INCLUDE,
        });
      });

      const dto = serializeTask(task);

      await recordActivity({
        workspaceId,
        projectId,
        taskId: task.id,
        actorId: userId,
        action: 'TASK_CREATED',
        entityType: 'TASK',
        entityId: task.id,
        summary: `created task ${task.identifier}: "${task.title}"`,
      });

      if (task.assigneeId && task.assigneeId !== userId) {
        await createNotification({
          workspaceId,
          userId: task.assigneeId,
          type: 'TASK_ASSIGNED',
          title: 'New task assigned',
          message: `${req.user!.name} assigned you to ${task.identifier}: ${task.title}`,
          entityType: 'TASK',
          entityId: task.id,
        });
      }

      emitToWorkspace(workspaceId, SOCKET_EVENTS.TASK_CREATED, {
        task: dto,
        actorId: userId,
      });

      res.status(201).json({ task: dto });
    } catch (err) {
      next(err);
    }
  }
);

tasksRouter.patch(
  '/bulk',
  validateBody(bulkUpdateTasksSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { workspaceId, taskIds, status, priority, assigneeId } = req.body;
      const userId = req.user!.id;

      await assertWorkspaceAccess(userId, workspaceId, 'MEMBER');

      const updateData: Prisma.TaskUpdateManyMutationInput = {
        ...(status !== undefined
          ? {
              status,
              completedAt: status === 'DONE' ? new Date() : null,
            }
          : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(assigneeId !== undefined ? { assigneeId } : {}),
        version: { increment: 1 },
      };

      const result = await prisma.task.updateMany({
        where: { id: { in: taskIds }, workspaceId },
        data: updateData,
      });

      const updatedTasks = await prisma.task.findMany({
        where: { id: { in: taskIds }, workspaceId },
        include: TASK_INCLUDE,
      });

      const dtos = updatedTasks.map(serializeTask);

      await recordActivity({
        workspaceId,
        actorId: userId,
        action: 'TASKS_BULK_UPDATED',
        entityType: 'TASK',
        entityId: taskIds[0],
        summary: `bulk updated ${result.count} task(s)`,
        metadata: { count: result.count, status, priority },
      });

      for (const dto of dtos) {
        emitToWorkspace(workspaceId, SOCKET_EVENTS.TASK_UPDATED, {
          task: dto,
          actorId: userId,
        });
      }

      res.json({ updatedCount: result.count, items: dtos });
    } catch (err) {
      next(err);
    }
  }
);

tasksRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const taskId = String(req.params.id);
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        ...TASK_INCLUDE,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: USER_SUMMARY_SELECT } },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: { actor: { select: USER_SUMMARY_SELECT } },
        },
      },
    });

    if (!task) throw new NotFoundError('Task not found');
    await assertWorkspaceAccess(req.user!.id, task.workspaceId, 'MEMBER');

    res.json({
      task: {
        ...serializeTask(task),
        comments: task.comments.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
        activities: task.activities.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

tasksRouter.patch(
  '/:id',
  validateBody(updateTaskSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const taskId = String(req.params.id);
      const existing = await prisma.task.findUnique({ where: { id: taskId } });
      if (!existing) throw new NotFoundError('Task not found');

      await assertWorkspaceAccess(req.user!.id, existing.workspaceId, 'MEMBER');

      const { labelIds, dueDate, expectedVersion, ...fields } = req.body;

      if (expectedVersion !== undefined && existing.version !== expectedVersion) {
        throw new ConflictError(
          'This task was updated by another user. Refreshing latest state.',
          { currentVersion: existing.version }
        );
      }

      if (fields.assigneeId) {
        const isMember = await prisma.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: existing.workspaceId,
              userId: fields.assigneeId,
            },
          },
        });
        if (!isMember) {
          throw new BadRequestError('Assignee must belong to the workspace');
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (Array.isArray(labelIds)) {
          const validLabels = await tx.label.findMany({
            where: { workspaceId: existing.workspaceId, id: { in: labelIds } },
            select: { id: true },
          });
          await tx.taskLabel.deleteMany({ where: { taskId } });
          if (validLabels.length > 0) {
            await tx.taskLabel.createMany({
              data: validLabels.map((l) => ({ taskId, labelId: l.id })),
            });
          }
        }

        const nextStatus = fields.status ?? existing.status;
        const completedAt =
          nextStatus === 'DONE'
            ? existing.completedAt ?? new Date()
            : fields.status
              ? null
              : existing.completedAt;

        return tx.task.update({
          where: { id: taskId },
          data: {
            ...fields,
            ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
            completedAt,
            version: { increment: 1 },
          },
          include: TASK_INCLUDE,
        });
      });

      const dto = serializeTask(updated);

      await recordActivity({
        workspaceId: existing.workspaceId,
        projectId: updated.projectId,
        taskId: updated.id,
        actorId: req.user!.id,
        action: 'TASK_UPDATED',
        entityType: 'TASK',
        entityId: updated.id,
        summary: `updated task ${updated.identifier}: "${updated.title}"`,
      });

      if (
        updated.assigneeId &&
        updated.assigneeId !== existing.assigneeId &&
        updated.assigneeId !== req.user!.id
      ) {
        await createNotification({
          workspaceId: existing.workspaceId,
          userId: updated.assigneeId,
          type: 'TASK_ASSIGNED',
          title: 'Task assigned to you',
          message: `${req.user!.name} assigned you to ${updated.identifier}: ${updated.title}`,
          entityType: 'TASK',
          entityId: updated.id,
        });
      }

      emitToWorkspace(existing.workspaceId, SOCKET_EVENTS.TASK_UPDATED, {
        task: dto,
        actorId: req.user!.id,
      });

      res.json({ task: dto });
    } catch (err) {
      next(err);
    }
  }
);

tasksRouter.patch(
  '/:id/move',
  validateBody(moveTaskSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const taskId = String(req.params.id);
      const { status, beforeTaskId, afterTaskId, position: explicitPosition, expectedVersion } =
        req.body;
      const userId = req.user!.id;

      const existing = await prisma.task.findUnique({ where: { id: taskId } });
      if (!existing) throw new NotFoundError('Task not found');

      await assertWorkspaceAccess(userId, existing.workspaceId, 'MEMBER');

      if (expectedVersion !== undefined && existing.version !== expectedVersion) {
        throw new ConflictError(
          'Task was moved or modified by another teammate. Syncing latest board state.',
          { currentVersion: existing.version }
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        let nextPos: number;
        let needsRebalance = false;

        if (typeof explicitPosition === 'number') {
          nextPos = explicitPosition;
        } else {
          const [beforeTask, afterTask] = await Promise.all([
            beforeTaskId
              ? tx.task.findFirst({
                  where: { id: beforeTaskId, workspaceId: existing.workspaceId },
                  select: { position: true },
                })
              : null,
            afterTaskId
              ? tx.task.findFirst({
                  where: { id: afterTaskId, workspaceId: existing.workspaceId },
                  select: { position: true },
                })
              : null,
          ]);

          const calc = computeNewPosition(beforeTask?.position, afterTask?.position);
          nextPos = calc.position;
          needsRebalance = calc.needsRebalance;
        }

        const completedAt =
          status === 'DONE'
            ? existing.completedAt ?? new Date()
            : null;

        let moved = await tx.task.update({
          where: { id: taskId },
          data: {
            status,
            position: nextPos,
            completedAt,
            version: { increment: 1 },
          },
          include: TASK_INCLUDE,
        });

        // Rebalance column positions atomically if gap becomes too tight
        if (needsRebalance) {
          const columnTasks = await tx.task.findMany({
            where: {
              workspaceId: existing.workspaceId,
              projectId: existing.projectId,
              status,
            },
            orderBy: { position: 'asc' },
            select: { id: true },
          });
          const newPositions = generateRebalancedPositions(columnTasks.length);
          await Promise.all(
            columnTasks.map((t, idx) =>
              tx.task.update({
                where: { id: t.id },
                data: { position: newPositions[idx] },
              })
            )
          );
          moved = await tx.task.findUniqueOrThrow({
            where: { id: taskId },
            include: TASK_INCLUDE,
          });
        }

        return moved;
      });

      const dto = serializeTask(updated);

      if (existing.status !== status) {
        const fromLabel = TASK_STATUS_META[existing.status as TaskStatus].label;
        const toLabel = TASK_STATUS_META[status as TaskStatus].label;
        await recordActivity({
          workspaceId: existing.workspaceId,
          projectId: existing.projectId,
          taskId: existing.id,
          actorId: userId,
          action: 'TASK_MOVED',
          entityType: 'TASK',
          entityId: existing.id,
          summary: `moved ${existing.identifier} from ${fromLabel} to ${toLabel}`,
        });
      }

      emitToWorkspace(existing.workspaceId, SOCKET_EVENTS.TASK_MOVED, {
        task: dto,
        previousStatus: existing.status,
        actorId: userId,
      });

      res.json({ task: dto });
    } catch (err) {
      next(err);
    }
  }
);

tasksRouter.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const taskId = String(req.params.id);
    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) throw new NotFoundError('Task not found');

    await assertWorkspaceAccess(req.user!.id, existing.workspaceId, 'MEMBER');

    await prisma.task.delete({ where: { id: taskId } });

    await recordActivity({
      workspaceId: existing.workspaceId,
      projectId: existing.projectId,
      actorId: req.user!.id,
      action: 'TASK_DELETED',
      entityType: 'TASK',
      entityId: taskId,
      summary: `deleted task ${existing.identifier}: "${existing.title}"`,
    });

    emitToWorkspace(existing.workspaceId, SOCKET_EVENTS.TASK_DELETED, {
      taskId,
      projectId: existing.projectId,
      actorId: req.user!.id,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Comments ---

tasksRouter.post(
  '/:id/comments',
  validateBody(createCommentSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const taskId = String(req.params.id);
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) throw new NotFoundError('Task not found');

      await assertWorkspaceAccess(req.user!.id, task.workspaceId, 'MEMBER');

      const comment = await prisma.taskComment.create({
        data: {
          taskId,
          authorId: req.user!.id,
          content: req.body.content,
        },
        include: { author: { select: USER_SUMMARY_SELECT } },
      });

      const dto = {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      };

      await recordActivity({
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId,
        actorId: req.user!.id,
        action: 'COMMENT_ADDED',
        entityType: 'COMMENT',
        entityId: comment.id,
        summary: `commented on ${task.identifier}: "${task.title}"`,
      });

      const notifyUserIds = new Set<string>();
      if (task.assigneeId && task.assigneeId !== req.user!.id) notifyUserIds.add(task.assigneeId);
      if (task.creatorId !== req.user!.id) notifyUserIds.add(task.creatorId);

      for (const uid of notifyUserIds) {
        await createNotification({
          workspaceId: task.workspaceId,
          userId: uid,
          type: 'TASK_COMMENTED',
          title: `New comment on ${task.identifier}`,
          message: `${req.user!.name}: ${req.body.content.slice(0, 120)}`,
          entityType: 'TASK',
          entityId: task.id,
        });
      }

      emitToWorkspace(task.workspaceId, SOCKET_EVENTS.COMMENT_CREATED, {
        taskId,
        comment: dto,
        actorId: req.user!.id,
      });

      res.status(201).json({ comment: dto });
    } catch (err) {
      next(err);
    }
  }
);

tasksRouter.delete('/:id/comments/:commentId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const taskId = String(req.params.id);
    const commentId = String(req.params.commentId);

    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
      include: { task: true },
    });
    if (!comment || comment.taskId !== taskId) {
      throw new NotFoundError('Comment not found');
    }

    const membership = await assertWorkspaceAccess(
      req.user!.id,
      comment.task.workspaceId,
      'MEMBER'
    );
    if (comment.authorId !== req.user!.id && membership.role === 'MEMBER') {
      throw new ForbiddenError('You can only delete your own comments');
    }

    await prisma.taskComment.delete({ where: { id: commentId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
