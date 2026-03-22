# ProCon — AI-Powered Construction Contract Management

AI-driven contract management for construction and Turnaround (TAR) projects. Upload contract PDFs/DOCX files, automatically extract milestones with AI, compare contract versions with side-by-side diff, track progress on a real-time dashboard, and manage approval workflows with SLA enforcement.

## Features

- **AI Contract Parsing** — Upload PDF/DOCX contracts and extract milestones, obligations, penalties, payment triggers, equipment lists, and key dates. Includes OCR fallback for scanned documents.
- **Contract Version Diff** — Side-by-side PDF comparison with text-level highlighting (additions, deletions, modifications), synchronized scrolling, and keyboard navigation.
- **Individual Milestone Review** — Accept or reject each AI-extracted milestone individually. Accepted milestones are created instantly; rejected milestones require a reason and are removed from the review queue.
- **ProCon Command Dashboard** — Real-time KPIs with RAG status donut chart, cumulative cost burn vs planned budget, contracts-at-risk table, and overdue milestone panel.
- **Milestone Tracker** — Visual milestone management grouped by status (overdue, in progress, not started, complete, waived) with one-click status transitions.
- **Approval Workflow** — Role-based approval with SLA countdown timers. All roles escalate to ProCon Manager (tar_manager) for final decision. Automatic escalation for overdue approvals.
- **Multi-Org Isolation** — Owner organizations and contractor organizations see only their relevant data. Authorization enforced at the application middleware layer.
- **RAG Status Engine** — Automated Red/Amber/Green health scoring per contract based on milestone delays and budget burn rate.
- **Source Verification** — Click any AI-extracted item to highlight the exact clause in the original PDF with fuzzy Levenshtein matching.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TanStack Query, Zustand, shadcn/ui, Recharts, Tailwind CSS 3 |
| Backend | Fastify 5, Prisma ORM, Zod validation, BullMQ + Redis |
| AI | BytePlus Ark (Seed model), pdf-parse, mammoth, tesseract.js (OCR) |
| Database | PostgreSQL 16, Redis 7 |
| Auth | Clerk (multi-org RBAC), `SKIP_AUTH=true` for local dev |
| Storage | AWS S3 |

## Architecture

```
TAR-Contract-Management-Platform/
  apps/
    web/          # Next.js 14 frontend (:3000)
    api/          # Fastify 5 REST API (:3001)
      src/
        routes/       # API endpoints
        services/     # Business logic, AI extraction, diff engine
        workers/      # BullMQ contract parser, SLA checker
        middleware/   # Auth + RLS
      prisma/         # Schema + migrations + seed
  packages/
    shared/       # TypeScript types shared between web and api
```

The API server, BullMQ worker, and SLA checker run as **separate processes**.

### AI Extraction Pipeline

```
Upload PDF/DOCX -> Store in AWS S3 -> Extract text (pdf-parse / mammoth / OCR fallback)
  -> Chunk (4000 tokens, 200 overlap)
  -> BytePlus Seed model per chunk
  -> Merge results -> Individual review (Accept/Reject per milestone)
  -> Accepted items become milestones instantly
```

### Contract Diff Pipeline

```
Select 2 versions -> Backend downloads both files from S3
  -> Extract text with page info (extractFromPdfWithPages)
  -> Word-level diff (diff npm package)
  -> Frontend renders side-by-side with text-layer highlighting
```

## Prerequisites

- **Node.js** 20+
- **pnpm** 10+
- **Docker** (for PostgreSQL and Redis)

## Getting Started

```bash
# 1. Clone and install
git clone <repo-url>
cd TAR-Contract-Management-Platform
pnpm install

# 2. Set up environment
# Create .env in both root and apps/api/ with:
#   DATABASE_URL="postgresql://postgres:password@localhost:5432/tar_platform"
#   REDIS_URL="redis://localhost:6379"
#   SKIP_AUTH="true"
#   BYTEPLUS_API_KEY="your-byteplus-ark-api-key"
#   S3_BUCKET_NAME="your-bucket"
#   S3_REGION="ap-southeast-1"
#   S3_ACCESS_KEY_ID="your-access-key"
#   S3_SECRET_ACCESS_KEY="your-secret-key"

# 3. Start infrastructure
docker-compose up -d    # PostgreSQL 16 + Redis 7

# 4. Set up database
pnpm db:migrate         # Run Prisma migrations
pnpm db:seed            # Seed demo data (orgs, users, sample contracts)

# 5. Start development
pnpm dev                # Starts both web (:3000) and api (:3001)
```

### Additional Processes

```bash
# BullMQ worker for async contract parsing (required for AI extraction)
cd apps/api && pnpm worker

# SLA breach checker (runs every 30 min, escalates overdue approvals)
cd apps/api && pnpm sla-checker
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web + api in development |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed demo data |

## Database Schema

Nine models: **Organisation** -> **User**, **Project** -> **Contract** -> **ContractVersion**, **Contract** -> **Milestone** -> **ApprovalRequest**, **CostEntry**, **AuditLog**.

Key enums:
- `RagStatus`: green, amber, red
- `AiExtractionStatus`: pending -> processing -> review -> confirmed / failed
- `MilestoneSource`: ai_extracted, manual
- `ApprovalStatus`: pending, approved, rejected, escalated, expired

## Roles

| Role | Capabilities |
|------|-------------|
| `tar_manager` | Full access: create projects, upload/delete contracts, parse AI, manage milestones, approve/reject, admin panel |
| `procurement` | Parse AI, approve/reject |
| `contractor` | View own contracts, complete assigned milestones |

## License

Proprietary — Hackathon project.
