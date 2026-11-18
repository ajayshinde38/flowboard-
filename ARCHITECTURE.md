# FlowBoard — System Architecture

## 1. High-Level Overview

FlowBoard is organized as a strict TypeScript npm workspaces monorepo:

```text
flowboard/
├── apps/
│   ├── web/              # React 18 + Vite + Tailwind + shadcn/ui + TanStack Query + dnd-kit + Recharts
│   └── api/              # Node.js + Express + Prisma + PostgreSQL + Socket.IO + Argon2 + Pino
├── packages/
│   └── shared/           # Shared Zod schemas, enums, DTO contracts, fractional rank utility
├── docs/
│   └── screenshots/      # Captured live application screenshots
├── docker-compose.yml    # Local PostgreSQL 16 service
└── .github/workflows/    # GitHub Actions CI pipeline
```

All request/response DTOs, validation schemas, enums, and fractional positioning math live in `@flowboard/shared` so frontend and backend contracts remain strictly synchronized at compile time and runtime.

---

## 2. Frontend State Architecture

FlowBoard cleanly separates state by ownership so server data is never duplicated across stores:

| Concern | Technology | Responsibility |
| --- | --- | --- |
| **Server State** | TanStack Query v5 | Caching, background refetch, request cancellation (`AbortSignal`), pagination, optimistic updates & rollback |
| **Global UI State** | Zustand (`uiStore.ts`) | Theme (`dark`/`light`), sidebar collapse, mobile drawer, command palette, active workspace ID, active task drawer ID, modal triggers |
| **Local / Form State** | React Hook Form + Zod + `useState` | Form inputs, validation errors, drag overlays, debounced search inputs |
| **Filter State** | React Router `useSearchParams` | URL-synchronized filters, sorting, and pagination on the Tasks table |

### Optimistic Updates & Conflict Rollback (Kanban)

When a user drags a card or triggers a quick column move on `KanbanBoard.tsx`:

1. **Snapshot & Optimistic Patch**: `onMutate` cancels in-flight task queries, snapshots the previous TanStack Query cache, computes the target midpoint position via `computeNewPosition(beforePos, afterPos)`, and immediately updates the card in the UI while marking its ID in `syncingTaskIds`.
2. **Server Persistence**: `PATCH /api/v1/tasks/:id/move` runs inside a PostgreSQL transaction (`prisma.$transaction`), verifies `expectedVersion`, writes the new `status` and floating-point `position`, increments `version`, and rebalances the column if the gap drops below `0.001`.
3. **Conflict / Error Rollback**: If another teammate modified the card concurrently (`409 CONFLICT`) or a network error occurs, `onError` immediately restores the saved cache snapshot, surfaces a Sonner toast notification, and invalidates queries to reconcile with the authoritative server state.

---

## 3. Real-Time Synchronization (Socket.IO)

Real-time updates flow through `apps/api/src/sockets/index.ts` and `apps/web/src/hooks/useSocketSync.ts`:

1. **Authenticated Handshake**: Socket.IO middleware parses the `fb_access_token` HttpOnly cookie on connection and validates the JWT signature before accepting the socket.
2. **Workspace Room Authorization**: Clients emit `workspace:join` with a `workspaceId`. The server verifies `WorkspaceMember(workspaceId, userId)` in PostgreSQL before adding the socket to `workspace:<id>`. Every user also joins a private `user:<userId>` room for personal notifications.
3. **Scoped Broadcasts**: No workspace mutations are ever broadcast globally. Task creation, edits, Kanban moves, deletions, comments, project changes, and activity events emit exclusively to `workspace:<workspaceId>`.
4. **Client Reconciliation**: `useSocketSync` listens to typed socket events and invalidates the relevant TanStack Query keys (`['tasks']`, `['task', id]`, `['analytics']`, `['projects']`, `['activity']`, `['notifications']`), keeping all connected sessions synchronized without manual refreshes or duplicate records.

---

## 4. Security & Multi-Tenant Isolation

- **Password Storage**: Argon2id (`memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`).
- **Session Credentials**: Short-lived JWT access tokens (`15m`) and opaque 48-byte rotating refresh tokens (`7d`, SHA-256 hashed in `RefreshSession`), delivered exclusively in `HttpOnly`, `SameSite` cookies (`Secure` in production). Sensitive tokens are never stored in `localStorage`.
- **Refresh Replay Protection**: Attempting to reuse a revoked refresh token revokes all active refresh sessions for that user.
- **CSRF Protection**: State-changing cookie-authenticated requests (`POST`, `PATCH`, `PUT`, `DELETE`) verify the `X-CSRF-Token` header against the `fb_csrf_token` cookie (double-submit pattern).
- **Workspace Authorization**: Every protected endpoint verifies `WorkspaceMember` ownership and enforces RBAC (`OWNER` > `ADMIN` > `MEMBER`) before returning or mutating any resource.

---

## 5. Performance Engineering

- **Route-Level Code Splitting**: All 18 public and authenticated pages are dynamically imported with `React.lazy` and `Suspense`.
- **Vendor Chunking**: Vite `manualChunks` isolates React, TanStack Query, dnd-kit, Motion, Radix UI, and Recharts.
- **Lazy-Loaded Charts**: `DashboardCharts.tsx` (Recharts) is loaded only when visiting `/app/dashboard` or `/app/analytics`, keeping public routes lightweight.
- **List Virtualization**: `MyTasksPage.tsx` uses `@tanstack/react-virtual` to render large task tables smoothly.
- **Debounced Search & Cancellation**: Search inputs debounce at 200–220ms and pass `AbortSignal` to cancel superseded fetch requests.
