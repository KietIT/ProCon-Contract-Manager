# TAR Contract Management Platform — Setup Guide

> **For backend developers cloning this project from GitHub.**
> The UI/UX is fully built. This guide walks you through getting everything running locally so you can integrate the backend.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 14, Tailwind CSS v3, shadcn/ui, Recharts, Zustand |
| Backend | Fastify 5, Prisma ORM, BullMQ |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Auth | Clerk (`@clerk/fastify` + `@clerk/nextjs`) |
| Storage | Supabase Storage (fallback: local `.local-storage/`) |
| Email | Resend (fallback: console.log) |

---

## Prerequisites

Install these before starting:

| Tool | Version | Download |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 10+ | `npm install -g pnpm` |
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop |
| Git | any | https://git-scm.com |

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/<your-org>/TAR-Contract-Management-Platform.git
cd TAR-Contract-Management-Platform
```

---

## Step 2 — Start Database & Redis (Docker)

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL 16** on port `5432`
- **Redis 7** on port `6379`

Verify they are running:
```bash
docker ps
```

---

## Step 3 — Install All Dependencies

Run this from the **project root** (not inside any sub-folder):

```bash
pnpm install
```

This installs dependencies for all three workspaces at once:
- `apps/web` — Next.js frontend
- `apps/api` — Fastify backend
- `packages/shared` — Shared TypeScript types

---

## Step 4 — Configure Environment Variables

### 4a. Root `.env` (for Prisma CLI at root level)

Create a file named `.env` in the **project root**:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/tar_platform"
```

### 4b. API `.env` (main backend config)

The file `apps/api/.env` should already exist. Verify or create it:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/tar_platform"

# Redis
REDIS_URL="redis://localhost:6379"

# Anthropic AI — get your key at https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY="sk-ant-..."

# Auth — set to true to bypass Clerk during local development
SKIP_AUTH=true

# Supabase Storage — get from https://supabase.com → Project Settings → API
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_KEY="your-service-key"
SUPABASE_STORAGE_BUCKET="contracts"

# Clerk (only needed when SKIP_AUTH=false)
CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Email via Resend — leave empty to log emails to console instead
RESEND_API_KEY=""
EMAIL_FROM="noreply@tar-platform.com"

# Server
PORT=3001
NODE_ENV="development"
```

> **Tip:** For local development, `SKIP_AUTH=true` lets you skip Clerk entirely.
> The API will automatically use the first seeded user as the current user.

---

## Step 5 — Run Database Migrations & Seed

```bash
# Apply all migrations to the database
pnpm db:migrate

# Seed demo data (projects, contracts, users, milestones)
pnpm db:seed
```

---

## Step 6 — Run the Project

### Option A — Run everything together (recommended)

```bash
pnpm dev
```

This starts both frontend and backend in parallel via Turborepo:
- **Frontend** → http://localhost:3000
- **Backend API** → http://localhost:3001

### Option B — Run separately

```bash
# Terminal 1 — Frontend only
cd apps/web
pnpm dev

# Terminal 2 — Backend API only
cd apps/api
pnpm dev

# Terminal 3 — BullMQ worker (required for AI contract parsing)
cd apps/api
pnpm worker

# Terminal 4 — SLA checker (optional, for approval escalation)
cd apps/api
pnpm sla-checker
```

---

## Project Structure

```
TAR-Contract-Management-Platform/
├── apps/
│   ├── web/                        # Next.js 14 frontend
│   │   ├── app/
│   │   │   ├── (dashboard)/        # Main workspace (all roles)
│   │   │   │   ├── workspace/      # TAR Manager — project dashboard
│   │   │   │   ├── approvals/      # TAR Manager + Procurement
│   │   │   │   ├── procurement/    # Procurement role dashboard
│   │   │   │   └── my-work/        # Contractor portal
│   │   │   └── (admin)/            # Admin panel (TAR Manager only)
│   │   ├── components/             # Shared UI components
│   │   │   ├── role-switcher.tsx   # Demo role switcher
│   │   │   ├── theme-toggle.tsx    # Dark / Light mode toggle
│   │   │   └── currency-input.tsx  # Currency selector input
│   │   └── lib/
│   │       ├── mock-data.ts        # All demo/mock data (UI-only)
│   │       ├── store.ts            # Zustand global state
│   │       └── api-client.ts       # API client (currently stubbed)
│   │
│   └── api/                        # Fastify 5 backend
│       ├── src/
│       │   ├── routes/             # API route handlers
│       │   ├── services/           # Business logic
│       │   ├── workers/            # BullMQ background jobs
│       │   └── middleware/         # Auth, RBAC, RLS
│       └── prisma/
│           ├── schema.prisma       # Database schema
│           ├── migrations/         # SQL migration history
│           └── seed.ts             # Demo data seeder
│
└── packages/
    └── shared/                     # TypeScript types shared by web + api
```

---

## User Roles (Demo)

The UI includes a **Role Switcher** in the sidebar for demo purposes.
Each role has a dedicated home page:

| Role | Home Page | Permissions |
|------|-----------|-------------|
| `tar_manager` (MGR) | `/workspace` | Full access — manage all projects, contracts, approvals |
| `procurement` (PRO) | `/procurement` | Sourcing dashboard, create contracts, approve milestones |
| `contractor` (CON) | `/my-work` | View own contracts, update milestones, submit expenses |

---

## API Endpoints (Backend Integration)

The frontend's `apps/web/lib/api-client.ts` is currently **stubbed** (all functions return `null`).
Wire it up to the real Fastify API running on `http://localhost:3001/api/v1`.

Key endpoints already implemented in `apps/api/src/routes/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/projects` | List projects |
| `POST` | `/api/v1/projects` | Create project |
| `GET` | `/api/v1/projects/:id/dashboard` | Project KPIs & RAG |
| `GET` | `/api/v1/projects/:id/contracts` | List contracts |
| `POST` | `/api/v1/projects/:id/contracts` | Upload contract |
| `POST` | `/api/v1/contracts/:id/parse` | Trigger AI parsing |
| `GET` | `/api/v1/contracts/:id/extraction` | Get AI extraction |
| `POST` | `/api/v1/contracts/:id/extraction/confirm` | Confirm milestones |
| `PATCH` | `/api/v1/milestones/:id/complete` | Complete milestone |
| `GET` | `/api/v1/approvals/pending` | Pending approvals |
| `POST` | `/api/v1/approvals/:id/decide` | Approve / reject |

---

## Common Issues

**`pnpm install` fails**
→ Make sure you're using pnpm v10+: `pnpm --version`

**Database connection error**
→ Make sure Docker is running: `docker ps`
→ Check `DATABASE_URL` in both `.env` files

**Port already in use**
→ Frontend default: `3000`, Backend default: `3001`
→ Change `PORT` in `apps/api/.env` if needed

**AI parsing not working**
→ Set `ANTHROPIC_API_KEY` in `apps/api/.env`
→ Make sure the BullMQ worker is running: `pnpm worker`

---

## Questions?

Contact the frontend team or open an issue on GitHub.
