const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let inMemoryCsrfToken: string | null = null;

export function setCsrfToken(token: string | null | undefined) {
  if (token) {
    inMemoryCsrfToken = token;
  } else if (token === null) {
    inMemoryCsrfToken = null;
  }
}

export function hasSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((row) => row.startsWith('fb_csrf_token='));
}

function readCsrfFromCookie(): string | null {
  if (typeof document === 'undefined') return inMemoryCsrfToken;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('fb_csrf_token='));
  if (match) {
    return decodeURIComponent(match.split('=')[1] || '');
  }
  return inMemoryCsrfToken;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return false;
        const data = (await res.json().catch(() => null)) as { csrfToken?: string } | null;
        if (data?.csrfToken) setCsrfToken(data.csrfToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  skipAuthRefresh?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, signal, skipAuthRefresh = false } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        search.set(k, String(v));
      }
    }
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET') {
    const csrf = readCsrfFromCookie();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
    signal,
  });

  if (
    res.status === 401 &&
    !skipAuthRefresh &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/register') &&
    !path.startsWith('/auth/refresh')
  ) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, skipAuthRefresh: true });
    }
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const code = data?.error?.code || 'REQUEST_FAILED';
    const message = data?.error?.message || `Request failed with status ${res.status}`;
    throw new ApiClientError(res.status, code, message, data?.error?.details);
  }

  if (data && typeof data === 'object' && 'csrfToken' in data && typeof data.csrfToken === 'string') {
    setCsrfToken(data.csrfToken);
  }

  return data as T;
}
