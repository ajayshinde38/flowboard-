import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { requireAuth, type AuthenticatedRequest } from '../../middleware/auth.js';
import { NotFoundError } from '../../utils/errors.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const workspaceId = req.query.workspaceId ? String(req.query.workspaceId) : undefined;
    const unreadOnly = req.query.unreadOnly === 'true';

    const where = {
      userId,
      ...(workspaceId ? { workspaceId } : {}),
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
      prisma.notification.count({
        where: { userId, ...(workspaceId ? { workspaceId } : {}), readAt: null },
      }),
    ]);

    res.json({
      items: items.map((n) => ({
        ...n,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch('/:id/read', async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!notification) throw new NotFoundError('Notification not found');

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });

    res.json({
      notification: {
        ...updated,
        readAt: updated.readAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/read-all', async (req: AuthenticatedRequest, res, next) => {
  try {
    const workspaceId =
      typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : undefined;
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user!.id,
        readAt: null,
        ...(workspaceId ? { workspaceId } : {}),
      },
      data: { readAt: new Date() },
    });

    res.json({ markedCount: result.count });
  } catch (err) {
    next(err);
  }
});
