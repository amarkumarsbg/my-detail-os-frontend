"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";
import { resourcesForPath } from "@/lib/domain-data-map";
import { stripOrgSlugFromPath } from "@/lib/tenant";
import {
  areDomainResourcesReady,
  ensureDomainResources,
} from "@/lib/domain-data-loader";
import {
  maybeRevalidateRouteDomainDataFromVisibility,
  revalidateRouteDomainData,
  revalidateRouteDomainDataFromPageShow,
} from "@/lib/domain-route-revalidate";

/**
 * Loads permission-scoped domain data for the active dashboard route into Zustand.
 * Revalidates on navigation and on mobile resume (iOS + Android) so pages like
 * Accounting always see fresh API data without a hard refresh.
 */
export function DomainDataSync() {
  const pathname = usePathname();
  const appPath = stripOrgSlugFromPath(pathname);
  const shellReady = useAppBootstrapStore((s) => s.ready);

  useEffect(() => {
    if (!shellReady) return;
    void revalidateRouteDomainData(appPath);
  }, [appPath, shellReady]);

  useEffect(() => {
    if (!shellReady) return;

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      maybeRevalidateRouteDomainDataFromVisibility(appPath);
    };

    /** Fallback for some Android WebViews that omit visibilitychange on resume. */
    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      maybeRevalidateRouteDomainDataFromVisibility(appPath);
    };

    const onPageShow = (event: PageTransitionEvent) => {
      revalidateRouteDomainDataFromPageShow(appPath, event);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [appPath, shellReady]);

  return null;
}

/** True when shell bootstrap is ready and the current route's domain pack has settled. */
export function useDomainDataReady(pathname?: string): boolean {
  const shellReady = useAppBootstrapStore((s) => s.ready);
  const path = usePathname();
  const effective = stripOrgSlugFromPath(pathname ?? path);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!shellReady) {
      setReady(false);
      return;
    }
    const resources = resourcesForPath(effective);
    let cancelled = false;
    void (async () => {
      await ensureDomainResources(resources);
      if (!cancelled) {
        setReady(areDomainResourcesReady(resources));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shellReady, effective]);

  return shellReady && ready;
}
