# TAR Contract Management Platform — Implementation Guide

> **Mục đích file này:** Hướng dẫn triển khai đầy đủ cho Claude Code CLI. Đọc toàn bộ file trước khi bắt đầu bất kỳ bước nào.

---

## 1. Project Overview

**Tên dự án:** AI-Driven TAR (Turnaround) Contract Management Platform  
**Mục tiêu MVP:** AI tự động trích xuất milestones từ hợp đồng PDF/DOCX, hiển thị trên dashboard thời gian thực, giảm >40% công việc báo cáo thủ công.  
**Target users:** EPC Contractors, PMC / Owner's Engineers trong ngành dầu khí hóa dầu.  
**Team size:** 2–4 engineers  
**MVP timeline:** 8 sprints × 2 tuần

---

## 2. Tech Stack

### Frontend
| Tech | Version | Purpose |
|---|---|---|
| Next.js | 14 (App Router) | Dashboard, contract workspace, approval flows |
| TypeScript | 5.x | Type safety toàn bộ codebase |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | latest | Component library |
| React Hook Form | 7.x | Form handling |
| Zustand | 4.x | Client state management |
| TanStack Query | 5.x | Server state, caching, refetch |
| Recharts | 2.x | Cost burn charts, dashboard KPIs |

### Backend / API
| Tech | Version | Purpose |
|---|---|---|
| Node.js | 20 LTS | Runtime |
| Fastify | 4.x | REST API server |
| TypeScript | 5.x | Type safety |
| Prisma | 5.x | ORM, migrations, type-safe DB queries |
| Zod | 3.x | Schema validation cho API payloads |

### Database & Storage
| Tech | Purpose |
|---|---|
| PostgreSQL 16 | Primary database, Row-Level Security cho multi-org |
| Redis 7 | BullMQ job queue, session cache, KPI cache |
| AWS S3 / Cloudflare R2 | Contract PDF/DOCX storage, exported reports |

### AI Layer
| Tech | Purpose |
|---|---|
| Anthropic Claude API (`claude-sonnet-4-6`) | Contract parsing, milestone extraction, risk summarization |
| `@anthropic-ai/sdk` | Official Node.js SDK |
| `pdf-parse` | Extract text từ native PDF |
| `mammoth` | Extract text từ DOCX |
| `tesseract.js` | OCR fallback cho scanned PDF |

### Queue / Async
| Tech | Purpose |
|---|---|
| BullMQ | Job queue cho async contract processing |
| Redis | BullMQ backend |
| Bull Board (optional) | UI monitor job queue trong development |

### Auth
| Tech | Purpose |
|---|---|
| Clerk | Multi-org auth, RBAC, SSO enterprise — recommended |
| Auth.js (NextAuth) | Alternative nếu không dùng Clerk |

### Notifications
| Tech | Purpose |
|---|---|
| Resend | Transactional email (approval requests, alerts) |
| Web Push API | In-app notifications |

### Analytics & Monitoring
| Tech | Purpose |
|---|---|
| PostHog | Product analytics, funnel tracking, feature flags |
| Sentry | Error tracking |

### Infrastructure
| Tech | Purpose |
|---|---|
| Vercel | Frontend deployment (Next.js) |
| Railway | Backend API + PostgreSQL + Redis |
| GitHub Actions | CI/CD pipeline |
| Docker | Local development environment |

---

## 3. Repository Structure

