"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KPICard } from "@/components/shared/kpi-card";
import { JobCardStatusBadge } from "@/components/shared/status-badge";
import { useJobCardStore } from "@/store/job-card-store";
import { useBranchStore } from "@/store/branch-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useExpenseStore } from "@/store/expense-store";
import { useDashboardStatsStore } from "@/store/dashboard-stats-store";
import { useAppointmentStore } from "@/store/appointment-store";
import { resolveAppointmentKind } from "@/lib/appointment-ids";
import {
  appointmentsScheduledToday,
  upcomingReservations,
} from "@/lib/appointment-reminders";
import { normalizeReminderKind } from "@/lib/reminder-schedule";
import { useReservationReminders } from "@/hooks/use-reservation-reminders";
import { useReminderStore } from "@/store/reminder-store";
import {
  computeBranchScopedDashboardStats,
  filterRemindersByBranch,
  filterInvoicesByBranch,
  useBranchScope,
} from "@/lib/branch-scope";
import { useInventoryStore } from "@/store/inventory-store";
import { useCustomerStore } from "@/store/customer-store";
import { getStockStatus } from "@/lib/inventory-units";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  Wrench,
  IndianRupee,
  UserPlus,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Receipt,
  Bell,
  TrendingDown,
  UserX,
  ClipboardList,
  AlertCircle,
  Building2,
  Calendar,
  CalendarCheck,
  FileText,
  Users,
  BarChart3,
  Eye,
  MoreHorizontal,
  Car,
  CarFront,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { StaggerGrid } from "@/components/motion/stagger-grid";
import {
  alertStaggerContainer,
  alertStaggerItem,
} from "@/components/motion/dashboard-motion";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import {
  isTodaysBookingsJob,
  isReadyForDeliveryJob,
  isInactiveCustomer,
  isOverdueJobCard,
  jobCardDeliveryAt,
} from "@/lib/dashboard-filters";
import type { DashboardStats, JobCard, UserRole } from "@/types";
import { DashboardSkeleton } from "@/components/shared/skeleton-loader";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { useSettingsStore } from "@/store/settings-store";
import { useAuthStore } from "@/store/auth-store";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { notifyJobReadyWhatsApp } from "@/lib/whatsapp-automation-triggers";
import { useSidebarStore } from "@/store/sidebar-store";

const FUNNEL_IN_PROGRESS: JobCard["status"][] = [
  "INSPECTION",
  "AWAITING_SERVICE",
  "QUALITY_CHECK",
];

const BRANCH_SHORT: Record<string, string> = {
  "br-main": "PD-DEL",
  "br-002": "PD-NOI",
};

const EMPTY_DASHBOARD_STATS: DashboardStats = {
  averageRating: 0,
  carsReceivedToday: 0,
  carsDeliveredToday: 0,
  inProgressServices: 0,
  dailyRevenue: 0,
  totalExpensesToday: 0,
  netProfitToday: 0,
  newCustomersToday: 0,
  inactiveCustomers: 0,
  activeJobCards: 0,
  pendingPayments: 0,
  monthlyRevenue: [],
  serviceBreakdown: [],
  todaysBookings: [],
  readyForDelivery: [],
};

