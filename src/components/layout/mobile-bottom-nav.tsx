"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarCheck,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/sidebar-store";
import { stripOrgSlugFromPath } from "@/lib/tenant";
import { useTenantPath } from "@/components/tenant/tenant-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, match: (p: string) => p === "/dashboard" },
  {
    href: "/job-cards",
    label: "Jobs",
    icon: ClipboardList,
    match: (p: string) => p === "/job-cards" || (p.startsWith("/job-cards/") && p !== "/job-cards/new"),
  },
  {
    href: "/bookings",
    label: "Bookings",
    icon: CalendarCheck,
    match: (p: string) => p === "/bookings" || p.startsWith("/bookings/"),
  },
] as const;

/** Routes with their own fixed bottom bars — hide shell bottom nav. */
function shouldHideBottomNav(pathname: string): boolean {
  if (pathname === "/job-cards/new" || pathname === "/bookings/walk-in") return true;
  if (pathname === "/booking" || pathname.startsWith("/booking/")) return true;
  if (/^\/job-cards\/[^/]+$/.test(pathname) && pathname !== "/job-cards/new") return true;
  return false;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const appPath = stripOrgSlugFromPath(pathname);
  const tenantHref = useTenantPath();
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const toggleMobileOpen = useSidebarStore((s) => s.toggleMobileOpen);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  if (shouldHideBottomNav(appPath)) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-border bg-background/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(15,23,42,0.06)] backdrop-blur-sm md:hidden"
    >
      <div className="grid h-14 grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = item.match(appPath);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={tenantHref(item.href)}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("size-5", active && "stroke-[2.25]")} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={toggleMobileOpen}
          aria-expanded={mobileOpen}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
            mobileOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <Menu className="size-5" aria-hidden />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
