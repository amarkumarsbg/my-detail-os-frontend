# MY DETAIL OS

A modern garage/auto-service management platform built with Next.js, Tailwind CSS, and Zustand.

## Getting Started

**Frontend** (Next.js) — one terminal:

```bash
cd frontend
npm install
npm run dev
```

**Backend** (API) — PostgreSQL required. Another terminal:

```bash
cd backend
npm install
npm run db:up
```

Copy `backend/env.example` → `backend/.env`, set `DATABASE_URL` to `postgresql://prime:prime@localhost:5432/primedetailer?schema=public` (Docker Compose defaults), then:

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The API listens on [http://localhost:4000](http://localhost:4000) by default.

From the repo root you can also run `npm run dev:frontend` or `npm run dev:backend` (shortcuts to the same commands).

## Architecture

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the hybrid frontend/backend model, AppJsonRow collections, RBAC, bootstrap data flow, and where new code should go.

Coding conventions for PRs: **[docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)**.

API envelope and error codes: **[docs/API_CONVENTIONS.md](docs/API_CONVENTIONS.md)**.

Folder map: **[docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md)** · Testing: **[docs/TESTING.md](docs/TESTING.md)**.

**New developers:** read Architecture first, then this README’s setup steps.

## Attendance (Vercel / QR)

On Vercel, each serverless function can run on a **different instance** with its own memory, so in-memory attendance from a phone punch may not appear on the dashboard. Set **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** (e.g. Vercel → Storage → Redis / [Upstash](https://upstash.com)) — see `.env.example`. Local dev works without Redis (single-process memory).

## Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS v4
- **State:** Zustand
- **Backend:** Express, Prisma, PostgreSQL
- **UI Components:** Radix UI, Lucide React icons
- **Forms:** React Hook Form + Zod (used selectively)
- **Charts:** Recharts
- **Toasts:** Sonner
- **Theming:** next-themes

## Project Structure

```
frontend/src/
├── app/
│   ├── (auth)/          # Login, signup, forgot-password
│   ├── (dashboard)/     # All dashboard pages
│   └── layout.tsx       # Root layout (ThemeProvider, Toaster)
├── components/
│   ├── layout/          # Sidebar, Header, NotificationPanel
│   ├── shared/          # PageHeader, DataTable, KPICard, Breadcrumbs, etc.
│   └── ui/              # Radix-based primitives (Button, Card, Dialog, etc.)
├── lib/
│   ├── api-client.ts    # Calls Express API (Postgres via Prisma)
│   └── utils.ts         # formatCurrency, formatDate, cn, etc.
├── store/               # Zustand stores (auth, sidebar, notification, settings)
└── types/               # Shared TypeScript interfaces and types
```

## Code Consistency Rules

Follow these conventions when contributing to the codebase.

### General Principles

- **Reuse existing components** — check `src/components/shared/` and `src/components/ui/` before building something new. If a pattern repeats, extract it into a shared component.
- **Maintain consistency** — follow the structure, naming, and patterns already established in the codebase.
- **Keep code clean and readable** — prefer clarity over cleverness. Small functions, descriptive names, no dead code.
- **Keep it simple** — avoid over-engineering. Only add as much abstraction as the current need demands.
- **No inline styles** — use Tailwind CSS for all styling. Only use `style={}` when a truly dynamic runtime value is required (e.g. a user-chosen vehicle color hex, or a Recharts `fill` prop).
- **No hardcoded colors** — use Tailwind color classes (`text-blue-500`, `bg-primary`) or CSS variables (`var(--primary)`). Raw hex values are only acceptable inside chart library props (Recharts `fill`, `stroke`).
- **Proper error handling** — validate user input with Zod schemas, show errors inline on forms, and use toast notifications for action feedback.
- **Remove unused code** — no unused imports, variables, or `console.log` statements should be committed.

### Imports

Order imports in every file as follows, with a blank line between groups:

1. React (`import { useState, useMemo } from "react"`)
2. Next.js (`next/navigation`, `next/link`, `next/image`)
3. Third-party libraries (`sonner`, `react-hook-form`, `zod`, `recharts`, `date-fns`, `cmdk`)
4. Lucide icons (`lucide-react`)
5. Local components (`@/components/...`)
6. Local lib/utils (`@/lib/...`)
7. Local stores (`@/store/...`)
8. Local types (`@/types`)

Combine imports from the same module into a single statement:

```tsx
// Good
import { useState, useMemo, useRef } from "react";

// Bad
import { useState } from "react";
import { useMemo } from "react";
```

### "use client" Directive

Add `"use client"` at the top of every file that uses hooks, browser APIs, or event handlers. Server components (layouts without hooks, `loading.tsx`) should omit it.

### Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Files & folders | kebab-case | `page-header.tsx`, `collection-sync.ts` |
| Page components | `export default function XxxPage()` | `DashboardPage`, `CustomersPage` |
| Shared components | `export function XxxYyy()` | `PageHeader`, `KPICard` |
| TypeScript types/interfaces | PascalCase | `JobCard`, `UserRole` |
| Module-level constants (lookup maps, config arrays) | SCREAMING_SNAKE_CASE | `STATUS_COLORS`, `NAV_GROUPS` |
| Local variables & functions | camelCase | `handleSubmit`, `filteredItems` |
| Zustand stores | `use___Store` | `useAuthStore`, `useSidebarStore` |

### Tailwind CSS (v4)

- Use **postfix** important modifier: `p-5!` (not `!p-5`)
- Use shorthand utilities: `shrink-0` (not `flex-shrink-0`), `bg-linear-to-br` (not `bg-gradient-to-br`)
- Responsive page wrappers: `space-y-4 sm:space-y-6`
- Card content padding override: `className="p-5!"` or `className="p-4!"`
- Mobile-first breakpoints: base styles for mobile, `sm:` / `md:` / `lg:` for larger screens
- Use CSS utility classes (defined in `globals.css`) for repeated visual patterns instead of inline styles (e.g. `bg-grid-light` for decorative grid overlays)
- Use `cn()` for conditionally joining class names — never build class strings with template literals when conditional logic is involved

### Component Patterns

- **Reuse shared components** — always check if an existing component fits before creating a new one:
  - `<PageHeader>` for page titles (not custom `<h1>` headers)
  - `<KPICard>` for stat cards (not custom Card+CardContent stat blocks)
  - `<Breadcrumbs>` on detail pages (not standalone "Back" buttons)
  - `<DataTable>` for tabular data with search and pagination
  - `<EmptyState>` when lists have no data
  - `<ToggleSwitch>` for boolean settings (not custom toggle markup)
- Wrap page content in `<div className="space-y-4 sm:space-y-6">`
- If you find yourself copying UI markup across pages, extract it into a shared component in `src/components/shared/`

### Styling Rules

- **Never use inline `style={}`** unless the value is truly dynamic at runtime (e.g. a hex color from a database field, a Recharts `fill` prop, or a Radix `transform`)
- **Never use hardcoded hex colors** in Tailwind classes or JSX — use Tailwind's named color palette (`text-blue-500`, `bg-emerald-100`) or theme tokens (`bg-primary`, `text-muted-foreground`)
- For chart libraries (Recharts), hardcoded hex values are acceptable in `fill`/`stroke` props. If those same colors are displayed elsewhere in the UI, create a parallel `CHART_TEXT_CLASSES` array with Tailwind classes
- Reusable CSS patterns (e.g. grid overlays) go in `globals.css` as utility classes

### Toast Notifications

Use `sonner` for all user-facing feedback on **every mutation** (add, edit, delete, status change). Always use a typed method:

```tsx
import { toast } from "sonner";

toast.success("Customer added", { description: "John Doe has been added." });
toast.error("Failed to save");
toast.info("Reminder dismissed");
```

Never use bare `toast("message")` — always use `.success()`, `.error()`, or `.info()`.

### Error Handling & Validation

- Use **Zod** schemas for form validation
- Use **React Hook Form** with `zodResolver` for form state management
- Display field-level errors inline below inputs
- Show a `toast.error()` for server-side or unexpected failures
- Wrap async operations in try/catch blocks

### State Management

- Use **Zustand** for global state (auth, sidebar, settings, notifications)
- Use **useState** for page-local UI state (form inputs, tabs, dialogs)
- When a value needs to reflect instantly across components (e.g. business name), put it in a Zustand store, not just local state

### Types

- Define all shared interfaces and types in `src/types/index.ts`
- Use `import type { X }` for type-only imports
- Never duplicate type definitions inline — import from `@/types`

### Data

- **Relational data** (branches, users, customers, vehicles) lives in Postgres and is loaded via `/api/bootstrap` and entity routes.
- **Document-style data** (job cards, invoices, cash bank state, payroll, etc.) is stored in `AppJsonRow` and synced via `/api/collections/*`.
- Optional seed: `cd backend && npm run db:seed` (minimal starter branch + admin; password `password` for `admin@local.dev` until you change it).

### Utilities

- Use `formatCurrency()` from `@/lib/utils` for all money values — never manually format or strip symbols
- Use `formatDate()` and `formatDateTime()` from `@/lib/utils` — never create local date formatters
- Use `cn()` from `@/lib/utils` for conditional class merging

### Code Cleanliness

- Remove all unused imports, variables, and type declarations before committing
- No `console.log`, `console.warn`, or `console.debug` in committed code
- No commented-out code blocks — delete what isn't used
- Keep components focused — if a component exceeds ~200 lines, consider extracting sub-components into the same file or separate files

### Folder Organization

- Follow the existing structure — don't create new top-level folders without discussion
- Pages go in `src/app/(dashboard)/[feature]/page.tsx`
- Detail pages go in `src/app/(dashboard)/[feature]/[id]/page.tsx`
- Shared UI components go in `src/components/shared/`
- Radix-based primitives go in `src/components/ui/`
- Layout components (sidebar, header) go in `src/components/layout/`

### Role-Based Access

- Sidebar nav items support an optional `roles` array on each item
- Filtering is handled in `SidebarContent` using `useAuthStore`
- Roles are: `ADMIN`, `MANAGER`, `RECEPTIONIST`, `MECHANIC`

## Deployment

**Stack:** [Vercel](https://vercel.com) (Next.js from `frontend/`) · Render/Railway (Express from `backend/`) · [Neon](https://neon.tech) or any Postgres (`DATABASE_URL`).

1. **Database:** Create Postgres on Neon; copy the URL (append `?sslmode=require` if required).
2. **API:** Create a Node Web Service with root **`backend`**. Build: `npm ci && npm run db:generate && npm run build`. Start: `npx prisma migrate deploy && npm start`. Env at minimum: `DATABASE_URL`, `JWT_SECRET` (≥16 chars), `FRONTEND_ORIGIN` (exact Vercel URL), `NODE_ENV=production`. Optional: repo-root [`render.yaml`](render.yaml) blueprint (you still must add secrets in the dashboard).
3. **Seed (once):** With prod `DATABASE_URL` set locally: `cd backend && npx prisma migrate deploy && npm run db:seed`.
4. **Frontend:** Import repo with root **`frontend`**. Set **`NEXT_PUBLIC_API_URL`** to your API origin (e.g. `https://your-api.onrender.com`), no trailing slash — browsers call `/api/...` on that host.

Examples: [`backend/env.example`](backend/env.example), [`frontend/env.example`](frontend/env.example). See also [Next.js deployment](https://nextjs.org/docs/app/building-your-application/deploying).