function daysAgoMidnight(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

type DashboardView = "admin" | "manager" | "technician";

function getDashboardView(role: UserRole | undefined): DashboardView {
  if (!role) return "manager";
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "admin";
  if (role === "MECHANIC") return "technician";
  return "manager";
}

const QUICK_ACTIONS = [
  {
    href: "/job-cards/new",
    label: "New Job Card",
    icon: Plus,
    bgClass: "bg-primary/5 hover:bg-primary/10 border-primary/30 hover:border-primary/55 dark:bg-primary/10 dark:hover:bg-primary/15 dark:border-primary/35 dark:hover:border-primary/55 hover:shadow-primary/5",
    iconBgClass: "bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary",
    textClass: "text-foreground",
    plusClass: "text-primary/80",
  },
  {
    href: "/bookings/walk-in",
    label: "New Booking",
    icon: CalendarCheck,
    bgClass: "bg-violet-50/40 hover:bg-violet-50/70 border-violet-300 hover:border-violet-500 dark:bg-violet-950/20 dark:hover:bg-violet-950/30 dark:border-violet-800 dark:hover:border-violet-600 hover:shadow-violet-500/5",
    iconBgClass: "bg-violet-100/80 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400",
    textClass: "text-violet-950 dark:text-violet-100",
    plusClass: "text-violet-500/80",
  },
  {
    href: "/quotations?new=true",
    label: "New Quotation",
    icon: FileText,
    bgClass: "bg-amber-50/40 hover:bg-amber-50/70 border-amber-300 hover:border-amber-500 dark:bg-amber-950/20 dark:hover:bg-amber-950/30 dark:border-amber-800 dark:hover:border-amber-600 hover:shadow-amber-500/5",
    iconBgClass: "bg-amber-100/80 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
    textClass: "text-amber-950 dark:text-amber-100",
    plusClass: "text-amber-500/80",
  },
  {
    href: "/appointments?new=true",
    label: "New Appointment",
    icon: Calendar,
    bgClass: "bg-emerald-50/40 hover:bg-emerald-50/70 border-emerald-300 hover:border-emerald-500 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 dark:border-emerald-800 dark:hover:border-emerald-600 hover:shadow-emerald-500/5",
    iconBgClass: "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400",
    textClass: "text-emerald-950 dark:text-emerald-100",
    plusClass: "text-emerald-500/80",
  },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const branches = useBranchStore((s) => s.branches);
  const { jobCards } = useJobCardStore();
  const appointments = useAppointmentStore((s) => s.appointments);
  const invoices = useInvoiceStore((s) => s.invoices);
  const expenses = useExpenseStore((s) => s.expenses);
  const { selectedBranchId, viewingLabel } = useBranchScope();
  const parts = useInventoryStore((s) => s.parts);
  const customers = useCustomerStore((s) => s.customers);
  const rawStats =
    useDashboardStatsStore((s) => s.stats) ?? EMPTY_DASHBOARD_STATS;
  const serviceReminders = useReminderStore((s) => s.reminders);
  const businessName = useSettingsStore((s) => s.businessName);
  const user = useAuthStore((s) => s.user);
  const dashboardView = getDashboardView(user?.role);

  useReservationReminders();

  const bookingReservations = useMemo(
    () => appointments.filter((a) => resolveAppointmentKind(a) === "BOOKING"),
    [appointments]
  );
  const todaysBookingReservations = useMemo(
    () => appointmentsScheduledToday(bookingReservations),
    [bookingReservations]
  );
  const upcomingBookingReservations = useMemo(
    () => upcomingReservations(bookingReservations),
    [bookingReservations]
  );

  const [recentBookingPreview, setRecentBookingPreview] = useState<JobCard | null>(null);

  const scopedJobCards = useMemo(() => {
    if (!selectedBranchId) return jobCards;
    return jobCards.filter((jc) => jc.branchId === selectedBranchId);
  }, [jobCards, selectedBranchId]);

  const scopedInvoices = useMemo(
    () => filterInvoicesByBranch(invoices, jobCards, selectedBranchId),
    [invoices, jobCards, selectedBranchId]
  );

  const stats = useMemo(
    () =>
      computeBranchScopedDashboardStats(
        jobCards,
        invoices,
        expenses,
        customers,
        selectedBranchId,
        rawStats
      ),
    [jobCards, invoices, expenses, customers, selectedBranchId, rawStats]
  );

  const scopedReminders = useMemo(
    () => filterRemindersByBranch(serviceReminders, jobCards, selectedBranchId),
    [serviceReminders, jobCards, selectedBranchId]
  );

  const todaysBookingsLive = useMemo(
    () => scopedJobCards.filter(isTodaysBookingsJob),
    [scopedJobCards]
  );
  const readyForDeliveryLive = useMemo(
    () => scopedJobCards.filter(isReadyForDeliveryJob),
    [scopedJobCards]
  );

  const jobsToday = useMemo(
    () => scopedJobCards.filter(isTodaysBookingsJob),
    [scopedJobCards]
  );

  const executive = useMemo(() => {
    const d30 = daysAgoMidnight(30);
    const d60 = daysAgoMidnight(60);
    const invoiceIn30 = scopedInvoices.filter((inv) => {
      if (inv.status === "DRAFT") return false;
      return new Date(inv.createdAt) >= d30;
    });
    const invoicePrevWindow = scopedInvoices.filter((inv) => {
      if (inv.status === "DRAFT") return false;
      const c = new Date(inv.createdAt);
      return c >= d60 && c < d30;
    });
    const rev30 = invoiceIn30.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const revPrev = invoicePrevWindow.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const revenueTrend =
      revPrev > 0
        ? {
            value: Math.abs(Math.round(((rev30 - revPrev) / revPrev) * 100)),
            isPositive: rev30 >= revPrev,
          }
        : undefined;

    const completed30d = scopedJobCards.filter((jc) => {
      if (jc.status !== "DELIVERED") return false;
      const end = jc.actualDelivery
        ? new Date(jc.actualDelivery)
        : new Date(jc.updatedAt);
      return end >= d30;
    }).length;
    const pendingBookings = scopedJobCards.filter((jc) =>
      ["RECEIVED", "INSPECTION", "AWAITING_SERVICE"].includes(jc.status)
    ).length;
    const activeCustomers = customers.filter((c) => {
      if (isInactiveCustomer(c)) return false;
      return scopedJobCards.some((jc) => jc.customerId === c.id);
    }).length;

    return {
      totalRevenue30d: rev30,
      revenueTrend,
      todaysJobCount: jobsToday.length,
      pendingBookings,
      completed30d,
      activeCustomers,
    };
  }, [scopedJobCards, scopedInvoices, customers, jobsToday]);

  const todaysFunnel = useMemo(() => {
    const total = jobsToday.length;
    const assigned = jobsToday.filter(
      (j) =>
        Boolean(j.mechanicId) &&
        !["DELIVERED", "CANCELLED", "READY"].includes(j.status)
    ).length;
    const inProgress = jobsToday.filter((j) =>
      FUNNEL_IN_PROGRESS.includes(j.status)
    ).length;
    const completed = jobsToday.filter((j) => j.status === "DELIVERED").length;
    return { total, assigned, inProgress, completed };
  }, [jobsToday]);

  const branchPerformance = useMemo(() => {
    const d30 = daysAgoMidnight(30);
    const branchList = selectedBranchId
      ? branches.filter((b) => b.id === selectedBranchId)
      : branches;
    return branchList.map((branch) => {
      const scoped = scopedJobCards.filter(
        (jc) => jc.branchId === branch.id && new Date(jc.createdAt) >= d30
      );
      const scopedBranchInvoices = invoices.filter((inv) => {
        if (inv.status === "DRAFT") return false;
        if (new Date(inv.createdAt) < d30) return false;
        return (inv.jobCardId
          ? jobCards.find((jc) => jc.id === inv.jobCardId)?.branchId
          : undefined) === branch.id;
      });
      const bookings = scoped.length;
      const completed = scoped.filter((jc) => jc.status === "DELIVERED").length;
      const revenue = scopedBranchInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
      const completionRate =
        bookings > 0 ? Math.round((completed / bookings) * 100) : 0;
      return {
        branch,
        code: BRANCH_SHORT[branch.id] ?? branch.id.toUpperCase(),
        revenue,
        bookings,
        completed,
        completionRate,
        jobCards: bookings,
        rating: 0,
      };
    });
  }, [scopedJobCards, branches, selectedBranchId, invoices, jobCards]);

  const recentBookings = useMemo(
    () =>
      [...scopedJobCards].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [scopedJobCards]
  );

  const alerts = useMemo(() => {
    const items: {
      id: string;
      icon: React.ElementType;
      label: string;
      shortLabel: string;
      count: number;
      href: string;
      color: string;
      bgColor: string;
    }[] = [];

    // Use the shared isOverdueJobCard function so the badge count matches the job-cards page filter.
    const overdueJobs = scopedJobCards.filter(isOverdueJobCard);
    if (overdueJobs.length > 0) {
      items.push({
        id: "overdue",
        icon: AlertTriangle,
        label: "Overdue job cards",
        shortLabel: "Overdue Jobs",
        count: overdueJobs.length,
        href: "/job-cards",
        color: "text-red-700 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/40",
      });
    }

    const lowStock = parts.filter((p) => getStockStatus(p).label === "Low Stock");
    if (lowStock.length > 0) {
      items.push({
        id: "stock",
        icon: Package,
        label: "Low stock items",
        shortLabel: "Low Stock",
        count: lowStock.length,
        href: "/inventory",
        color: "text-amber-700 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/40",
      });
    }

    if (stats.pendingPayments > 0) {
      items.push({
        id: "payments",
        icon: Receipt,
        label: "Pending payments",
        shortLabel: "Pending Payments",
        count: stats.pendingPayments,
        href: "/billing",
        color: "text-orange-700 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/40",
      });
    }

    const overdueReminders = scopedReminders.filter(
      (r) =>
        normalizeReminderKind(r.kind) === "SERVICE" &&
        (r.status === "OVERDUE" || r.status === "DUE")
    );
    if (overdueReminders.length > 0) {
      items.push({
        id: "reminders",
        icon: Bell,
        label: "Due service reminders",
        shortLabel: "Service Reminders",
        count: overdueReminders.length,
        href: "/reminders",
        color: "text-violet-700 dark:text-violet-400",
        bgColor: "bg-violet-50 dark:bg-violet-950/40",
      });
    }

    if (stats.inactiveCustomers > 0) {
      items.push({
        id: "inactive",
        icon: UserX,
        label: "Inactive customers",
        shortLabel: "Inactive Customers",
        count: stats.inactiveCustomers,
        href: "/customers",
        color: "text-slate-700 dark:text-slate-400",
        bgColor: "bg-slate-50 dark:bg-slate-900/40",
      });
    }

    return items;
  }, [
    stats.pendingPayments,
    stats.inactiveCustomers,
    scopedJobCards,
    parts,
    scopedReminders,
  ]);

  const revenueYesterday = useMemo(() => {
    const todayStart = daysAgoMidnight(0);
    const yesterdayStart = daysAgoMidnight(1);
    const scoped = filterInvoicesByBranch(invoices, jobCards, selectedBranchId);
    return scoped.reduce(
      (sum, inv) =>
        sum +
        inv.payments
          .filter((p) => {
            const d = new Date(p.paidAt);
            return d >= yesterdayStart && d < todayStart;
          })
          .reduce((s, p) => s + p.amount, 0),
      0
    );
  }, [invoices, jobCards, selectedBranchId]);

  const dailyRevenueTrend = useMemo(() => {
    if (stats.dailyRevenue <= 0 || revenueYesterday <= 0) return undefined;
    return {
      value: Math.abs(
        Math.round(((stats.dailyRevenue - revenueYesterday) / revenueYesterday) * 100)
      ),
      isPositive: stats.dailyRevenue >= revenueYesterday,
      label: "vs yesterday",
    };
  }, [stats.dailyRevenue, revenueYesterday]);

  const technicianStats = useMemo(() => {
    if (!user?.id) return { assigned: 0, inProgress: 0, completed: 0 };
    const todayStart = daysAgoMidnight(0);
    const mine = scopedJobCards.filter((j) => j.mechanicId === user.id);
    return {
      assigned: mine.filter(
        (j) =>
          Boolean(j.mechanicId) &&
          !["DELIVERED", "CANCELLED", "READY"].includes(j.status)
      ).length,
      inProgress: mine.filter((j) => FUNNEL_IN_PROGRESS.includes(j.status)).length,
      completed: mine.filter((j) => {
        if (j.status !== "DELIVERED") return false;
        const end = j.actualDelivery ? new Date(j.actualDelivery) : new Date(j.updatedAt);
        return end >= todayStart;
      }).length,
    };
  }, [scopedJobCards, user?.id]);

  const compactAlertLabel = (id: string, shortLabel: string) => {
    const labels: Record<string, string> = {
      overdue: "Overdue",
      stock: "Low Stock",
      payments: "Pending",
      reminders: "Reminders",
      inactive: "Inactive",
    };
    return labels[id] ?? shortLabel;
  };

  const alertCardClassName =
    "group flex min-w-0 w-full items-center gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-2 text-left shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:border-primary/50 cursor-pointer active:scale-[0.98]";

  const mobileAlertFilterMap: Record<string, string> = {
    overdue: DASHBOARD_FILTER.OVERDUE,
    stock: DASHBOARD_FILTER.LOW_STOCK,
    payments: DASHBOARD_FILTER.PENDING_PAYMENT,
    reminders: DASHBOARD_FILTER.DUE_SOON,
    inactive: DASHBOARD_FILTER.INACTIVE,
  };

  const handleMobileAlertClick = (alertId: string, href: string) => {
    const filter = mobileAlertFilterMap[alertId];
    if (filter) setActiveFilter(filter);
    router.push(href);
  };

  const branchNameById = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  const dashboardStoresReady = useDashboardStoresReady();
  const reduceMotion = useReducedMotion();

  if (!dashboardStoresReady) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-md:pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      {/* ——— Mobile-only layout ——— */}
      <div className="md:hidden space-y-3">
      <div>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span>
            Viewing:{" "}
            <span className="font-medium text-foreground">{viewingLabel}</span>
          </span>
          <span className="text-muted-foreground/70">&middot;</span>
          <time dateTime={new Date().toISOString().slice(0, 10)} className="tabular-nums">
            {formatDate(new Date())}
          </time>
        </p>
      </div>

      {alerts.length > 0 &&
        (reduceMotion ? (
          <div className="grid grid-cols-2 gap-2">
            {alerts.map((alert) => {
              const borderClassMap: Record<string, string> = {
                overdue: "border-red-300 dark:border-red-800/70 hover:border-red-500",
                stock: "border-amber-300 dark:border-amber-800/70 hover:border-amber-500",
                payments: "border-orange-300 dark:border-orange-800/70 hover:border-orange-500",
                reminders: "border-violet-300 dark:border-violet-800/70 hover:border-violet-500",
                inactive: "border-slate-300 dark:border-slate-800/70 hover:border-slate-500",
              };
              const iconBgClassMap: Record<string, string> = {
                overdue: "bg-red-100/80 dark:bg-red-900/50",
                stock: "bg-amber-100/80 dark:bg-amber-900/50",
                payments: "bg-orange-100/80 dark:bg-orange-900/50",
                reminders: "bg-violet-100/80 dark:bg-violet-900/50",
                inactive: "bg-slate-200/80 dark:bg-slate-800/50",
              };
              const borderClass = borderClassMap[alert.id] ?? "border-border/70";
              const iconBgClass = iconBgClassMap[alert.id] ?? alert.bgColor;
              return (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => handleMobileAlertClick(alert.id, alert.href)}
                  className={`group flex min-w-0 w-full items-center gap-2 rounded-lg border ${borderClass} ${alert.bgColor} px-2.5 py-2 text-left shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer active:scale-[0.98]`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconBgClass}`}
                  >
                    <alert.icon className={`w-3.5 h-3.5 ${alert.color}`} />
                  </div>
                  <p className="min-w-0 flex-1 text-left text-xs font-semibold leading-snug">
                    <span className={alert.color}>{alert.count}</span>{" "}
                    <span className="text-foreground">
                      {compactAlertLabel(alert.id, alert.shortLabel)}
                    </span>
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <motion.div
            variants={alertStaggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-2"
          >
            {alerts.map((alert) => {
              const borderClassMap: Record<string, string> = {
                overdue: "border-red-300 dark:border-red-800/70 hover:border-red-500",
                stock: "border-amber-300 dark:border-amber-800/70 hover:border-amber-500",
                payments: "border-orange-300 dark:border-orange-800/70 hover:border-orange-500",
                reminders: "border-violet-300 dark:border-violet-800/70 hover:border-violet-500",
                inactive: "border-slate-300 dark:border-slate-800/70 hover:border-slate-500",
              };
              const iconBgClassMap: Record<string, string> = {
                overdue: "bg-red-100/80 dark:bg-red-900/50",
                stock: "bg-amber-100/80 dark:bg-amber-900/50",
                payments: "bg-orange-100/80 dark:bg-orange-900/50",
                reminders: "bg-violet-100/80 dark:bg-violet-900/50",
                inactive: "bg-slate-200/80 dark:bg-slate-800/50",
              };
              const borderClass = borderClassMap[alert.id] ?? "border-border/70";
              const iconBgClass = iconBgClassMap[alert.id] ?? alert.bgColor;
              return (
                <motion.button
                  key={alert.id}
                  type="button"
                  variants={alertStaggerItem}
                  onClick={() => handleMobileAlertClick(alert.id, alert.href)}
                  whileTap={{ scale: 0.98 }}
                  className={`group flex min-w-0 w-full items-center gap-2 rounded-lg border ${borderClass} ${alert.bgColor} px-2.5 py-2 text-left shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer active:scale-[0.98]`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconBgClass}`}
                  >
                    <alert.icon className={`w-3.5 h-3.5 ${alert.color}`} />
                  </div>
                  <p className="min-w-0 flex-1 text-left text-xs font-semibold leading-snug">
                    <span className={alert.color}>{alert.count}</span>{" "}
                    <span className="text-foreground">
                      {compactAlertLabel(alert.id, alert.shortLabel)}
                    </span>
                  </p>
                </motion.button>
              );
            })}
          </motion.div>
        ))}

      {todaysBookingReservations.length > 0 && (
        <Card className="border-primary/30 bg-primary/5 shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-2">
              <Bell className="h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm font-medium">
                Today&apos;s Bookings ({todaysBookingReservations.length})
              </p>
            </div>
            <Button size="sm" className="shrink-0" asChild>
              <Link href="/bookings">View list</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Today's Jobs — operations first */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-2.5 sm:px-5 sm:py-3">
          <CardTitle className="text-sm font-semibold sm:text-base">Today&apos;s Jobs</CardTitle>
          <Button variant="link" className="h-auto p-0 text-emerald-600 text-xs sm:text-sm" asChild>
            <Link href="/job-cards">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-4 pt-0 pb-3 sm:px-5 sm:pb-4">
          <StaggerGrid className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {(
              dashboardView === "technician"
                ? [
                    { label: "Assigned", value: technicianStats.assigned },
                    { label: "In Progress", value: technicianStats.inProgress },
                    { label: "Done", value: technicianStats.completed },
                    { label: "Total", value: todaysFunnel.total },
                  ]
                : [
                    { label: "Total", value: todaysFunnel.total },
                    { label: "Assigned", value: todaysFunnel.assigned },
                    { label: "Active", value: todaysFunnel.inProgress },
                    { label: "Done", value: todaysFunnel.completed },
                  ]
            ).map((tile) => (
              <div
                key={tile.label}
                className="flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg border border-border/50 bg-muted/30 px-1 py-2 text-center sm:min-h-[3.75rem]"
              >
                <p className="text-[9px] font-medium text-muted-foreground sm:text-[10px]">
                  {tile.label}
                </p>
                <p className="mt-0.5 text-base font-bold tabular-nums sm:text-lg">{tile.value}</p>
              </div>
            ))}
          </StaggerGrid>
        </CardContent>
      </Card>

      {/* Quick actions — 2×2 grid */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Quick actions
        </p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className={`border shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer active:scale-[0.98] ${action.bgClass}`}>
                <CardContent className="flex items-center gap-2 p-2 sm:p-2.5">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${action.iconBgClass}`}>
                    <action.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className={`min-w-0 flex-1 text-xs font-semibold leading-tight sm:text-sm ${action.textClass}`}>
                    {action.label}
                  </span>
                  <Plus className={`ml-auto h-3 w-3 shrink-0 ${action.plusClass}`} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Revenue — fixed 4-card grid */}
      {dashboardView !== "technician" && (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Revenue
        </p>
        <StaggerGrid className="grid grid-cols-2 gap-2 items-stretch">
          <KPICard
            size="compact"
            surface="minimal"
            tone="emerald"
            title="Revenue"
            value={formatCurrency(stats.dailyRevenue)}
            isEmpty={stats.dailyRevenue === 0}
            emptyLabel="No revenue today"
            emptyHint="Revenue will appear after first invoice"
            icon={IndianRupee}
            trend={dailyRevenueTrend}
            titleClassName="text-[11px] leading-tight"
            valueClassName="text-base sm:text-lg tabular-nums"
          />
          <KPICard
            size="compact"
            surface="minimal"
            tone="amber"
            title="Pending"
            value={stats.pendingPayments}
            isEmpty={stats.pendingPayments === 0}
            emptyLabel="All clear"
            emptyHint="No pending collections"
            icon={AlertCircle}
            titleClassName="text-[11px] leading-tight"
            valueClassName="text-base sm:text-lg tabular-nums"
          />
          <KPICard
            size="compact"
            surface="minimal"
            tone="blue"
            title="Profit"
            value={formatCurrency(stats.netProfitToday)}
            isEmpty={stats.netProfitToday === 0}
            emptyLabel="No profit today"
            icon={IndianRupee}
            titleClassName="text-[11px] leading-tight"
            valueClassName="text-base sm:text-lg tabular-nums"
          />
          <KPICard
            size="compact"
            surface="minimal"
            tone="rose"
            title="Expenses"
            value={formatCurrency(stats.totalExpensesToday)}
            isEmpty={stats.totalExpensesToday === 0}
            emptyLabel="No expenses today"
            subtitle="cash paid"
            icon={TrendingDown}
            titleClassName="text-[11px] leading-tight"
            valueClassName="text-base sm:text-lg tabular-nums"
          />
        </StaggerGrid>
      </div>
      )}

      {/* Technician focus KPIs */}
      {dashboardView === "technician" && (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          My work
        </p>
        <StaggerGrid className="grid grid-cols-3 gap-2">
          <KPICard
            size="compact"
            surface="minimal"
            tone="blue"
            title="Assigned"
            value={technicianStats.assigned}
            icon={ClipboardList}
            titleClassName="text-[11px] leading-tight"
            valueClassName="text-base sm:text-lg tabular-nums"
          />
          <KPICard
            size="compact"
            surface="minimal"
            tone="violet"
            title="In Progress"
            value={technicianStats.inProgress}
            icon={Wrench}
            titleClassName="text-[11px] leading-tight"
            valueClassName="text-base sm:text-lg tabular-nums"
          />
          <KPICard
            size="compact"
            surface="minimal"
            tone="emerald"
            title="Completed"
            value={technicianStats.completed}
            icon={CheckCircle2}
            titleClassName="text-[11px] leading-tight"
            valueClassName="text-base sm:text-lg tabular-nums"
          />
        </StaggerGrid>
      </div>
      )}

      {/* Today's activity — desktop only to reduce mobile scroll */}
      {(todaysBookingsLive.length > 0 || readyForDeliveryLive.length > 0) && (
      <div className="hidden lg:grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {todaysBookingsLive.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 sm:px-6 sm:pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold sm:text-base">Today&apos;s Bookings</CardTitle>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Job cards created today</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => {
                setActiveFilter(DASHBOARD_FILTER.TODAYS_BOOKINGS);
                router.push("/job-cards");
              }}
            >
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-4 sm:px-6 sm:pb-6">
              <div className="max-h-[min(220px,40vh)] overflow-y-auto overscroll-contain space-y-2 pr-1 [scrollbar-gutter:stable]">
                {todaysBookingsLive.map((jc) => (
                  <Link
                    key={jc.id}
                    href={`/job-cards/${jc.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-2.5 hover:bg-muted/50 sm:p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{jc.jobNumber}</span>
                        <JobCardStatusBadge status={jc.status} />
                      </div>
                      <p className="text-sm font-medium mt-0.5 truncate">{jc.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {jc.vehicleRegNumber} &middot; {jc.vehicleMakeModel}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground ml-3 shrink-0">
                      {jc.mechanicName || "Unassigned"}
                    </p>
                  </Link>
                ))}
              </div>
          </CardContent>
        </Card>
        ) : null}

        {readyForDeliveryLive.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 sm:px-6 sm:pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <CardTitle className="text-sm font-semibold sm:text-base">Ready for Delivery</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => {
                setActiveFilter(DASHBOARD_FILTER.READY_FOR_DELIVERY);
                router.push("/job-cards");
              }}
            >
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-4 sm:px-6 sm:pb-6">
              <div className="max-h-[min(220px,40vh)] overflow-y-auto overscroll-contain space-y-2 pr-1 [scrollbar-gutter:stable]">
                {readyForDeliveryLive.map((jc) => (
                  <div
                    key={jc.id}
                    className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted/50 sm:p-3"
                  >
                    <Link
                      href={`/job-cards/${jc.id}`}
                      className="flex flex-1 min-w-0 items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{jc.jobNumber}</span>
                          <JobCardStatusBadge status={jc.status} />
                        </div>
                        <p className="text-sm font-medium mt-0.5 truncate">{jc.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {jc.vehicleRegNumber} &middot; {jc.vehicleMakeModel}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground shrink-0">{jc.customerPhone}</p>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-[#25D366] hover:text-[#128C7E] hover:bg-emerald-500/10"
                      title="WhatsApp: ready for pickup"
                      onClick={() => notifyJobReadyWhatsApp(jc, businessName)}
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
          </CardContent>
        </Card>
        ) : null}
      </div>
      )}

      {/* Recent bookings */}
      {recentBookings.length > 0 && (
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 px-4 py-3 sm:px-6 sm:pb-4">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold sm:text-base">
              Recent Bookings ({recentBookings.length})
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Latest activity</p>
          </div>
          <Button variant="default" size="sm" className="h-8 shrink-0" asChild>
            <Link href="/bookings">View All</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-4 pt-0 pb-4 sm:px-6 sm:pb-6">
          <div className="md:hidden space-y-1.5">
            {recentBookings.slice(0, 8).map((jc, i) => (
              <div
                key={jc.id}
                className={cn(
                  "rounded-lg border border-border/80 p-2 text-sm",
                  i % 2 === 0 ? "bg-background" : "bg-muted/25"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-primary">
                    {jc.jobNumber}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <JobCardStatusBadge
                      status={jc.status}
                      className="whitespace-nowrap text-[10px]"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Booking actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/job-cards/${jc.id}`}>Open job card</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRecentBookingPreview(jc)}>
                          Quick view
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className="font-medium text-sm leading-tight truncate mt-0.5">
                  {jc.customerName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {jc.services[0]?.name ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {formatCurrency(jc.estimatedAmount)}
                  <span className="mx-1.5 text-border">•</span>
                  {formatDate(jobCardDeliveryAt(jc))}
                </p>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">ID</th>
                  <th className="px-3 py-3.5 align-middle font-semibold">Customer</th>
                  <th className="px-3 py-3.5 align-middle font-semibold">Service</th>
                  <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">Booking Date</th>
                  <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">Booked On</th>
                  <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">Price</th>
                  <th className="px-3 py-3.5 align-middle font-semibold min-w-[140px] w-[9rem]">Status</th>
                  <th className="px-3 py-3.5 align-middle font-semibold">Branch</th>
                  <th className="px-3 py-3.5 align-middle font-semibold text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.slice(0, 10).map((jc, i) => (
                  <tr key={jc.id} className={cnRow(i)}>
                    <td className="px-3 py-3.5 align-middle font-mono text-xs whitespace-nowrap">{jc.jobNumber}</td>
                    <td className="px-3 py-3.5 align-middle font-medium max-w-[140px]">{jc.customerName}</td>
                    <td className="px-3 py-3.5 align-middle text-muted-foreground max-w-[200px]">
                      {jc.services[0]?.name ?? "—"}
                    </td>
                    <td className="px-3 py-3.5 align-middle whitespace-nowrap text-muted-foreground">
                      {jc.expectedDelivery || jc.status === "DELIVERED"
                        ? formatDate(jobCardDeliveryAt(jc))
                        : "—"}
                    </td>
                    <td className="px-3 py-3.5 align-middle whitespace-nowrap text-muted-foreground">
                      {formatDate(jc.createdAt)}
                    </td>
                    <td className="px-3 py-3.5 align-middle whitespace-nowrap tabular-nums">
                      {formatCurrency(jc.estimatedAmount)}
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <JobCardStatusBadge status={jc.status} className="whitespace-nowrap shrink-0" />
                    </td>
                    <td className="px-3 py-3.5 align-middle text-muted-foreground max-w-[180px]">
                      {branchNameById[jc.branchId] ?? jc.branchId}
                    </td>
                    <td className="px-3 py-3.5 align-middle text-center">
                      <div className="inline-flex items-center justify-center gap-1">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                          <Link href={`/job-cards/${jc.id}`}>
                            <ClipboardList className="w-3.5 h-3.5 mr-1" />
                            Job card
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setRecentBookingPreview(jc)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Branch performance — admin only */}
      {dashboardView === "admin" && (
      <div>
        <p className="text-xs font-semibold flex items-center gap-2 mb-2 sm:text-sm sm:mb-3">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          Branch Performance (30 days)
        </p>
        <StaggerGrid className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-2">
          {branchPerformance.map(
            ({ branch, code, revenue, bookings, completed, completionRate }) => (
              <Card key={branch.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold truncate">{branch.name}</p>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{code}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:text-sm">
                    <div>
                      <p className="text-muted-foreground">Revenue</p>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(revenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bookings</p>
                      <p className="font-medium tabular-nums">{bookings}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Completed</p>
                      <p className="font-medium tabular-nums">{completed}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Completion</p>
                      <p className="font-medium text-blue-600 dark:text-blue-400 tabular-nums">
                        {completionRate}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </StaggerGrid>
      </div>
      )}

      </div>

      {/* ——— Desktop layout (unchanged classic dashboard) ——— */}
      <div className="hidden md:block space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                Viewing:{" "}
                <span className="font-medium text-foreground">{viewingLabel}</span>
              </span>
              <span className="text-muted-foreground/70">&middot;</span>
              <time dateTime={new Date().toISOString().slice(0, 10)} className="tabular-nums">
                {formatDate(new Date())}
              </time>
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link href="/quotations?new=true">
              <Button
                variant="ghost"
                className="h-10 inline-flex items-center justify-center bg-gradient-to-r from-amber-500/[0.04] to-amber-600/[0.06] border border-amber-200/80 text-amber-700 hover:bg-amber-100/50 hover:text-amber-800 hover:border-amber-400 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/30 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(245,158,11,0.08)] rounded-lg font-semibold px-4 py-2"
              >
                <FileText className="w-4 h-4 mr-1.5 text-amber-500 shrink-0" />
                <span className="leading-none">New Quotation</span>
              </Button>
            </Link>
            <Link href="/bookings/walk-in">
              <Button
                variant="ghost"
                className="h-10 inline-flex items-center justify-center bg-gradient-to-r from-violet-500/[0.04] to-violet-600/[0.06] border border-violet-200/80 text-violet-700 hover:bg-violet-100/50 hover:text-violet-800 hover:border-violet-400 dark:bg-violet-950/20 dark:border-violet-900 dark:text-violet-400 dark:hover:bg-violet-950/30 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(139,92,246,0.08)] rounded-lg font-semibold px-4 py-2"
              >
                <CalendarCheck className="w-4 h-4 mr-1.5 text-violet-500 shrink-0" />
                <span className="leading-none">New Booking</span>
              </Button>
            </Link>
            <Link href="/appointments?new=true">
              <Button
                variant="ghost"
                className="h-10 inline-flex items-center justify-center bg-gradient-to-r from-emerald-500/[0.04] to-emerald-600/[0.06] border border-emerald-200/80 text-emerald-700 hover:bg-emerald-100/50 hover:text-emerald-800 hover:border-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/30 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(16,185,129,0.08)] rounded-lg font-semibold px-4 py-2"
              >
                <Calendar className="w-4 h-4 mr-1.5 text-emerald-500 shrink-0" />
                <span className="leading-none">New Appointment</span>
              </Button>
            </Link>
            <Link href="/job-cards/new">
              <Button
                variant="default"
                className="h-10 inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(20,184,166,0.28)]"
              >
                <Plus className="w-4 h-4 mr-1 shrink-0" />
                <span className="leading-none">New Job Card</span>
              </Button>
            </Link>
          </div>
        </div>

        {alerts.length > 0 &&
          (reduceMotion ? (
            <div className="flex flex-wrap gap-2">
              {alerts.map((alert) => {
                const filterMap: Record<string, string> = {
                  overdue: DASHBOARD_FILTER.OVERDUE,
                  stock: DASHBOARD_FILTER.LOW_STOCK,
                  payments: DASHBOARD_FILTER.PENDING_PAYMENT,
                  reminders: DASHBOARD_FILTER.DUE_SOON,
                  inactive: DASHBOARD_FILTER.INACTIVE,
                };
                const filter = filterMap[alert.id];
                const borderClassMap: Record<string, string> = {
                  overdue: "border-red-300 dark:border-red-800/70 hover:border-red-500",
                  stock: "border-amber-300 dark:border-amber-800/70 hover:border-amber-500",
                  payments: "border-orange-300 dark:border-orange-800/70 hover:border-orange-500",
                  reminders: "border-violet-300 dark:border-violet-800/70 hover:border-violet-500",
                  inactive: "border-slate-300 dark:border-slate-800/70 hover:border-slate-500",
                };
                const borderClass = borderClassMap[alert.id] ?? "border-border";
                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => {
                      if (filter) setActiveFilter(filter);
                      router.push(alert.href);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${borderClass} ${alert.bgColor} cursor-pointer text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:border-primary/50`}
                  >
                    <alert.icon className={`w-4 h-4 ${alert.color}`} />
                    <span className={`text-sm font-semibold ${alert.color}`}>{alert.count}</span>
                    <span className="text-xs text-muted-foreground">{alert.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <motion.div
              variants={alertStaggerContainer}
              initial="hidden"
              animate="show"
              className="flex flex-wrap gap-2"
            >
              {alerts.map((alert) => {
                const filterMap: Record<string, string> = {
                  overdue: DASHBOARD_FILTER.OVERDUE,
                  stock: DASHBOARD_FILTER.LOW_STOCK,
                  payments: DASHBOARD_FILTER.PENDING_PAYMENT,
                  reminders: DASHBOARD_FILTER.DUE_SOON,
                  inactive: DASHBOARD_FILTER.INACTIVE,
                };
                const filter = filterMap[alert.id];
                const borderClassMap: Record<string, string> = {
                  overdue: "border-red-300 dark:border-red-800/70 hover:border-red-500",
                  stock: "border-amber-300 dark:border-amber-800/70 hover:border-amber-500",
                  payments: "border-orange-300 dark:border-orange-800/70 hover:border-orange-500",
                  reminders: "border-violet-300 dark:border-violet-800/70 hover:border-violet-500",
                  inactive: "border-slate-300 dark:border-slate-800/70 hover:border-slate-500",
                };
                const borderClass = borderClassMap[alert.id] ?? "border-border";
                return (
                  <motion.button
                    key={alert.id}
                    type="button"
                    variants={alertStaggerItem}
                    onClick={() => {
                      if (filter) setActiveFilter(filter);
                      router.push(alert.href);
                    }}
                    whileTap={{ scale: 0.99 }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${borderClass} ${alert.bgColor} cursor-pointer text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:border-primary/50`}
                  >
                    <alert.icon className={`w-4 h-4 ${alert.color}`} />
                    <span className={`text-sm font-semibold ${alert.color}`}>{alert.count}</span>
                    <span className="text-xs text-muted-foreground">{alert.label}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          ))}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Revenue &amp; collections
          </p>
          <StaggerGrid className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${sidebarCollapsed ? "xl:grid-cols-5" : "xl:grid-cols-4 2xl:grid-cols-5"}`}>
            <KPICard
              tone="emerald"
              title="Total Revenue"
              value={formatCurrency(executive.totalRevenue30d)}
              subtitle="Last 30 days"
              icon={IndianRupee}
              trend={
                executive.totalRevenue30d > 0 ? executive.revenueTrend : undefined
              }
            />
            <KPICard
              tone="emerald"
              title="Today's Revenue"
              value={formatCurrency(stats.dailyRevenue)}
              subtitle="collected"
              icon={IndianRupee}
            />
            <KPICard
              tone="blue"
              title="Net Profit Today"
              value={formatCurrency(stats.netProfitToday)}
              subtitle="revenue − expenses"
              icon={IndianRupee}
            />
            <KPICard
              tone="amber"
              title="Pending Payments"
              value={stats.pendingPayments}
              subtitle="awaiting collection"
              icon={AlertCircle}
            />
            <KPICard
              tone="rose"
              title="Expenses Today"
              value={formatCurrency(stats.totalExpensesToday)}
              subtitle="cash paid today"
              icon={TrendingDown}
            />
          </StaggerGrid>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Overview
          </p>
          <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard
              tone="emerald"
              title="Today's Bookings"
              value={todaysBookingReservations.length}
              icon={Bell}
            />
            <KPICard
              tone="blue"
              title="Upcoming Bookings"
              value={upcomingBookingReservations.length}
              icon={Calendar}
            />
            <KPICard tone="blue" title={"Today's Jobs"} value={executive.todaysJobCount} icon={Calendar} />
            <KPICard tone="amber" title="Pending Bookings" value={executive.pendingBookings} icon={Clock} />
            <KPICard
              tone="violet"
              title="Completed Services"
              value={executive.completed30d}
              subtitle="Last 30 days"
              icon={CheckCircle2}
            />
            <KPICard tone="orange" title="Average Rating" value={stats.averageRating.toFixed(1)} icon={Star} />
            <KPICard tone="blue" title="Active Customers" value={executive.activeCustomers} icon={Users} />
          </StaggerGrid>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 pb-4">
            <CardTitle className="text-base">Today&apos;s Jobs</CardTitle>
            <Button variant="link" className="h-auto p-0 text-emerald-600" asChild>
              <Link href="/job-cards">Show</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <StaggerGrid className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {(
                [
                  {
                    label: "Total",
                    value: todaysFunnel.total,
                    className:
                      "bg-slate-100/90 text-slate-900 dark:bg-slate-500/20 dark:text-slate-50 dark:ring-1 dark:ring-slate-400/30",
                  },
                  {
                    label: "Assigned",
                    value: todaysFunnel.assigned,
                    className:
                      "bg-sky-100/90 text-sky-900 dark:bg-sky-500/20 dark:text-sky-50 dark:ring-1 dark:ring-sky-400/40",
                  },
                  {
                    label: "In Progress",
                    value: todaysFunnel.inProgress,
                    className:
                      "bg-violet-100/90 text-violet-900 dark:bg-violet-500/20 dark:text-violet-50 dark:ring-1 dark:ring-violet-400/40",
                  },
                  {
                    label: "Completed",
                    value: todaysFunnel.completed,
                    className:
                      "bg-emerald-100/90 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-50 dark:ring-1 dark:ring-emerald-400/40",
                  },
                ] as const
              ).map((tile) => (
                <div
                  key={tile.label}
                  className={`flex min-h-28 flex-col items-center justify-center rounded-xl px-3 py-5 text-center ${tile.className}`}
                >
                  <p className="text-xs font-medium opacity-80 dark:opacity-90">{tile.label}</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{tile.value}</p>
                </div>
              ))}
            </StaggerGrid>
          </CardContent>
        </Card>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Operations
          </p>
          <StaggerGrid className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KPICard tone="blue" title="Cars Received" value={stats.carsReceivedToday} subtitle="today" icon={Car} />
            <KPICard tone="violet" title="Cars Delivered" value={stats.carsDeliveredToday} subtitle="today" icon={CarFront} />
            <KPICard tone="orange" title="In Progress" value={stats.inProgressServices} subtitle="services" icon={Wrench} />
            <KPICard tone="emerald" title="Active Job Cards" value={stats.activeJobCards} subtitle="in progress" icon={ClipboardList} />
            <KPICard tone="blue" title="New Customers" value={stats.newCustomersToday} subtitle="today" icon={UserPlus} />
            <KPICard tone="slate" title="Inactive Customers" value={stats.inactiveCustomers} subtitle="need follow-up" icon={UserX} />
          </StaggerGrid>
        </div>

        {(todaysBookingsLive.length > 0 || readyForDeliveryLive.length > 0) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {todaysBookingsLive.length > 0 ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base">Today&apos;s Bookings</CardTitle>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Job cards created today</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  setActiveFilter(DASHBOARD_FILTER.TODAYS_BOOKINGS);
                  router.push("/job-cards");
                }}
              >
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="max-h-[min(280px,40vh)] overflow-y-auto overscroll-contain space-y-2 pr-1 [scrollbar-gutter:stable]">
                {todaysBookingsLive.map((jc) => (
                  <Link
                    key={jc.id}
                    href={`/job-cards/${jc.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{jc.jobNumber}</span>
                        <JobCardStatusBadge status={jc.status} />
                      </div>
                      <p className="text-sm font-medium mt-0.5 truncate">{jc.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {jc.vehicleRegNumber} &middot; {jc.vehicleMakeModel}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground ml-3 shrink-0">
                      {jc.mechanicName || "Unassigned"}
                    </p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
          ) : null}

          {readyForDeliveryLive.length > 0 ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <CardTitle className="text-base">Ready for Delivery</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  setActiveFilter(DASHBOARD_FILTER.READY_FOR_DELIVERY);
                  router.push("/job-cards");
                }}
              >
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="max-h-[min(280px,40vh)] overflow-y-auto overscroll-contain space-y-2 pr-1 [scrollbar-gutter:stable]">
                {readyForDeliveryLive.map((jc) => (
                  <div
                    key={jc.id}
                    className="flex items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50"
                  >
                    <Link
                      href={`/job-cards/${jc.id}`}
                      className="flex flex-1 min-w-0 items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{jc.jobNumber}</span>
                          <JobCardStatusBadge status={jc.status} />
                        </div>
                        <p className="text-sm font-medium mt-0.5 truncate">{jc.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {jc.vehicleRegNumber} &middot; {jc.vehicleMakeModel}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground shrink-0">{jc.customerPhone}</p>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-[#25D366] hover:text-[#128C7E] hover:bg-emerald-500/10"
                      title="WhatsApp: ready for pickup"
                      onClick={() => notifyJobReadyWhatsApp(jc, businessName)}
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          ) : null}
        </div>
        )}

        {recentBookings.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 pb-4">
            <CardTitle className="text-base">Recent Bookings</CardTitle>
            <Button variant="default" size="sm" className="h-8" asChild>
              <Link href="/bookings">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">ID</th>
                    <th className="px-3 py-3.5 align-middle font-semibold">Customer</th>
                    <th className="px-3 py-3.5 align-middle font-semibold">Service</th>
                    <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">Booking Date</th>
                    <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">Booked On</th>
                    <th className="px-3 py-3.5 align-middle font-semibold whitespace-nowrap">Price</th>
                    <th className="px-3 py-3.5 align-middle font-semibold min-w-[140px] w-[9rem]">Status</th>
                    <th className="px-3 py-3.5 align-middle font-semibold">Branch</th>
                    <th className="px-3 py-3.5 align-middle font-semibold text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.slice(0, 10).map((jc, i) => (
                    <tr key={jc.id} className={cnRow(i)}>
                      <td className="px-3 py-3.5 align-middle font-mono text-xs whitespace-nowrap">{jc.jobNumber}</td>
                      <td className="px-3 py-3.5 align-middle font-medium max-w-[140px]">{jc.customerName}</td>
                      <td className="px-3 py-3.5 align-middle text-muted-foreground max-w-[200px]">
                        {jc.services[0]?.name ?? "—"}
                      </td>
                      <td className="px-3 py-3.5 align-middle whitespace-nowrap text-muted-foreground">
                        {jc.expectedDelivery || jc.status === "DELIVERED"
                          ? formatDate(jobCardDeliveryAt(jc))
                          : "—"}
                      </td>
                      <td className="px-3 py-3.5 align-middle whitespace-nowrap text-muted-foreground">
                        {formatDate(jc.createdAt)}
                      </td>
                      <td className="px-3 py-3.5 align-middle whitespace-nowrap tabular-nums">
                        {formatCurrency(jc.estimatedAmount)}
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <JobCardStatusBadge status={jc.status} className="whitespace-nowrap shrink-0" />
                      </td>
                      <td className="px-3 py-3.5 align-middle text-muted-foreground max-w-[180px]">
                        {branchNameById[jc.branchId] ?? jc.branchId}
                      </td>
                      <td className="px-3 py-3.5 align-middle text-center">
                        <div className="inline-flex items-center justify-center gap-1">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                            <Link href={`/job-cards/${jc.id}`}>
                              <ClipboardList className="w-3.5 h-3.5 mr-1" />
                              Job card
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setRecentBookingPreview(jc)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        )}

        <div>
          <p className="text-xs font-semibold flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            Branch Performance (30 days)
          </p>
          <StaggerGrid className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {branchPerformance.map(
              ({ branch, code, revenue, bookings, completed, completionRate }) => (
                <Card key={branch.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold truncate">{branch.name}</p>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">{code}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Revenue</p>
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatCurrency(revenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Bookings</p>
                        <p className="font-medium tabular-nums">{bookings}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p className="font-medium tabular-nums">{completed}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Completion</p>
                        <p className="font-medium text-blue-600 dark:text-blue-400 tabular-nums">
                          {completionRate}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </StaggerGrid>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Quick actions
          </p>
          <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { href: "/job-cards", title: "Manage Job Cards", desc: "View and assign jobs", icon: Wrench },
                { href: "/services", title: "Service Packages", desc: "Manage services", icon: Calendar },
                { href: "/customers", title: "Users", desc: "Manage customers & staff", icon: Users },
                { href: "/reports", title: "Analytics", desc: "View detailed reports", icon: BarChart3 },
              ] as const
            ).map((item) => (
              <Link key={item.href} href={item.href} className="block h-full min-h-[140px]">
                <Card className="h-full translate-y-0 transform-gpu will-change-transform transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-primary/50 cursor-pointer active:scale-[0.98]">
                  <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-3 px-5 py-8 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </StaggerGrid>
        </div>
      </div>

      <Dialog
        open={recentBookingPreview !== null}
        onOpenChange={(open) => {
          if (!open) setRecentBookingPreview(null);
        }}
      >
        <DialogContent className="max-w-md">
          {recentBookingPreview ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-base">
                  {recentBookingPreview.jobNumber}
                </DialogTitle>
                <DialogDescription className="text-left space-y-0.5">
                  <span className="block font-medium text-foreground">
                    {recentBookingPreview.customerName}
                  </span>
                  <span className="block text-sm">
                    {recentBookingPreview.vehicleRegNumber} · {recentBookingPreview.vehicleMakeModel}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <JobCardStatusBadge status={recentBookingPreview.status} />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                  <dt className="text-muted-foreground">Service</dt>
                  <dd>{recentBookingPreview.services[0]?.name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Booking date</dt>
                  <dd>
                    {recentBookingPreview.expectedDelivery ||
                    recentBookingPreview.status === "DELIVERED"
                      ? formatDate(jobCardDeliveryAt(recentBookingPreview))
                      : "—"}
                  </dd>
                  <dt className="text-muted-foreground">Booked on</dt>
                  <dd>{formatDate(recentBookingPreview.createdAt)}</dd>
                  <dt className="text-muted-foreground">Estimate</dt>
                  <dd className="tabular-nums font-medium">
                    {formatCurrency(recentBookingPreview.estimatedAmount)}
                  </dd>
                  <dt className="text-muted-foreground">Branch</dt>
                  <dd>
                    {branchNameById[recentBookingPreview.branchId] ??
                      recentBookingPreview.branchId}
                  </dd>
                </dl>
              </div>
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" asChild className="w-full sm:w-auto">
                  <Link href={`/customers/${recentBookingPreview.customerId}`}>Customer profile</Link>
                </Button>
                <Button asChild className="w-full sm:w-auto">
                  <Link href={`/job-cards/${recentBookingPreview.id}`}>Open job card</Link>
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cnRow(i: number): string {
  return i % 2 === 0 ? "border-b border-border/60 bg-background" : "border-b border-border/60 bg-muted/20";
}
