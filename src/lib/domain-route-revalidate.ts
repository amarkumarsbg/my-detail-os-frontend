import type { DomainResource } from "@/lib/domain-data-map";
import { deferredResourcesForPath, resourcesForPath } from "@/lib/domain-data-map";
import {
  ensureDomainResources,
  invalidateDomainResources,
} from "@/lib/domain-data-loader";

/** Skip visibility/focus refresh right after a navigation-driven fetch (both platforms). */
export const ROUTE_REVALIDATE_GRACE_MS = 2_000;

/** Minimum gap between visibility/focus-triggered revalidates (avoids duplicate calls). */
export const VISIBILITY_REVALIDATE_MIN_MS = 8_000;

let lastRouteRevalidateAt = 0;
let lastVisibilityRevalidateAt = 0;

/** @internal test helper */
export function __resetDomainRouteRevalidateTimersForTests(): void {
  lastRouteRevalidateAt = 0;
  lastVisibilityRevalidateAt = 0;
}

function routeResources(pathname: string): DomainResource[] {
  return resourcesForPath(pathname);
}

async function ensureRoutePackWithDeferred(pathname: string): Promise<void> {
  const resources = routeResources(pathname);
  await ensureDomainResources(["appSettings", ...resources]);
  const deferred = deferredResourcesForPath(pathname);
  if (deferred.length > 0) {
    void ensureDomainResources(deferred);
  }
}

/** Revalidate domain collections for the active route (navigation, manual refresh). */
export async function revalidateRouteDomainData(pathname: string): Promise<void> {
  lastRouteRevalidateAt = Date.now();
  // We no longer invalidate here so that hasFetched flags are respected on sidebar navigation
  await ensureRoutePackWithDeferred(pathname);
}

/**
 * Revalidate when the tab/app becomes visible again (iOS Safari, Android Chrome, PWA).
 * Debounced so quick app-switching does not spam the API.
 */
export function maybeRevalidateRouteDomainDataFromVisibility(pathname: string): void {
  const now = Date.now();
  if (now - lastRouteRevalidateAt < ROUTE_REVALIDATE_GRACE_MS) return;
  if (now - lastVisibilityRevalidateAt < VISIBILITY_REVALIDATE_MIN_MS) return;
  lastVisibilityRevalidateAt = now;
  const resources = routeResources(pathname);
  const deferred = deferredResourcesForPath(pathname);
  invalidateDomainResources([...resources, ...deferred]);
  void ensureRoutePackWithDeferred(pathname);
}

/**
 * iOS/Android back-forward cache can restore the page without re-running React effects.
 * `persisted` is set on both mobile Safari and Chromium when restoring from bfcache.
 */
export function revalidateRouteDomainDataFromPageShow(
  pathname: string,
  event: PageTransitionEvent
): void {
  if (!event.persisted) return;
  void revalidateRouteDomainData(pathname);
}
