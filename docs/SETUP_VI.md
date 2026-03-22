# TAR Contract Management Platform — Hướng Dẫn Cài Đặt

> **Dành cho backend developer clone project từ GitHub.**
> Phần UI/UX đã được xây dựng hoàn chỉnh. Hướng dẫn này giúp bạn chạy toàn bộ project trên máy local để tích hợp backend.

---

## Công Nghệ Sử Dụng

| Tầng | Công nghệ |
|------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 14, Tailwind CSS v3, shadcn/ui, Recharts, Zustand |
| Backend | Fastify 5, Prisma ORM, BullMQ |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Auth | Clerk (`@clerk/fastify` + `@clerk/nextjs`) |
| Storage | Supabase Storage (fallback: thư mục `.local-storage/`) |
| Email | Resend (fallback: log ra console) |

---

## Yêu Cầu Cài Đặt Trước

Cài đặt các công cụ sau trước khi bắt đầu:

| Công cụ | Phiên bản | Link tải |
|---------|----------|---------|
| Node.js | 20 trở lên | https://nodejs.org |
| pnpm | 10 trở lên | `npm install -g pnpm` |
| Docker Desktop | Mới nhất | https://www.docker.com/products/docker-desktop |
| Git | Bất kỳ | https://git-scm.com |

---

## Bước 1 — Clone Repository

```bash
git clone https://github.com/<your-org>/TAR-Contract-Management-Platform.git
cd TAR-Contract-Management-Platform
```

---

## Bước 2 — Khởi Động Database & Redis (Docker)

```bash
docker-compose up -d
```

Lệnh này sẽ khởi động:
- **PostgreSQL 16** trên cổng `5432`
- **Redis 7** trên cổng `6379`

Kiểm tra đã chạy chưa:
```bash
docker ps
```

---

## Bước 3 — Cài Đặt Tất Cả Dependencies

Chạy lệnh này từ **thư mục gốc** của project (không phải bên trong sub-folder):

```bash
pnpm install
```

Lệnh này cài dependencies cho cả 3 workspace cùng lúc:
- `apps/web` — Frontend Next.js
- `apps/api` — Backend Fastify
- `packages/shared` — TypeScript types dùng chung

---

## Bước 4 — Cấu Hình Biến Môi Trường

### 4a. File `.env` ở thư mục gốc (dành cho Prisma CLI)

Tạo file `.env` tại **thư mục gốc** của project:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/tar_platform"
```

### 4b. File `.env` của API (cấu hình chính)

File `apps/api/.env` đã có sẵn. Kiểm tra hoặc tạo mới với nội dung:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/tar_platform"

# Redis
REDIS_URL="redis://localhost:6379"

# Anthropic AI — lấy key tại https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY="sk-ant-..."

# Auth — đặt true để bỏ qua Clerk khi dev local
SKIP_AUTH=true

# Supabase Storage — lấy tại https://supabase.com → Project Settings → API
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_KEY="your-service-key"
SUPABASE_STORAGE_BUCKET="contracts"

# Clerk (chỉ cần khi SKIP_AUTH=false)
CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Email qua Resend — để trống sẽ log email ra console thay vì gửi thật
RESEND_API_KEY=""
EMAIL_FROM="noreply@tar-platform.com"

# Server
PORT=3001
NODE_ENV="development"
```

> **Lưu ý:** Khi dev local, đặt `SKIP_AUTH=true` để bỏ qua Clerk.
> API sẽ tự động dùng user đầu tiên trong database làm current user.

---

## Bước 5 — Chạy Migration & Seed Database

```bash
# Áp dụng toàn bộ migration vào database
pnpm db:migrate

# Seed dữ liệu demo (projects, contracts, users, milestones)
pnpm db:seed
```

---

## Bước 6 — Chạy Project

### Cách A — Chạy tất cả cùng lúc (khuyến nghị)

```bash
pnpm dev
```

Turborepo sẽ chạy song song cả frontend lẫn backend:
- **Frontend** → http://localhost:3000
- **Backend API** → http://localhost:3001

### Cách B — Chạy từng phần riêng lẻ

```bash
# Terminal 1 — Frontend
cd apps/web
pnpm dev

# Terminal 2 — Backend API
cd apps/api
pnpm dev

# Terminal 3 — BullMQ worker (bắt buộc nếu dùng AI parsing hợp đồng)
cd apps/api
pnpm worker

# Terminal 4 — SLA checker (tuỳ chọn, cho approval escalation)
cd apps/api
pnpm sla-checker
```

---

## Cấu Trúc Project

