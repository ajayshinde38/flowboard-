import type {
  ActivityLogDTO,
  AnalyticsOverviewDTO,
  BulkUpdateTasksInput,
  ChangePasswordInput,
  CreateCommentInput,
  CreateLabelInput,
  CreateProjectInput,
  CreateTaskInput,
  CreateWorkspaceInput,
  ForgotPasswordInput,
  InviteMemberInput,
  LabelDTO,
  LoginInput,
  MoveTaskInput,
  NotificationDTO,
  PaginatedResponse,
  ProjectDTO,
  ProjectProgressDTO,
  RegisterInput,
  ResetPasswordInput,
  TaskCommentDTO,
  TaskDTO,
  TaskTrendsDTO,
  UpdateMemberRoleInput,
  UpdateProfileInput,
  UpdateProjectInput,
  UpdateTaskInput,
  UpdateWorkspaceInput,
  UserSummary,
  WorkspaceMemberDTO,
  WorkspaceSummary,
} from '@flowboard/shared';
import { apiRequest, setCsrfToken } from '@/lib/api';

export interface AuthResponse {
  user: UserSummary;
  workspaces: WorkspaceSummary[];
  unreadNotifications?: number;
  csrfToken?: string | null;
}

export const authApi = {
  me: (signal?: AbortSignal) => apiRequest<AuthResponse>('/auth/me', { signal }),
  login: (input: LoginInput) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input }),
  register: (input: RegisterInput) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: input }),
  logout: async () => {
    const res = await apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' });
    setCsrfToken(null);
    return res;
  },
  forgotPassword: (input: ForgotPasswordInput) =>
    apiRequest<{ message: string; devResetToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: input,
    }),
  resetPassword: (input: ResetPasswordInput) =>
    apiRequest<{ message: string }>('/auth/reset-password', { method: 'POST', body: input }),
  updateProfile: (input: UpdateProfileInput) =>
    apiRequest<{ user: UserSummary }>('/auth/me', { method: 'PATCH', body: input }),
  changePassword: (input: ChangePasswordInput) =>
    apiRequest<{ message: string }>('/auth/change-password', { method: 'POST', body: input }),
};

export const workspacesApi = {
  list: () => apiRequest<{ items: WorkspaceSummary[] }>('/workspaces'),
  create: (input: CreateWorkspaceInput) =>
    apiRequest<{ workspace: WorkspaceSummary }>('/workspaces', { method: 'POST', body: input }),
  update: (id: string, input: UpdateWorkspaceInput) =>
    apiRequest<{ workspace: WorkspaceSummary }>(`/workspaces/${id}`, {
      method: 'PATCH',
      body: input,
    }),
  delete: (id: string) => apiRequest<{ ok: boolean }>(`/workspaces/${id}`, { method: 'DELETE' }),
  listMembers: (workspaceId: string) =>
    apiRequest<{ items: WorkspaceMemberDTO[] }>(`/workspaces/${workspaceId}/members`),
  inviteMember: (workspaceId: string, input: InviteMemberInput) =>
    apiRequest<{ member: WorkspaceMemberDTO; provisioned: boolean }>(
      `/workspaces/${workspaceId}/members`,
      { method: 'POST', body: input }
    ),
  updateMemberRole: (workspaceId: string, memberId: string, input: UpdateMemberRoleInput) =>
    apiRequest<{ member: WorkspaceMemberDTO }>(
      `/workspaces/${workspaceId}/members/${memberId}`,
      { method: 'PATCH', body: input }
    ),
  removeMember: (workspaceId: string, memberId: string) =>
    apiRequest<{ ok: boolean }>(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    }),
  listLabels: (workspaceId: string) =>
    apiRequest<{ items: LabelDTO[] }>(`/workspaces/${workspaceId}/labels`),
  createLabel: (workspaceId: string, input: Omit<CreateLabelInput, 'workspaceId'>) =>
    apiRequest<{ label: LabelDTO }>(`/workspaces/${workspaceId}/labels`, {
      method: 'POST',
      body: input,
    }),
  deleteLabel: (workspaceId: string, labelId: string) =>
    apiRequest<{ ok: boolean }>(`/workspaces/${workspaceId}/labels/${labelId}`, {
      method: 'DELETE',
    }),
  listActivity: (
    workspaceId: string,
    params?: { page?: number; limit?: number; projectId?: string; entityType?: string }
  ) =>
    apiRequest<PaginatedResponse<ActivityLogDTO>>(`/workspaces/${workspaceId}/activity`, {
      params,
    }),
};

