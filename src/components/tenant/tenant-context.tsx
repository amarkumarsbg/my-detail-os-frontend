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

export function TenantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fromPath = useMemo(
    () => (pathname ? parseOrgSlugFromPathname(pathname) : null),
    [pathname]
  );
  const orgSlug = useSyncedOrgSlug(fromPath);

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

/** Current org slug from the URL, or null when not on a tenant path. */
export function useTenantSlug(): string | null {
  return useContext(TenantContext).orgSlug;
}

/** Prefix paths with `/{orgSlug}` when a tenant slug is active. */
export function useTenantPath(): (path: string) => string {
  return useContext(TenantContext).tenantPath;
}
