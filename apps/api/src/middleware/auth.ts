import type { Request, Response, NextFunction } from 'express';
import type { WorkspaceRole } from '@flowboard/shared';
import { prisma } from '../config/prisma.js';
import { COOKIE_NAMES, verifyAccessToken } from '../utils/auth.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  workspaceMembership?: {
    workspaceId: string;
    role: WorkspaceRole;
  };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] as string | undefined;
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;

  const token = cookieToken || bearerToken;
  if (!token) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  // Enforce CSRF double-submit verification for cookie-authenticated state-changing requests
  if (cookieToken && !bearerToken && !SAFE_METHODS.has(req.method.toUpperCase())) {
    const csrfCookie = req.cookies?.[COOKIE_NAMES.CSRF_TOKEN] as string | undefined;
    const csrfHeader = req.headers['x-csrf-token'] as string | undefined;
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      next(new ForbiddenError('Invalid or missing CSRF token'));
      return;
    }
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
    next();
  } catch {
    next(new UnauthorizedError('Session expired or invalid token'));
  }
}

const ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export async function assertWorkspaceAccess(
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole = 'MEMBER'
): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
    },
    select: {
      workspaceId: true,
      role: true,
    },
  });

  if (!membership) {
    throw new ForbiddenError('Access to this workspace is denied');
  }

  const role = membership.role as WorkspaceRole;
  if (ROLE_WEIGHT[role] < ROLE_WEIGHT[minRole]) {
    throw new ForbiddenError(`Requires ${minRole} role or higher`);
  }

  return { workspaceId: membership.workspaceId, role };
}

export function extractWorkspaceId(req: Request): string | undefined {
  return (
    (req.params.workspaceId as string | undefined) ||
    (req.query.workspaceId as string | undefined) ||
    (typeof req.body === 'object' && req.body !== null
      ? (req.body.workspaceId as string | undefined)
      : undefined) ||
    (req.headers['x-workspace-id'] as string | undefined)
  );
}
