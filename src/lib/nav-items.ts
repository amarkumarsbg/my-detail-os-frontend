import type { UserRole } from "@/types";
import { stripOrgSlugFromPath } from "@/lib/tenant";
import {
  LayoutDashboard,
  Users,
  Car,
  ClipboardList,
  Wrench,
  UserCog,
  Package,
  Calendar,
  CalendarCheck,
  CalendarOff,
  Truck,
  BarChart3,
  Banknote,
  Receipt,
  History,
  MessageSquare,
  Bell,
  Settings,
  Gauge,
  FileText,
  PhoneCall,
  Wallet,
  Store,
  TrendingUp,
  FileBarChart,
  Gift,
  Building2,
  Landmark,
  Crown,
  BookMarked,
  QrCode,
  IndianRupee,
  ShoppingCart,
  Trophy,
} from "lucide-react";

export type NavItemDef = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
  permissionKey?: string;
};

export const NAV_GROUPS: { label: string; items: NavItemDef[] }[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permissionKey: "DASHBOARD" },
      { label: "Job Cards", href: "/job-cards", icon: ClipboardList, permissionKey: "JOB_CARDS" },
      { label: "Bookings", href: "/bookings", icon: CalendarCheck, permissionKey: "BOOKINGS" },
      { label: "Pickup & Drop", href: "/pickup-drop", icon: Truck, permissionKey: "PICKUP_DROP" },
      { label: "Counter Sale", href: "/counter-sale", icon: ShoppingCart, permissionKey: "BILLING" },
      { label: "Quotations", href: "/quotations", icon: FileText, permissionKey: "QUOTATIONS" },
      { label: "Appointments", href: "/appointments", icon: Calendar, permissionKey: "APPOINTMENTS" },
    ],
  },
  {
    label: "Customers & fleet",
    items: [
      { label: "Customers", href: "/customers", icon: Users, permissionKey: "CUSTOMERS" },
      { label: "Membership", href: "/membership", icon: Crown, permissionKey: "MEMBERSHIP" },
      { label: "Vehicles", href: "/vehicles", icon: Car, permissionKey: "VEHICLES" },
      { label: "Reminders", href: "/reminders", icon: Bell, roles: ["ADMIN", "MANAGER", "RECEPTIONIST"], permissionKey: "REMINDERS" },
      { label: "Follow-ups", href: "/follow-ups", icon: PhoneCall, roles: ["ADMIN", "MANAGER", "RECEPTIONIST"], permissionKey: "FOLLOW_UPS" },
      { label: "Referrals", href: "/referrals", icon: Gift, roles: ["ADMIN", "MANAGER"], permissionKey: "REFERRALS" },
    ],
  },
  {
    label: "Workshop",
    items: [
      { label: "Services", href: "/services", icon: Wrench, roles: ["ADMIN", "MANAGER"], permissionKey: "SERVICES" },
      {
        label: "Inventory Hub",
        href: "/inventory",
        icon: Package,
        roles: ["ADMIN", "MANAGER"],
        permissionKey: "INVENTORY",
      },
      {
        label: "Vendors",
        href: "/vendors",
        icon: Store,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER"],
        permissionKey: "VENDORS",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Accounting",
        href: "/accounting",
        icon: IndianRupee,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
        permissionKey: "REPORTS",
      },
      {
        label: "Expenses",
        href: "/expenses",
        icon: Banknote,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER"],
        permissionKey: "EXPENSES",
      },
      { label: "Billing", href: "/billing", icon: Receipt, permissionKey: "BILLING" },
      {
        label: "Reports",
        href: "/reports",
        icon: FileBarChart,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
        permissionKey: "REPORTS",
      },
      {
        label: "Cash & Bank",
        href: "/cash-bank",
        icon: Landmark,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
        permissionKey: "CASH_BANK",
      },
      {
        label: "Parties",
        href: "/parties",
        icon: Building2,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
        permissionKey: "PARTIES",
      },
      {
        label: "Shared Ledger",
        href: "/shared-ledger",
        icon: BookMarked,
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "RECEPTIONIST"],
        permissionKey: "SHARED_LEDGER",
      },
    ],
  },
  {
    label: "HR & staff",
    items: [
      { label: "Users & Staff", href: "/staff", icon: UserCog, roles: ["ADMIN", "MANAGER"], permissionKey: "STAFF" },
      { label: "Attendance", href: "/attendance", icon: QrCode, roles: ["ADMIN", "MANAGER"], permissionKey: "ATTENDANCE" },
      { label: "Leave", href: "/leave", icon: CalendarOff, roles: ["ADMIN", "MANAGER", "BRANCH_MANAGER", "SUPERVISOR", "RECEPTIONIST", "MECHANIC"], permissionKey: "LEAVE" },
      {
        label: "Rewards",
        href: "/rewards",
        icon: Trophy,
        roles: ["ADMIN", "MANAGER", "BRANCH_MANAGER"],
        permissionKey: "STAFF_REWARDS",
      },
      {
        label: "Performance",
        href: "/performance",
        icon: TrendingUp,
        roles: ["ADMIN", "MANAGER", "BRANCH_MANAGER"],
        permissionKey: "PERFORMANCE",
      },
      { label: "Salary & Payroll", href: "/payroll", icon: Wallet, roles: ["ADMIN", "MANAGER"], permissionKey: "PAYROLL" },
    ],
  },
  {
    label: "Workshop Analytics & Tools",
    items: [
      {
        label: "Locations",
        href: "/branches",
        icon: Building2,
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "BRANCH_MANAGER"],
        permissionKey: "BRANCHES",
      },
      { label: "Mechanics", href: "/mechanics", icon: Gauge, roles: ["ADMIN", "MANAGER"], permissionKey: "MECHANICS" },
      { label: "Analytics", href: "/reports/analytics", icon: BarChart3, roles: ["ADMIN", "MANAGER"], permissionKey: "ANALYTICS" },
      {
        label: "Advanced Reports",
        href: "/advanced-reports",
        icon: FileBarChart,
        roles: ["ADMIN", "MANAGER", "BRANCH_MANAGER"],
        permissionKey: "ADVANCED_REPORTS",
      },
      { label: "Activity Log", href: "/activity", icon: History, roles: ["ADMIN"], permissionKey: "ACTIVITY" },
      { label: "Messages Log", href: "/messages", icon: MessageSquare, roles: ["ADMIN"], permissionKey: "MESSAGES" },
      { label: "Settings", href: "/settings", icon: Settings, roles: ["ADMIN"], permissionKey: "SETTINGS" },
    ],
  },
];

