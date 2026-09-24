"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { useReminderStore } from "@/store/reminder-store";
import { useBranchScope } from "@/lib/branch-scope";
import { useScopedReminders } from "@/hooks/use-scoped-data";
import { useSettingsStore } from "@/store/settings-store";
import { useNotificationStore } from "@/store/notification-store";
import { useAutoReminderWhatsApp } from "@/hooks/use-auto-reminder-whatsapp";
import { ensureDomainResources } from "@/lib/domain-data-loader";
import { ApiError } from "@/lib/api-client";
import {
  buildPaymentPendingReminderWhatsAppMessage,
  buildServiceReminderWhatsAppMessage,
  publicCustomerLedgerShareUrl,
  publicInvoiceShareUrl,
} from "@/lib/whatsapp-customer-messages";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { isDueSoonReminder } from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  REMINDER_FREQUENCY_LABELS,
  SCHEDULABLE_REMINDER_FREQUENCIES,
  nextDueDate,
  normalizeReminderKind,
} from "@/lib/reminder-schedule";
import type {
  ReminderFrequency,
  ReminderStatus,
  ReminderType,
  ServiceReminder,
} from "@/types";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { PageSkeleton, RefreshingBar } from "@/components/shared/skeleton-loader";

function reminderWasSent(r: ServiceReminder): boolean {
  return Boolean(r.lastMessageSentAt || r.whatsappSent);
}

const SERVICE_TYPE_LABELS: Record<ReminderType, string> = {
  GENERAL_SERVICE: "General Service",
  OIL_CHANGE: "Oil Change",
  BRAKE_INSPECTION: "Brake Inspection",
  TIRE_ROTATION: "Tire Rotation",
  AC_SERVICE: "AC Service",
  BATTERY_CHECK: "Battery Check",
  INSURANCE: "Insurance",
  PUC: "PUC",
  PPF_MAINTENANCE: "PPF Maintenance",
  CERAMIC_MAINTENANCE: "Ceramic Maintenance",
};

const STATUS_CONFIG: Record<ReminderStatus, { label: string; color: string }> = {
  OVERDUE: {
    label: "Overdue",
    color: "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900",
  },
  DUE: {
    label: "Due Now",
    color:
      "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900",
  },
  UPCOMING: {
    label: "Upcoming",
    color:
      "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900",
  },
  COMPLETED: {
    label: "Completed",
    color:
      "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-900",
  },
  DISMISSED: {
    label: "Dismissed",
    color:
      "text-gray-700 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-950/30 dark:border-gray-800",
  },
};

const FALLBACK_STATUS_CONFIG = {
  label: "Active",
  color:
    "text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-900/40 dark:border-slate-800",
};

const ALL_STATUSES: ReminderStatus[] = [
  "OVERDUE",
  "DUE",
  "UPCOMING",
  "COMPLETED",
  "DISMISSED",
];

const ALL_FREQUENCIES: ReminderFrequency[] = [
  ...SCHEDULABLE_REMINDER_FREQUENCIES,
  "CUSTOM",
];

function serviceCategoryLabel(r: ServiceReminder): string {
  if (r.serviceCategoryName?.trim()) return r.serviceCategoryName.trim();
  return SERVICE_TYPE_LABELS[r.type] ?? r.type;
}

function displayNextDue(r: ServiceReminder): string {
  if (r.nextDueDate) return formatDate(r.nextDueDate);
  if (r.frequency !== "CUSTOM") {
    try {
      return formatDate(nextDueDate(r.dueDate, r.frequency));
    } catch {
      return "—";
    }
  }
  return "—";
}

