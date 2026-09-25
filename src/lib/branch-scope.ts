"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { isAllBranchesScope } from "@/lib/all-branches";
import type {
  ActivityLog,
  ActivityEntityType,
  Appointment,
  Customer,
  DashboardStats,
  Expense,
  FollowUp,
  Invoice,
  JobCard,
  ServiceReminder,
} from "@/types";
import { isInactiveCustomer, isPendingPaymentInvoice, isTodaysBookingsJob } from "@/lib/dashboard-filters";
import { recognizedExpenseAmount } from "@/lib/accounting/dashboard-metrics";
import { expensePaidAmount } from "@/lib/party/ledger-math";

/** Header branch selector: null = org-wide (all branches). */
export function useBranchScope() {
  const currentBranch = useAuthStore((s) => s.currentBranch);

  const selectedBranchId = useMemo(() => {
    if (!currentBranch || isAllBranchesScope(currentBranch)) return null;
    return currentBranch.id;
  }, [currentBranch]);

  const showBranchPicker = useMemo(
    () => !currentBranch || isAllBranchesScope(currentBranch),
    [currentBranch]
  );

  const viewingLabel = useMemo(() => {
    if (!currentBranch || isAllBranchesScope(currentBranch)) return "All branches";
    return currentBranch.name;
  }, [currentBranch]);

  return { currentBranch, selectedBranchId, showBranchPicker, viewingLabel };
}

/** Page-level branch dropdown state (pairs with header scope). */
export function useBranchPageFilter() {
  const scope = useBranchScope();
  const [pageBranchFilter, setPageBranchFilter] = useState("all");

  useEffect(() => {
    if (!scope.showBranchPicker) {
      queueMicrotask(() => setPageBranchFilter("all"));
    }
  }, [scope.showBranchPicker, scope.selectedBranchId]);

  const effectiveBranchId = useMemo(
    () =>
      resolveEffectiveBranchId(
        scope.selectedBranchId,
        scope.showBranchPicker,
        pageBranchFilter
      ),
    [scope.selectedBranchId, scope.showBranchPicker, pageBranchFilter]
  );

  return {
    ...scope,
    pageBranchFilter,
    setPageBranchFilter,
    effectiveBranchId,
  };
}

export function resolveEffectiveBranchId(
  selectedBranchId: string | null,
  showBranchPicker: boolean,
  pageBranchFilter: string
): string | null {
  if (selectedBranchId) return selectedBranchId;
  if (showBranchPicker && pageBranchFilter !== "all") return pageBranchFilter;
  return null;
}

export function filterByBranchId<T>(
  items: T[],
  getBranchId: (item: T) => string | undefined,
  branchId: string | null
): T[] {
  if (!branchId) return items;
  return items.filter((item) => getBranchId(item) === branchId);
}

/**
 * Apply global header branch scope, then optional page-level filter when the picker is shown.
 * `pageBranchFilter` is typically "all" or a branch id from a local dropdown.
 */
export function applyBranchFilters<T>(
  items: T[],
  getBranchId: (item: T) => string | undefined,
  selectedBranchId: string | null,
  showBranchPicker: boolean,
  pageBranchFilter: string
): T[] {
  let list = filterByBranchId(items, getBranchId, selectedBranchId);
  if (showBranchPicker && pageBranchFilter !== "all") {
    list = list.filter((item) => getBranchId(item) === pageBranchFilter);
  }
  return list;
}

export function buildJobBranchMap(jobCards: JobCard[]): Map<string, string> {
  return new Map(jobCards.map((j) => [j.id, j.branchId]));
}

export function invoiceBranchId(
  invoice: Invoice,
  jobBranch: Map<string, string>
): string | undefined {
  if (invoice.branchId) return invoice.branchId;
  if (!invoice.jobCardId) return undefined;
  return jobBranch.get(invoice.jobCardId);
}

export function applyInvoiceBranchFilters(
  invoices: Invoice[],
  jobCards: JobCard[],
  selectedBranchId: string | null,
  showBranchPicker: boolean,
  pageBranchFilter: string
): Invoice[] {
  const jobBranch = buildJobBranchMap(jobCards);
  const withBranch = invoices.filter((inv) => Boolean(invoiceBranchId(inv, jobBranch)));
  return applyBranchFilters(
    withBranch,
    (inv) => invoiceBranchId(inv, jobBranch),
    selectedBranchId,
    showBranchPicker,
    pageBranchFilter
  );
}

export function filterInvoicesByBranch(
  invoices: Invoice[],
  jobCards: JobCard[],
  branchId: string | null
): Invoice[] {
  if (!branchId) return invoices;
  const jobBranch = buildJobBranchMap(jobCards);
  return invoices.filter((inv) => invoiceBranchId(inv, jobBranch) === branchId);
}

export function filterAppointmentsByBranch(
  appointments: Appointment[],
  jobCards: JobCard[],
  branchId: string | null
): Appointment[] {
  if (!branchId) return appointments;
  const jobBranch = buildJobBranchMap(jobCards);
  return appointments.filter((a) => {
    if (!a.jobCardId) return true;
    return jobBranch.get(a.jobCardId) === branchId;
  });
}

export function filterFollowUpsByBranch(
  followUps: FollowUp[],
  jobCards: JobCard[],
  branchId: string | null
): FollowUp[] {
  if (!branchId) return followUps;
  return followUps.filter((fu) =>
    jobCards.some((jc) => jc.customerId === fu.customerId && jc.branchId === branchId)
  );
}

