# FlowBoard — REST API Documentation

Base URL (local development): `http://localhost:8000/api/v1`

Interactive OpenAPI / Swagger UI is served at:
- **Swagger UI**: `http://localhost:8000/api/v1/docs`
- **OpenAPI JSON**: `http://localhost:8000/api/v1/openapi.json`

---

## Authentication & Headers

FlowBoard authenticates browser clients using **HttpOnly session cookies**:

- `fb_access_token` — Short-lived JWT access token (`HttpOnly`, `SameSite=Lax`, `15m`)
- `fb_refresh_token` — Opaque rotating refresh token (`HttpOnly`, `SameSite=Lax`, `7d`)
- `fb_csrf_token` — Readable CSRF cookie (`SameSite=Lax`)

All state-changing cookie-authenticated requests (`POST`, `PATCH`, `PUT`, `DELETE`) MUST include:
```http
X-CSRF-Token: <value from fb_csrf_token cookie>
```

---

## Standard Error Format

All errors return a consistent JSON structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": { "title": ["Title must be at least 2 characters"] }
  }
}
```

| HTTP Status | Error Codes | Meaning |
| --- | --- | --- |
| `400` | `BAD_REQUEST`, `VALIDATION_ERROR` | Invalid input or schema violation |
| `401` | `UNAUTHORIZED` | Missing, invalid, or expired session |
| `403` | `FORBIDDEN` | Insufficient role, CSRF mismatch, or cross-workspace access denied |
| `404` | `NOT_FOUND`, `ROUTE_NOT_FOUND` | Resource or endpoint does not exist |
| `409` | `CONFLICT`, `UNIQUE_CONSTRAINT` | Optimistic version mismatch or duplicate key |
| `429` | `RATE_LIMITED`, `AUTH_RATE_LIMITED` | Rate limit exceeded |

---

## Endpoints Reference

### System
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | API and PostgreSQL health check |
| `GET` | `/openapi.json` | Public | OpenAPI 3.0.3 JSON specification |
| `GET` | `/docs` | Public | Interactive Swagger UI |

### Authentication (`/auth`)
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Create user, default workspace, and starter labels; issue session cookies |
| `POST` | `/auth/login` | Public | Authenticate credentials and issue session cookies |
| `POST` | `/auth/refresh` | Refresh Cookie | Rotate refresh session and issue new access cookie |
| `POST` | `/auth/logout` | Cookie | Revoke active refresh session and clear auth cookies |
| `POST` | `/auth/forgot-password` | Public | Generate 30-minute hashed password reset token |
| `POST` | `/auth/reset-password` | Public | Reset password with valid token and revoke existing sessions |
| `GET` | `/auth/me` | Required | Fetch current user profile, workspaces, and unread notification count |
| `PATCH` | `/auth/me` | Required + CSRF | Update profile (`name`, `jobTitle`, `bio`, `avatarColor`, `timezone`) |
| `POST` | `/auth/change-password` | Required + CSRF | Change password after verifying current password |

### Workspaces (`/workspaces`)
| Method | Path | Min Role | Description |
| --- | --- | --- | --- |
| `GET` | `/workspaces` | Auth | List all workspaces the user belongs to |
| `POST` | `/workspaces` | Auth | Create a new workspace (caller becomes `OWNER`) |
| `GET` | `/workspaces/:id` | `MEMBER` | Fetch workspace metadata and counts |
| `PATCH` | `/workspaces/:id` | `ADMIN` | Update workspace name or description |
| `DELETE` | `/workspaces/:id` | `OWNER` | Permanently delete workspace |
| `GET` | `/workspaces/:id/members` | `MEMBER` | List members with assigned/completed task workload |
| `POST` | `/workspaces/:id/members` | `ADMIN` | Add/provision member by email with role |
| `PATCH` | `/workspaces/:id/members/:memberId` | `ADMIN` | Update member role (`ADMIN` or `MEMBER`) |
| `DELETE` | `/workspaces/:id/members/:memberId` | `ADMIN` | Remove non-Owner member from workspace |
| `GET` | `/workspaces/:id/labels` | `MEMBER` | List workspace task labels |
| `POST` | `/workspaces/:id/labels` | `MEMBER` | Create a colored workspace label |
| `DELETE` | `/workspaces/:id/labels/:labelId` | `ADMIN` | Delete a workspace label |
| `GET` | `/workspaces/:id/activity` | `MEMBER` | Paginated activity log (`page`, `limit`, `projectId`, `entityType`) |

### Projects (`/projects`)
| Method | Path | Min Role | Description |
| --- | --- | --- | --- |
| `GET` | `/projects?workspaceId=...` | `MEMBER` | List projects (`search`, `status`, `priority`, `includeArchived`) |
| `POST` | `/projects` | `MEMBER` | Create project with unique workspace key and member list |
| `GET` | `/projects/:id` | `MEMBER` | Get project details, members, and progress metrics |
| `PATCH` | `/projects/:id` | `MEMBER` | Update project fields, dates, members, or archive status |
| `DELETE` | `/projects/:id` | Owner/Admin | Delete project and cascade its tasks |

### Tasks & Comments (`/tasks`)
| Method | Path | Min Role | Description |
| --- | --- | --- | --- |
| `GET` | `/tasks?workspaceId=...` | `MEMBER` | Paginated tasks (`projectId`, `status`, `priority`, `assigneeId`, `labelId`, `search`, `overdue`, `sortBy`, `sortDir`, `page`, `limit`) |
| `POST` | `/tasks` | `MEMBER` | Create task with auto-incremented project identifier (`KEY-N`) and stable position |
| `PATCH` | `/tasks/bulk` | `MEMBER` | Bulk update `status`, `priority`, or `assigneeId` across up to 100 tasks |
| `GET` | `/tasks/:id` | `MEMBER` | Get task detail including comments and recent activity history |
| `PATCH` | `/tasks/:id` | `MEMBER` | Update task properties with optional `expectedVersion` concurrency guard |
| `PATCH` | `/tasks/:id/move` | `MEMBER` | Move/reorder Kanban task using `status`, `beforeTaskId`, `afterTaskId`, `expectedVersion` |
| `DELETE` | `/tasks/:id` | `MEMBER` | Delete task and broadcast removal to workspace room |
| `POST` | `/tasks/:id/comments` | `MEMBER` | Add comment to task, log activity, and notify assignee/creator |
| `DELETE` | `/tasks/:id/comments/:commentId` | Author/Admin | Delete task comment |

### Analytics (`/analytics`)
| Method | Path | Min Role | Description |
| --- | --- | --- | --- |
| `GET` | `/analytics/overview?workspaceId=...` | `MEMBER` | KPI cards, status/priority distribution, team workload, upcoming deadlines |
| `GET` | `/analytics/task-trends?workspaceId=...` | `MEMBER` | 8-week completion trend and 6-month activity trend series |
| `GET` | `/analytics/project-progress?workspaceId=...` | `MEMBER` | Per-project completion percentages, in-flight, and overdue counts |

### Notifications (`/notifications`)
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/notifications` | Required | List current user notifications (`workspaceId`, `unreadOnly`) + `unreadCount` |
| `PATCH` | `/notifications/:id/read` | Required + CSRF | Mark single notification as read |
| `POST` | `/notifications/read-all` | Required + CSRF | Mark all unread notifications as read |