```
tar-platform/
├── apps/
│   ├── web/                        # Next.js 14 frontend
│   │   ├── app/
│   │   │   ├── (auth)/             # Login, signup pages
│   │   │   ├── (dashboard)/        # Protected dashboard routes
│   │   │   │   ├── projects/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── page.tsx          # Project dashboard
│   │   │   │   │   │   ├── contracts/        # Contract list
│   │   │   │   │   │   └── milestones/       # Milestone tracker
│   │   │   │   ├── contracts/
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx          # Contract detail
│   │   │   │   │       └── extraction/       # AI review UI
│   │   │   │   └── approvals/
│   │   │   ├── api/                # Next.js API routes (webhooks only)
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui components
│   │   │   ├── dashboard/          # Dashboard-specific components
│   │   │   ├── contracts/          # Contract components
│   │   │   └── extraction/         # AI extraction review components
│   │   └── lib/
│   │       ├── api-client.ts       # Typed API client
│   │       └── utils.ts
│   │
│   └── api/                        # Fastify backend
│       ├── src/
│       │   ├── routes/
│       │   │   ├── projects.ts
│       │   │   ├── contracts.ts
│       │   │   ├── milestones.ts
│       │   │   ├── approvals.ts
│       │   │   ├── alerts.ts
│       │   │   └── reports.ts
│       │   ├── workers/
│       │   │   └── contract-parser.worker.ts  # BullMQ worker
│       │   ├── services/
│       │   │   ├── ai/
│       │   │   │   ├── extractor.ts           # Claude API calls
│       │   │   │   ├── chunker.ts             # Text chunking logic
│       │   │   │   └── prompts.ts             # Prompt templates
│       │   │   ├── storage.ts                 # S3 operations
│       │   │   ├── queue.ts                   # BullMQ setup
│       │   │   └── notifications.ts           # Email + push
│       │   ├── middleware/
│       │   │   ├── auth.ts                    # JWT validation
│       │   │   └── rls.ts                     # Row-level security context
│       │   └── lib/
│       │       ├── prisma.ts                  # Prisma client singleton
│       │       └── redis.ts                   # Redis client singleton
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
│
├── packages/
│   └── shared/                     # Shared TypeScript types
│       └── types/
│           ├── contract.types.ts
│           ├── milestone.types.ts
│           └── api.types.ts
│
├── docker-compose.yml              # Local dev: Postgres + Redis
├── .env.example
└── turbo.json                      # Turborepo monorepo config
```

---

## 4. Database Schema (PostgreSQL 16 + Prisma)

### 4.1 Prisma Schema

