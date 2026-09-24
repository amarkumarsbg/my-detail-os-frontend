"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ScrollToTopButton } from "@/components/layout/scroll-to-top-button";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { AppDataSync } from "@/components/layout/app-data-sync";
import { DomainDataSync } from "@/components/layout/domain-data-sync";
import { Button } from "@/components/ui/button";
import { NAV_GROUPS } from "@/lib/nav-items";
import { canAccessNavItem } from "@/lib/rbac";
import { isHrStaffNavPath, userHasWithoutEditAccess } from "@/lib/staff-access";
import { useSidebarStore } from "@/store/sidebar-store";
import { cn } from "@/lib/utils";
import { SubscriptionRenewBanner } from "@/components/billing/subscription-renew-banner";
import { goToMarketingLogin } from "@/lib/marketing-site";
import { stripOrgSlugFromPath } from "@/lib/tenant";
import { useTenantPath } from "@/components/tenant/tenant-context";
import { TenantGuard } from "@/components/tenant/tenant-guard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword === true);
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const appPath = useMemo(() => stripOrgSlugFromPath(pathname), [pathname]);
  const tenantHref = useTenantPath();
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const currentNavItem = useMemo(() => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (appPath === item.href || appPath.startsWith(item.href + "/")) {
          return item;
        }
      }
    }
    return null;
  }, [appPath]);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      queueMicrotask(() => setAuthReady(true));
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    void (async () => {
      await useAuthStore.getState().ensureValidSession();
      if (!cancelled) setSessionChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady]);

  useEffect(() => {
    if (!authReady || !sessionChecked) return;
    if (!isAuthenticated) {
      goToMarketingLogin();
    }
  }, [authReady, sessionChecked, isAuthenticated, router]);

  useEffect(() => {
    if (!authReady || !sessionChecked || !isAuthenticated) return;
    if (user?.role === "PLATFORM_OWNER") {
      router.replace("/saas-admin/organizations");
    }
  }, [authReady, sessionChecked, isAuthenticated, user?.role, router]);

  useEffect(() => {
    if (!authReady || !sessionChecked || !isAuthenticated) return;
    if (!mustChangePassword) return;
    void router.replace(tenantHref("/change-password"));
  }, [authReady, sessionChecked, isAuthenticated, mustChangePassword, router, tenantHref]);

  useEffect(() => {
    if (!authReady || !sessionChecked || !isAuthenticated || !user) return;
    if (user.role === "SUPER_ADMIN") return;
    if (userHasWithoutEditAccess(user) && isHrStaffNavPath(appPath)) {
      toast.error("Access Denied", {
        description: "HR & Staff is not available without edit access.",
      });
      void router.replace(tenantHref("/dashboard"));
      return;
    }
    if (currentNavItem) {
      const hasRoleAccess = canAccessNavItem(
        currentNavItem.roles,
        user.role,
        currentNavItem.permissionKey,
        user.permissions
      );
      if (!hasRoleAccess) {
        toast.error("Access Denied", {
          description: "You do not have permission to access this module.",
        });
        void router.replace(tenantHref("/dashboard"));
      }
    }
  }, [authReady, sessionChecked, isAuthenticated, user, currentNavItem, appPath, router, tenantHref]);

  const runBootstrap = useAppBootstrapStore((s) => s.run);
  const resetBootstrap = useAppBootstrapStore((s) => s.reset);
  const bootstrapError = useAppBootstrapStore((s) => s.error);
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);

  useEffect(() => {
    if (authReady && sessionChecked && !isAuthenticated) {
      resetBootstrap();
    }
  }, [authReady, sessionChecked, isAuthenticated, resetBootstrap]);

  useEffect(() => {
    if (!authReady || !sessionChecked || !isAuthenticated) return;
    void runBootstrap();
  }, [authReady, sessionChecked, isAuthenticated, runBootstrap]);

  useEffect(() => {
    if (!bootstrapError) return;
    toast.error(bootstrapError, {
      id: "bootstrap-load-error",
      duration: 10_000,
      description:
        "Production: check NEXT_PUBLIC_API_URL (API origin only, no /api) and FRONTEND_ORIGIN on Render. Wait ~60s if Render was asleep.",
    });
  }, [bootstrapError]);

  if (!authReady || !sessionChecked || !isAuthenticated) {
    return <div className="min-h-screen bg-slate-950" aria-busy="true" aria-label="Loading" />;
  }

  if (mustChangePassword) {
    return <div className="min-h-screen bg-slate-950" aria-busy="true" aria-label="Loading" />;
  }

  return (
    <TenantGuard mode="staff">
      <div className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-background">
        <Sidebar />
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pl-0 transition-[padding] duration-300",
            sidebarCollapsed ? "md:pl-0" : "md:pl-[260px]"
          )}
        >
          <Header />
          <SubscriptionRenewBanner />
          <main
            ref={mainScrollRef}
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6 md:[scrollbar-gutter:stable]"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {bootstrapError ? (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
              >
                <p className="font-medium text-destructive">Could not load data from the API</p>
                <p className="mt-1 text-muted-foreground">{bootstrapError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void runBootstrap()}
                >
                  Retry
                </Button>
              </div>
            ) : null}
            <AppDataSync />
            <DomainDataSync />
            {children}
          </main>
          <ScrollToTopButton scrollContainerRef={mainScrollRef} />
          <MobileBottomNav />
        </div>
      </div>
    </TenantGuard>
  );
}
