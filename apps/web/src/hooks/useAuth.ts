import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LoginInput, RegisterInput, UpdateProfileInput } from '@flowboard/shared';
import { authApi } from '@/services/api.service';
import { useUIStore } from '@/stores/uiStore';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;
const SESSION_HINT_KEY = 'flowboard_session_hint';

function shouldProbeSession(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.location.pathname.startsWith('/app')) return true;
  return window.sessionStorage.getItem(SESSION_HINT_KEY) === '1';
}

export function useAuth() {
  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useUIStore((s) => s.setActiveWorkspaceId);

  const query = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: ({ signal }) => authApi.me(signal),
    enabled: shouldProbeSession(),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (query.isError && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_HINT_KEY);
    } else if (query.data?.user && typeof window !== 'undefined') {
      window.sessionStorage.setItem(SESSION_HINT_KEY, '1');
    }
  }, [query.isError, query.data?.user]);

  const workspaces = query.data?.workspaces ?? [];
  const resolvedWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;

  useEffect(() => {
    if (resolvedWorkspace && resolvedWorkspace.id !== activeWorkspaceId) {
      setActiveWorkspaceId(resolvedWorkspace.id);
    }
  }, [resolvedWorkspace, activeWorkspaceId, setActiveWorkspaceId]);

  return {
    user: query.data?.user ?? null,
    workspaces,
    activeWorkspace: resolvedWorkspace,
    workspaceId: resolvedWorkspace?.id ?? null,
    unreadNotifications: query.data?.unreadNotifications ?? 0,
    isAuthenticated: Boolean(query.data?.user),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useLoginMutation() {
  const qc = useQueryClient();
  const setActiveWorkspaceId = useUIStore((s) => s.setActiveWorkspaceId);

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (data) => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SESSION_HINT_KEY, '1');
      }
      qc.setQueryData(AUTH_QUERY_KEY, data);
      if (data.workspaces[0]) {
        setActiveWorkspaceId(data.workspaces[0].id);
      }
      toast.success(`Welcome back, ${data.user.name.split(' ')[0]}`);
    },
  });
}

export function useRegisterMutation() {
  const qc = useQueryClient();
  const setActiveWorkspaceId = useUIStore((s) => s.setActiveWorkspaceId);

  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: (data) => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SESSION_HINT_KEY, '1');
      }
      qc.setQueryData(AUTH_QUERY_KEY, data);
      if (data.workspaces[0]) {
        setActiveWorkspaceId(data.workspaces[0].id);
      }
      toast.success('Workspace created! Welcome to FlowBoard.');
    },
  });
}

export function useLogoutMutation() {
  const qc = useQueryClient();
  const setActiveWorkspaceId = useUIStore((s) => s.setActiveWorkspaceId);
  const openTaskDrawer = useUIStore((s) => s.openTaskDrawer);

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(SESSION_HINT_KEY);
      }
      openTaskDrawer(null);
      setActiveWorkspaceId(null);
      qc.clear();
      toast.success('Signed out safely');
    },
  });
}

export function useUpdateProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => authApi.updateProfile(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      toast.success('Profile updated');
    },
  });
}