Tạo file `apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────

enum OrgType {
  owner
  epc_contractor
  pmc
}

enum ProjectStatus {
  planning
  active
  close_out
  complete
}

enum ContractType {
  subcontract
  supply
  service
  mep
  inspection
}

enum ContractStatus {
  draft
  active
  at_risk
  complete
  disputed
}

enum RagStatus {
  green
  amber
  red
}

enum AiExtractionStatus {
  pending
  processing
  review
  confirmed
  failed
}

enum MilestoneType {
  completion
  payment_trigger
  inspection
  handover
  penalty_threshold
}

enum MilestoneStatus {
  not_started
  in_progress
  complete
  overdue
  waived
}

enum MilestoneSource {
  ai_extracted
  manual
}

enum ApprovalStatus {
  pending
  approved
  rejected
  escalated
  expired
}

enum CostCategory {
  labour
  materials
  equipment
  subcontract
  other
}

// ─── Models ──────────────────────────────────────────────

model Organisation {
  id        String   @id @default(uuid())
  name      String
  type      OrgType
  slug      String   @unique
  settings  Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  // Relations
  ownedProjects     Project[]     @relation("ProjectOwner")
  contractorContracts Contract[]  @relation("ContractorOrg")
  users             User[]

  @@map("organisations")
}

model User {
  id       String @id @default(uuid())
  orgId    String @map("org_id")
  clerkId  String @unique @map("clerk_id")
  email    String @unique
  name     String
  role     String // tar_manager | contract_manager | pmo | procurement | contractor

  org                  Organisation        @relation(fields: [orgId], references: [id])
  assignedMilestones   Milestone[]         @relation("MilestoneAssignee")
  requestedApprovals   ApprovalRequest[]   @relation("ApprovalRequester")
  assignedApprovals    ApprovalRequest[]   @relation("ApprovalAssignee")
  escalatedApprovals   ApprovalRequest[]   @relation("ApprovalEscalation")
  costEntries          CostEntry[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}

model Project {
  id           String        @id @default(uuid())
  ownerOrgId   String        @map("owner_org_id")
  name         String
  tarStartDate DateTime      @map("tar_start_date") @db.Date
  tarEndDate   DateTime      @map("tar_end_date") @db.Date
  totalBudget  Decimal       @map("total_budget") @db.Decimal(18, 2)
  status       ProjectStatus @default(planning)

  ownerOrg  Organisation @relation("ProjectOwner", fields: [ownerOrgId], references: [id])
  contracts Contract[]

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  @@map("projects")
}

model Contract {
  id                  String             @id @default(uuid())
  projectId           String             @map("project_id")
  contractorOrgId     String             @map("contractor_org_id")
  contractNumber      String             @map("contract_number")
  type                ContractType
  contractValue       Decimal            @map("contract_value") @db.Decimal(18, 2)
  approvedValue       Decimal?           @map("approved_value") @db.Decimal(18, 2)
  startDate           DateTime           @map("start_date") @db.Date
  endDate             DateTime           @map("end_date") @db.Date
  status              ContractStatus     @default(draft)
  ragStatus           RagStatus          @default(green) @map("rag_status")
  fileKey             String?            @map("file_key")
  aiExtractionStatus  AiExtractionStatus @default(pending) @map("ai_extraction_status")
  aiExtractionData    Json?              @map("ai_extraction_data")

  project       Project      @relation(fields: [projectId], references: [id])
  contractorOrg Organisation @relation("ContractorOrg", fields: [contractorOrgId], references: [id])
  milestones    Milestone[]
  costEntries   CostEntry[]

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  @@map("contracts")
}

model Milestone {
  id               String          @id @default(uuid())
  contractId       String          @map("contract_id")
  title            String
  description      String
  type             MilestoneType
  dueDate          DateTime        @map("due_date") @db.Date
  assignedToUserId String?         @map("assigned_to_user_id")
  status           MilestoneStatus @default(not_started)
  completedAt      DateTime?       @map("completed_at")
  source           MilestoneSource @default(ai_extracted)
  aiConfidence     Float?          @map("ai_confidence")
  requiresApproval Boolean         @default(false) @map("requires_approval")

  contract         Contract          @relation(fields: [contractId], references: [id])
  assignedTo       User?             @relation("MilestoneAssignee", fields: [assignedToUserId], references: [id])
  approvalRequests ApprovalRequest[]

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  @@map("milestones")
}

model ApprovalRequest {
  id                  String         @id @default(uuid())
  milestoneId         String         @map("milestone_id")
  requestedByUserId   String         @map("requested_by_user_id")
  approverUserId      String         @map("approver_user_id")
  status              ApprovalStatus @default(pending)
  slaDeadline         DateTime       @map("sla_deadline")
  decidedAt           DateTime?      @map("decided_at")
  comments            String?
  escalatedToUserId   String?        @map("escalated_to_user_id")

  milestone     Milestone @relation(fields: [milestoneId], references: [id])
  requestedBy   User      @relation("ApprovalRequester", fields: [requestedByUserId], references: [id])
  approver      User      @relation("ApprovalAssignee", fields: [approverUserId], references: [id])
  escalatedTo   User?     @relation("ApprovalEscalation", fields: [escalatedToUserId], references: [id])

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("approval_requests")
}

model CostEntry {
  id                String       @id @default(uuid())
  contractId        String       @map("contract_id")
  entryDate         DateTime     @map("entry_date") @db.Date
  amount            Decimal      @db.Decimal(18, 2)
  category          CostCategory
  submittedByUserId String       @map("submitted_by_user_id")
  approved          Boolean      @default(false)

  contract    Contract @relation(fields: [contractId], references: [id])
  submittedBy User     @relation(fields: [submittedByUserId], references: [id])

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("cost_entries")
}
```

