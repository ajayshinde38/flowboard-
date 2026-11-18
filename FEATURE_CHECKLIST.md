# FlowBoard — Feature & Acceptance Checklist

## Public Pages (6/6 Implemented)
- [x] Landing Page (`/`) — Hero, interactive 3-mode product preview, feature grid, responsive CTAs
- [x] Features Page (`/features`) — Detailed architectural and workflow capability breakdown
- [x] Login Page (`/login`) — Zod validation, error handling, one-click demo credentials autofill
- [x] Registration Page (`/register`) — Account + workspace creation with strong password rules
- [x] Forgot Password Page (`/forgot-password`) — Token issuance with local dev shortcut link
- [x] Reset Password Page (`/reset-password`) — Token verification, password update, session revocation

## Authenticated Application Pages (12/12 Implemented)
- [x] Overview Dashboard (`/app/dashboard`) — 6 live KPI cards, lazy-loaded charts, My Assigned Tasks, Project Progress, Upcoming Deadlines, Recent Activity, Team Overview, Quick Task creation
- [x] My Tasks (`/app/tasks`) — Debounced search, URL-synced filters, sorting, pagination, bulk selection & bulk status/priority updates, virtualized table container (`@tanstack/react-virtual`)
- [x] Projects (`/app/projects`) — Search, filter by status/priority, archive toggle, create/edit/archive/delete with confirmation dialog
- [x] Project Details (`/app/projects/:id`) — Metadata & progress header, member badges, embedded Project Kanban, Task List, Project Activity tabs, inline edit modal
- [x] Kanban Board (`/app/kanban`) — 5 status columns (`BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`), `@dnd-kit` drag-and-drop, stable floating-point ordering + transactional rebalance, optimistic UI + rollback on 409/error, keyboard drag + accessible quick-move dropdown
- [x] Calendar (`/app/calendar`) — Interactive monthly due-date calendar grid, month navigation, quick task creation on any day
- [x] Analytics (`/app/analytics`) — Weekly task completion, status distribution, stacked team workload, 6-month activity trends, project delivery health table (100% real API data)
- [x] Team Members (`/app/team`) — Member directory, RBAC badges, workload completion bars, add member modal, role update & remove member confirmation
- [x] Activity Feed (`/app/activity`) — Workspace audit trail with entity-type filtering, pagination, and real-time updates
- [x] Notifications (`/app/notifications`) — All/Unread tabs, unread counter badge, Mark All Read, direct navigation to referenced task/project
- [x] Workspace Settings (`/app/settings/workspace`) — General info editor, colored task labels CRUD, create new workspace dialog, Owner Danger Zone delete
- [x] Profile Settings (`/app/settings/profile`) — Profile editor, avatar color picker, dark/light theme switcher, password update

## Acceptance Criteria Verification
- [x] Frontend starts cleanly on `http://localhost:5173`
- [x] Backend starts cleanly on `http://localhost:8000`
- [x] PostgreSQL Prisma migrations applied cleanly (`20261118140227_init`)
- [x] Registration, login, refresh rotation, and logout verified
- [x] Protected routes redirect unauthenticated users to `/login`
- [x] Users can create, edit, archive, and delete projects
- [x] Users can create, edit, comment on, bulk-update, and delete tasks
- [x] Kanban card movements persist across page refreshes
- [x] Dashboard and Analytics display real computed PostgreSQL data
- [x] Cross-workspace authorization verified via automated tests (`403 Forbidden`)
- [x] Real-time Socket.IO updates verified live across two concurrent Playwright sessions
- [x] Responsive desktop (1440px) and mobile (375px) layouts verified with zero horizontal overflow
- [x] Keyboard shortcuts (`Ctrl/Cmd+K`, `C`, `[`), command palette, and accessible Kanban controls implemented
- [x] Automated backend (9), frontend (6), and Playwright E2E (2) test suites pass
- [x] Production builds (`shared`, `api`, `web`) succeed with zero TypeScript or ESLint errors
- [x] Full documentation suite and live screenshots generated
