# FlowBoard — Deployment Guide

FlowBoard is configured for clean split deployment:
- **Frontend (`apps/web`)**: Vercel (static SPA)
- **Backend (`apps/api`)**: Render, Railway, or Fly.io (Node.js web service with WebSockets enabled)
- **Database**: Managed PostgreSQL 16 (Neon, Supabase, Render PostgreSQL, or RDS)

---

## 1. Provision Managed PostgreSQL

Create a PostgreSQL 16 database and obtain the pooled/direct connection string:
```env
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require"
```

---

## 2. Deploy Backend (`apps/api`) on Render

Create a **Web Service** pointing to this repository:

- **Build Command**:
  ```bash
  npm ci && npm run build --workspace=@flowboard/shared && npm run db:generate && npm run build --workspace=@flowboard/api
  ```
- **Pre-Deploy / Release Command**:
  ```bash
  npm run db:migrate
  ```
- **Start Command**:
  ```bash
  npm run start --workspace=@flowboard/api
  ```
- **Health Check Path**: `/api/v1/health`

### Required Production Environment Variables (Backend)

| Variable | Example / Notes |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `8000` (or platform-assigned port) |
| `DATABASE_URL` | Managed PostgreSQL connection string |
| `FRONTEND_URL` | `https://your-flowboard-app.vercel.app` |
| `JWT_ACCESS_SECRET` | Random 64-byte secret (`openssl rand -hex 48`) |
| `JWT_REFRESH_SECRET` | Distinct random 64-byte secret (`openssl rand -hex 48`) |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_DAYS` | `7` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAME_SITE` | `none` (required when frontend & backend are on different domains) or `lax` (same root domain) |

> **Important Cross-Origin Cookie Note**: If frontend (`app.example.com`) and backend (`api.example.com`) share the same apex domain, `COOKIE_SAME_SITE=lax` works smoothly. If deployed across separate public suffixes (`*.vercel.app` and `*.onrender.com`), set `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true`.

---

## 3. Deploy Frontend (`apps/web`) on Vercel

Create a Vercel project pointing to the repository:

- **Framework Preset**: Vite
- **Root Directory**: `.` (monorepo root) or configure workspace build:
  - **Install Command**: `npm ci`
  - **Build Command**: `npm run build --workspace=@flowboard/shared && npm run build --workspace=@flowboard/web`
  - **Output Directory**: `apps/web/dist`

### Required Production Environment Variables (Frontend)

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `https://your-api-domain.onrender.com/api/v1` |
| `VITE_SOCKET_URL` | `https://your-api-domain.onrender.com` |

### SPA Rewrite (`apps/web/vercel.json`)

An included `vercel.json` rewrites client-side routes back to `index.html` so refreshing `/app/kanban` or `/app/projects/:id` works cleanly in production.

---

## 4. CI Pipeline (GitHub Actions)

`.github/workflows/ci.yml` automatically runs on every push/PR to `main` with a PostgreSQL 16 service container:
1. `npm ci`
2. Build `@flowboard/shared`
3. Prisma generate & schema push
4. `npm run typecheck`
5. `npm run lint`
6. `npm run test` (API + Web suites)
7. `npm run build` (full production bundle verification)