### 4.2 Row-Level Security (RLS)

Sau khi migrate, chạy SQL này để bật RLS:

```sql
-- Enable RLS on all tenant tables
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Contractor chỉ thấy contract của org mình
CREATE POLICY contractor_contracts ON contracts
  USING (contractor_org_id = current_setting('app.current_org_id')::uuid
    OR project_id IN (
      SELECT id FROM projects
      WHERE owner_org_id = current_setting('app.current_org_id')::uuid
    )
  );

-- Set org context trong mỗi DB session (gọi từ API middleware)
-- SET app.current_org_id = '<org_uuid>';
```

---

## 5. Environment Variables

Tạo `.env.example` tại root:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/tar_platform"

# Redis
REDIS_URL="redis://localhost:6379"

# Anthropic AI
ANTHROPIC_API_KEY="sk-ant-..."

# AWS S3 / Cloudflare R2
S3_BUCKET_NAME="tar-contracts"
S3_REGION="ap-southeast-1"
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_ENDPOINT=""           # Để trống nếu dùng AWS, điền endpoint nếu dùng R2

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Email (Resend)
RESEND_API_KEY=""
EMAIL_FROM="noreply@tar-platform.com"

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=""
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"

# App
API_URL="http://localhost:3001"
NEXT_PUBLIC_API_URL="http://localhost:3001"
NODE_ENV="development"
```

---

## 6. AI Contract Parsing Pipeline

### 6.1 Text Chunker (`apps/api/src/services/ai/chunker.ts`)

```typescript
export interface TextChunk {
  index: number;
  text: string;
  tokenEstimate: number;
}

const CHARS_PER_TOKEN = 4; // rough estimate for English contract text
const MAX_TOKENS = 4000;
const OVERLAP_TOKENS = 200;

export function chunkText(rawText: string): TextChunk[] {
  const maxChars = MAX_TOKENS * CHARS_PER_TOKEN;
  const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN;

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < rawText.length) {
    const end = Math.min(start + maxChars, rawText.length);

    // Try to break at paragraph boundary
    let actualEnd = end;
    if (end < rawText.length) {
      const boundary = rawText.lastIndexOf('\n\n', end);
      if (boundary > start + maxChars * 0.5) {
        actualEnd = boundary;
      }
    }

    const text = rawText.slice(start, actualEnd).trim();
    if (text.length > 0) {
      chunks.push({
        index,
        text,
        tokenEstimate: Math.ceil(text.length / CHARS_PER_TOKEN),
      });
      index++;
    }

    // Move start forward with overlap
    start = actualEnd - overlapChars;
    if (start <= 0) break;
  }

  return chunks;
}
```

### 6.2 System Prompt (`apps/api/src/services/ai/prompts.ts`)

```typescript
export const EXTRACTION_SYSTEM_PROMPT = `You are a specialist contract analyst with deep expertise in petrochemical EPC subcontracts, TAR (turnaround) scopes, and FIDIC-style agreements.

Extract ALL of the following from the contract text and return ONLY valid JSON matching the schema below. Do not include explanation, preamble, or markdown formatting — return raw JSON only.

{
  "milestones": [{
    "title": "string — short milestone name",
    "description": "string — full clause text or detailed description",
    "type": "completion | payment_trigger | inspection | handover | penalty_threshold",
    "due_date": "YYYY-MM-DD or null if date is relative or unclear",
    "relative_date_expression": "string or null — e.g. '14 days after mechanical completion'",
    "confidence": 0.0,
    "source_clause": "exact verbatim text from contract that this was extracted from"
  }],
  "obligations": [{
    "party": "string — which party holds this obligation",
    "description": "string — what they must do",
    "deadline": "string or null",
    "confidence": 0.0
  }],
  "penalty_clauses": [{
    "trigger": "string — what event causes the penalty",
    "amount_or_rate": "string — e.g. '$5,000 per day' or '0.5% of contract value'",
    "cap": "string or null — maximum penalty amount",
    "confidence": 0.0
  }],
  "payment_triggers": [{
    "description": "string — condition that triggers payment",
    "amount_or_percentage": "string",
    "confidence": 0.0
  }],
  "key_dates": [{
    "label": "string",
    "date": "YYYY-MM-DD or null",
    "relative_expression": "string or null",
    "confidence": 0.0
  }]
}

Rules:
- Flag any extraction with confidence < 0.7 — these will be sent for mandatory human review
- If a date is relative (e.g. "14 days after mechanical completion"), set due_date to null and record the expression in relative_date_expression
- NEVER guess or infer dates — return null rather than an approximation
- Always include source_clause — it is essential for dispute evidence
- If a section contains no relevant information, return an empty array for that key`;

