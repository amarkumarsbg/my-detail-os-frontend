"use client";

import { useAuthStore } from "@/store/auth-store";
import { goToMarketingHome } from "@/lib/marketing-site";
import { useBranchStore } from "@/store/branch-store";
import { useSettingsStore } from "@/store/settings-store";
import { useScopedNotifications } from "@/hooks/use-scoped-data";
import { ALL_BRANCHES_BRANCH, isAllBranchesScope } from "@/lib/all-branches";
import { canOrgWideRole } from "@/lib/branch-selection";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationPanel } from "./notification-panel";
import {
  Bell,
  LogOut,
  Moon,
  Sun,
  User,
  Wrench,
  Building2,
  PanelLeft,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useSidebarStore } from "@/store/sidebar-store";
import { navTitleForPath } from "@/lib/nav-items";

export function Header() {
  const { user, currentBranch, logout, setBranch } = useAuthStore();
  const branchesFromStore = useBranchStore((s) => s.branches);
  const businessName = useSettingsStore((s) => s.businessName);
  const businessLogo = useSettingsStore((s) => s.businessLogo);
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const setSidebarCollapsed = useSidebarStore((s) => s.setCollapsed);
  const scopedNotifications = useScopedNotifications();
  const unreadCount = scopedNotifications.filter((n) => !n.read).length;
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const pageTitle = useMemo(() => navTitleForPath(pathname), [pathname]);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  const handleLogout = () => {
    logout();
    goToMarketingHome();
  };

  const canSelectOrgWide = useMemo(
    () => !!user && canOrgWideRole(user.role),
    [user]
  );

  const selectableBranches = useMemo(() => {
    const active = branchesFromStore.filter((b) => b.isActive);
    if (!user) return active;
    if (canSelectOrgWide) return active;
    return active.filter((b) => b.id === user.branchId);
  }, [branchesFromStore, user, canSelectOrgWide]);

  /** “All branches” only makes sense when there are 2+ locations to aggregate. */
  const showAllBranchesOption = canSelectOrgWide && selectableBranches.length > 1;

  useEffect(() => {
    if (!user) return;
    if (canSelectOrgWide) {
      if (selectableBranches.length === 1 && isAllBranchesScope(currentBranch)) {
        setBranch(selectableBranches[0]!);
      }
      return;
    }
    const mine =
      selectableBranches.find((b) => b.id === user.branchId) ?? selectableBranches[0];
    if (!mine) return;
    if (
      !currentBranch ||
      isAllBranchesScope(currentBranch) ||
      !selectableBranches.some((b) => b.id === currentBranch.id)
    ) {
      setBranch(mine);
    }
  }, [user, canSelectOrgWide, currentBranch, selectableBranches, setBranch]);

  /** Dropdown only when the user can switch between 2+ locations. */
  const showBranchDropdown = selectableBranches.length > 1;
  const singleBranchLabel =
    currentBranch && !isAllBranchesScope(currentBranch)
      ? currentBranch.name
      : selectableBranches[0]?.name ?? "Branch";

  if (!user) return null;

  const avatarSrc = resolveUploadsPublicUrl(user.avatar);
  const companyLogoSrc = resolveUploadsPublicUrl(businessLogo);
  const count = unreadCount;

  return (
    <header
      className="shrink-0 z-30 min-w-0 border-b border-border bg-background px-3 sm:px-4 md:px-6 py-2 md:py-0 md:h-16 md:box-border max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto_auto] max-md:items-center max-md:gap-x-1.5 sm:max-md:gap-x-2 max-md:[grid-template-areas:'hdr_logo_hdr_branch_hdr_tools'] md:flex md:flex-nowrap md:items-center md:justify-between md:gap-3"
    >
      <div className="max-md:[grid-area:hdr_logo] flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard"
          className="md:hidden flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg border border-border/60 bg-transparent">
            {companyLogoSrc ? (
              <AvatarImage
                src={companyLogoSrc}
                alt={businessName}
                className="object-cover"
                key={companyLogoSrc}
              />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground">
              <Wrench className="w-[1.125rem] h-[1.125rem] sm:w-5 sm:h-5" />
            </AvatarFallback>
          </Avatar>
        </Link>

        {sidebarCollapsed ? (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="hidden md:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Show sidebar"
            title="Show sidebar"
          >
            <PanelLeft className="h-4 w-4" strokeWidth={2.25} />
          </button>
        ) : null}

        <h1 className="min-w-0 truncate text-[20px] font-semibold leading-tight tracking-tight text-foreground lg:text-[22px]">
          {pageTitle}
        </h1>
      </div>

      <div className="max-md:[grid-area:hdr_branch] max-md:min-w-0 max-md:self-center max-md:flex max-md:items-center max-md:justify-end max-md:gap-1 md:flex md:items-center md:gap-2 md:shrink-0 md:min-w-0 md:max-w-none md:ml-auto">
        {showBranchDropdown ? (
          <Select
            value={
              currentBranch?.id ??
              (showAllBranchesOption
                ? ALL_BRANCHES_BRANCH.id
                : selectableBranches[0]?.id)
            }
            onValueChange={(id) => {
              if (id === ALL_BRANCHES_BRANCH.id) {
                if (showAllBranchesOption) setBranch(ALL_BRANCHES_BRANCH);
                return;
              }
              const next = selectableBranches.find((b) => b.id === id);
              if (next) setBranch(next);
            }}
          >
            <SelectTrigger
              title={currentBranch?.name}
              className="h-9 min-h-9 w-full max-w-full max-md:w-auto max-md:max-w-[min(100%,12rem)] md:w-max md:max-w-[min(100vw-5rem,17.5rem)] justify-start gap-1.5 sm:gap-2 px-2 sm:px-2.5 md:px-3 text-left text-sm ring-offset-background max-md:rounded-lg max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:ring-0 max-md:hover:bg-accent/80 max-md:focus:ring-0 max-md:focus-visible:ring-0 max-md:focus-visible:ring-offset-0 md:border md:border-border md:bg-muted/50 md:shadow-sm md:hover:bg-muted/50 [&>span]:min-w-0 max-sm:[&>span]:max-w-[5.5rem] max-md:[&>span]:truncate md:[&>span]:line-clamp-none md:[&>span]:break-words md:[&>span]:whitespace-normal"
            >
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent align="start" className="max-h-[min(24rem,70vh)] min-w-[var(--radix-select-trigger-width)]">
              {showAllBranchesOption && (
                <SelectItem value={ALL_BRANCHES_BRANCH.id}>{ALL_BRANCHES_BRANCH.name}</SelectItem>
              )}
              {selectableBranches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div
            title={singleBranchLabel}
            className="flex h-9 min-h-9 w-full max-w-full max-md:w-auto max-md:max-w-[min(100%,12rem)] md:w-max md:max-w-[min(100vw-5rem,17.5rem)] items-center justify-start gap-1.5 sm:gap-2 px-2 sm:px-2.5 md:px-3 text-left text-sm max-md:rounded-lg md:rounded-md md:border md:border-border md:bg-muted/50 md:shadow-sm"
          >
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="min-w-0 truncate font-medium">{singleBranchLabel}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-0.5 sm:gap-1 shrink-0 max-md:[grid-area:hdr_tools] max-md:self-center">
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent transition-colors"
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            ) : (
              <Moon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            )}
          </button>
        )}

        <div className="relative shrink-0" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-accent transition-colors"
          >
            <Bell className="size-4 shrink-0" />
            {count > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="sm:hidden">
                <div
                  className="fixed inset-0 z-40 bg-black/30 cursor-pointer top-24 md:top-14"
                  onClick={() => setNotifOpen(false)}
                  aria-hidden
                />
                <div className="fixed inset-x-0 z-50 px-3 pt-2 top-24 md:top-14">
                  <div className="rounded-xl border border-border bg-card shadow-xl animate-in fade-in-0 slide-in-from-top-2">
                    <NotificationPanel onClose={() => setNotifOpen(false)} />
                  </div>
                </div>
              </div>
              <div className="hidden sm:block absolute right-0 top-full mt-2 z-50 rounded-xl border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
                <NotificationPanel onClose={() => setNotifOpen(false)} />
              </div>
            </>
          )}
        </div>

        <div className="hidden md:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 sm:gap-3 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors ml-1">
                <Avatar className="w-8 h-8">
                  {avatarSrc ? (
                    <AvatarImage src={avatarSrc} alt="" className="object-cover" key={avatarSrc} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-medium leading-tight">{user.name}</p>
                  <p className="text-[11px] text-muted-foreground">{user.role}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
