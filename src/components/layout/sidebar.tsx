"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { format, addDays } from "date-fns";
import { cn, getInitials } from "@/lib/utils";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSidebarStore } from "@/store/sidebar-store";
import { useAuthStore } from "@/store/auth-store";
import { goToMarketingAfterLogout } from "@/lib/marketing-site";
import { useDashboardFilterStore } from "@/store/dashboard-filter-store";
import { useSettingsStore } from "@/store/settings-store";
import { useAppointmentStore } from "@/store/appointment-store";
import { resolveAppointmentKind } from "@/lib/appointment-ids";
import { canAccessNavItem } from "@/lib/rbac";
import { NAV_GROUPS } from "@/lib/nav-items";
import { isHrStaffNavHref, userHasWithoutEditAccess } from "@/lib/staff-access";
import { stripOrgSlugFromPath } from "@/lib/tenant";
import { useTenantPath } from "@/components/tenant/tenant-context";
import {
  CarFront,
  X,
  LogOut,
  ChevronDown,
} from "lucide-react";

function navSectionSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Sidebar navigation clears dashboard drill-down filters (alerts use `setActiveFilter` before routing). */
const SIDEBAR_CLEAR_FILTER_HREFS = new Set([
  "/job-cards",
  "/bookings",
  "/inventory",
  "/customers",
  "/billing",
  "/reminders",
]);