export function buildUserPrompt(chunk: string, chunkIndex: number, totalChunks: number): string {
  return `Contract text (chunk ${chunkIndex + 1} of ${totalChunks}):

---
${chunk}
---

Extract all milestones, obligations, penalty clauses, payment triggers, and key dates from this section.`;
}
```

### 6.3 AI Extractor (`apps/api/src/services/ai/extractor.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { chunkText } from './chunker';
import { EXTRACTION_SYSTEM_PROMPT, buildUserPrompt } from './prompts';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ExtractionResult {
  milestones: ExtractedMilestone[];
  obligations: ExtractedObligation[];
  penalty_clauses: ExtractedPenalty[];
  payment_triggers: ExtractedPaymentTrigger[];
  key_dates: ExtractedKeyDate[];
  chunks_processed: number;
  low_confidence_count: number;
}

export interface ExtractedMilestone {
  title: string;
  description: string;
  type: string;
  due_date: string | null;
  relative_date_expression: string | null;
  confidence: number;
  source_clause: string;
}

// ... (same pattern for other types)

export async function extractContractData(rawText: string): Promise<ExtractionResult> {
  const chunks = chunkText(rawText);
  
  const allResults: Partial<ExtractionResult>[] = [];

  for (const chunk of chunks) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(chunk.text, chunk.index, chunks.length),
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') continue;

    try {
      const parsed = JSON.parse(content.text);
      allResults.push(parsed);
    } catch (err) {
      // Log parse error, continue with other chunks
      console.error(`Failed to parse chunk ${chunk.index}:`, err);
    }
  }

  // Merge all chunk results
  const merged = mergeResults(allResults);

  // Second pass: re-run low-confidence items
  const lowConfidence = merged.milestones.filter(m => m.confidence < 0.7);
  if (lowConfidence.length > 0) {
    // TODO: implement targeted second pass for low-confidence items
  }

  return {
    ...merged,
    chunks_processed: chunks.length,
    low_confidence_count: merged.milestones.filter(m => m.confidence < 0.7).length,
  };
}

