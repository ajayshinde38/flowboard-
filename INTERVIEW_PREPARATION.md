# FlowBoard — Interview Preparation Guide

A practical, plain-English guide to explain FlowBoard confidently in an Associate Frontend or Junior Full-Stack Developer interview. Everything below reflects what is **actually built and running** in this repository.

---

## Part 1: 15 Core Project Questions (Simple Answers)

### 1. What is FlowBoard?
FlowBoard is a full-stack project and task management web application where teams can create projects, manage tasks, move cards across a four-column Kanban board (**To Do**, **In Progress**, **Review**, **Done**), assign work to teammates, and view progress reports.

### 2. Why did I build it?
I wanted to build a realistic application that goes beyond a static UI clone. FlowBoard lets me practice and demonstrate core real-world frontend skills — routing, protected pages, form validation, REST API integration, drag-and-drop state updates, responsive design, and connecting a React frontend to a real PostgreSQL database.

### 3. What problems does it solve?
Small teams and student groups often lose track of who is working on what and which tasks are overdue across spreadsheets or chat messages. FlowBoard gives everyone one shared place to see active projects, filter tasks, update task statuses on a board, and track completion progress.

### 4. What technologies are used?
- **Frontend (`apps/web`)**: React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, `@dnd-kit` (drag-and-drop), Recharts (charts), and Fetch API.
- **Backend (`apps/api`)**: Node.js, Express, TypeScript, Prisma ORM, Argon2 (password hashing), JWT + HttpOnly cookies (authentication), and Socket.IO (live updates).
- **Database**: PostgreSQL 16.
- **Shared Package (`packages/shared`)**: Shared TypeScript types and Zod validation schemas used by both frontend and backend.
- **Testing**: Vitest, React Testing Library, Supertest, and Playwright.

*(Note: While a Python/FastAPI backend can serve the same REST contract, this project uses the already-working Node.js + Express + Prisma API so the frontend and backend share TypeScript types directly.)*

### 5. Why React?
React breaks complex screens (like a Dashboard, a 4-column Board, and a Task Detail Drawer) into small, reusable components. When task data changes — for example, moving a card from To Do to Done — React updates only the affected parts of the DOM efficiently.

### 6. How does React state management work in FlowBoard?
I separate state into three clear layers so nothing gets messy or duplicated:
1. **Local component state (`useState`)**: Form inputs, search text, open/closed modals, and temporary drag state.
2. **UI state (`apps/web/src/stores/uiStore.ts`)**: Shared interface preferences such as Light/Dark theme, mobile sidebar drawer state, active workspace ID, and which task is open in the detail drawer.
3. **Server state (`TanStack Query`)**: Data fetched from the REST API (projects, tasks, team members, reports). It handles caching, loading/error states, and refreshing data automatically after mutations.

### 7. How do components communicate?
- **Parent to child via props**: For example, `KanbanBoardPage` fetches filtered tasks and passes `tasks` and `queryKey` down to `KanbanBoard`, which passes each task to `SortableKanbanCard`.
- **Child to parent via callback props**: Clicking "Move to Done" inside a card calls `onQuickMove(task, 'DONE')` defined in `KanbanBoard`.
- **Across unrelated components via shared store / query cache**: Clicking a task anywhere (Dashboard, My Tasks, Board, or Notifications) sets `activeTaskId` in `uiStore`, which opens `TaskDetailDrawer`. When the drawer saves an edit, invalidating the `['tasks']` query updates every screen automatically.

### 8. How are REST APIs called?
All HTTP requests go through one small helper function `apiRequest()` in `apps/web/src/lib/api.ts`, which wraps the browser's native **Fetch API**:
- Sends `credentials: 'include'` so HttpOnly authentication cookies are sent automatically.
- Attaches `X-CSRF-Token` header on `POST`, `PATCH`, and `DELETE` requests.
- Parses JSON errors into a readable `ApiClientError`.
- Automatically attempts one token refresh (`POST /api/v1/auth/refresh`) if an access token expires (`401`).

