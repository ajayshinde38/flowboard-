# FlowBoard — Testing Guide

FlowBoard validates quality across four automated layers: static checks, backend integration tests, frontend component/accessibility tests, and full-browser Playwright end-to-end tests.

---

## Commands Reference

```bash
# 1. Static Type Checking (shared + api + web)
npm run typecheck

# 2. ESLint (api + web)
npm run lint

# 3. All Unit & Integration Tests (Vitest)
npm run test

# Backend integration tests only (Vitest + Supertest against flowboard_test DB)
npm run test:api

# Frontend component, optimistic rollback & axe-core tests only (Vitest + RTL)
npm run test:web

# 4. Playwright End-to-End Tests (requires API :8000 and Web :5173 running)
npm run test:e2e

# 5. Full Production Build Verification
npm run build
```

---

## Test Coverage Summary

### Backend Integration Suite (`apps/api/src/tests/api.test.ts`)
Runs against a dedicated `flowboard_test` PostgreSQL database via Supertest:
- Health check endpoint (`GET /api/v1/health`)
- User registration, Argon2id hashing, default workspace creation, and HttpOnly + CSRF cookie issuance
- CSRF enforcement (`403 FORBIDDEN` when `X-CSRF-Token` header is omitted on cookie mutations)
- Zod request validation (`400 VALIDATION_ERROR`)
- Project CRUD (`POST`, `PATCH`, `GET`)
- Task creation, stable floating-point ordering, midpoint Kanban moves (`PATCH /tasks/:id/move`), and optimistic concurrency conflict detection (`409 CONFLICT`)
- Multi-tenant workspace isolation (verifies User B receives `403 FORBIDDEN` when accessing or mutating User A's projects, tasks, or analytics by ID)
- Live PostgreSQL analytics aggregation (`GET /api/v1/analytics/overview`)
- Refresh token rotation (`POST /api/v1/auth/refresh`) and password reset lifecycle (`forgot-password` -> `reset-password` -> `login`)

### Frontend Unit, Optimistic UI & Accessibility Suite (`apps/web/src/tests/app.test.tsx`)
Runs via Vitest + React Testing Library + `axe-core`:
- Landing page hero rendering and interactive preview tab switching
- Login form Zod validation and one-click Demo Credential autofill
- Registration password strength validation
- Fractional position calculation and rebalance detection (`computeNewPosition`)
- Five-column Kanban board rendering and optimistic move rollback on API error (`409 Conflict`)
- Automated `axe-core` WCAG accessibility audit verifying zero critical or serious violations

### End-to-End Browser Suite (`apps/web/e2e/flowboard.spec.ts`)
Runs in real Chromium via Playwright against the live API, PostgreSQL database, and Socket.IO server:
- Complete lifecycle: Register -> Workspace dashboard -> Create Project -> Create Task -> Move on Kanban Board -> Reload page to verify PostgreSQL persistence -> Open Task Detail Drawer -> Edit title -> Post comment -> Delete task -> Logout -> Verify protected route redirect to `/login`
- Multi-session real-time Socket.IO verification: Two separate authenticated browser contexts (`alex@flowboard.dev` and `maya@flowboard.dev`); Session 1 creates and deletes a task and Session 2 observes both changes live without reloading
- Responsive mobile viewport check (`375x812`) verifying zero horizontal overflow and functional mobile navigation drawer
- Zero browser console errors check & automated screenshot capture into `docs/screenshots/`
