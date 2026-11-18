import { Router } from 'express';
import {
  createLabelSchema,
  createWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateWorkspaceSchema,
} from '@flowboard/shared';
import { prisma } from '../../config/prisma.js';
import {
  assertWorkspaceAccess,
  requireAuth,
  type AuthenticatedRequest,
} from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import {
  generateOpaqueToken,
  hashPassword,
  pickAvatarColor,
  slugifyWorkspace,
} from '../../utils/auth.js';
import {
  createNotification,
  recordActivity,
  USER_SUMMARY_SELECT,
} from '../../utils/activity.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors.js';

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);

workspacesRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.user!.id },
      orderBy: { joinedAt: 'asc' },
      include: {
        workspace: {
          include: {
            _count: { select: { members: true, projects: true } },
          },
        },
      },
    });

    res.json({
      items: memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        description: m.workspace.description,
        role: m.role,
        memberCount: m.workspace._count.members,
        projectCount: m.workspace._count.projects,
        createdAt: m.workspace.createdAt.toISOString(),
        updatedAt: m.workspace.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.post(
  '/',
  validateBody(createWorkspaceSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { name, description } = req.body;
      const userId = req.user!.id;

      const workspace = await prisma.$transaction(async (tx) => {
        return tx.workspace.create({
          data: {
            name,
            slug: slugifyWorkspace(name),
            description: description ?? null,
            ownerId: userId,
            members: {
              create: { userId, role: 'OWNER' },
            },
            labels: {
              create: [
                { name: 'Frontend', color: '#786CFF' },
                { name: 'Backend', color: '#3B82F6' },
                { name: 'Design', color: '#EC4899' },
                { name: 'Bug', color: '#EF4444' },
              ],
            },
          },
          include: {
            _count: { select: { members: true, projects: true } },
          },
        });
      });

      await recordActivity({
        workspaceId: workspace.id,
        actorId: userId,
        action: 'WORKSPACE_CREATED',
        entityType: 'WORKSPACE',
        entityId: workspace.id,
        summary: `created workspace "${workspace.name}"`,
      });

      res.status(201).json({
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          role: 'OWNER',
          memberCount: workspace._count.members,
          projectCount: workspace._count.projects,
          createdAt: workspace.createdAt.toISOString(),
          updatedAt: workspace.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

workspacesRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = String(req.params.id);
    const membership = await assertWorkspaceAccess(req.user!.id, workspaceId, 'MEMBER');

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        _count: { select: { members: true, projects: true, tasks: true } },
      },
    });
    if (!workspace) throw new NotFoundError('Workspace not found');

    res.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        role: membership.role,
        memberCount: workspace._count.members,
        projectCount: workspace._count.projects,
        taskCount: workspace._count.tasks,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.patch(
  '/:id',
  validateBody(updateWorkspaceSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const workspaceId = String(req.params.id);
      const membership = await assertWorkspaceAccess(req.user!.id, workspaceId, 'ADMIN');

      const workspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: req.body,
        include: {
          _count: { select: { members: true, projects: true } },
        },
      });

      await recordActivity({
        workspaceId,
        actorId: req.user!.id,
        action: 'WORKSPACE_UPDATED',
        entityType: 'WORKSPACE',
        entityId: workspaceId,
        summary: `updated workspace settings for "${workspace.name}"`,
      });

      res.json({
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          role: membership.role,
          memberCount: workspace._count.members,
          projectCount: workspace._count.projects,
          createdAt: workspace.createdAt.toISOString(),
          updatedAt: workspace.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

workspacesRouter.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = String(req.params.id);
    await assertWorkspaceAccess(req.user!.id, workspaceId, 'OWNER');

    await prisma.workspace.delete({ where: { id: workspaceId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Members ---

workspacesRouter.get('/:id/members', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = String(req.params.id);
    await assertWorkspaceAccess(req.user!.id, workspaceId, 'MEMBER');

    const [members, tasks] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspaceId },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        include: { user: { select: USER_SUMMARY_SELECT } },
      }),
      prisma.task.findMany({
        where: { workspaceId, assigneeId: { not: null } },
        select: { assigneeId: true, status: true },
      }),
    ]);

    const taskStats = new Map<string, { assigned: number; completed: number }>();
    for (const t of tasks) {
      if (!t.assigneeId) continue;
      const cur = taskStats.get(t.assigneeId) ?? { assigned: 0, completed: 0 };
      cur.assigned += 1;
      if (t.status === 'DONE') cur.completed += 1;
      taskStats.set(t.assigneeId, cur);
    }

    res.json({
      items: members.map((m) => ({
        id: m.id,
        workspaceId: m.workspaceId,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        user: m.user,
        assignedTaskCount: taskStats.get(m.userId)?.assigned ?? 0,
        completedTaskCount: taskStats.get(m.userId)?.completed ?? 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.post(
  '/:id/members',
  validateBody(inviteMemberSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const workspaceId = String(req.params.id);
      await assertWorkspaceAccess(req.user!.id, workspaceId, 'ADMIN');

      const { email, role } = req.body;
      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (!workspace) throw new NotFoundError('Workspace not found');

      let user = await prisma.user.findUnique({ where: { email } });
      let provisioned = false;

      if (!user) {
        const displayName = email
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
        const randomHash = await hashPassword(generateOpaqueToken(24));
        user = await prisma.user.create({
          data: {
            email,
            name: displayName || 'Team Member',
            passwordHash: randomHash,
            avatarColor: pickAvatarColor(email),
            jobTitle: 'Team Member',
          },
        });
        provisioned = true;
      }

      const existing = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
      });
      if (existing) {
        throw new ConflictError('This user is already a member of the workspace');
      }

      const member = await prisma.workspaceMember.create({
        data: { workspaceId, userId: user.id, role },
        include: { user: { select: USER_SUMMARY_SELECT } },
      });

      await Promise.all([
        recordActivity({
          workspaceId,
          actorId: req.user!.id,
          action: 'MEMBER_ADDED',
          entityType: 'MEMBER',
          entityId: member.id,
          summary: `added ${user.name} (${role}) to the workspace`,
        }),
        createNotification({
          workspaceId,
          userId: user.id,
          type: 'WORKSPACE_INVITE',
          title: 'Added to workspace',
          message: `${req.user!.name} added you to ${workspace.name} as ${role}`,
          entityType: 'WORKSPACE',
          entityId: workspaceId,
        }),
      ]);

      res.status(201).json({
        member: {
          id: member.id,
          workspaceId: member.workspaceId,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt.toISOString(),
          user: member.user,
          assignedTaskCount: 0,
          completedTaskCount: 0,
        },
        provisioned,
      });
    } catch (err) {
      next(err);
    }
  }
);

workspacesRouter.patch(
  '/:id/members/:memberId',
  validateBody(updateMemberRoleSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const workspaceId = String(req.params.id);
      const memberId = String(req.params.memberId);
      await assertWorkspaceAccess(req.user!.id, workspaceId, 'ADMIN');

      const target = await prisma.workspaceMember.findFirst({
        where: { id: memberId, workspaceId },
        include: { user: { select: USER_SUMMARY_SELECT } },
      });
      if (!target) throw new NotFoundError('Workspace member not found');

      if (target.role === 'OWNER' && req.body.role !== 'OWNER') {
        const ownerCount = await prisma.workspaceMember.count({
          where: { workspaceId, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          throw new BadRequestError('Workspace must have at least one Owner');
        }
      }

      const updated = await prisma.workspaceMember.update({
        where: { id: memberId },
        data: { role: req.body.role },
        include: { user: { select: USER_SUMMARY_SELECT } },
      });

      await recordActivity({
        workspaceId,
        actorId: req.user!.id,
        action: 'MEMBER_ROLE_UPDATED',
        entityType: 'MEMBER',
        entityId: updated.id,
        summary: `updated ${updated.user.name}'s role to ${updated.role}`,
      });

      res.json({
        member: {
          id: updated.id,
          workspaceId: updated.workspaceId,
          userId: updated.userId,
          role: updated.role,
          joinedAt: updated.joinedAt.toISOString(),
          user: updated.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

workspacesRouter.delete('/:id/members/:memberId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = String(req.params.id);
    const memberId = String(req.params.memberId);
    await assertWorkspaceAccess(req.user!.id, workspaceId, 'ADMIN');

    const target = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      include: { user: { select: USER_SUMMARY_SELECT } },
    });
    if (!target) throw new NotFoundError('Workspace member not found');
    if (target.role === 'OWNER') {
      throw new BadRequestError('Cannot remove the workspace Owner');
    }

    await prisma.workspaceMember.delete({ where: { id: memberId } });

    await recordActivity({
      workspaceId,
      actorId: req.user!.id,
      action: 'MEMBER_REMOVED',
      entityType: 'MEMBER',
      entityId: memberId,
      summary: `removed ${target.user.name} from the workspace`,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Labels ---

workspacesRouter.get('/:id/labels', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = String(req.params.id);
    await assertWorkspaceAccess(req.user!.id, workspaceId, 'MEMBER');

    const labels = await prisma.label.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });

    res.json({ items: labels });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.post(
  '/:id/labels',
  validateBody(createLabelSchema.omit({ workspaceId: true })),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const workspaceId = String(req.params.id);
      await assertWorkspaceAccess(req.user!.id, workspaceId, 'MEMBER');

      const label = await prisma.label.create({
        data: {
          workspaceId,
          name: req.body.name,
          color: req.body.color,
        },
      });

      res.status(201).json({ label });
    } catch (err) {
      next(err);
    }
  }
);

workspacesRouter.delete('/:id/labels/:labelId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = String(req.params.id);
    const labelId = String(req.params.labelId);
    await assertWorkspaceAccess(req.user!.id, workspaceId, 'ADMIN');

    const label = await prisma.label.findFirst({ where: { id: labelId, workspaceId } });
    if (!label) throw new NotFoundError('Label not found');

    await prisma.label.delete({ where: { id: labelId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Activity Feed ---

workspacesRouter.get('/:id/activity', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = String(req.params.id);
    await assertWorkspaceAccess(req.user!.id, workspaceId, 'MEMBER');

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;

    const where = {
      workspaceId,
      ...(projectId ? { projectId } : {}),
      ...(entityType ? { entityType } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          actor: { select: USER_SUMMARY_SELECT },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      items: items.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
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