### 9. How does the database store tasks?
PostgreSQL stores tasks in the `Task` table (defined in `apps/api/prisma/schema.prisma`) with foreign keys to `Workspace`, `Project`, `creatorId` (`User`), and optional `assigneeId` (`User`). Each task also stores:
- `status` (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`)
- `priority` (`URGENT`, `HIGH`, `MEDIUM`, `LOW`)
- `position` (a floating-point number so card order stays stable without rewriting every row)
- `version` (an integer incremented on every update to catch conflicting simultaneous edits)

### 10. How does login work?
1. The user submits email/username and password on `/login` (`LoginPage.tsx`).
2. `POST /api/v1/auth/login` validates input with Zod, finds the user in PostgreSQL, and verifies the password hash with **Argon2**.
3. The server creates a `RefreshSession` row in PostgreSQL and sets `HttpOnly` cookies (`fb_access_token` lasting 15 minutes and `fb_refresh_token` lasting 7 days), plus a `fb_csrf_token` cookie.
4. No sensitive tokens are stored in `localStorage`. On protected routes (`/app/*`), `ProtectedRoute` checks `GET /api/v1/auth/me` and redirects unauthenticated visitors to `/login`.

### 11. How does the Kanban board work?
`KanbanBoard.tsx` groups tasks into 4 columns (**To Do**, **In Progress**, **Review**, **Done**) sorted by `position`.
- Dragging uses `@dnd-kit` (`DndContext`, `useDroppable`, `useSortable`).
- When dropped, the app calculates a midpoint `position` between the card above and the card below (`computeNewPosition`), updates the UI immediately (optimistic update), and sends `PATCH /api/v1/tasks/:id/move`.
- If the API fails or returns `409 Conflict`, the UI rolls back to the previous snapshot and shows an error toast.
- Every card also has a `"..."` dropdown menu so mobile and keyboard users can move tasks without dragging.

### 12. What happens when I create a task?
1. Clicking **Add Task** opens `CreateTaskModal.tsx`.
2. React Hook Form + Zod validates title, project, status, priority, assignee, and due date.
3. Submitting calls `POST /api/v1/tasks`.
4. The backend checks workspace membership, increments the project's `taskCounter` (generating an ID like `WEB-5`), computes the bottom `position` in that column, saves the task inside a database transaction, and logs an `ActivityLog` entry.
5. On success, the frontend invalidates cached task, project, and report queries so the new task appears immediately on the Dashboard, My Tasks, and Board.

### 13. How does frontend routing work?
`apps/web/src/app/App.tsx` uses **React Router v7** (`BrowserRouter`, `Routes`, `Route`):
- Public routes: `/`, `/features`, `/login`, `/register`, `/forgot-password`, `/reset-password`.
- Protected routes nested under `/app`: `ProtectedRoute` wraps `AppShell` (which renders the fixed sidebar, sticky header, and `<Outlet />` for child pages like `/app/dashboard`, `/app/tasks`, `/app/projects`, `/app/kanban`, `/app/team`, `/app/analytics`, `/app/settings/profile`).
- Pages are lazy-loaded with `React.lazy()` and `Suspense` so initial page loads stay fast.

### 14. What challenges did I face?
1. **Fixed Sidebar Scrolling**: Making sure the desktop sidebar stayed locked at `100vh` while only the main content scrolled — without creating double scrollbars — required a clean `height: 100vh; overflow: hidden` flex container on desktop and a slide-over drawer on mobile.
2. **Persisting Kanban Card Order**: Relying on array indexes breaks when multiple cards move. Switching to floating-point gap positions (`65536` spacing with midpoint calculation and automatic rebalancing) made ordering reliable across page refreshes.
3. **Cross-Origin Cookies & CSRF in Local Dev**: Because the frontend runs on `:5173` and the API on `:8000`, `document.cookie` on `:5173` cannot read cookies set by `:8000`. Returning the CSRF token in the auth JSON response alongside the cookie solved cross-origin mutations cleanly.

### 15. How can the application be improved?
- Add real email delivery (e.g., Resend or SMTP) for password resets and team invitations.
- Add file attachments on tasks (screenshots or specs uploaded to object storage).
- Add exportable CSV reports for completed sprint tasks.

---

## Part 2: 20 Likely Frontend Interview Questions (Connected to FlowBoard)

1. **What is the difference between controlled and uncontrolled inputs in React?**
   In FlowBoard, search bars and comment boxes use controlled inputs (`value` + `onChange` via `useState`), while longer forms like `LoginPage` and `CreateTaskModal` use React Hook Form (`register`), which uses uncontrolled refs under the hood to avoid re-rendering on every keystroke.
2. **Why do we pass a `key` prop when rendering lists?**
   React uses stable `key` values (like `task.id` or `project.id`) to track which DOM nodes changed, moved, or were deleted. Using array indexes as keys causes bugs when reordering Kanban cards or filtering tables.
3. **What does `useEffect` do, and why is a cleanup function important?**
   `useEffect` synchronizes components with external systems (like keyboard listeners in `useKeyboardShortcuts.ts` or debounce timers in `useDebounce.ts`). Returning a cleanup function removes listeners and clears timers when the component unmounts to prevent memory leaks.
4. **How do you debounce a search input in React?**
   In `apps/web/src/hooks/useDebounce.ts`, a `setTimeout` waits 200–220ms after the user stops typing before updating the debounced state, and cleans up the previous timer on each keystroke so we don't spam the API on every letter.
5. **What is optimistic UI updating?**
   Updating the screen immediately before the server responds so the app feels instant. On FlowBoard's Kanban board, moving a card updates the UI right away in `onMutate`; if `PATCH /tasks/:id/move` fails, `onError` rolls the card back to its original column.
6. **How do you prevent race conditions when fetching data on search/filter changes?**
   `tasksApi.list` accepts an `AbortSignal` from TanStack Query and passes it to `fetch()`. If the user changes a filter before the previous request finishes, the older request is aborted automatically.
7. **Why use `React.lazy` and `Suspense`?**
   They split each page and heavy libraries like Recharts into separate JavaScript chunks loaded only when the user navigates to that page, keeping the Landing and Login pages lightweight.
8. **How do protected routes work in React Router?**
   Our `ProtectedRoute` component checks `useAuth()`. While checking the session it renders a skeleton loader; if unauthenticated, it returns `<Navigate to="/login" state={{ from: location }} replace />`; otherwise it renders the child route.
9. **What is the difference between `useMemo` and `useCallback`?**
   `useMemo` caches a computed value (like grouping and sorting Kanban tasks by column in `KanbanBoard.tsx`), while `useCallback` caches a function reference. I only use them when recalculating on every render would cause unnecessary work or effect re-runs.
10. **Why store JWT/refresh tokens in `HttpOnly` cookies instead of `localStorage`?**
    JavaScript cannot read `HttpOnly` cookies, which protects session credentials from XSS (Cross-Site Scripting) attacks. Pairing cookies with `SameSite` and an `X-CSRF-Token` header protects against CSRF attacks.
11. **How did you implement Light and Dark themes?**
    CSS custom properties (`--bg-background`, `--bg-sidebar`, `--bg-surface`, `--accent`, etc.) are defined in `:root` (light mode default) and `.dark` in `globals.css`. Toggling the theme adds/removes the `.dark` class on `<html>` and saves the choice in `localStorage`.
12. **How did you make the desktop sidebar stay fixed while scrolling?**
    At `>= 1024px`, `.app-layout` uses `display: flex; height: 100vh; overflow: hidden`. `.app-sidebar` is fixed at `width: 240px; height: 100vh; flex-shrink: 0`, and `.app-main` has `flex: 1; height: 100vh; overflow-y: auto` so only the main column scrolls.
13. **How do you handle mobile responsiveness?**
    Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) stack grids into single columns on small screens, tables wrap in `overflow-x-auto`, and on `< 1024px` the sidebar becomes a slide-over drawer triggered by a menu button.
14. **How do you keep URL filters shareable on the My Tasks page?**
    `MyTasksPage.tsx` uses React Router's `useSearchParams()` for status, priority, project, assignee, and page filters, so refreshing or sharing the URL keeps the exact same filtered view.
15. **What is client-side vs. server-side validation, and why use both?**
    Client-side validation (Zod + React Hook Form) gives instant feedback without a network trip. Server-side validation (Zod middleware in Express) guarantees bad data can never reach PostgreSQL even if someone calls the API directly.
16. **How did you handle accessibility (a11y)?**
    Semantic HTML landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`), proper `<label htmlFor>` bindings, visible `:focus-visible` rings, keyboard-accessible Radix dialogs/dropdowns, quick-move menus as a drag-and-drop alternative, and automated `axe-core` tests.
17. **What happens if a user refreshes a nested route like `/app/projects/123` in production?**
    In a Single Page Application (SPA), the static host must rewrite unknown paths to `index.html` so React Router can handle the route. `apps/web/vercel.json` configures this rewrite for Vercel.
18. **How do you handle empty, loading, and error states cleanly?**
    Every data view shows matching `<Skeleton />` placeholders while loading, a helpful `<EmptyState />` with an action button (e.g., "Add Task") when empty, and inline alerts or Sonner toast notifications on API errors.
19. **How do you test React components?**
    Using Vitest + React Testing Library (`apps/web/src/tests/app.test.tsx`), I test user-visible behavior (form validation errors, clicking buttons, switching tabs, optimistic rollback) rather than internal implementation details.
20. **What is the difference between `PUT` and `PATCH` in your REST API?**
    FlowBoard uses `PATCH` (e.g., `PATCH /api/v1/tasks/:id`) for partial updates — such as changing only a task's status or assignee — without having to resend the entire task object.

---

## Part 3: Spoken Project Explanations

### 60-Second Explanation (HR / Initial Screen)
> "I built **FlowBoard**, a full-stack project and task management web app designed for small teams to organize projects and track daily work. On the frontend I used React, TypeScript, Tailwind CSS, React Router, and Recharts, and on the backend I built a REST API with Node.js, Express, Prisma, and PostgreSQL. Users can sign in — or try the isolated demo account — create projects, filter and search tasks, drag tasks across a four-column board (To Do, In Progress, Review, Done) with database persistence, and view progress reports. I focused heavily on clean, readable UI, a fixed desktop sidebar with mobile drawer navigation, Light and Dark mode support, and automated frontend, backend, and end-to-end tests."

### 2-Minute Technical Explanation (Technical Interview)
> "FlowBoard is structured as a monorepo with three workspaces: `apps/web` for the React frontend, `apps/api` for the Express + Prisma backend, and `packages/shared` for shared TypeScript types and Zod validation schemas so the client and server never drift out of sync.
>
> On the frontend, I kept state management clean: local UI interactions use `useState`, lightweight global UI preferences like Light/Dark theme and the active task drawer live in a small store, URL query parameters drive task filters, and TanStack Query manages all server data via a typed Fetch API wrapper. Pages and charts are code-split with `React.lazy`, and the layout uses a viewport-locked flex shell on desktop so the 240px sidebar stays fixed while only the main content scrolls.
>
> One feature I'm particularly proud of is the four-column Kanban board built with `@dnd-kit`. Instead of storing array indexes in the database, each task stores a floating-point `position` and an optimistic `version` number. When a user moves a card, the frontend updates optimistically and calls `PATCH /api/v1/tasks/:id/move` inside a PostgreSQL transaction. If there's a conflict or network failure, the UI rolls back cleanly.
>
> For security, passwords are hashed with Argon2, sessions use rotating `HttpOnly` cookies with CSRF double-submit header checks, and every backend route verifies workspace membership so users can never access another workspace's data. Finally, I wrote Vitest + Supertest integration tests, React Testing Library + `axe-core` tests, and Playwright end-to-end tests to verify persistence and responsiveness from 375px mobile up to 1920px desktop."

---

## Part 4: Basic System Architecture Diagram

```text
+---------------------------------------------------------------+
|                React + Vite Frontend (apps/web)               |
|  Pages: Landing, Login, Dashboard, My Tasks, Projects, Board, |
|         Team, Reports, Settings                               |
|  Fetch API (credentials: include + X-CSRF-Token)              |
+-------------------------------+-------------------------------+
                                |
                                | HTTP REST (/api/v1) + WebSocket
                                v
+---------------------------------------------------------------+
|             Node.js + Express Backend (apps/api)              |
|  Auth Middleware (JWT Cookies + CSRF) -> Zod Validation       |
|  Route Modules: Auth, Workspaces, Projects, Tasks, Analytics  |
|  Prisma ORM (Transactions + Relational Queries)               |
+-------------------------------+-------------------------------+
                                |
                                | SQL
                                v
+---------------------------------------------------------------+
|                   PostgreSQL 16 Database                      |
|  Tables: User, Workspace, WorkspaceMember, Project, Task,     |
|          Label, TaskComment, ActivityLog, Notification,       |
|          RefreshSession, PasswordResetToken                   |
+---------------------------------------------------------------+
```

---

## Part 5: Running the Application Locally

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Start PostgreSQL (via Docker Compose or local PostgreSQL 16)
npm run db:up

# 4. Build shared types, generate Prisma client, migrate & seed demo workspace
npm run build --workspace=@flowboard/shared
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Start API (http://localhost:8000) and Frontend (http://localhost:5173)
npm run dev
```

- **Local Demo Login**: Username `ajay` / Password `ajay` (or click **Try Demo** on `/login`).
- **Run Tests**: `npm run test` (unit/integration) and `npm run test:e2e` (Playwright).