export const projectsApi = {
  list: (
    workspaceId: string,
    params?: { search?: string; status?: string; priority?: string; includeArchived?: boolean }
  ) =>
    apiRequest<{ items: ProjectDTO[] }>('/projects', {
      params: { workspaceId, ...params },
    }),
  get: (id: string) => apiRequest<{ project: ProjectDTO }>(`/projects/${id}`),
  create: (input: CreateProjectInput) =>
    apiRequest<{ project: ProjectDTO }>('/projects', { method: 'POST', body: input }),
  update: (id: string, input: UpdateProjectInput) =>
    apiRequest<{ project: ProjectDTO }>(`/projects/${id}`, { method: 'PATCH', body: input }),
  delete: (id: string) => apiRequest<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
};

export const tasksApi = {
  list: (
    workspaceId: string,
    params?: {
      projectId?: string;
      status?: string;
      priority?: string;
      assigneeId?: string;
      labelId?: string;
      search?: string;
      overdue?: boolean;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    },
    signal?: AbortSignal
  ) =>
    apiRequest<PaginatedResponse<TaskDTO>>('/tasks', {
      params: { workspaceId, ...params },
      signal,
    }),
  get: (id: string) => apiRequest<{ task: TaskDTO }>(`/tasks/${id}`),
  create: (input: CreateTaskInput) =>
    apiRequest<{ task: TaskDTO }>('/tasks', { method: 'POST', body: input }),
  update: (id: string, input: UpdateTaskInput) =>
    apiRequest<{ task: TaskDTO }>(`/tasks/${id}`, { method: 'PATCH', body: input }),
  move: (id: string, input: MoveTaskInput) =>
    apiRequest<{ task: TaskDTO }>(`/tasks/${id}/move`, { method: 'PATCH', body: input }),
  bulkUpdate: (input: BulkUpdateTasksInput) =>
    apiRequest<{ updatedCount: number; items: TaskDTO[] }>('/tasks/bulk', {
      method: 'PATCH',
      body: input,
    }),
  delete: (id: string) => apiRequest<{ ok: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
  addComment: (taskId: string, input: CreateCommentInput) =>
    apiRequest<{ comment: TaskCommentDTO }>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: input,
    }),
  deleteComment: (taskId: string, commentId: string) =>
    apiRequest<{ ok: boolean }>(`/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    }),
};

export const analyticsApi = {
  overview: (workspaceId: string) =>
    apiRequest<AnalyticsOverviewDTO>('/analytics/overview', { params: { workspaceId } }),
  taskTrends: (workspaceId: string) =>
    apiRequest<TaskTrendsDTO>('/analytics/task-trends', { params: { workspaceId } }),
  projectProgress: (workspaceId: string) =>
    apiRequest<ProjectProgressDTO>('/analytics/project-progress', { params: { workspaceId } }),
};

export const notificationsApi = {
  list: (workspaceId?: string, unreadOnly?: boolean) =>
    apiRequest<{ items: NotificationDTO[]; unreadCount: number }>('/notifications', {
      params: { workspaceId, unreadOnly },
    }),
  markRead: (id: string) =>
    apiRequest<{ notification: NotificationDTO }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),
  markAllRead: (workspaceId?: string) =>
    apiRequest<{ markedCount: number }>('/notifications/read-all', {
      method: 'POST',
      body: { workspaceId },
    }),
};
