# API conventions

MY DETAIL OS Express API (`backend/`). Base URL local: `http://localhost:4000`.

## Response envelope

Success:

```json
{ "data": { ... }, "error": null }
```

Failure:

```json
{
  "data": null,
  "error": {
    "message": "Human-readable message",
    "code": "VALIDATION",
    "details": {}
  }
}
```

### Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION` | 400 | Zod / structural payload validation |
| `UNAUTHORIZED` | 401 | Missing/invalid JWT |
| `FORBIDDEN` | 403 | Authenticated but missing permission |
| `NOT_FOUND` | 404 | Resource missing |
| `CONFLICT` | 409 | Business conflict (e.g. unique phone) |
| `PAYLOAD_TOO_LARGE` | 413 | Request body too large |
| `INTERNAL` | 500 | Unexpected server error |

Prefer throwing `AppError` from `backend/src/lib/app-error.ts` in new code.

## Auth

- Header: `Authorization: Bearer <jwt>`
- `SUPER_ADMIN` bypasses permission checks
- Collection access: `backend/src/constants/collection-permissions.ts` (default-deny)

## Data surfaces

| Kind | Paths | Notes |
|------|-------|-------|
| Relational CRUD | `/api/customers`, `/api/vehicles`, `/api/users`, `/api/branches`, `/api/parties`, `/api/attendance` | Typed Prisma models |
| JSON collections | `/api/collections/:collection` | `AppJsonRow`; high-risk payloads structurally validated |
| Bootstrap | `/api/bootstrap` | Hydrates dashboard stores |
| Public | `/api/public/invoices/:id`, `/api/public/attendance/*` | No JWT; minimized payloads |

### High-risk collection validation

On `PUT` / snapshot for: `invoices`, `jobCards`, `quotations`, `payroll`, `membership` — Zod schemas in `backend/src/validations/collection-payloads.ts` (`.passthrough()` for legacy fields).

Run after seed/schema changes:

```bash
cd backend && npm run test:collection-payloads
```

## Ops

- Migrate / seed via CLI only (`npx prisma migrate deploy`, `npm run db:seed`) — no HTTP admin endpoints
- Health: `GET /health`, `GET /health/db`
