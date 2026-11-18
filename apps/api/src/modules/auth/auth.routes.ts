import { Router, type Response } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@flowboard/shared';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth, type AuthenticatedRequest } from '../../middleware/auth.js';
import {
  clearAuthCookies,
  COOKIE_NAMES,
  generateCsrfToken,
  generateOpaqueToken,
  hashPassword,
  hashToken,
  pickAvatarColor,
  setAuthCookies,
  signAccessToken,
  slugifyWorkspace,
  verifyPassword,
} from '../../utils/auth.js';
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from '../../utils/errors.js';

export const authRouter = Router();

const DEFAULT_LABELS = [
  { name: 'Frontend', color: '#786CFF' },
  { name: 'Backend', color: '#3B82F6' },
  { name: 'Design', color: '#EC4899' },
  { name: 'Bug', color: '#EF4444' },
  { name: 'Security', color: '#F59E0B' },
  { name: 'Performance', color: '#10B981' },
];

async function getUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
    include: {
      workspace: {
        include: {
          _count: {
            select: { members: true, projects: true },
          },
        },
      },
    },
  });

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    description: m.workspace.description,
    role: m.role,
    memberCount: m.workspace._count.members,
    projectCount: m.workspace._count.projects,
    createdAt: m.workspace.createdAt.toISOString(),
    updatedAt: m.workspace.updatedAt.toISOString(),
  }));
}

async function issueSession(
  res: Response,
  user: { id: string; email: string; name: string },
  meta: { userAgent?: string; ipAddress?: string }
) {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
  });
  const rawRefresh = generateOpaqueToken(48);
  const refreshHash = hashToken(rawRefresh);
  const csrfToken = generateCsrfToken();

  const expiresAt = new Date(
    Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: refreshHash,
      userAgent: meta.userAgent?.slice(0, 255),
      ipAddress: meta.ipAddress?.slice(0, 64),
      expiresAt,
    },
  });

  setAuthCookies(res, accessToken, rawRefresh, csrfToken);
  return { csrfToken };
}

authRouter.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, workspaceName } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(password);
    const avatarColor = pickAvatarColor(email);
    const wsName = workspaceName || `${name.split(' ')[0]}'s Workspace`;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          avatarColor,
          jobTitle: 'Workspace Owner',
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatarColor: true,
          jobTitle: true,
          bio: true,
          timezone: true,
          createdAt: true,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: wsName,
          slug: slugifyWorkspace(wsName),
          description: 'Primary collaborative workspace',
          ownerId: user.id,
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
          labels: {
            create: DEFAULT_LABELS,
          },
        },
      });

      return { user, workspace };
    });

    const { csrfToken } = await issueSession(res, result.user, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    const workspaces = await getUserWorkspaces(result.user.id);

    res.status(201).json({
      user: {
        ...result.user,
        createdAt: result.user.createdAt.toISOString(),
      },
      workspaces,
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const rawIdentifier: string = req.body.email;
    const password: string = req.body.password;
    // Map local demo username "ajay" to the isolated non-privileged demo account
    const email = rawIdentifier === 'ajay' ? 'ajay@demo.flowboard.local' : rawIdentifier;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Invalid email/username or password');
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedError('Invalid email/username or password');
    }

    const { csrfToken } = await issueSession(res, user, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    const workspaces = await getUserWorkspaces(user.id);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarColor: user.avatarColor,
        jobTitle: user.jobTitle,
        bio: user.bio,
        timezone: user.timezone,
        createdAt: user.createdAt.toISOString(),
      },
      workspaces,
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const rawRefresh = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;
    if (!rawRefresh) {
      clearAuthCookies(res);
      throw new UnauthorizedError('Refresh session missing');
    }

    const tokenHash = hashToken(rawRefresh);
    const session = await prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      if (session && session.revokedAt) {
        // Potential refresh token replay: revoke all active sessions for this user
        await prisma.refreshSession.updateMany({
          where: { userId: session.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      clearAuthCookies(res);
      throw new UnauthorizedError('Refresh session expired or revoked');
    }

    // Rotate refresh token atomically
    await prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const { csrfToken } = await issueSession(res, session.user, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.json({
      ok: true,
      csrfToken,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        avatarColor: session.user.avatarColor,
        jobTitle: session.user.jobTitle,
        bio: session.user.bio,
        timezone: session.user.timezone,
        createdAt: session.user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const rawRefresh = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;
    if (rawRefresh) {
      const tokenHash = hashToken(rawRefresh);
      await prisma.refreshSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/forgot-password', validateBody(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    let devResetToken: string | undefined;
    if (user) {
      const rawToken = generateOpaqueToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      if (!env.isProduction) {
        devResetToken = rawToken;
      }
    }

    res.json({
      message: 'If an account matches that email, a password reset link has been generated.',
      ...(devResetToken ? { devResetToken } : {}),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', validateBody(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const tokenHash = hashToken(token);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestError('Reset token is invalid or has expired');
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.refreshSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    clearAuthCookies(res);
    res.json({ message: 'Password has been reset successfully. Please sign in.' });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarColor: true,
        jobTitle: true,
        bio: true,
        timezone: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    const [workspaces, unreadNotifications] = await Promise.all([
      getUserWorkspaces(userId),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    res.json({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
      workspaces,
      unreadNotifications,
      csrfToken: req.cookies?.[COOKIE_NAMES.CSRF_TOKEN] ?? null,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.patch(
  '/me',
  requireAuth,
  validateBody(updateProfileSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user!.id;
      const updated = await prisma.user.update({
        where: { id: userId },
        data: req.body,
        select: {
          id: true,
          name: true,
          email: true,
          avatarColor: true,
          jobTitle: true,
          bio: true,
          timezone: true,
          createdAt: true,
        },
      });

      res.json({
        user: {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new UnauthorizedError();

      const valid = await verifyPassword(user.passwordHash, currentPassword);
      if (!valid) {
        throw new BadRequestError('Current password is incorrect');
      }

      const passwordHash = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      next(err);
    }
  }
);
