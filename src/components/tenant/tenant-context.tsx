"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { parseOrgSlugFromPathname, tenantPath } from "@/lib/tenant";
import { useOrganizationStore } from "@/store/organization-store";

type TenantContextValue = {
  orgSlug: string | null;
  tenantPath: (path: string) => string;
};

const TenantContext = createContext<TenantContextValue>({
  orgSlug: null,
  tenantPath: (path) => path,
});

function readWindowSlug(): string | null {
  if (typeof window === "undefined") return null;
  return parseOrgSlugFromPathname(window.location.pathname);
}

/** Subscribe no-op — window location is read on each getSnapshot after navigation. */
function subscribeWindowPath(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function useSyncedOrgSlug(pathnameSlug: string | null): string | null {
  const windowSlug = useSyncExternalStore(
    subscribeWindowPath,
    readWindowSlug,
    () => null
  );
  return pathnameSlug ?? windowSlug;
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const entitlementSlug = useOrganizationStore(
    (s) => normalizeSlug(s.entitlement?.organization?.slug)
  );
  const fromPath = useMemo(
    () => (pathname ? parseOrgSlugFromPathname(pathname) : null),
    [pathname]
  );
  // Prefer URL slug; fall back to session entitlement so bare `/messages` still
  // builds tenant links like `/my-detail-os/messages`.
  const orgSlug = useSyncedOrgSlug(fromPath) ?? entitlementSlug;

  const withTenant = useCallback(
    (path: string) => tenantPath(orgSlug, path),
    [orgSlug]
  );

  const value = useMemo<TenantContextValue>(
    () => ({ orgSlug, tenantPath: withTenant }),
    [orgSlug, withTenant]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/**
 * Org slug from the URL when present, otherwise from session entitlement.
 * Null only when neither source has a slug (e.g. marketing / logged-out).
 */
export function useTenantSlug(): string | null {
  return useContext(TenantContext).orgSlug;
}

/** Prefix paths with `/{orgSlug}` when a tenant slug is active. */
export function useTenantPath(): (path: string) => string {
  return useContext(TenantContext).tenantPath;
}
