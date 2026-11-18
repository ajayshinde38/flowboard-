import type {
  NotificationType,
  Priority,
  ProjectStatus,
  TaskStatus,
  WorkspaceRole,
} from './enums.js';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  jobTitle?: string | null;
  bio?: string | null;
  timezone?: string | null;
  createdAt?: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: WorkspaceRole;
  memberCount: number;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberDTO {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: UserSummary;
  assignedTaskCount?: number;
  completedTaskCount?: number;
}

export interface LabelDTO {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
}

export interface ProjectDTO {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  color: string;
  startDate: string | null;
  dueDate: string | null;
  ownerId: string;
  owner: UserSummary;
  members: Array<{
    userId: string;
    user: UserSummary;
  }>;
  taskCount: number;
  completedTaskCount: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCommentDTO {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  author: UserSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogDTO {
  id: string;
  workspaceId: string;
  projectId: string | null;
  taskId: string | null;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  actor: UserSummary;
  createdAt: string;
}

export interface TaskDTO {
  id: string;
  workspaceId: string;
  projectId: string;
  identifier: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  position: number;
  version: number;
  dueDate: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  assignee: UserSummary | null;
  creatorId: string;
  creator: UserSummary;
  project: {
    id: string;
    name: string;
    key: string;
    color: string;
  };
  labels: LabelDTO[];
  commentCount: number;
  comments?: TaskCommentDTO[];
  activities?: ActivityLogDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDTO {
  id: string;
  workspaceId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AnalyticsOverviewDTO {
  kpis: {
    totalProjects: number;
    activeProjects: number;
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    overdueTasks: number;
    completionRate: number;
    teamProductivity: number;
  };
  statusDistribution: Array<{ status: TaskStatus; label: string; count: number; color: string }>;
  priorityDistribution: Array<{ priority: Priority; label: string; count: number; color: string }>;
  teamWorkload: Array<{
    userId: string;
    name: string;
    avatarColor: string;
    assigned: number;
    inProgress: number;
    completed: number;
  }>;
  upcomingDeadlines: TaskDTO[];
}

export interface TaskTrendsDTO {
  weeklyCompletion: Array<{
    week: string;
    completed: number;
    created: number;
  }>;
  monthlyActivity: Array<{
    month: string;
    tasksCreated: number;
    tasksCompleted: number;
    comments: number;
  }>;
}

export interface ProjectProgressDTO {
  projects: Array<{
    id: string;
    name: string;
    key: string;
    color: string;
    status: ProjectStatus;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    progress: number;
    dueDate: string | null;
  }>;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
