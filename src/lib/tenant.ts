/**
 * White-label tenant URL helpers.
 * Paths like `/{orgSlug}/dashboard` are rewritten by middleware to `/dashboard`
 * while the browser URL (and usePathname) keep the slug prefix.
 */

/** Slugs that collide with platform / app routes — never treat as org tenants. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(
  [
    "",
    "www",
    "login",
    "signup",
    "register",
    "pricing",
    "features",
    "solutions",
    "about",
    "contact",
    "demo",
    "faq",
    "privacy",
    "terms",
    "forgot-password",
    "reset-password",
    "change-password",
    "how-it-works",
    "assets",
    "static",
    "images",
    "favicon.ico",
    "robots.txt",
    "sitemap.xml",
    "sitemap",
    "robots",
    "api",
    "admin",
    "platform",
    "saas-admin",
    "customer",
    "dashboard",
    "job-cards",
    "bookings",
    "booking",
    "billing",
    "settings",
    "staff",
    "customers",
    "vehicles",
    "inventory",
    "reports",
    "messages",
    "activity",
    "notifications",
    "profile",
    "public-invoice",
    "public-ledger",
    "attendance",
    "backend-api",
    "backend-uploads",
    "uploads",
    "_next",
    "health",
    "appointments",
    "quotations",
    "membership",
    "reminders",
    "follow-ups",
    "referrals",
    "accounting",
    "expenses",
    "vendors",
    "cash-bank",
    "parties",
    "shared-ledger",
    "leave",
    "rewards",
    "payroll",
    "services",
    "branches",
    "performance",
    "mechanics",
    "advanced-reports",
    "pickup-drop",
    "counter-sale",
  ].map((s) => s.toLowerCase())
);

/** True when the segment must never be treated as an organization slug. */
export function isReservedSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return true;
  if (RESERVED_SLUGS.has(normalized)) return true;
  if (normalized.includes(".")) return true;
  return false;
}

/** First path segment looks like a static file (favicon.ico, robots.txt, …). */
export function looksLikeFileSegment(segment: string): boolean {
  return segment.includes(".");
}

/**
 * Extract org slug from a browser pathname (e.g. `/abcd/dashboard` → `abcd`).
 * Returns null when the first segment is reserved or absent.
 */
export function parseOrgSlugFromPathname(pathname: string): string | null {
  const path = pathname.split(/[?#]/)[0] ?? pathname;
  const segments = path.split("/").filter(Boolean);
  const first = segments[0];
  if (!first || isReservedSlug(first) || looksLikeFileSegment(first)) return null;
  return first.toLowerCase();
}

/**
 * Strip a leading org slug from a pathname so route matching against
 * unprefixed hrefs (e.g. `/dashboard`) still works.
 */
export function stripOrgSlugFromPath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? pathname;
  const slug = parseOrgSlugFromPathname(path);
  if (!slug) {
    return path.startsWith("/") ? path : `/${path}`;
  }
  const segments = path.split("/").filter(Boolean);
  const rest = segments.slice(1).join("/");
  return rest ? `/${rest}` : "/";
}

/**
 * Prefix an app path with `/{slug}` when a tenant slug is present.
 * Without a slug, returns `path` unchanged (leading slash normalized).
 * Idempotent: paths that already start with `/{slug}` are left as-is;
 * a different leading org slug is replaced.
 */
export function tenantPath(slug: string | null | undefined, path: string): string {
  const normalized =
    !path || path === "/"
      ? "/"
      : path.startsWith("/")
        ? path
        : `/${path}`;
  const trimmed = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (!trimmed || isReservedSlug(trimmed)) return normalized;

  // Already correctly prefixed
  if (normalized === `/${trimmed}` || normalized.startsWith(`/${trimmed}/`)) {
    return normalized;
  }

  // Strip any existing org slug, then prefix with the intended one
  const bare = stripOrgSlugFromPath(normalized);
  if (bare === "/") return `/${trimmed}`;
  return `/${trimmed}${bare}`;
}