function StatusBadge({ status }: { status?: string }) {
  const cfg =
    status && Object.prototype.hasOwnProperty.call(STATUS_CONFIG, status)
      ? STATUS_CONFIG[status as ReminderStatus]
      : FALLBACK_STATUS_CONFIG;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

function WhatsAppCell({
  reminder,
  enabled,
  onSend,
}: {
  reminder: ServiceReminder;
  enabled: boolean;
  onSend: (r: ServiceReminder) => void;
}) {
  const sent = reminderWasSent(reminder);
  const closed = reminder.status === "COMPLETED" || reminder.status === "DISMISSED";
  if (closed) {
    return (
      <span className="text-xs text-muted-foreground">
        {sent ? `Sent${reminder.lastMessageSentAt ? ` · ${formatDate(reminder.lastMessageSentAt)}` : ""}` : "—"}
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1 items-start">
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={!enabled}
        title={enabled ? undefined : "Enable WhatsApp reminders in Settings → Reminders"}
        onClick={(e) => {
          e.stopPropagation();
          onSend(reminder);
        }}
      >
        <WhatsAppIcon className="w-3.5 h-3.5 mr-1.5 text-[#25D366]" />
        {sent ? "Resend" : "Send"}
      </Button>
      {sent && (
        <span className="inline-flex items-center gap-1 text-[10px] text-violet-700 dark:text-violet-300">
          <Send className="w-3 h-3" />
          Sent
          {reminder.lastMessageSentAt ? ` · ${formatDate(reminder.lastMessageSentAt)}` : ""}
        </span>
      )}
    </div>
  );
}

function RowActions({
  reminder,
  onComplete,
  onDismiss,
}: {
  reminder: ServiceReminder;
  onComplete: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  if (reminder.status === "COMPLETED" || reminder.status === "DISMISSED") {
    return reminder.status === "COMPLETED" ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Done
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">Dismissed</span>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
        onClick={(e) => {
          e.stopPropagation();
          onComplete(reminder.id);
        }}
      >
        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
        Done
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        title="Dismiss"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(reminder.id);
        }}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

type KindTab = "service" | "payment";

export default function RemindersPage() {
  const storesReady = useDashboardStoresReady();
  useAutoReminderWhatsApp();
  useEffect(() => {
    void ensureDomainResources(["serviceReminders", "jobCards", "invoices", "appSettings"]);
  }, []);
  const reminders = useScopedReminders();
  const { viewingLabel } = useBranchScope();
  const updateReminder = useReminderStore((s) => s.updateReminder);
  const whatsappReminderEnabled = useSettingsStore((s) => s.whatsappReminderEnabled);
  const businessName = useSettingsStore((s) => s.businessName);
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);

  const [kindTab, setKindTab] = useState<KindTab>("service");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const serviceReminders = useMemo(
    () => reminders.filter((r) => normalizeReminderKind(r.kind) === "SERVICE"),
    [reminders]
  );
  const paymentReminders = useMemo(
    () => reminders.filter((r) => normalizeReminderKind(r.kind) === "PAYMENT"),
    [reminders]
  );

  const kindList = kindTab === "service" ? serviceReminders : paymentReminders;

  const counts = useMemo(() => {
    const open = kindList.filter((r) => r.status !== "COMPLETED" && r.status !== "DISMISSED");
    return {
      open: open.length,
      overdue: kindList.filter((r) => r.status === "OVERDUE").length,
      due: kindList.filter((r) => r.status === "DUE").length,
      upcoming: kindList.filter((r) => r.status === "UPCOMING").length,
      sent: kindList.filter(reminderWasSent).length,
      completed: kindList.filter((r) => r.status === "COMPLETED").length,
      service: serviceReminders.filter((r) => r.status !== "COMPLETED" && r.status !== "DISMISSED")
        .length,
      payment: paymentReminders.filter((r) => r.status !== "COMPLETED" && r.status !== "DISMISSED")
        .length,
    };
  }, [kindList, serviceReminders, paymentReminders]);

  const filtered = useMemo(() => {
    let list = [...kindList];

    if (statusFilter === "active") {
      list = list.filter((r) => r.status !== "COMPLETED" && r.status !== "DISMISSED");
    } else if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }

    if (frequencyFilter !== "all") {
      list = list.filter((r) => r.frequency === frequencyFilter);
    }

    if (dateFrom) {
      list = list.filter((r) => r.dueDate.slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((r) => r.dueDate.slice(0, 10) <= dateTo);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.customerName,
          r.customerPhone,
          r.vehicleRegNumber,
          r.vehicleMakeModel,
          serviceCategoryLabel(r),
          r.invoiceNumber,
          r.notes,
          REMINDER_FREQUENCY_LABELS[r.frequency],
          r.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (activeFilter === DASHBOARD_FILTER.DUE_SOON && kindTab === "service") {
      // Match the dashboard badge definition exactly: only OVERDUE and DUE reminders
      // (not UPCOMING — those are not yet counted in the dashboard alert).
      list = list.filter((r) => r.status === "OVERDUE" || r.status === "DUE");
    }

    return list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [
    kindList,
    statusFilter,
    frequencyFilter,
    dateFrom,
    dateTo,
    search,
    activeFilter,
    kindTab,
  ]);

  const handleMarkComplete = (id: string) => {
    const current = useReminderStore.getState().reminders.find((r) => r.id === id);
    if (!current || current.status === "COMPLETED") return;
    toast.success("Reminder marked as completed");
    void updateReminder(id, { status: "COMPLETED" as ReminderStatus }).catch(() => {
      toast.error("Could not save reminder", { description: "Please try again." });
    });
  };

  const handleDismiss = (id: string) => {
    const current = useReminderStore.getState().reminders.find((r) => r.id === id);
    if (!current || current.status === "DISMISSED") return;
    toast.info("Reminder dismissed");
    void updateReminder(id, { status: "DISMISSED" as ReminderStatus }).catch(() => {
      toast.error("Could not dismiss reminder", { description: "Please try again." });
    });
  };

  const markSent = (reminder: ServiceReminder) => {
    const now = new Date().toISOString();
    void updateReminder(reminder.id, {
      whatsappSent: true,
      lastMessageSentAt: now,
    });
  };

  const handleSendServiceWhatsApp = async (reminder: ServiceReminder) => {
    if (!whatsappReminderEnabled) {
      toast.error("WhatsApp reminders are off", {
        description: "Turn on “WhatsApp Reminders” under Settings → Reminders.",
      });
      return;
    }
    const message = buildServiceReminderWhatsAppMessage(reminder);
    try {
      await sendCustomerWhatsApp(reminder.customerPhone, message);
      markSent(reminder);
      toast.success("WhatsApp reminder sent", {
        description: `Sent to ${reminder.customerName} at ${reminder.customerPhone}`,
      });
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: "Service reminder via WhatsApp",
        message: `${reminder.customerName} — ${reminder.vehicleRegNumber}`,
        href: "/reminders",
      });
    } catch (e) {
      if (isWhatsAppNotConfiguredError(e)) {
        openWhatsAppComposer(reminder.customerPhone, message);
        markSent(reminder);
        toast.info("WhatsApp opened", {
          description: "Finish sending in the app. Reminder marked as sent.",
        });
        useNotificationStore.getState().addNotification({
          type: "whatsapp_sent",
          title: "Reminder — WhatsApp composer",
          message: `${reminder.customerName} — ${reminder.vehicleRegNumber}`,
          href: "/reminders",
        });
        return;
      }
      toast.error("WhatsApp failed", {
        description: e instanceof ApiError ? e.message : "Could not send reminder",
      });
    }
  };

  const handleSendPaymentWhatsApp = async (reminder: ServiceReminder) => {
    if (!whatsappReminderEnabled) {
      toast.error("WhatsApp reminders are off", {
        description: "Turn on “WhatsApp Reminders” under Settings → Reminders.",
      });
      return;
    }
    const amount = reminder.outstandingAmount ?? 0;
    const message = buildPaymentPendingReminderWhatsAppMessage({
      pendingAmount: amount,
      statementUrl: publicCustomerLedgerShareUrl(reminder.customerId),
      businessName: businessName || "MY DETAIL OS",
      mode: "singleInvoice",
      invoiceUrl: reminder.invoiceId ? publicInvoiceShareUrl(reminder.invoiceId) : undefined,
      invoiceNumber: reminder.invoiceNumber,
    });
    try {
      await sendCustomerWhatsApp(reminder.customerPhone, message);
      markSent(reminder);
      toast.success("Payment reminder sent", {
        description: `Sent to ${reminder.customerName} at ${reminder.customerPhone}`,
      });
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: "Payment reminder via WhatsApp",
        message: `${reminder.customerName} — ${reminder.invoiceNumber ?? "invoice"}`,
        href: "/reminders",
      });
    } catch (e) {
      if (isWhatsAppNotConfiguredError(e)) {
        openWhatsAppComposer(reminder.customerPhone, message);
        markSent(reminder);
        toast.info("WhatsApp opened", {
          description: "Finish sending in the app. Reminder marked as sent.",
        });
        return;
      }
      toast.error("WhatsApp failed", {
        description: e instanceof ApiError ? e.message : "Could not send reminder",
      });
    }
  };

  const clearFilters = () => {
    setStatusFilter("active");
    setFrequencyFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const filterBar = (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Frequency</Label>
          <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All frequencies</SelectItem>
              {ALL_FREQUENCIES.map((f) => (
                <SelectItem key={f} value={f}>
                  {REMINDER_FREQUENCY_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Due from</Label>
          <Input
            type="date"
            className="h-9 date-input-icon-end pr-9"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Due to</Label>
          <Input
            type="date"
            className="h-9 date-input-icon-end pr-9"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-8"
              placeholder={
                kindTab === "service"
                  ? "Customer, vehicle, category…"
                  : "Customer, invoice…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {kindList.length}{" "}
          {kindTab === "service" ? "service" : "payment"} reminders
        </p>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>
    </div>
  );

  const emptyState = (
    <div className="py-10 text-center">
      <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
      <p className="text-muted-foreground">
        {kindTab === "service"
          ? "No service reminders match these filters."
          : "No payment reminders match these filters."}
      </p>
    </div>
  );

  if (!storesReady && reminders.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <RefreshingBar show={!storesReady} />
      <PageHeader
        title="Reminders"
        description={`Service follow-ups and pending payment reminders for ${viewingLabel}.`}
      />

      {activeFilter === DASHBOARD_FILTER.DUE_SOON && (
        <FilterBanner
          message="Showing overdue and due service reminders"
          onDismiss={() => setActiveFilter(null)}
        />
      )}

      {!whatsappReminderEnabled && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          WhatsApp reminder sending is disabled in{" "}
          <Link href="/settings" className="font-medium underline underline-offset-2">
            Settings → Reminders
          </Link>
          . Enable “WhatsApp Reminders” to send messages from this page.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.overdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-900">
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.due}</p>
              <p className="text-xs text-muted-foreground">Due Now</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-900">
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.upcoming}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-violet-200 dark:border-violet-900">
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Send className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.sent}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="!flex !items-center gap-3 !px-4 !py-5 sm:!px-5 sm:!py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={kindTab}
        onValueChange={(v) => {
          setKindTab(v as KindTab);
          setSearch("");
        }}
      >
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="service">Service ({counts.service})</TabsTrigger>
          <TabsTrigger value="payment">Payment ({counts.payment})</TabsTrigger>
        </TabsList>

        <TabsContent value="service" className="mt-4 space-y-4">
          {filterBar}
          <DataTable
            data={filtered}
            hideSearch
            defaultSortKey="dueDate"
            defaultSortDir="asc"
            pageSize={12}
            emptyContent={emptyState}
            columns={[
              {
                key: "customerName",
                label: "Customer",
                sortable: true,
                render: (r) => (
                  <div>
                    <p className="font-medium">{r.customerName}</p>
                    <p className="text-xs text-muted-foreground">{r.customerPhone}</p>
                  </div>
                ),
              },
              {
                key: "vehicleRegNumber",
                label: "Vehicle",
                sortable: true,
                render: (r) => (
                  <div>
                    {r.vehicleId ? (
                      <Link
                        href={`/vehicles/${r.vehicleId}`}
                        className="font-medium hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.vehicleRegNumber || "—"}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.vehicleRegNumber || "—"}</span>
                    )}
                    <p className="text-xs text-muted-foreground">{r.vehicleMakeModel}</p>
                  </div>
                ),
              },
              {
                key: "type",
                label: "Service Category",
                sortable: true,
                sortValue: (r) => serviceCategoryLabel(r),
                render: (r) => (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{serviceCategoryLabel(r)}</span>
                    {r.isHighEndService && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <Sparkles className="h-3 w-3" />
                        High-end
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "frequency",
                label: "Frequency",
                sortable: true,
                render: (r) => REMINDER_FREQUENCY_LABELS[r.frequency] ?? r.frequency,
              },
              {
                key: "dueDate",
                label: "Due Date",
                sortable: true,
                render: (r) => formatDate(r.dueDate),
              },
              {
                key: "nextDueDate",
                label: "Next Due",
                sortable: true,
                sortValue: (r) => r.nextDueDate ?? r.dueDate,
                render: (r) => displayNextDue(r),
              },
              {
                key: "status",
                label: "Status",
                sortable: true,
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "whatsapp",
                label: "WhatsApp",
                render: (r) => (
                  <WhatsAppCell
                    reminder={r}
                    enabled={whatsappReminderEnabled}
                    onSend={handleSendServiceWhatsApp}
                  />
                ),
              },
              {
                key: "actions",
                label: "",
                render: (r) => (
                  <RowActions
                    reminder={r}
                    onComplete={handleMarkComplete}
                    onDismiss={handleDismiss}
                  />
                ),
              },
            ]}
            renderMobileCard={(r) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.customerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.vehicleRegNumber} · {serviceCategoryLabel(r)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {REMINDER_FREQUENCY_LABELS[r.frequency]} · Due {formatDate(r.dueDate)} · Next{" "}
                  {displayNextDue(r)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <WhatsAppCell
                    reminder={r}
                    enabled={whatsappReminderEnabled}
                    onSend={handleSendServiceWhatsApp}
                  />
                  <RowActions
                    reminder={r}
                    onComplete={handleMarkComplete}
                    onDismiss={handleDismiss}
                  />
                </div>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="payment" className="mt-4 space-y-4">
          {filterBar}
          <DataTable
            data={filtered}
            hideSearch
            defaultSortKey="dueDate"
            defaultSortDir="asc"
            pageSize={12}
            emptyContent={emptyState}
            columns={[
              {
                key: "customerName",
                label: "Customer",
                sortable: true,
                render: (r) => (
                  <div>
                    <p className="font-medium">{r.customerName}</p>
                    <p className="text-xs text-muted-foreground">{r.customerPhone}</p>
                  </div>
                ),
              },
              {
                key: "invoiceNumber",
                label: "Invoice Number",
                sortable: true,
                render: (r) =>
                  r.invoiceId ? (
                    <Link
                      href={`/billing/${r.invoiceId}`}
                      className="font-medium hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.invoiceNumber || r.invoiceId}
                    </Link>
                  ) : (
                    <span>{r.invoiceNumber || "—"}</span>
                  ),
              },
              {
                key: "outstandingAmount",
                label: "Outstanding Amount",
                sortable: true,
                sortValue: (r) => r.outstandingAmount ?? 0,
                render: (r) => (
                  <span className="tabular-nums font-medium">
                    {formatCurrency(r.outstandingAmount ?? 0)}
                  </span>
                ),
              },
              {
                key: "frequency",
                label: "Frequency",
                sortable: true,
                render: (r) => REMINDER_FREQUENCY_LABELS[r.frequency] ?? r.frequency,
              },
              {
                key: "dueDate",
                label: "Due Date",
                sortable: true,
                render: (r) => formatDate(r.dueDate),
              },
              {
                key: "nextDueDate",
                label: "Next Due",
                sortable: true,
                sortValue: (r) => r.nextDueDate ?? r.dueDate,
                render: (r) => displayNextDue(r),
              },
              {
                key: "status",
                label: "Status",
                sortable: true,
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "whatsapp",
                label: "WhatsApp",
                render: (r) => (
                  <WhatsAppCell
                    reminder={r}
                    enabled={whatsappReminderEnabled}
                    onSend={handleSendPaymentWhatsApp}
                  />
                ),
              },
              {
                key: "actions",
                label: "",
                render: (r) => (
                  <RowActions
                    reminder={r}
                    onComplete={handleMarkComplete}
                    onDismiss={handleDismiss}
                  />
                ),
              },
            ]}
            renderMobileCard={(r) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.customerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.invoiceNumber || "Invoice"} ·{" "}
                      {formatCurrency(r.outstandingAmount ?? 0)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {REMINDER_FREQUENCY_LABELS[r.frequency]} · Due {formatDate(r.dueDate)} · Next{" "}
                  {displayNextDue(r)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <WhatsAppCell
                    reminder={r}
                    enabled={whatsappReminderEnabled}
                    onSend={handleSendPaymentWhatsApp}
                  />
                  <RowActions
                    reminder={r}
                    onComplete={handleMarkComplete}
                    onDismiss={handleDismiss}
                  />
                </div>
              </div>
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