export function filterRemindersByBranch(
  reminders: ServiceReminder[],
  jobCards: JobCard[],
  branchId: string | null
): ServiceReminder[] {
  if (!branchId) return reminders;
  const jobBranch = buildJobBranchMap(jobCards);
  return reminders.filter((r) => {
    if (r.lastJobCardId) {
      const linkedBranch = jobBranch.get(r.lastJobCardId);
      // Job not in store yet (or deleted) — don't hide; use customer heuristic below
      if (linkedBranch !== undefined) return linkedBranch === branchId;
    }
    const customerAtBranch = jobCards.some(
      (jc) => jc.customerId === r.customerId && jc.branchId === branchId
    );
    if (customerAtBranch) return true;
    // No job-card link resolved: keep visible so seed / payment rows aren't blanked out
    // when job cards are still loading or the linked job is missing.
    if (r.lastJobCardId && jobBranch.size === 0) return true;
    if (!r.lastJobCardId) return true;
    return false;
  });
}

const ACTIVITY_ENTITY_TYPES_WITH_BRANCH: ActivityEntityType[] = [
  "JOB_CARD",
  "INVOICE",
  "EXPENSE",
];

export function filterActivityByBranch(
  logs: ActivityLog[],
  jobCards: JobCard[],
  invoices: Invoice[],
  expenses: Expense[],
  branchId: string | null
): ActivityLog[] {
  if (!branchId) return logs;
  const jobBranch = buildJobBranchMap(jobCards);
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const expenseById = new Map(expenses.map((e) => [e.id, e]));

  return logs.filter((log) => {
    if (!ACTIVITY_ENTITY_TYPES_WITH_BRANCH.includes(log.entityType)) return true;
    switch (log.entityType) {
      case "JOB_CARD": {
        const jobBranchId = jobBranch.get(log.entityId);
        // Keep when linked job is not loaded yet (avoid empty Activity page).
        return jobBranchId == null || jobBranchId === branchId;
      }
      case "INVOICE": {
        const inv = invoiceById.get(log.entityId);
        if (!inv) return true;
        return invoiceBranchId(inv, jobBranch) === branchId;
      }
      case "EXPENSE": {
        const expense = expenseById.get(log.entityId);
        if (!expense) return true;
        return expense.branchId === branchId;
      }
      default:
        return true;
    }
  });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameCalendarDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

/** Recompute dashboard KPIs from branch-scoped operational data. */
export function computeBranchScopedDashboardStats(
  jobCards: JobCard[],
  invoices: Invoice[],
  expenses: Expense[],
  customers: Customer[],
  branchId: string | null,
  fallback: DashboardStats
): DashboardStats {
  const jobs = filterByBranchId(jobCards, (j) => j.branchId, branchId);
  const jobBranch = buildJobBranchMap(jobCards);
  const scopedInvoices = branchId
    ? invoices.filter((inv) => invoiceBranchId(inv, jobBranch) === branchId)
    : invoices;
  const scopedExpenses = filterByBranchId(expenses, (e) => e.branchId, branchId);
  const today = startOfToday();

  const carsReceivedToday = jobs.filter(
    (j) => isTodaysBookingsJob(j) && j.status !== "CANCELLED"
  ).length;

  const carsDeliveredToday = jobs.filter(
    (j) =>
      j.status === "DELIVERED" &&
      (j.actualDelivery
        ? isSameCalendarDay(j.actualDelivery, today)
        : isSameCalendarDay(j.updatedAt, today))
  ).length;

  const inProgressServices = jobs.filter(
    (j) => !["DELIVERED", "CANCELLED", "READY"].includes(j.status)
  ).length;

  const activeJobCards = inProgressServices;

  const dailyRevenue = scopedInvoices
    .filter((inv) => inv.payments.some((p) => isSameCalendarDay(p.paidAt, today)))
    .reduce(
      (sum, inv) =>
        sum +
        inv.payments
          .filter((p) => isSameCalendarDay(p.paidAt, today))
          .reduce((s, p) => s + p.amount, 0),
      0
    );

  // Today's cash-paid expenses (same cash basis as the Expenses page KPI).
  const totalExpensesToday = scopedExpenses
    .filter((e) => isSameCalendarDay(e.date, today))
    .reduce((s, e) => s + expensePaidAmount(e), 0);

  const pendingPayments = new Set(
    scopedInvoices.filter(isPendingPaymentInvoice).map((inv) => inv.customerId)
  ).size;

  const jobCustomerIds = new Set(jobs.map((j) => j.customerId));
  const newCustomersToday = customers.filter(
    (c) => jobCustomerIds.has(c.id) && jobs.some((j) => j.customerId === c.id && isTodaysBookingsJob(j))
  ).length;

  const inactiveCustomers = customers.filter(
    (c) => jobCustomerIds.has(c.id) && isInactiveCustomer(c)
  ).length;

  return {
    ...fallback,
    carsReceivedToday,
    carsDeliveredToday,
    inProgressServices,
    activeJobCards,
    dailyRevenue,
    totalExpensesToday,
    netProfitToday: dailyRevenue - totalExpensesToday,
    pendingPayments,
    newCustomersToday,
    inactiveCustomers,
    todaysBookings: jobs.filter(isTodaysBookingsJob),
    readyForDelivery: jobs.filter((j) => j.status === "READY"),
  };
}

/** Label for summaries: page filter when org-wide, otherwise header branch name. */
export function resolveBranchScopeLabel(
  showBranchPicker: boolean,
  viewingLabel: string,
  pageBranchFilter: string,
  branches: { id: string; name: string }[]
): string {
  if (!showBranchPicker) return viewingLabel;
  if (pageBranchFilter === "all") return "All branches";
  return branches.find((b) => b.id === pageBranchFilter)?.name ?? pageBranchFilter;
}
