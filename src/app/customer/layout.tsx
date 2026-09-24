"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCustomerAuthStore } from "@/store/customer-auth-store";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { useSettingsStore } from "@/store/settings-store";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Home, FileText, Car, ClipboardList, User, Trophy, Wallet, Share2, CreditCard, KeyRound, Moon, Sun, Menu, X, RefreshCw } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { stripOrgSlugFromPath } from "@/lib/tenant";
import { useTenantPath } from "@/components/tenant/tenant-context";
import { TenantGuard } from "@/components/tenant/tenant-guard";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const appPath = stripOrgSlugFromPath(pathname);
  const tenantHref = useTenantPath();
  const [ready, setReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { isAuthenticated, user, logout, ensureValidSession } = useCustomerAuthStore();
  const { bootstrap, customer, isLoading, refresh } = useCustomerDashboardStore();
  const sessionValidatedRef = useRef(false);
  const businessName = useSettingsStore((s) => s.businessName) || "MY DETAIL OS";
  const businessLogo = useSettingsStore((s) => s.businessLogo);
  const logoUrl = resolveUploadsPublicUrl(businessLogo);
  const customerAvatarSrc = resolveUploadsPublicUrl(customer?.avatar ?? user?.avatar ?? undefined);
  const customerDisplayName = customer?.name || user?.name || "Customer";
  const { resolvedTheme, setTheme } = useTheme();

  // Initialize session - wait for Zustand persist to hydrate from localStorage
  useEffect(() => {
    // Immediately check if already hydrated
    if (useCustomerAuthStore.persist.hasHydrated?.()) {
      setReady(true);
      return;
    }

    // Subscribe to hydration completion
    const unsub = useCustomerAuthStore.persist.onFinishHydration?.(() => setReady(true));
    
    // Fallback: force ready after 2s to avoid infinite loading
    const fallback = setTimeout(() => setReady(true), 2000);
    
    return () => {
      unsub?.();
      clearTimeout(fallback);
    };
  }, []);

  // Check if we're on the login page (no auth required)
  const isLoginPage = appPath === "/customer/login";

  // Check session and bootstrap data
  useEffect(() => {
    if (!ready) return;

    // Skip auth checks for login page
    if (isLoginPage) return;

    if (!isAuthenticated) {
      router.replace(tenantHref("/customer/login"));
      return;
    }

    // Validate session only once per mount (not on every isAuthenticated change)
    if (!sessionValidatedRef.current) {
      sessionValidatedRef.current = true;
      void ensureValidSession();
    }

    // Bootstrap dashboard data
    void bootstrap();
  }, [ready, isAuthenticated, user, router, ensureValidSession, bootstrap, isLoginPage, sessionValidatedRef, tenantHref]);

  // Real-time refresh: poll frequently + re-fetch on tab focus/visibility
  const refreshRef = useRef(bootstrap);
  refreshRef.current = bootstrap;

  useEffect(() => {
    if (isLoginPage || !isAuthenticated) return;

    const POLL_INTERVAL_MS = 60_000;

    const interval = setInterval(() => {
      void refreshRef.current();
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshRef.current();
      }
    };
    const onFocus = () => {
      void refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [isLoginPage, isAuthenticated]);

  if (!isLoginPage && (!ready || !isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace(tenantHref("/customer/login"));
  };

  // Mobile bottom nav
  const mobileNavItems = [
    { label: "Home", icon: Home, href: "/customer/dashboard", testId: "nav-home" },
    { label: "Jobs", icon: ClipboardList, href: "/customer/jobs", testId: "nav-jobs" },
    { label: "Invoices", icon: FileText, href: "/customer/invoices", testId: "nav-invoices" },
    { label: "Vehicles", icon: Car, href: "/customer/vehicles", testId: "nav-vehicles" },
  ];

  // Desktop sidebar — grouped sections
  const sidebarSections = [
    {
      title: "Main",
      items: [
        { label: "Home", icon: Home, href: "/customer/dashboard" },
        { label: "My Jobs", icon: ClipboardList, href: "/customer/jobs" },
        { label: "Invoices", icon: FileText, href: "/customer/invoices" },
        { label: "Vehicles", icon: Car, href: "/customer/vehicles" },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "My Profile", icon: User, href: "/customer/more/profile" },
        { label: "Memberships", icon: CreditCard, href: "/customer/more/memberships" },
        { label: "Change Password", icon: KeyRound, href: "/customer/more/change-password" },
      ],
    },
    {
      title: "Rewards & Wallet",
      items: [
        { label: "Reward Points", icon: Trophy, href: "/customer/more/rewards" },
        { label: "Wallet", icon: Wallet, href: "/customer/more/wallet" },
        { label: "Referral Code", icon: Share2, href: "/customer/more/referral" },
      ],
    },
  ];

  // For login page, render without header/nav
  if (isLoginPage) {
    return <TenantGuard mode="customer">{children}</TenantGuard>;
  }

  return (
    <TenantGuard mode="customer">
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header — matches staff dashboard header pattern */}
      <header className="shrink-0 z-30 border-b border-border bg-background h-16 flex items-center px-4 md:pl-68 md:pr-6">
        <div className="flex flex-1 items-center justify-between min-w-0">
          {/* Left: current page title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={tenantHref("/customer/dashboard")}
              className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center md:hidden shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Go to customer home"
            >
              <Car className="h-5 w-5 text-primary-foreground" />
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
              {(() => {
                if (appPath === "/customer/dashboard") return "Dashboard";
                if (appPath === "/customer/jobs") return "My Jobs";
                if (appPath.startsWith("/customer/jobs/")) return "Job Details";
                if (appPath === "/customer/invoices") return "Billing";
                if (appPath.startsWith("/customer/invoices/")) return "Invoice";
                if (appPath === "/customer/vehicles") return "My Vehicles";
                if (appPath === "/customer/more") return "More";
                if (appPath === "/customer/more/profile") return "My Profile";
                if (appPath === "/customer/more/change-password") return "Change Password";
                if (appPath === "/customer/more/rewards") return "Reward Points";
                if (appPath === "/customer/more/wallet") return "Wallet";
                if (appPath === "/customer/more/referral") return "Referral Code";
                if (appPath === "/customer/more/memberships") return "Memberships";
                return "Customer Portal";
              })()}
            </h1>
          </div>

          {/* Right: theme toggle + logout (avatar moved to sidebar on desktop) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Mobile only: show avatar in header */}
            <div className="flex md:hidden items-center gap-2 mr-1">
              <Avatar className="h-8 w-8 shrink-0 border border-border/70">
                {customerAvatarSrc ? (
                  <AvatarImage src={customerAvatarSrc} alt={customerDisplayName} className="object-cover" key={customerAvatarSrc} />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                  {getInitials(customerDisplayName)}
                </AvatarFallback>
              </Avatar>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refresh()}
              disabled={isLoading}
              className="h-9 px-2"
              aria-label="Refresh data"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="h-9 px-2"
              aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 px-2 md:hidden" title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content — offset on desktop to clear the fixed sidebar */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0 md:ml-64">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background border-t border-border/80">
        <div className="flex items-center justify-around h-16">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = appPath === item.href || appPath.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={tenantHref(item.href)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-4 py-2 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={item.testId}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            data-testid="nav-menu"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* Mobile side drawer menu (workshop-style) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-dvh max-h-screen min-h-0 w-[288px] flex flex-col transition-transform duration-300 md:hidden bg-sidebar text-sidebar-foreground border border-sidebar-border shadow-sm",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border shrink-0 box-border">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={tenantHref("/customer/dashboard")}
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Go to customer home"
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={businessName} className="h-9 w-9 rounded-lg object-cover shrink-0 border border-sidebar-border" />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-sidebar-active flex items-center justify-center shrink-0">
                  <Car className="h-5 w-5 text-sidebar-active-foreground" />
                </div>
              )}
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-bold text-sidebar-accent-foreground truncate leading-tight">{businessName}</p>
              <p className="text-[11px] text-sidebar-foreground opacity-80">Customer Portal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-2.5">
          {sidebarSections.map((section, si) => (
            <div key={section.title} className={cn("space-y-0.5", si > 0 ? "mt-4" : "") }>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground opacity-60 px-3 pb-1.5">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = appPath === item.href || appPath.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={tenantHref(item.href)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium origin-left",
                      "translate-x-0 scale-100 transform-gpu transition-[color,background-color,transform,box-shadow] duration-200 ease-out",
                      isActive
                        ? "bg-sidebar-active text-sidebar-active-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-sm motion-safe:hover:scale-[1.03] motion-safe:hover:translate-x-0.5"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200 ease-out",
                        isActive ? "opacity-100" : "opacity-90 motion-safe:group-hover:scale-125"
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-2.5 border-t border-sidebar-border space-y-1 shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl">
            <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
              {customerAvatarSrc ? (
                <AvatarImage src={customerAvatarSrc} alt={customerDisplayName} className="object-cover" key={customerAvatarSrc} />
              ) : null}
              <AvatarFallback className="bg-sidebar-active text-sidebar-active-foreground text-sm font-bold">
                {getInitials(customerDisplayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-sidebar-accent-foreground truncate leading-tight">{customerDisplayName}</p>
            </div>
          </div>
          <div className="-mx-2.5 border-t border-sidebar-border my-0.5" />
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors dark:text-rose-400 dark:hover:bg-rose-500/15"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex-col z-40">
        {/* Brand header — company name + logo like staff sidebar */}
        <Link
          href={tenantHref("/customer/dashboard")}
          className="flex items-center gap-3 h-16 px-4 shrink-0 border-b border-sidebar-border rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={businessName} className="h-9 w-9 rounded-lg object-cover shrink-0 border border-sidebar-border" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-sidebar-active flex items-center justify-center shrink-0">
              <Car className="h-5 w-5 text-sidebar-active-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-sidebar-accent-foreground truncate leading-tight">{businessName}</p>
            <p className="text-[11px] text-sidebar-foreground opacity-80">Customer Portal</p>
          </div>
        </Link>

        <nav className="flex flex-col gap-0.5 p-2.5 flex-1 overflow-y-auto">
          {sidebarSections.map((section, si) => (
            <div key={section.title} className={si > 0 ? "mt-4" : ""}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground opacity-60 px-3 pb-1.5">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = appPath === item.href || appPath.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={tenantHref(item.href)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium origin-left",
                      "translate-x-0 scale-100 transform-gpu transition-[color,background-color,transform,box-shadow] duration-200 ease-out",
                      isActive
                        ? "bg-sidebar-active text-sidebar-active-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-sm motion-safe:hover:scale-[1.03] motion-safe:hover:translate-x-0.5"
                    )}
                  >
                    <Icon className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200 ease-out",
                      isActive ? "opacity-100" : "opacity-90 motion-safe:group-hover:scale-125"
                    )} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Customer profile + Logout */}
        <div className="p-2.5 border-t border-sidebar-border space-y-1">
          {/* Customer name + avatar */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl">
            <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
              {customerAvatarSrc ? (
                <AvatarImage src={customerAvatarSrc} alt={customerDisplayName} className="object-cover" key={customerAvatarSrc} />
              ) : null}
              <AvatarFallback className="bg-sidebar-active text-sidebar-active-foreground text-sm font-bold">
                {getInitials(customerDisplayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-sidebar-accent-foreground truncate leading-tight">{customerDisplayName}</p>
            </div>
          </div>
          <div className="-mx-2.5 border-t border-sidebar-border my-0.5" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors dark:text-rose-400 dark:hover:bg-rose-500/15"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

    </div>
    </TenantGuard>
  );
}
