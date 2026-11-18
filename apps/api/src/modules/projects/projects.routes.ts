import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  createProjectSchema,
  SOCKET_EVENTS,
  updateProjectSchema,
} from '@flowboard/shared';
import { prisma } from '../../config/prisma.js';
import {
  assertWorkspaceAccess,
  extractWorkspaceId,
  requireAuth,
  type AuthenticatedRequest,
} from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { generateProjectKey } from '../../utils/auth.js';
import {
  createNotification,
  recordActivity,
  USER_SUMMARY_SELECT,
} from '../../utils/activity.js';
import { emitToWorkspace } from '../../sockets/index.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const PROJECT_INCLUDE = {
  owner: { select: USER_SUMMARY_SELECT },
  members: {
    include: { user: { select: USER_SUMMARY_SELECT } },
    orderBy: { joinedAt: 'asc' as const },
  },
  tasks: {
    select: { id: true, status: true },
  },
} as const;

type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: typeof PROJECT_INCLUDE }>;

function serializeProject(project: ProjectWithRelations) {
  const taskCount = project.tasks.length;
  const completedTaskCount = project.tasks.filter((t) => t.status === 'DONE').length;
  const progress = taskCount === 0 ? 0 : Math.round((completedTaskCount / taskCount) * 100);

  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    key: project.key,
    description: project.description,
    status: project.status,
    priority: project.priority,
    color: project.color,
    startDate: project.startDate?.toISOString() ?? null,
    dueDate: project.dueDate?.toISOString() ?? null,
    ownerId: project.ownerId,
    owner: project.owner,
    members: project.members.map((m) => ({
      userId: m.userId,
      user: m.user,
    })),
    taskCount,
    completedTaskCount,
    progress,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

projectsRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = extractWorkspaceId(req);
    if (!workspaceId) throw new BadRequestError('workspaceId query parameter is required');
    await assertWorkspaceAccess(req.user!.id, workspaceId, 'MEMBER');

    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const priority = req.query.priority ? String(req.query.priority) : undefined;
    const includeArchived = req.query.includeArchived === 'true';

    const where: Prisma.ProjectWhereInput = {
      workspaceId,
      ...(status
        ? { status: status as Prisma.EnumProjectStatusFilter }
        : includeArchived
          ? {}
          : { status: { not: 'ARCHIVED' } }),
      ...(priority ? { priority: priority as Prisma.EnumPriorityFilter } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { key: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const projects = await prisma.project.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      include: PROJECT_INCLUDE,
    });

    res.json({ items: projects.map(serializeProject) });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post(
  '/',
  validateBody(createProjectSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        workspaceId,
        name,
        key: rawKey,
        description,
        status,
        priority,
        color,
        startDate,
        dueDate,
        memberIds,
      } = req.body;
      const userId = req.user!.id;

      await assertWorkspaceAccess(userId, workspaceId, 'MEMBER');

      // Generate unique project key inside workspace
      let key = rawKey || generateProjectKey(name);
      const existingKey = await prisma.project.findUnique({
        where: { workspaceId_key: { workspaceId, key } },
      });
      if (existingKey) {
        key = `${key.slice(0, 4)}${Math.floor(10 + Math.random() * 89)}`;
      }

      // Ensure all requested memberIds belong to the workspace
      const uniqueMemberIds = Array.from(new Set([userId, ...(memberIds ?? [])]));
      const validMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId, userId: { in: uniqueMemberIds } },
        select: { userId: true },
      });
      const validMemberIds = validMembers.map((m) => m.userId);

      const project = await prisma.project.create({
        data: {
          workspaceId,
          ownerId: userId,
          name,
          key,
          description: description ?? null,
          status,
          priority,
          color,
          startDate: startDate ? new Date(startDate) : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          members: {
            create: validMemberIds.map((uid) => ({ userId: uid })),
          },
        },
        include: PROJECT_INCLUDE,
      });

      const dto = serializeProject(project);

      await recordActivity({
        workspaceId,
        projectId: project.id,
        actorId: userId,
        action: 'PROJECT_CREATED',
        entityType: 'PROJECT',
        entityId: project.id,
        summary: `created project "${project.name}" (${project.key})`,
      });

      for (const uid of validMemberIds) {
        if (uid !== userId) {
          await createNotification({
            workspaceId,
            userId: uid,
            type: 'PROJECT_INVITE',
            title: 'Added to project',
            message: `${req.user!.name} added you to project ${project.name}`,
            entityType: 'PROJECT',
            entityId: project.id,
          });
        }
      }

      emitToWorkspace(workspaceId, SOCKET_EVENTS.PROJECT_UPDATED, { type: 'created', project: dto });
      res.status(201).json({ project: dto });
    } catch (err) {
      next(err);
    }
  }
);

projectsRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const projectId = String(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: PROJECT_INCLUDE,
    });

    if (!project) throw new NotFoundError('Project not found');
    await assertWorkspaceAccess(req.user!.id, project.workspaceId, 'MEMBER');

    res.json({ project: serializeProject(project) });
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch(
  '/:id',
  validateBody(updateProjectSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const projectId = String(req.params.id);
      const existing = await prisma.project.findUnique({ where: { id: projectId } });
      if (!existing) throw new NotFoundError('Project not found');

      await assertWorkspaceAccess(req.user!.id, existing.workspaceId, 'MEMBER');

      const { memberIds, startDate, dueDate, ...fields } = req.body;

      const updated = await prisma.$transaction(async (tx) => {
        if (Array.isArray(memberIds)) {
          const validMembers = await tx.workspaceMember.findMany({
            where: {
              workspaceId: existing.workspaceId,
              userId: { in: Array.from(new Set([existing.ownerId, ...memberIds])) },
            },
            select: { userId: true },
          });
          await tx.projectMember.deleteMany({ where: { projectId } });
          await tx.projectMember.createMany({
            data: validMembers.map((m) => ({ projectId, userId: m.userId })),
          });
        }

        return tx.project.update({
          where: { id: projectId },
          data: {
            ...fields,
            ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
            ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
          },
          include: PROJECT_INCLUDE,
        });
      });

      const dto = serializeProject(updated);

      await recordActivity({
        workspaceId: existing.workspaceId,
        projectId,
        actorId: req.user!.id,
        action: fields.status === 'ARCHIVED' ? 'PROJECT_ARCHIVED' : 'PROJECT_UPDATED',
        entityType: 'PROJECT',
        entityId: projectId,
        summary:
          fields.status === 'ARCHIVED'
            ? `archived project "${updated.name}"`
            : `updated project "${updated.name}"`,
      });

      emitToWorkspace(existing.workspaceId, SOCKET_EVENTS.PROJECT_UPDATED, {
        type: 'updated',
        project: dto,
      });

      res.json({ project: dto });
    } catch (err) {
      next(err);
    }
  }
);

projectsRouter.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const projectId = String(req.params.id);
    const existing = await prisma.project.findUnique({ where: { id: projectId } });
    if (!existing) throw new NotFoundError('Project not found');

    const membership = await assertWorkspaceAccess(req.user!.id, existing.workspaceId, 'MEMBER');
    if (existing.ownerId !== req.user!.id && membership.role === 'MEMBER') {
      await assertWorkspaceAccess(req.user!.id, existing.workspaceId, 'ADMIN');
    }

    await prisma.project.delete({ where: { id: projectId } });

    await recordActivity({
      workspaceId: existing.workspaceId,
      actorId: req.user!.id,
      action: 'PROJECT_DELETED',
      entityType: 'PROJECT',
      entityId: projectId,
      summary: `deleted project "${existing.name}"`,
    });

    emitToWorkspace(existing.workspaceId, SOCKET_EVENTS.PROJECT_UPDATED, {
      type: 'deleted',
      projectId,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