const EXTRA_PAGE_TITLES: { href: string; label: string }[] = [
  { href: "/profile", label: "Profile" },
  { href: "/notifications", label: "Notifications" },
];

const NAV_DESCRIPTIONS: Record<string, string> = {
  "/job-cards": "Create and manage job cards, track workshop progress, and close deliveries",
  "/bookings": "Create walk-in and scheduled bookings, then convert them to job cards",
  "/pickup-drop": "Schedule vehicle pickup and delivery and track driver assignments",
  "/counter-sale": "Sell parts at the counter, collect payment, and update stock",
  "/quotations": "Create and manage quotations, send estimates via WhatsApp, and convert to job cards",
  "/appointments": "Schedule appointments, manage the calendar, and track confirmations",
  "/customers": "Add and manage customers, vehicles, and service history",
  "/membership": "Create membership packages and assign them to customers",
  "/vehicles": "Manage the vehicle directory and link cars to customers",
  "/reminders": "Track service due dates and send follow-up reminders",
  "/follow-ups": "Work inactive customers and complete follow-up tasks",
  "/referrals": "Track referral codes, rewards, and new customer sign-ups",
  "/accounting": "Review finances, expenses, revenue, and workshop analytics",
  "/expenses": "Track and manage operational expenses by category and vendor",
  "/vendors": "Manage supplier relationships and outstanding payables",
  "/billing": "Create invoices, record payments, and track outstanding dues",
  "/reports": "Open GST, sales, and finance reports for this branch",
  "/reports/analytics": "Review performance trends, revenue, and workshop analytics",
  "/cash-bank": "Manage cash on hand, bank accounts, and account transactions",
  "/parties": "Maintain customers and suppliers in one ledger",
  "/shared-ledger": "Review receivables and payables across invoices and expenses",
  "/staff": "Manage staff accounts, roles, and attendance PINs",
  "/attendance": "Track QR and PIN punch, check-in/out, and working hours",
  "/leave": "Apply for leave, review balances, and approve requests",
  "/rewards": "Manage staff reward ledger, settings, and monthly targets",
  "/payroll": "Manage staff salaries, bonuses, and disbursements",
  "/services": "Manage service packages, add-ons, and categories",
  "/inventory": "Manage parts catalog, branch stock, transfers, purchases, and history",
  "/branches": "Manage workshop locations, contacts, and operating status",
  "/performance": "Review branch and staff performance across jobs and revenue",
  "/mechanics": "Track mechanic jobs, utilization, and performance stats",
  "/advanced-reports": "Run deep-dive reports across jobs, billing, and operations",
  "/activity": "Review tracked actions across jobs, invoices, and expenses",
  "/messages": "Track transactional email, SMS, and WhatsApp messages to customers",
  "/settings": "Manage business profile, branding, and workspace preferences",
  "/profile": "Manage your account settings and preferences",
  "/notifications": "Review alerts, reminders, and workspace notifications",
};

function navMatchForPath(pathname: string): { href: string; label: string } | undefined {
  const path = stripOrgSlugFromPath(pathname.split(/[?#]/)[0] ?? pathname);
  const candidates = [
    ...NAV_GROUPS.flatMap((group) =>
      group.items.map((item) => ({ href: item.href, label: item.label }))
    ),
    ...EXTRA_PAGE_TITLES,
  ];
  return candidates
    .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Active sidebar/menu title for the current dashboard route (longest href match). */
export function navTitleForPath(pathname: string): string {
  return navMatchForPath(pathname)?.label ?? "Dashboard";
}

/** Menu description shown under the navbar title on hub pages. */
export function navDescriptionForPath(pathname: string): string | undefined {
  const match = navMatchForPath(pathname);
  if (!match) return undefined;
  return NAV_DESCRIPTIONS[match.href];
}

function normalizePageTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemTitleWord(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

/** True when a content heading repeats the top-navbar page title. */
export function isDuplicateNavTitle(pageTitle: string, navTitle: string): boolean {
  const page = normalizePageTitle(pageTitle);
  const nav = normalizePageTitle(navTitle);
  if (!page || !nav) return false;
  if (page === nav) return true;

  const longer = page.length >= nav.length ? page : nav;
  const shorter = page.length >= nav.length ? nav : page;
  if (longer.startsWith(`${shorter} `)) return true;

  const pageWords = page.split(" ");
  const navWords = nav.split(" ");
  const pageFirst = pageWords[0];
  const navFirst = navWords[0];
  if (
    pageFirst &&
    navFirst &&
    pageFirst.length >= 5 &&
    navFirst.length >= 5 &&
    stemTitleWord(pageFirst) === stemTitleWord(navFirst)
  ) {
    return true;
  }

  const navOnly = navWords[0];
  const pageLast = pageWords[pageWords.length - 1];
  if (navWords.length === 1 && pageWords.length >= 2 && navOnly && pageLast === navOnly) {
    return true;
  }

  return false;
}