function mergeResults(results: Partial<ExtractionResult>[]): ExtractionResult {
  return {
    milestones: results.flatMap(r => r.milestones ?? []),
    obligations: results.flatMap(r => r.obligations ?? []),
    penalty_clauses: results.flatMap(r => r.penalty_clauses ?? []),
    payment_triggers: results.flatMap(r => r.payment_triggers ?? []),
    key_dates: results.flatMap(r => r.key_dates ?? []),
    chunks_processed: 0,
    low_confidence_count: 0,
  };
}
```

### 6.4 File Text Extractor (`apps/api/src/services/ai/file-extractor.ts`)

```typescript
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === 'application/pdf') {
    return extractFromPdf(buffer);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return extractFromDocx(buffer);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    
    // If text extraction returns empty or too short, fall back to OCR
    if (!data.text || data.text.trim().length < 100) {
      console.log('PDF appears to be scanned — falling back to OCR');
      return extractWithOcr(buffer);
    }

    return data.text;
  } catch {
    // Native extraction failed, try OCR
    return extractWithOcr(buffer);
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractWithOcr(buffer: Buffer): Promise<string> {
  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(buffer);
  await worker.terminate();
  return text;
}
```

### 6.5 BullMQ Worker (`apps/api/src/workers/contract-parser.worker.ts`)

```typescript
import { Worker, Queue } from 'bullmq';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { downloadFromS3 } from '../services/storage';
import { extractTextFromFile } from '../services/ai/file-extractor';
import { extractContractData } from '../services/ai/extractor';

export const parsingQueue = new Queue('contract-parsing', { connection: redis });

export const parsingWorker = new Worker(
  'contract-parsing',
  async (job) => {
    const { contractId, fileKey, mimeType } = job.data;

    // Update status to processing
    await prisma.contract.update({
      where: { id: contractId },
      data: { aiExtractionStatus: 'processing' },
    });

    try {
      // Step 1: Download file from S3
      const fileBuffer = await downloadFromS3(fileKey);

      // Step 2: Extract raw text
      await job.updateProgress(20);
      const rawText = await extractTextFromFile(fileBuffer, mimeType);

      // Step 3: Run AI extraction
      await job.updateProgress(40);
      const extractionResult = await extractContractData(rawText);

      // Step 4: Save results to DB
      await job.updateProgress(90);
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          aiExtractionStatus: 'review',
          aiExtractionData: extractionResult as any,
        },
      });

      await job.updateProgress(100);
      return { success: true, contractId, chunksProcessed: extractionResult.chunks_processed };

    } catch (error) {
      await prisma.contract.update({
        where: { id: contractId },
        data: { aiExtractionStatus: 'failed' },
      });
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 3, // Process up to 3 contracts simultaneously
  }
);
```

---

## 7. REST API Endpoints

Base path: `/api/v1`  
Auth: `Authorization: Bearer <token>` on all endpoints unless marked Public.

### 7.1 Projects

```
GET    /projects                        → List projects for authenticated org
POST   /projects                        → Create TAR project
GET    /projects/:id                    → Project detail + summary stats
GET    /projects/:id/dashboard          → TAR command dashboard: KPIs, RAG, burn rate, overdue
PATCH  /projects/:id                    → Update project settings/status
```

### 7.2 Contracts

```
GET    /projects/:id/contracts          → List contracts with RAG status and burn rate
POST   /projects/:id/contracts          → Create contract record + upload file (multipart)
GET    /contracts/:id                   → Contract detail: milestones, cost summary, approvals
POST   /contracts/:id/parse             → Trigger AI extraction job → returns { jobId }
GET    /contracts/:id/parse/:jobId      → Poll job status and progress (0–100)
GET    /contracts/:id/extraction        → Get AI extraction results for human review
POST   /contracts/:id/extraction/confirm → Confirm or edit extraction → activates milestones
PATCH  /contracts/:id                   → Update contract metadata/status
```

### 7.3 Milestones

```
GET    /contracts/:id/milestones        → List all milestones for a contract
POST   /contracts/:id/milestones        → Create milestone manually
PATCH  /milestones/:id                  → Update status, due date, or assignee
POST   /milestones/:id/complete         → Mark complete → triggers approval workflow if required
GET    /projects/:id/milestones/overdue → All overdue milestones with delay days
```

### 7.4 Approvals, Alerts, Reports

```
GET    /approvals/pending               → My pending approval requests
POST   /approvals/:id/decide            → Approve or reject (comments required on rejection)
GET    /projects/:id/alerts             → Active alerts: overdue, budget breach, SLA
POST   /alerts/:id/dismiss              → Dismiss with mandatory reason
GET    /projects/:id/report             → Generate daily status report (PDF or XLSX)
GET    /projects/:id/audit-log          → Full immutable audit trail
GET    /contracts/:id/costs             → Cost entries + daily burn summary
POST   /contracts/:id/costs             → Add a cost entry
```

---

## 8. RAG Status Computation

RAG (Red / Amber / Green) được tính bởi background job chạy mỗi giờ:

```typescript
// apps/api/src/services/rag-computer.ts

