# FlowBoard — Local Setup Guide

## Prerequisites

- **Node.js** `>= 20.0.0` (tested on `v22.23.2`)
- **npm** `>= 10.0.0` (workspaces enabled)
- **PostgreSQL 16** — either via **Docker Compose** (`docker-compose.yml`) or a local PostgreSQL 16 installation

---

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` (and optionally `apps/api/.env` for direct Prisma CLI usage):

```bash
cp .env.example .env
```

Default local development values:
- **Frontend URL**: `http://localhost:5173`
- **Backend API URL**: `http://localhost:8000`
- **Database URL**: `postgresql://flowboard:flowboard_dev_password@localhost:5432/flowboard?schema=public`

### 3. Start PostgreSQL

**Option A — Docker Compose (recommended):**
```bash
npm run db:up
```

**Option B — Existing Local PostgreSQL 16:**
Ensure PostgreSQL is listening on `localhost:5432` with role `flowboard` (password `flowboard_dev_password`) owning database `flowboard` (and `flowboard_test` for backend integration tests).

### 4. Build Shared Package, Generate Prisma Client, Apply Migrations & Seed Demo Data

```bash
npm run build --workspace=@flowboard/shared
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 5. Start Frontend & Backend Together

```bash
npm run dev
```

Or in separate terminals:
```bash
npm run dev:api   # http://localhost:8000
npm run dev:web   # http://localhost:5173
```

---

## Seeded Demo Credentials

After running `npm run db:seed`, the demo workspace **"Acme Product Studio (Demo)"** is populated with 5 teammates, 4 projects, 24 tasks, labels, comments, activity history, and notifications:

| Role | Email | Password |
| --- | --- | --- |
| Workspace Owner | `alex@flowboard.dev` | `DemoPass123!` |
| Admin | `maya@flowboard.dev` | `DemoPass123!` |
| Admin | `liam@flowboard.dev` | `DemoPass123!` |
| Member | `priya@flowboard.dev` | `DemoPass123!` |
| Member | `marcus@flowboard.dev` | `DemoPass123!` |

> You can also click **"Fill Demo Credentials"** directly on the `/login` page.
