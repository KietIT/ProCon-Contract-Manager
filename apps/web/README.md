# ProCon Web — Next.js Frontend

Next.js 14 App Router frontend for the ProCon Contract Management Platform.

## Development

```bash
pnpm dev       # Next.js on :3000
pnpm build     # Production build
pnpm lint      # ESLint
```

## Structure

- `app/(dashboard)/` — Protected dashboard with collapsible sidebar and role-based nav
- `app/(admin)/` — Admin-only pages (tar_manager role)
- `app/page.tsx` — Public landing page
- `components/contracts/` — Contract viewer, diff viewer, source panel
- `lib/api-client.ts` — API client targeting Fastify backend at `:3001`
- `lib/store.ts` — Zustand store for user state
- `lib/providers.tsx` — TanStack Query provider (5 min stale time)

## Key Dependencies

- react-pdf 7.7.3 — PDF rendering with text layer
- TanStack Query 5 — Server state with prefetch on hover
- Zustand 5 — Client state (persisted to localStorage)
- shadcn/ui — Radix UI primitives (Tailwind v3 compatible)
- Recharts — Dashboard charts