export function computeContractRag(contract: ContractWithMilestones): RagStatus {
  const today = new Date();
  const overdueMilestones = contract.milestones.filter(
    m => m.status !== 'complete' && m.status !== 'waived' && new Date(m.dueDate) < today
  );
  const burnRate = computeBurnRate(contract);

  // RED: any overdue milestone OR burn > 100%
  if (overdueMilestones.length > 0 || burnRate > 1.0) return 'red';

  // AMBER: burn > 80% OR milestone due within 3 days
  const imminentMilestones = contract.milestones.filter(m => {
    const daysUntilDue = (new Date(m.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return m.status !== 'complete' && daysUntilDue <= 3 && daysUntilDue >= 0;
  });

  if (burnRate > 0.8 || imminentMilestones.length > 0) return 'amber';

  return 'green';
}

function computeBurnRate(contract: ContractWithCosts): number {
  const totalSpent = contract.costEntries.reduce((sum, e) => sum + Number(e.amount), 0);
  return totalSpent / Number(contract.contractValue);
}
```

---

## 9. Multi-Org Permission Model

```typescript
// apps/api/src/middleware/auth.ts

import { getAuth } from '@clerk/fastify';

export async function authMiddleware(request, reply) {
  const { userId, orgId } = getAuth(request);
  
  if (!userId || !orgId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  // Set Postgres RLS context for this request
  await prisma.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;

  request.userId = userId;
  request.orgId = orgId;
}
```

**Roles và permissions:**

| Role | Permissions |
|---|---|
| `tar_manager` | Read all contracts/milestones in org's projects. Dismiss alerts. Generate reports. |
| `contract_manager` | Full CRUD on contracts, milestones, extractions. Add cost entries. |
| `pmo` | Read all. Generate reports. View audit log. |
| `procurement` | Read contracts. View milestone delivery dates. |
| `contractor` | Read/update own org's contracts only. Update assigned milestones. |

---

## 10. Local Development Setup

### Prerequisites
- Node.js 20 LTS
- Docker & Docker Compose
- pnpm 8+

### Step-by-step

```bash
# 1. Clone và install
git clone <repo-url>
cd tar-platform
pnpm install

# 2. Start Postgres + Redis với Docker
docker-compose up -d

# 3. Setup environment
cp .env.example .env
# Edit .env với API keys thật

# 4. Run database migrations
cd apps/api
pnpm prisma migrate dev --name init

# 5. Seed database (optional)
pnpm prisma db seed

# 6. Start development servers
# Terminal 1 — API server
cd apps/api
pnpm dev

# Terminal 2 — BullMQ worker
cd apps/api
pnpm worker

# Terminal 3 — Next.js frontend
cd apps/web
pnpm dev
```

### `docker-compose.yml`

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: tar_platform
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 11. Engineering Roadmap

### Phase 0 — Sprint 0 (Week 1) — ALL engineers
- [ ] Monorepo setup (Turborepo + pnpm workspaces)
- [ ] CI/CD pipeline (GitHub Actions → Vercel + Railway)
- [ ] Prisma schema + initial migration
- [ ] Auth scaffolding (Clerk multi-org)
- [ ] S3 bucket config + upload utility
- [ ] Docker Compose local dev environment
- [ ] Shared TypeScript types package

### Phase 1a — Sprints 1–2 — Backend + AI Engineer
- [ ] File upload endpoint (multipart, S3)
- [ ] BullMQ queue + worker setup
- [ ] Text extraction service (pdf-parse + mammoth + Tesseract fallback)
- [ ] Text chunker with overlap
- [ ] Claude API extractor service
- [ ] Confidence scoring + low-confidence flagging
- [ ] Extraction results saved to DB as `pending_review`
- [ ] Extraction review API endpoints
- [ ] Confirm/edit extraction endpoint → creates Milestone records

### Phase 1b — Sprints 1–2 — Backend + Frontend
- [ ] Project CRUD API
- [ ] Contract CRUD API
- [ ] Role-based access middleware
- [ ] Multi-org data model + RLS policies
- [ ] Contracts list UI + Contract detail UI
- [ ] Extraction review UI (show AI results, allow edits, confirm)

### Phase 2a — Sprints 3–4 — Backend + Frontend
- [ ] Milestone tracker UI (status updates for field teams)
- [ ] Mark complete flow → triggers approval if `requiresApproval = true`
- [ ] Approval workflow engine
- [ ] SLA timer computation + cron job for SLA breach detection
- [ ] Email notifications (Resend) for approval requests
- [ ] Escalation on SLA breach

### Phase 2b — Sprints 3–4 — Frontend + Data
- [ ] TAR command dashboard
- [ ] RAG computation background job (hourly)
- [ ] Daily cost burn chart (Recharts)
- [ ] Overdue milestone panel
- [ ] KPI tiles (total contracts, completion rate, avg approval time)

### Phase 3 — Sprints 5–6 — All engineers
- [ ] Deviation alert engine
- [ ] Alert dismiss with audit reason
- [ ] Immutable audit log (append-only table or DB trigger)
- [ ] Daily report export — PDF via `@react-pdf/renderer` or `puppeteer`
- [ ] Daily report export — XLSX via `exceljs`
- [ ] PostHog analytics integration

### Phase 4 — Sprints 7–8 — All + founder
- [ ] Design partner onboarding (real contract testing)
- [ ] Extraction prompt tuning (measure edit rate per prompt version)
- [ ] Feedback loop: log original vs. edited extraction values
- [ ] Performance hardening: Redis cache for dashboard KPIs
- [ ] Pre-compute RAG aggregates via background job

---

## 12. Key Implementation Notes for AI Engineer

### Prompt versioning
- Lưu mỗi version prompt vào DB hoặc constants file với `version` string.
- Log `prompt_version` cùng với mỗi extraction result.
- Khi update prompt, so sánh edit rate trước/sau trên held-out sample.

### Feedback loop
- Khi Contract Manager sửa một extracted item, log lại:
  ```typescript
  {
    extraction_id: string,
    field: string,          // e.g. "due_date"
    original_value: any,    // AI's original output
    corrected_value: any,   // User's correction
    prompt_version: string,
    contract_type: string,
  }
  ```
- Aggregate theo `prompt_version` để tính edit rate = `edited_items / total_items`.

### Chunking edge cases
- Hợp đồng có bảng (table) có thể bị chia cắt giữa các chunk. Nếu detection rate thấp, thử tăng overlap lên 400 tokens.
- Với DOCX, `mammoth` có thể không preserve table structure. Cân nhắc dùng `mammoth.convertToHtml()` thay vì `extractRawText()` rồi strip HTML tags để giữ tốt hơn.

### Rate limiting
- Claude API có rate limit. Với concurrency = 3 workers × 4000 token chunks, monitor usage.
- Implement exponential backoff khi gặp 429 từ Claude API.

---

## 13. Hackathon Deliverable Scope

Trong thời gian hackathon, tập trung hoàn thành:

**Must have (demo được):**
1. Contract upload → S3
2. Trigger AI parsing job → BullMQ worker chạy
3. Claude API trích xuất milestones từ PDF mẫu
4. Hiển thị kết quả extraction với confidence scores
5. Human review UI — confirm/edit items
6. Basic TAR dashboard với ít nhất 1 project + danh sách contracts

**Nice to have:**
- RAG status tính toán
- Milestone status update
- Cost burn chart

**Out of scope cho hackathon:**
- Approval workflow engine
- Email notifications
- Report export
- Power BI integration

---

*File này được generate từ TAR Engineering Blueprint v1.0 — MVP Scope.*
