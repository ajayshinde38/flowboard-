import { Router } from 'express';
import {
  PRIORITIES,
  PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUSES,
} from '@flowboard/shared';
import { prisma } from '../../config/prisma.js';
import {
  assertWorkspaceAccess,
  extractWorkspaceId,
  requireAuth,
  type AuthenticatedRequest,
} from '../../middleware/auth.js';
import { USER_SUMMARY_SELECT } from '../../utils/activity.js';
import { BadRequestError } from '../../utils/errors.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get('/overview', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = extractWorkspaceId(req);
    if (!workspaceId) throw new BadRequestError('workspaceId query parameter is required');
    await assertWorkspaceAccess(req.user!.id, workspaceId, 'MEMBER');

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [projects, tasks, members, upcomingTasks] = await Promise.all([
      prisma.project.findMany({
        where: { workspaceId },
        select: { id: true, status: true },
      }),
      prisma.task.findMany({
        where: { workspaceId },
        select: {
          id: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
          assigneeId: true,
        },
      }),
      prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: USER_SUMMARY_SELECT } },
      }),
      prisma.task.findMany({
        where: {
          workspaceId,
          status: { not: 'DONE' },
          dueDate: { not: null, lte: fourteenDaysFromNow },
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
        include: {
          assignee: { select: USER_SUMMARY_SELECT },
          creator: { select: USER_SUMMARY_SELECT },
          project: { select: { id: true, name: true, key: true, color: true } },
          labels: { include: { label: true } },
          _count: { select: { comments: true } },
        },
      }),
    ]);

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
    const activeTasks = totalTasks - completedTasks;
    const overdueTasks = tasks.filter(
      (t) => t.status !== 'DONE' && t.dueDate && t.dueDate < now
    ).length;
    const completionRate =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    // Team productivity: completed tasks in last 7 days per member normalized to percentage (or score)
    const completedLast7Days = tasks.filter(
      (t) => t.completedAt && t.completedAt >= sevenDaysAgo
    ).length;
    const onTimeDone = tasks.filter(
      (t) => t.status === 'DONE' && (!t.dueDate || (t.completedAt && t.completedAt <= t.dueDate))
    ).length;
    const teamProductivity =
      totalTasks === 0
        ? 0
        : Math.min(
            100,
            Math.round(
              (completionRate * 0.6) +
                ((completedTasks > 0 ? (onTimeDone / completedTasks) * 100 : 0) * 0.25) +
                Math.min(100, (completedLast7Days / Math.max(1, members.length)) * 25) * 0.15
            )
          );

    const statusCounts = new Map<string, number>();
    const priorityCounts = new Map<string, number>();
    const workloadMap = new Map<
      string,
      { assigned: number; inProgress: number; completed: number }
    >();

    for (const t of tasks) {
      statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
      priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);
      if (t.assigneeId) {
        const cur = workloadMap.get(t.assigneeId) ?? {
          assigned: 0,
          inProgress: 0,
          completed: 0,
        };
        cur.assigned += 1;
        if (t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW') cur.inProgress += 1;
        if (t.status === 'DONE') cur.completed += 1;
        workloadMap.set(t.assigneeId, cur);
      }
    }

    const statusDistribution = TASK_STATUSES.map((status) => ({
      status,
      label: TASK_STATUS_META[status].label,
      count: statusCounts.get(status) ?? 0,
      color: TASK_STATUS_META[status].color,
    }));

    const priorityDistribution = PRIORITIES.map((priority) => ({
      priority,
      label: PRIORITY_META[priority].label,
      count: priorityCounts.get(priority) ?? 0,
      color: PRIORITY_META[priority].color,
    }));

    const teamWorkload = members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      avatarColor: m.user.avatarColor,
      assigned: workloadMap.get(m.userId)?.assigned ?? 0,
      inProgress: workloadMap.get(m.userId)?.inProgress ?? 0,
      completed: workloadMap.get(m.userId)?.completed ?? 0,
    }));

    const upcomingDeadlines = upcomingTasks.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      projectId: t.projectId,
      identifier: t.identifier,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      position: t.position,
      version: t.version,
      dueDate: t.dueDate?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      assigneeId: t.assigneeId,
      assignee: t.assignee,
      creatorId: t.creatorId,
      creator: t.creator,
      project: t.project,
      labels: t.labels.map((tl) => ({
        id: tl.label.id,
        workspaceId: tl.label.workspaceId,
        name: tl.label.name,
        color: tl.label.color,
      })),
      commentCount: t._count.comments,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    res.json({
      kpis: {
        totalProjects,
        activeProjects,
        totalTasks,
        activeTasks,
        completedTasks,
        overdueTasks,
        completionRate,
        teamProductivity,
      },
      statusDistribution,
      priorityDistribution,
      teamWorkload,
      upcomingDeadlines,
    });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/task-trends', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = extractWorkspaceId(req);
    if (!workspaceId) throw new BadRequestError('workspaceId query parameter is required');
    await assertWorkspaceAccess(req.user!.id, workspaceId, 'MEMBER');

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [tasks, comments] = await Promise.all([
      prisma.task.findMany({
        where: { workspaceId },
        select: { createdAt: true, completedAt: true },
      }),
      prisma.taskComment.findMany({
        where: { task: { workspaceId }, createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
      }),
    ]);

    // Last 8 weeks task completion & creation
    const weeklyCompletion: Array<{ week: string; completed: number; created: number }> = [];
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const created = tasks.filter((t) => t.createdAt >= start && t.createdAt < end).length;
      const completed = tasks.filter(
        (t) => t.completedAt && t.completedAt >= start && t.completedAt < end
      ).length;
      weeklyCompletion.push({ week: label, completed, created });
    }

    // Last 6 months activity trends
    const monthlyActivity: Array<{
      month: string;
      tasksCreated: number;
      tasksCompleted: number;
      comments: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = start.toLocaleDateString('en-US', { month: 'short' });
      const tasksCreated = tasks.filter((t) => t.createdAt >= start && t.createdAt < end).length;
      const tasksCompleted = tasks.filter(
        (t) => t.completedAt && t.completedAt >= start && t.completedAt < end
      ).length;
      const commentCount = comments.filter(
        (c) => c.createdAt >= start && c.createdAt < end
      ).length;
      monthlyActivity.push({
        month: label,
        tasksCreated,
        tasksCompleted,
        comments: commentCount,
      });
    }

    res.json({ weeklyCompletion, monthlyActivity });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/project-progress', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId = extractWorkspaceId(req);
    if (!workspaceId) throw new BadRequestError('workspaceId query parameter is required');
    await assertWorkspaceAccess(req.user!.id, workspaceId, 'MEMBER');

    const now = new Date();
    const projects = await prisma.project.findMany({
      where: { workspaceId, status: { not: 'ARCHIVED' } },
      orderBy: { updatedAt: 'desc' },
      include: {
        tasks: { select: { status: true, dueDate: true } },
      },
    });

    res.json({
      projects: projects.map((p) => {
        const totalTasks = p.tasks.length;
        const completedTasks = p.tasks.filter((t) => t.status === 'DONE').length;
        const inProgressTasks = p.tasks.filter(
          (t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW'
        ).length;
        const overdueTasks = p.tasks.filter(
          (t) => t.status !== 'DONE' && t.dueDate && t.dueDate < now
        ).length;
        const progress =
          totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

        return {
          id: p.id,
          name: p.name,
          key: p.key,
          color: p.color,
          status: p.status,
          totalTasks,
          completedTasks,
          inProgressTasks,
          overdueTasks,
          progress,
          dueDate: p.dueDate?.toISOString() ?? null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});
