# Hosting: white-label tenant routing

MY DETAIL OS serves workshop apps under a shared apex host using **org slug prefixes**:

- Staff: `https://www.mydetailos.com/{orgSlug}/dashboard`
- Customer: `https://www.mydetailos.com/{orgSlug}/customer/login`

The workshop Next.js app rewrites `/{orgSlug}/…` → `/…` in `src/middleware.ts` so existing route files do not move. The browser URL keeps the slug; `usePathname()` still sees it; helpers in `src/lib/tenant.ts` strip or prefix as needed.

## Edge / Vercel split (marketing site vs workshop app)

On the **marketing** deployment (`prime-detailers-website` / mydetailos.com), configure rewrites so:

| Path pattern | Destination |
| --- | --- |
| Reserved marketing paths (`/`, `/login`, `/signup`, `/pricing`, `/features`, `/about`, …) | Marketing site (this deployment) |
| `/{orgSlug}` and `/{orgSlug}/…` where `orgSlug` is **not** reserved | Workshop app (prime-detailer-frontend) |

Example Vercel `rewrites` sketch for the **marketing** project:

```json
{
  "rewrites": [
    {
      "source": "/:orgSlug((?!login|signup|pricing|features|api|_next|saas-admin).*)/:path*",
      "destination": "https://workshop.mydetailos.com/:orgSlug/:path*"
    },
    {
      "source": "/:orgSlug((?!login|signup|pricing|features|api|_next|saas-admin).*)",
      "destination": "https://workshop.mydetailos.com/:orgSlug"
    }
  ]
}
```

Use the same reserved list as `RESERVED_SLUGS` / backend `reserved-slugs.ts` so platform pages never get treated as tenants.

### Workshop app

- Middleware strips the slug for internal matching and sets request header `x-org-slug`.
- `saas-admin` is reserved — never rewritten as a tenant.
- Staff nav / customer nav prefix links via `tenantPath(slug, href)`.
- `TenantGuard` validates `GET /api/public/organizations/by-slug/:slug` and branding `?slug=`, and blocks JWT org ≠ URL org.

### Local development

Without the marketing edge rewrite, open the workshop app directly:

- `http://localhost:3000/{orgSlug}/dashboard`
- `http://localhost:3000/{orgSlug}/customer/login`

Set `NEXT_PUBLIC_MARKETING_SITE_URL` (defaults: local `http://localhost:3003`, prod `https://www.mydetailos.com`).