```
TAR-Contract-Management-Platform/
├── apps/
│   ├── web/                        # Frontend Next.js 14
│   │   ├── app/
│   │   │   ├── (dashboard)/        # Workspace chính (tất cả vai trò)
│   │   │   │   ├── workspace/      # TAR Manager — quản lý dự án
│   │   │   │   ├── approvals/      # TAR Manager + Procurement
│   │   │   │   ├── procurement/    # Dashboard procurement
│   │   │   │   └── my-work/        # Cổng thông tin contractor
│   │   │   └── (admin)/            # Admin panel (chỉ TAR Manager)
│   │   ├── components/             # UI components dùng chung
│   │   │   ├── role-switcher.tsx   # Chuyển đổi vai trò demo
│   │   │   ├── theme-toggle.tsx    # Toggle Dark / Light mode
│   │   │   └── currency-input.tsx  # Input chọn tiền tệ
│   │   └── lib/
│   │       ├── mock-data.ts        # Toàn bộ dữ liệu giả (UI-only)
│   │       ├── store.ts            # Zustand global state
│   │       └── api-client.ts       # API client (hiện đang stub)
│   │
│   └── api/                        # Backend Fastify 5
│       ├── src/
│       │   ├── routes/             # Các route handler
│       │   ├── services/           # Business logic
│       │   ├── workers/            # BullMQ background jobs
│       │   └── middleware/         # Auth, RBAC, RLS
│       └── prisma/
│           ├── schema.prisma       # Schema database
│           ├── migrations/         # Lịch sử migration SQL
│           └── seed.ts             # Seeder dữ liệu demo
│
└── packages/
    └── shared/                     # TypeScript types dùng chung giữa web và api
```

---

## Vai Trò Người Dùng (Demo)

UI có **Role Switcher** trên sidebar để demo.
Mỗi vai trò có trang chủ riêng:

| Vai trò | Trang chủ | Quyền hạn |
|---------|-----------|-----------|
| `tar_manager` (MGR) | `/workspace` | Toàn quyền — quản lý dự án, hợp đồng, phê duyệt |
| `procurement` (PRO) | `/procurement` | Dashboard mua sắm, tạo hợp đồng, phê duyệt mốc |
| `contractor` (CON) | `/my-work` | Xem hợp đồng của mình, cập nhật mốc, nộp chi phí |

---

## Tích Hợp API Backend

File `apps/web/lib/api-client.ts` hiện đang **stub** (tất cả hàm trả về `null`).
Cần thay thế bằng các call thật đến Fastify API tại `http://localhost:3001/api/v1`.

Các endpoint đã được implement trong `apps/api/src/routes/`:

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/v1/projects` | Danh sách dự án |
| `POST` | `/api/v1/projects` | Tạo dự án |
| `GET` | `/api/v1/projects/:id/dashboard` | KPI & RAG dự án |
| `GET` | `/api/v1/projects/:id/contracts` | Danh sách hợp đồng |
| `POST` | `/api/v1/projects/:id/contracts` | Upload hợp đồng |
| `POST` | `/api/v1/contracts/:id/parse` | Kích hoạt AI parsing |
| `GET` | `/api/v1/contracts/:id/extraction` | Lấy kết quả AI |
| `POST` | `/api/v1/contracts/:id/extraction/confirm` | Xác nhận milestones |
| `PATCH` | `/api/v1/milestones/:id/complete` | Hoàn thành milestone |
| `GET` | `/api/v1/approvals/pending` | Danh sách phê duyệt |
| `POST` | `/api/v1/approvals/:id/decide` | Phê duyệt / từ chối |

---

## Lưu Ý Quan Trọng Cho Backend

- **`api-client.ts`** — File này là nơi kết nối frontend với backend thật. Hiện tại tất cả hàm đều trả về `null` (stub). Nhiệm vụ của backend dev là implement các hàm này gọi đến đúng endpoint.
- **`mock-data.ts`** — Toàn bộ dữ liệu hiển thị trên UI hiện lấy từ file này. Sau khi tích hợp API thật, các component sẽ dùng TanStack Query thay vì mock data.
- **`SKIP_AUTH=true`** — Luôn đặt trong môi trường dev để tránh lỗi Clerk auth.
- **Prisma schema** — Nằm tại `apps/api/prisma/schema.prisma`. Mọi thay đổi database cần chạy `pnpm db:migrate`.

---

## Xử Lý Lỗi Thường Gặp

**`pnpm install` thất bại**
→ Kiểm tra phiên bản pnpm: `pnpm --version` (cần 10+)

**Lỗi kết nối database**
→ Đảm bảo Docker đang chạy: `docker ps`
→ Kiểm tra `DATABASE_URL` trong cả hai file `.env`

**Cổng đã được dùng**
→ Frontend mặc định: `3000`, Backend mặc định: `3001`
→ Thay đổi `PORT` trong `apps/api/.env` nếu cần

**AI parsing không hoạt động**
→ Điền `ANTHROPIC_API_KEY` vào `apps/api/.env`
→ Đảm bảo worker đang chạy: `pnpm worker`

**Lỗi Prisma / migration**
→ Xoá database và chạy lại: `pnpm db:migrate` rồi `pnpm db:seed`

---

## Liên Hệ

Liên hệ team frontend hoặc tạo issue trên GitHub nếu gặp vấn đề.
