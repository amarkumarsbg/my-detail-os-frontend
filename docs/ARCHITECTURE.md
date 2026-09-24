# Architecture overview

MY DETAIL OS is a garage / auto-service management app with two packages (not a monorepo workspace):

| Package | Role |
|---------|------|
| `frontend/` | Next.js App Router SPA (Zustand, Tailwind, Radix/shadcn-style UI) |
| `backend/` | Express + Prisma + PostgreSQL API |

Start here as a new developer: this doc → root `README.md` → `frontend/src/lib/bootstrap-app-data.ts` + `frontend/src/lib/nav-items.ts` → `backend/src/index.ts` + `backend/src/constants/json-collections.ts` → the **parties** feature (`frontend/src/components/parties/`, `frontend/src/hooks/use-parties.ts`) as the best-organized domain example.

---

## High-level data flow

```text
Browser
  → Next.js (port 3000)
      → /backend-api/* rewrite → Express (port 4000)
          → Prisma → PostgreSQL
```

- Most dashboard data loads via **`GET /api/bootstrap`** into Zustand stores.
- **Parties** (and some customer/vehicle CRUD) use live REST calls instead of bootstrap-only state.
- Auth: JWT Bearer token from login/OTP; `SUPER_ADMIN` bypasses permission checks.

---

## Hybrid backend data model

1. **Relational tables** — users, branches, customers, vehicles, attendance, parties (+ party children).
2. **`AppJsonRow` document store** — job cards, invoices, quotations, membership, payroll, inventory payloads, settings, etc. Collection names are listed in `backend/src/constants/json-collections.ts`.

Business calculations (pricing, GST presentation, payroll generation, membership assign) largely live on the **frontend** today. The API persists JSON and enforces auth/RBAC. Notable server-side domain logic: wallet sync on invoice upsert, party ledger assembly, branch deletion blockers.

---

## Request flow (API)

```text
Request → Route → requireAuth → requirePermission (when applicable)
       → Controller (Zod) → Service → Prisma → { data, error }
```

JSON collections:

```text
/api/collections/:collection
  → requireAuth → requireCollectionPermission → collection controller/service
```

Permission for each collection is defined in `backend/src/constants/collection-permissions.ts`. **Unmapped or unknown collections are denied (403).** `SUPER_ADMIN` bypasses collection permission checks.

---

## RBAC notes (Phase 0)

| Area | Enforcement |
|------|-------------|
| Typed resources (customers, vehicles, branches, users, attendance, quotations convert) | Route-level `requirePermission(...)` |
| JSON collections | `COLLECTION_PERMISSION_MAP` + default-deny |
| Parties API | `PARTIES` |
| Job-card photo upload | `JOB_CARDS` |
| Messaging **send** (`/whatsapp`, `/email`) | Authenticated only — cross-feature (job cards, billing, etc.) |
| Messaging **test** (`/sms/test`, `/whatsapp/test`) | `SETTINGS` |
| Logo upload | `SETTINGS` |
| Nav / route gating in the UI | Client-side mirror for UX — **server is source of truth** |

Migrate / seed / inspect users must use **CLI** (`npx prisma migrate deploy`, `npm run db:seed`). HTTP endpoints that previously ran migrate/seed or leaked user records were **removed**.

---

## Frontend layout (current)

```text
frontend/src/
  app/           # Routes and thin pages
  components/    # ui/, shared/, and some domain folders
  store/         # Zustand
  hooks/         # Shared hooks (parties, branch scope, …)
  lib/           # API client, domain helpers, bootstrap
  types/         # Shared TypeScript types
```

Prefer extending existing `components/shared` and `lib/*` helpers over new frameworks. Large page files and feature-folder moves are planned for later phases — do not rewrite them casually.

---

## Where to put new code

| Change | Prefer |
|--------|--------|
| New dashboard page | Thin `app/(dashboard)/.../page.tsx` + components under `components/<domain>/` when non-trivial |
| New JSON domain synced like job cards | Collection name in `json-collections.ts` **and** permission in `collection-permissions.ts` (run `npm run test:collection-permissions`) |
| New typed API resource | `routes` → `controllers` → `services` + `requirePermission` |
| Pure money/status rules | `frontend/src/lib/` (and tests) — keep UI thin |
| Shared FE/BE constants | Duplicate carefully with comments until a shared package exists |

---

## Database & ops

- Local Postgres: `backend/docker-compose.yml` via `npm run db:up`.
- Env: `backend/env.example` → `backend/.env` (validated in `backend/src/config/env.ts`).
- Never expose migrate/seed over HTTP.

---

## Related docs

- Root [README.md](../README.md) — setup and coding conventions
- [CODING_STANDARDS.md](./CODING_STANDARDS.md) — naming, formatters, PR checklist
- [API_CONVENTIONS.md](./API_CONVENTIONS.md) — envelope, error codes, collections vs relational
- [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md) — where new code goes
- [TESTING.md](./TESTING.md) — unit/security tests
- [BRANCH_SCOPING.md](./BRANCH_SCOPING.md) — future server-side branch isolation (design only)
- `backend/docs/` — product notes when present (e.g. SaaS branch limits)

---

## Phase 1 foundations (done)

- Canonical phone: `frontend/src/lib/phone.ts`
- Shared CSV/Excel shell: `frontend/src/lib/tabular-import/parse-tabular.ts`
- Domain types split under `frontend/src/types/` (barrel `index.ts`)
- Permission keys: `frontend/src/lib/permission-keys.ts` ↔ `backend/src/constants/permission-keys.ts`
- Ledger/GST/INR helpers pointed at shared implementations where rules match

## Phase 2 mega-page extraction (in progress)

- Booking wizard lives under `frontend/src/features/booking-wizard/` (page re-exports from `app/.../booking/create-booking-page.tsx`)
- Pure helpers/constants extracted; steps gradually moved to `components/steps/`
- Job card detail presentational panels under `components/job-cards/`
- Quotations workflow banner + status filters under `components/quotations/`

## Phase 3 backend consistency (done)

- Structural Zod for `invoices` / `jobCards` / `quotations` / `payroll` / `membership`
- Quotation → job convert logic in `services/quotation-convert.service.ts`
- `AppError` + error `code` on API failures
- Public invoice endpoint returns minimized fields only (no branch dump / sibling invoices / stored PDF)

## Phase 4 hardening (done)

- Unit tests for ledger, GST, pricing, edit policies, RBAC, phone, payroll calculations
- Payroll pure math extracted to `frontend/src/lib/payroll/calculations.ts`
- Docs: TESTING, FOLDER_STRUCTURE, BRANCH_SCOPING (design only)
- Root `npm test` runs frontend Vitest + backend `test:security`
- Shared npm package deferred (duplicate permission keys remain aligned via check scripts)
