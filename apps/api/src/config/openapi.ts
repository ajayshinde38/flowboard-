export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'FlowBoard REST API',
    version: '1.0.0',
    description:
      'Production-style REST API for FlowBoard — Collaborative Project & Task Management Platform. Uses HttpOnly SameSite session cookies with CSRF double-submit header (`X-CSRF-Token`) for state-changing browser requests.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'fb_access_token',
      },
      csrfHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-CSRF-Token',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Validation failed' },
              details: { type: 'object' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 25 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 2 },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: { '200': { description: 'Service is healthy' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user and initial workspace',
        responses: {
          '201': { description: 'User registered and session cookies issued' },
          '400': { description: 'Validation error' },
          '409': { description: 'Email already exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign in with email and password',
        responses: {
          '200': { description: 'Authenticated and cookies set' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate refresh session and issue new access token cookie',
        responses: {
          '200': { description: 'Session refreshed' },
          '401': { description: 'Refresh token missing, expired, or revoked' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Revoke current refresh session and clear auth cookies',
        responses: { '200': { description: 'Logged out' } },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Request password reset token',
        responses: { '200': { description: 'Reset request accepted' } },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Reset password with a valid token',
        responses: {
          '200': { description: 'Password reset' },
          '400': { description: 'Invalid or expired token' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get authenticated user profile and workspaces',
        security: [{ cookieAuth: [] }],
        responses: { '200': { description: 'Current user' }, '401': { description: 'Unauthorized' } },
      },
      patch: {
        tags: ['Authentication'],
        summary: 'Update user profile',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        responses: { '200': { description: 'Profile updated' } },
      },
    },
    '/workspaces': {
      get: {
        tags: ['Workspaces'],
        summary: 'List workspaces the authenticated user belongs to',
        security: [{ cookieAuth: [] }],
        responses: { '200': { description: 'Workspace list' } },
      },
      post: {
        tags: ['Workspaces'],
        summary: 'Create a new workspace',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        responses: { '201': { description: 'Workspace created' } },
      },
    },
    '/workspaces/{id}': {
      get: {
        tags: ['Workspaces'],
        summary: 'Get workspace details',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Workspace detail' }, '403': { description: 'Forbidden' } },
      },
      patch: {
        tags: ['Workspaces'],
        summary: 'Update workspace (ADMIN or OWNER)',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Updated' } },
      },
      delete: {
        tags: ['Workspaces'],
        summary: 'Delete workspace (OWNER only)',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/projects': {
      get: {
        tags: ['Projects'],
        summary: 'List workspace projects with optional filters',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'workspaceId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Projects list' } },
      },
      post: {
        tags: ['Projects'],
        summary: 'Create a project',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        responses: { '201': { description: 'Project created' } },
      },
    },
    '/projects/{id}': {
      get: {
        tags: ['Projects'],
        summary: 'Get project by ID',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Project details' } },
      },
      patch: {
        tags: ['Projects'],
        summary: 'Update project',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Project updated' } },
      },
      delete: {
        tags: ['Projects'],
        summary: 'Delete project',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Project deleted' } },
      },
    },
    '/tasks': {
      get: {
        tags: ['Tasks'],
        summary: 'List tasks with search, filter, sort, and pagination',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'workspaceId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'projectId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'assigneeId', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Paginated tasks' } },
      },
      post: {
        tags: ['Tasks'],
        summary: 'Create a task',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        responses: { '201': { description: 'Task created' } },
      },
    },
    '/tasks/{id}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get task details including comments and activity history',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Task detail' } },
      },
      patch: {
        tags: ['Tasks'],
        summary: 'Update task with optional optimistic version check',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Task updated' }, '409': { description: 'Version conflict' } },
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Delete task',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Task deleted' } },
      },
    },
    '/tasks/{id}/move': {
      patch: {
        tags: ['Tasks'],
        summary: 'Move or reorder a Kanban task with stable floating-point position and automatic column rebalancing',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Task moved' }, '409': { description: 'Concurrent version conflict' } },
      },
    },
    '/analytics/overview': {
      get: {
        tags: ['Analytics'],
        summary: 'Workspace KPIs, status distribution, priority breakdown, team workload, and upcoming deadlines',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'workspaceId', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Analytics overview' } },
      },
    },
    '/analytics/task-trends': {
      get: {
        tags: ['Analytics'],
        summary: 'Weekly task completion and 6-month activity trends',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'workspaceId', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Trend series' } },
      },
    },
    '/analytics/project-progress': {
      get: {
        tags: ['Analytics'],
        summary: 'Per-project completion progress metrics',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'workspaceId', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Project progress list' } },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List current user notifications',
        security: [{ cookieAuth: [] }],
        responses: { '200': { description: 'Notifications list' } },
      },
    },
    '/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark notification as read',
        security: [{ cookieAuth: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Marked read' } },
      },
    },
  },
};
