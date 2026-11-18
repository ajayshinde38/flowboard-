import crypto from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { Response, CookieOptions } from 'express';
import { env } from '../config/env.js';

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'fb_access_token',
  REFRESH_TOKEN: 'fb_refresh_token',
  CSRF_TOKEN: 'fb_csrf_token',
} as const;

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function generateOpaqueToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function baseCookieOptions(httpOnly: boolean, maxAgeMs: number): CookieOptions {
  return {
    httpOnly,
    secure: env.cookieSecure,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  csrfToken: string
): void {
  const accessMaxAge = 15 * 60 * 1000;
  const refreshMaxAge = env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, baseCookieOptions(true, accessMaxAge));
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, baseCookieOptions(true, refreshMaxAge));
  // CSRF double-submit cookie is readable by JS on the same origin and echoed in X-CSRF-Token header
  res.cookie(COOKIE_NAMES.CSRF_TOKEN, csrfToken, baseCookieOptions(false, refreshMaxAge));
}

export function clearAuthCookies(res: Response): void {
  const clearOpts: CookieOptions = {
    path: '/',
    secure: env.cookieSecure,
    sameSite: env.COOKIE_SAME_SITE,
  };
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { ...clearOpts, httpOnly: true });
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { ...clearOpts, httpOnly: true });
  res.clearCookie(COOKIE_NAMES.CSRF_TOKEN, { ...clearOpts, httpOnly: false });
}

export function slugifyWorkspace(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base || 'workspace'}-${suffix}`;
}

export function generateProjectKey(name: string): string {
  const letters = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (letters.length >= 2) {
    return letters
      .slice(0, 4)
      .map((w) => w[0])
      .join('');
  }
  const single = (letters[0] || 'PRJ').slice(0, 4);
  return single.length >= 2 ? single : `${single}X`;
}

export const AVATAR_COLORS = [
  '#786CFF',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
  '#8B5CF6',
  '#EF4444',
];

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
