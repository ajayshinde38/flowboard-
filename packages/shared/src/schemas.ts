import { z } from 'zod';
import {
  PRIORITIES,
  PROJECT_STATUSES,
  TASK_STATUSES,
  WORKSPACE_ROLES,
} from './enums.js';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: passwordSchema,
  workspaceName: z.string().trim().min(2).max(80).optional(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (val) => val === 'ajay' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      'Please enter a valid email address or demo username'
    ),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Invalid reset token'),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  jobTitle: z.string().trim().max(80).nullable().optional(),
  bio: z.string().trim().max(400).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  timezone: z.string().trim().max(64).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Workspace name must be at least 2 characters').max(80),
  description: z.string().trim().max(400).optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(400).nullable().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  role: z.enum(WORKSPACE_ROLES).default('MEMBER'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(WORKSPACE_ROLES),
});

export const createProjectSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2, 'Project name must be at least 2 characters').max(120),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, 'Key must be 2–6 uppercase letters or digits')
    .optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(PROJECT_STATUSES).default('ACTIVE'),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#786CFF'),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  memberIds: z.array(z.string()).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  memberIds: z.array(z.string()).optional(),
});

export const createTaskSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(TASK_STATUSES).default('TODO'),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  projectId: z.string().min(1).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
  beforeTaskId: z.string().nullable().optional(),
  afterTaskId: z.string().nullable().optional(),
  position: z.number().finite().optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const bulkUpdateTasksSchema = z.object({
  workspaceId: z.string().min(1),
  taskIds: z.array(z.string().min(1)).min(1).max(100),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.string().nullable().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(3000),
});

export const createLabelSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1, 'Label name is required').max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#786CFF'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type BulkUpdateTasksInput = z.infer<typeof bulkUpdateTasksSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
