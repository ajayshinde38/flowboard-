export const WORKSPACE_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Primary four columns displayed on the FlowBoard Kanban board */
export const BOARD_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'TASK_UPDATED',
  'TASK_COMMENTED',
  'TASK_MOVED',
  'PROJECT_INVITE',
  'WORKSPACE_INVITE',
  'MENTION',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; shortLabel: string; color: string; order: number }
> = {
  BACKLOG: { label: 'Backlog', shortLabel: 'Backlog', color: '#64748B', order: 0 },
  TODO: { label: 'To Do', shortLabel: 'To Do', color: '#64748B', order: 1 },
  IN_PROGRESS: { label: 'In Progress', shortLabel: 'In Progress', color: '#2563EB', order: 2 },
  IN_REVIEW: { label: 'Review', shortLabel: 'Review', color: '#D97706', order: 3 },
  DONE: { label: 'Done', shortLabel: 'Done', color: '#16A34A', order: 4 },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; weight: number }
> = {
  URGENT: { label: 'Urgent', color: '#DC2626', weight: 4 },
  HIGH: { label: 'High', color: '#EA580C', weight: 3 },
  MEDIUM: { label: 'Medium', color: '#CA8A04', weight: 2 },
  LOW: { label: 'Low', color: '#64748B', weight: 1 },
};

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; color: string }
> = {
  PLANNING: { label: 'Planning', color: '#64748B' },
  ACTIVE: { label: 'Active', color: '#2563EB' },
  ON_HOLD: { label: 'On Hold', color: '#D97706' },
  COMPLETED: { label: 'Completed', color: '#16A34A' },
  ARCHIVED: { label: 'Archived', color: '#94A3B8' },
};

export const SOCKET_EVENTS = {
  WORKSPACE_JOIN: 'workspace:join',
  WORKSPACE_LEAVE: 'workspace:leave',
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  TASK_MOVED: 'task:moved',
  COMMENT_CREATED: 'comment:created',
  NOTIFICATION_CREATED: 'notification:created',
  ACTIVITY_CREATED: 'activity:created',
  PROJECT_UPDATED: 'project:updated',
} as const;