/** Sidebar active state: Finance "Reports" links to `/reports` but must not stay lit on `/reports/analytics` (that page is the separate "Analytics" item). */
function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/reports") {
    if (pathname === "/reports") return true;
    if (pathname === "/reports/analytics" || pathname.startsWith("/reports/analytics/")) {
      return false;
    }
    return pathname.startsWith("/reports/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  onNavClick,
  navOverflow = "hidden",
  className,
}: {
  onNavClick?: () => void;
  navOverflow?: "hidden" | "auto";
  className?: string;
}) {
  const pathname = usePathname();
  const appPath = stripOrgSlugFromPath(pathname);
  const tenantHref = useTenantPath();
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role;
  const userPermissions = user?.permissions;
  const hideHrStaffNav = userHasWithoutEditAccess(user);
  const clearDashboardFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const allAppointments = useAppointmentStore((s) => s.appointments);

  const tomorrowScheduledCount = (() => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const tomorrowKey = format(addDays(new Date(), 1), "yyyy-MM-dd");
    return allAppointments.filter(
      (a) =>
        resolveAppointmentKind(a) === "APPOINTMENT" &&
        (a.status === "SCHEDULED" || a.status === "CONFIRMED") &&
        (a.date === todayKey || a.date === tomorrowKey)
    ).length;
  })();

  const bookingTodayTomorrowCount = (() => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const tomorrowKey = format(addDays(new Date(), 1), "yyyy-MM-dd");
    return allAppointments.filter(
      (a) =>
        resolveAppointmentKind(a) === "BOOKING" &&
        (a.status === "SCHEDULED" || a.status === "CONFIRMED") &&
        (a.date === todayKey || a.date === tomorrowKey)
    ).length;
  })();

  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (hideHrStaffNav && isHrStaffNavHref(item.href)) return false;
      return canAccessNavItem(item.roles, userRole, item.permissionKey, userPermissions);
    }),
  })).filter((group) => group.items.length > 0);

  const navRef = useRef<HTMLElement>(null);
  const navContentRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const updateScrollHint = useCallback(() => {
    queueMicrotask(() => {
      const el = navRef.current;
      if (!el || navOverflow !== "auto") {
        setShowScrollHint(false);
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = el;
      const canScroll = scrollHeight > clientHeight + 2;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 6;
      setShowScrollHint(canScroll && !atBottom);
    });
  }, [navOverflow]);

  const navContentSignature = filteredGroups.map((g) => g.items.length).join(",");

  const scrollNavDown = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    const step = Math.min(Math.max(el.clientHeight * 0.75, 72), Math.max(remaining, 0));
    if (step <= 0) return;
    el.scrollBy({ top: step, behavior: "smooth" });
  }, []);

  useLayoutEffect(() => {
    updateScrollHint();
  }, [appPath, userRole, navContentSignature, updateScrollHint]);

  useEffect(() => {
    const el = navRef.current;
    const inner = navContentRef.current;
    if (!el || navOverflow !== "auto") return;

    updateScrollHint();
    el.addEventListener("scroll", updateScrollHint, { passive: true });
    const ro = new ResizeObserver(() => updateScrollHint());
    ro.observe(el);
    if (inner) ro.observe(inner);
    window.addEventListener("resize", updateScrollHint);

    return () => {
      el.removeEventListener("scroll", updateScrollHint);
      ro.disconnect();
      window.removeEventListener("resize", updateScrollHint);
    };
  }, [navOverflow, updateScrollHint, navContentSignature]);

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <nav
        ref={navRef}
        className={cn(
          "min-h-0 flex-1 overflow-x-hidden py-3 px-2.5",
          navOverflow === "hidden" && "overflow-y-hidden overscroll-none",
          navOverflow === "auto" && "overflow-y-auto overscroll-y-contain scrollbar-none"
        )}
      >
        <div ref={navContentRef} className="space-y-3">
          {filteredGroups.map((group, groupIndex) => (
            <section
              key={group.label}
              className="space-y-1"
              aria-labelledby={`nav-section-${navSectionSlug(group.label)}`}
            >
              <div
                className={cn(
                  "flex items-center gap-1 px-3 pb-1.5",
                  groupIndex === 0 ? "pt-0" : "pt-4"
                )}
              >
                <h2
                  id={`nav-section-${navSectionSlug(group.label)}`}
                  className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--sidebar-section-heading)]"
                >
                  {group.label}
                </h2>
              </div>
              <div className="space-y-0.5 px-1.5">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(appPath, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={tenantHref(item.href)}
                      onClick={() => {
                        if (SIDEBAR_CLEAR_FILTER_HREFS.has(item.href)) clearDashboardFilter(null);
                        onNavClick?.();
                      }}
                      className={cn(
                        "group flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium origin-left",
                        "translate-x-0 scale-100 transform-gpu transition-[color,background-color,transform,box-shadow] duration-200 ease-out",
                        isActive
                          ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)] shadow-sm"
                          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] hover:shadow-sm motion-safe:hover:scale-[1.03] motion-safe:hover:translate-x-0.5"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200 ease-out",
                          isActive ? "opacity-100" : "opacity-90 motion-safe:group-hover:scale-125"
                        )}
                      />
                      <span className="flex-1 min-w-0">{item.label}</span>
                      {item.href === "/appointments" && tomorrowScheduledCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-violet-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">
                          {tomorrowScheduledCount}
                        </span>
                      )}
                      {item.href === "/bookings" && bookingTodayTomorrowCount > 0 && (
                        <span
                          className={cn(
                            "ml-auto inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums",
                            isActive
                              ? "bg-white/90 text-[var(--sidebar-active)]"
                              : "bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)]"
                          )}
                        >
                          {bookingTodayTomorrowCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>

      {navOverflow === "auto" && showScrollHint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-[var(--sidebar)] from-40% via-[var(--sidebar)]/85 to-transparent pb-2.5 pt-10">
          <button
            type="button"
            onClick={scrollNavDown}
            className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--sidebar-border)] bg-[var(--sidebar-scroll-hint-bg)] px-3 py-1.5 text-xs font-medium text-[var(--sidebar-accent-foreground)] shadow-sm transition-[transform,filter] hover:brightness-95 active:scale-[0.98]"
            aria-label="Scroll down for more navigation options"
          >
            Scroll for more options
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const router = useRouter();
  const tenantHref = useTenantPath();
  const { mobileOpen, setMobileOpen, collapsed, setCollapsed } = useSidebarStore();
  const businessName = useSettingsStore((s) => s.businessName);
  const businessLogo = useSettingsStore((s) => s.businessLogo);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const companyLogoSrc = resolveUploadsPublicUrl(businessLogo);

  const handleMobileLogout = () => {
    logout();
    setMobileOpen(false);
    goToMarketingAfterLogout();
  };

  const brandHeader = (onClick?: () => void) => (
    <Link
      href={tenantHref("/dashboard")}
      onClick={onClick}
      className="flex items-center gap-3 min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label="Go to dashboard"
    >
      <Avatar className="h-9 w-9 shrink-0 border border-[var(--sidebar-border)] bg-transparent">
        {companyLogoSrc ? (
          <AvatarImage
            src={companyLogoSrc}
            alt={businessName}
            className="object-cover"
            key={companyLogoSrc}
          />
        ) : (
          <AvatarImage
            src="/my-detail-os-mark.png"
            alt="MY DETAIL OS"
            className="object-cover"
          />
        )}
        <AvatarFallback className="bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)]">
          <CarFront
            className="h-[22px] w-[22px]"
            strokeWidth={1.65}
            aria-hidden
          />
        </AvatarFallback>
      </Avatar>
      <div className="overflow-hidden min-w-0">
        <h1 className="text-base font-bold text-[var(--sidebar-accent-foreground)] leading-tight truncate">
          {businessName}
        </h1>
        <p className="text-[11px] text-[var(--sidebar-foreground)] truncate opacity-80">Service management</p>
      </div>
    </Link>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden md:flex fixed left-0 top-0 z-40 h-[100dvh] max-h-screen w-[260px] flex-col transition-transform duration-300 min-h-0 bg-[var(--sidebar)] text-sidebar-foreground border border-t-0 border-[var(--sidebar-border)] shadow-sm",
          collapsed ? "-translate-x-full pointer-events-none" : "translate-x-0"
        )}
        aria-hidden={collapsed}
      >
        <div className="flex items-center h-16 px-4 shrink-0 border-b border-border box-border">
          {brandHeader()}
        </div>

        <div className="relative flex-1 flex flex-col overflow-hidden min-h-0 min-w-0 bg-transparent">
          <SidebarContent
            className="flex-1 min-h-0"
            onNavClick={() => setCollapsed(true)}
            navOverflow="auto"
          />
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-[100dvh] max-h-screen min-h-0 w-[288px] flex flex-col transition-transform duration-300 md:hidden bg-[var(--sidebar)] text-sidebar-foreground border border-[var(--sidebar-border)] shadow-sm",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border shrink-0 box-border">
          {brandHeader(() => setMobileOpen(false))}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <SidebarContent
            className="flex-1 min-h-0"
            onNavClick={() => setMobileOpen(false)}
            navOverflow="auto"
          />
        </div>

        {user && (
          <div className="shrink-0 border-t border-[var(--sidebar-border)] px-2.5 py-3 space-y-1">
            <button
              type="button"
              onClick={handleMobileLogout}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors dark:text-rose-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
                <LogOut className="w-4 h-4" />
              </span>
              <span className="truncate min-w-0">Log out</span>
            </button>
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] transition-colors"
            >
              <Avatar className="h-9 w-9 shrink-0 border border-[var(--sidebar-border)]">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate min-w-0">{user.name}</span>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
