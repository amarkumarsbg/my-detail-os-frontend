import {
  parseOrgSlugFromPathname,
  tenantPath,
} from "@/lib/tenant";
import { useOrganizationStore } from "@/store/organization-store";

/**
 * Absolute customer-portal login URL with org slug when available.
 * Examples:
 * - `http://localhost:3002/my-detail-os/customer/login`
 * - `https://app.example.com/acme-detailers/customer/login`
 *
 * Slug resolution order:
 * 1. Explicit `orgSlug` option
 * 2. Current browser path (`/{slug}/…`)
 * 3. Bootstrap entitlement `organization.slug` (works on bare `/messages` etc.)
 */
export function getCustomerPortalLoginUrl(opts?: {
  /** Defaults to window.location.origin / NEXT_PUBLIC_APP_URL */
  origin?: string | null;
  /** Defaults to slug from path, then organization entitlement */
  orgSlug?: string | null;
}): string {
  const origin = resolveAppOrigin(opts?.origin);
  const slug = resolveOrgSlug(opts?.orgSlug);
  const path = tenantPath(slug, "/customer/login");
  return origin ? `${origin}${path}` : path;
}

/** Absolute URL for a customer portal path (login, job-card photos, etc.). */
export function getCustomerPortalAbsoluteUrl(
  appPath: string,
  opts?: { origin?: string | null; orgSlug?: string | null }
): string {
  const origin = resolveAppOrigin(opts?.origin);
  const slug = resolveOrgSlug(opts?.orgSlug);
  const path = tenantPath(slug, appPath.startsWith("/") ? appPath : `/${appPath}`);
  return origin ? `${origin}${path}` : path;
}

function resolveAppOrigin(override?: string | null): string {
  const fromOpt = typeof override === "string" ? override.trim().replace(/\/$/, "") : "";
  if (fromOpt) return fromOpt;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function resolveOrgSlug(override?: string | null): string | null {
  const fromOpt = normalizeSlug(override);
  if (fromOpt) return fromOpt;

  if (typeof window !== "undefined") {
    const fromPath = parseOrgSlugFromPathname(window.location.pathname);
    if (fromPath) return fromPath;
  }

  return normalizeSlug(
    useOrganizationStore.getState().entitlement?.organization?.slug
  );
}
