"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/skeleton-loader";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { DataTable } from "@/components/shared/data-table";
import { JobCardStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useBranchStore } from "@/store/branch-store";
import { useStaffStore } from "@/store/staff-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useSettingsStore } from "@/store/settings-store";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { userCanCreate, userCanDelete, userCanEdit } from "@/lib/rbac";
import { RecordPaymentDialog } from "@/components/billing/record-payment-dialog";
import { createOrGetInvoiceForJob } from "@/lib/invoice-from-job-card";
import { buildJobCardTemplateMessage, defaultWhatsAppTemplateForStatus } from "@/lib/job-card-whatsapp-templates";
import { sendCustomerWhatsApp, openWhatsAppComposer } from "@/lib/whatsapp-send";
import { buildJobCardPhotosWhatsAppMessage } from "@/lib/whatsapp-customer-messages";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { downloadInvoicePdf, type InvoicePdfOpts } from "@/lib/invoice-pdf";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { filterByBranchId, useBranchScope } from "@/lib/branch-scope";
import { computeGstFromSubtotal } from "@/lib/gst-tax";
import {
  isOverdueJobCard,
  isTodaysBookingsJob,
  isReadyForDeliveryJob,
  jobCardDeliveryAt,
} from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";
import { formatDate, formatDateTime, cn, formatCurrency } from "@/lib/utils";
import { jobNumberSortKey, sortJobCardsByNumberThenCreated } from "@/lib/sort-by-date";
import { normalizeRegistrationNumber } from "@/lib/vehicle-registration";
import type { JobCard, JobCardStatus } from "@/types";
import { Plus, LayoutGrid, List, ChevronDown, MoreVertical, Eye, Pencil, Trash2, Download, Clock, FileText, Wrench, Calendar, User, Car, CreditCard, Copy, Image as ImageIcon } from "lucide-react";
import { VirtuosoGrid } from "react-virtuoso";

const GridList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ style, children, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      style={style}
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      {children}
    </div>
  )
);
GridList.displayName = "GridList";

const GridItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} {...props} className="flex flex-col h-full">
      {children}
    </div>
  )
);
GridItem.displayName = "GridItem";

const TAB_STATUSES: (JobCardStatus | "ALL")[] = [
  "ALL",
  "RECEIVED",
  "INSPECTION",
  "AWAITING_SERVICE",
  "QUALITY_CHECK",
  "READY",
  "DELIVERED",
  "CANCELLED",
];

const TAB_LABELS: Record<JobCardStatus | "ALL", string> = {
  ALL: "All",
  RECEIVED: "Received",
  INSPECTION: "Inspection",
  AWAITING_SERVICE: "Awaiting Service",
  QUALITY_CHECK: "Quality Check",
  READY: "Ready",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const KANBAN_COLUMNS: JobCardStatus[] = [
  "RECEIVED",
  "INSPECTION",
  "AWAITING_SERVICE",
  "QUALITY_CHECK",
  "READY",
  "DELIVERED",
];

function compactRegForSearch(s: string): string {
  return normalizeRegistrationNumber(s).replace(/-/g, "").toLowerCase();
}

function jobCardMatchesSearch(jc: JobCard, queryRaw: string): boolean {
  const q = queryRaw.trim().toLowerCase();
  if (!q) return true;
  const qDigits = queryRaw.replace(/\D/g, "");
  const phoneDigits = jc.customerPhone.replace(/\D/g, "");
  const regCompact = compactRegForSearch(jc.vehicleRegNumber);
  const qCompact = compactRegForSearch(queryRaw);
  return (
    jc.jobNumber.toLowerCase().includes(q) ||
    jc.customerName.toLowerCase().includes(q) ||
    (qDigits.length > 0 && phoneDigits.includes(qDigits)) ||
    (qCompact.length > 0 && regCompact.includes(qCompact)) ||
    jc.vehicleRegNumber.toLowerCase().includes(q) ||
    (jc.vehicleMakeModel?.toLowerCase().includes(q) ?? false) ||
    (jc.services ?? []).some((s) => s.name.toLowerCase().includes(q))
  );
}

const KANBAN_COLORS: Record<JobCardStatus, string> = {
  RECEIVED: "border-t-blue-500",
  INSPECTION: "border-t-violet-500",
  AWAITING_SERVICE: "border-t-amber-500",
  QUALITY_CHECK: "border-t-cyan-500",
  READY: "border-t-emerald-500",
  DELIVERED: "border-t-green-500",
  CANCELLED: "border-t-red-500",
};

const STATUS_BADGE_STYLES: Record<JobCardStatus, string> = {
  DELIVERED: "bg-green-50 text-green-700 border-green-200/50 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/30",
  RECEIVED: "bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30",
  INSPECTION: "bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30",
  AWAITING_SERVICE: "bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30",
  QUALITY_CHECK: "bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30",
  READY: "bg-purple-50 text-purple-700 border-purple-200/50 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/30",
  CANCELLED: "bg-red-50 text-red-700 border-red-200/50 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30",
};

export default function JobCardsPage() {
  const user = useAuthStore((s) => s.user);
  const canEditJobCards = userCanEdit(user, "JOB_CARDS");
  const storesReady = useDashboardStoresReady();
  const router = useRouter();
  const jobCards = useJobCardStore((s) => s.jobCards);
  const total = useJobCardStore((s) => s.total);
  const totalPages = useJobCardStore((s) => s.totalPages);
  const currentPage = useJobCardStore((s) => s.page);
  const isLoading = useJobCardStore((s) => s.jobCardsLoading);
  const isInitialLoaded = useJobCardStore((s) => s.isInitialLoaded);
  const fetchPaginatedJobCards = useJobCardStore((s) => s.fetchPaginatedJobCards);
  const deleteJobCard = useJobCardStore((s) => s.deleteJobCard);
  const invoices = useInvoiceStore((s) => s.invoices);
    const gstRegistrationStatus = useSettingsStore((s) => s.gstRegistrationStatus);
  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId } = useBranchScope();

  const handleDownloadInvoiceForJobCard = async (jc: JobCard) => {
    const invoices = useInvoiceStore.getState().invoices;
    const invoice = invoices.find((inv) => inv.jobCardId === jc.id);
    if (!invoice) {
      toast.error("Invoice not available yet");
      return;
    }

    const settingsStore = useSettingsStore.getState();
    const customerStore = useCustomerStore.getState();
    const vehicleStore = useVehicleStore.getState();

    const customer = customerStore.customers.find((c) => c.id === invoice.customerId) || {
      id: invoice.customerId,
      name: invoice.customerName,
      phone: invoice.customerPhone,
      email: "",
      address: "",
    };

    const vehicle = vehicleStore.vehicles.find((v) => v.id === jc.vehicleId);
    const resolvedVehicleMakeModel = vehicle
      ? `${vehicle.make} ${vehicle.model}`
      : jc.vehicleMakeModel || "Vehicle";
    const vehicleDetailsLine = vehicle
      ? `${vehicle.year ? `${vehicle.year} ` : ""}${vehicle.color ? `${vehicle.color} ` : ""}${vehicle.vinNumber ? `(VIN: ${vehicle.vinNumber})` : ""}`
      : undefined;

    const sanitizedInvoice = {
      ...invoice,
      rewardDiscount: invoice.rewardDiscount,
    };

    const invoicePdfOpts: InvoicePdfOpts = {
      invoice: sanitizedInvoice,
      jobCard: jc,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      customerEmail: customer.email?.trim() ?? "",
      customerAddress: customer.address ?? "",
      vehicleMakeModel: resolvedVehicleMakeModel,
      vehicleDetailsLine: vehicleDetailsLine || undefined,
      odometerReading: jc.odometerReading ?? undefined,
      business: {
        businessName: settingsStore.businessName,
        businessTagline: settingsStore.businessTagline,
        businessAddress: settingsStore.businessAddress,
        businessPhone: settingsStore.businessPhone,
        businessWhatsApp: settingsStore.businessWhatsApp,
        businessEmail: settingsStore.businessEmail,
        businessWebsite: settingsStore.businessWebsite,
        gstRegistrationStatus: settingsStore.gstRegistrationStatus,
        gstin: settingsStore.gstin,
        companyPan: settingsStore.companyPan,
        bankName: settingsStore.bankName,
        bankBranch: settingsStore.bankBranch,
        bankAccountNumber: settingsStore.bankAccountNumber,
        bankIfsc: settingsStore.bankIfsc,
        bankUpi: settingsStore.bankUpi,
      },
      payments: invoice.payments || [],
      totalPaid: (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0) + (invoice.walletAmountUsed || 0),
      remainingBalance: invoice.grandTotal - ((invoice.payments || []).reduce((sum, p) => sum + p.amount, 0) + (invoice.walletAmountUsed || 0)),
      referralCode: "referralCode" in customer ? customer.referralCode : undefined,
      referralRewardAmount: settingsStore.referralRewardAmount,
      newCustomerDiscount: settingsStore.newCustomerDiscount,
    };

    const toastId = toast.loading("Generating PDF...");
    try {
      await downloadInvoicePdf(invoicePdfOpts);
      toast.success("PDF downloaded successfully.", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Failed to download PDF.", { id: toastId });
    }
  };

  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [recordPaymentInvoiceId, setRecordPaymentInvoiceId] = useState<string | null>(null);
  const [deleteConfirmJobCard, setDeleteConfirmJobCard] = useState<(typeof jobCards)[0] | null>(null);
  const [deleteConfirmHasInvoice, setDeleteConfirmHasInvoice] = useState(false);
  const [deletingJobCard, setDeletingJobCard] = useState(false);

  const handleOpenRecordPayment = (jc: JobCard) => {
    let invoice = useInvoiceStore.getState().invoices.find((inv) => inv.jobCardId === jc.id);
    if (!invoice) {
      const tempJc = { ...jc, status: "READY" as const };
      const result = createOrGetInvoiceForJob(jc.id, tempJc);
      if (result.ok) {
        invoice = useInvoiceStore.getState().invoices.find((i) => i.id === result.invoiceId);
      }
    }
    if (invoice) {
      setRecordPaymentInvoiceId(invoice.id);
      setRecordPaymentOpen(true);
    } else {
      toast.error("Failed to generate or find invoice for payment recording");
    }
  };

  const handleSendWhatsApp = async (jc: JobCard) => {
    const businessName = useSettingsStore.getState().businessName;
    const invoices = useInvoiceStore.getState().invoices;
    const invoice = invoices.find((inv) => inv.jobCardId === jc.id);
    const buildOpts = {
      businessName: businessName || "MY DETAIL OS",
      invoiceNumber: invoice ? invoice.invoiceNumber : null,
      customerLoginUrl: typeof window !== "undefined" ? window.location.origin : null,
      customerPhotosLink: jc.secureToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/customer/job-card/${jc.secureToken}/photos` : null,
    };
    const templateId = defaultWhatsAppTemplateForStatus(jc.status);
    const body = buildJobCardTemplateMessage(templateId, jc, buildOpts);
    const phone = jc.customerPhone?.trim() ?? "";
    if (!phone) {
      toast.error("Customer phone number is missing");
      return;
    }

    const toastId = toast.loading("Sending WhatsApp message...");
    try {
      await sendCustomerWhatsApp(phone, body);
      toast.success("WhatsApp message sent successfully", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Failed to send WhatsApp message", { id: toastId });
    }
  };

  const showBranchColumn = !selectedBranchId;
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [mechanicFilter, setMechanicFilter] = useState<string>("ALL");

  const staff = useStaffStore((s) => s.staff);
  const mechanics = useMemo(() => {
    return staff.filter((m) => m.role === "MECHANIC" || !m.role);
  }, [staff]);

  const hasMore = currentPage < totalPages;
  const isFirstMount = useRef(true);

  useEffect(() => {
    const filters: Record<string, any> = {};
    if (selectedBranchId) filters.branchId = selectedBranchId;
    if (statusFilter !== "ALL") filters.status = statusFilter;
    if (dateFilter) filters.date = dateFilter;
    if (mechanicFilter !== "ALL") filters.mechanicId = mechanicFilter;
    if (activeFilter) filters.dashboardFilter = activeFilter;
    
    const isDefaultFilters = !selectedBranchId && statusFilter === "ALL" && !dateFilter && mechanicFilter === "ALL" && !activeFilter;

    if (isFirstMount.current && isInitialLoaded && !searchQuery && isDefaultFilters) {
      isFirstMount.current = false;
      return;
    }
    isFirstMount.current = false;

    fetchPaginatedJobCards({ page: 1, pageSize: 50, search: searchQuery, filters });
  }, [searchQuery, statusFilter, dateFilter, mechanicFilter, activeFilter, selectedBranchId, fetchPaginatedJobCards, isInitialLoaded]);

  const loadMore = () => {
    if (!isLoading && hasMore) {
      const filters: Record<string, any> = {};
      if (selectedBranchId) filters.branchId = selectedBranchId;
      if (statusFilter !== "ALL") filters.status = statusFilter;
      if (dateFilter) filters.date = dateFilter;
      if (mechanicFilter !== "ALL") filters.mechanicId = mechanicFilter;
      if (activeFilter) filters.dashboardFilter = activeFilter;
      
      fetchPaginatedJobCards({ page: currentPage + 1, pageSize: 50, search: searchQuery, filters }, true);
    }
  };

  const handlePageChange = (newPage: number) => {
    const filters: Record<string, any> = {};
    if (selectedBranchId) filters.branchId = selectedBranchId;
    if (statusFilter !== "ALL") filters.status = statusFilter;
    if (dateFilter) filters.date = dateFilter;
    if (mechanicFilter !== "ALL") filters.mechanicId = mechanicFilter;
    if (activeFilter) filters.dashboardFilter = activeFilter;
    
    fetchPaginatedJobCards({ page: newPage, pageSize: 50, search: searchQuery, filters });
  };

  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");
  const [collapsedKanbanSections, setCollapsedKanbanSections] = useState<Set<JobCardStatus>>(
    () => new Set(KANBAN_COLUMNS.slice(1))
  );
  const kanbanCollapseSeeded = useRef(false);

  const toggleKanbanSection = useCallback((status: JobCardStatus) => {
    kanbanCollapseSeeded.current = true;
    setCollapsedKanbanSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const branchNameById = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  const renderBranchLabel = useCallback(
    (branchId: string) => branchNameById[branchId] ?? branchId,
    [branchNameById]
  );

  const branchScopedJobCards = useMemo(
    () => filterByBranchId(jobCards, (jc) => jc.branchId, selectedBranchId),
    [jobCards, selectedBranchId]
  );

  const jobCardsForView = useMemo(() => {
    let list = branchScopedJobCards;
    if (activeFilter === DASHBOARD_FILTER.OVERDUE) {
      list = list.filter(isOverdueJobCard);
    } else if (activeFilter === DASHBOARD_FILTER.TODAYS_BOOKINGS) {
      list = list.filter(isTodaysBookingsJob);
    } else if (activeFilter === DASHBOARD_FILTER.READY_FOR_DELIVERY) {
      list = list.filter(isReadyForDeliveryJob);
    }
    return sortJobCardsByNumberThenCreated(list);
  }, [branchScopedJobCards, activeFilter]);

  const payableForJobCard = useCallback((jc: JobCard) => {
    const invoice = invoices.find((inv) => inv.jobCardId === jc.id);
    if (invoice) return invoice.grandTotal;
    return computeGstFromSubtotal(jc.estimatedAmount ?? 0, gstRegistrationStatus).grandTotal;
  }, [invoices, gstRegistrationStatus]);

  const filteredJobCards = useMemo(() => {
    return jobCardsForView.filter((jc) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = jobCardMatchesSearch(jc, q);
        if (!matches) return false;
      }
      if (statusFilter !== "ALL" && jc.status !== statusFilter) {
        return false;
      }
      if (dateFilter) {
        const jcDateStr = jc.createdAt ? jc.createdAt.slice(0, 10) : "";
        if (jcDateStr !== dateFilter) {
          const expectedStr = jc.expectedDelivery ? jc.expectedDelivery.slice(0, 10) : "";
          if (expectedStr !== dateFilter) return false;
        }
      }
      if (mechanicFilter !== "ALL") {
        const mechName = jc.mechanicName || "";
        const mechId = jc.mechanicId || "";
        if (mechName !== mechanicFilter && mechId !== mechanicFilter) {
          const mechObj = staff.find((s) => s.id === mechanicFilter);
          if (!mechObj || mechName !== mechObj.name) return false;
        }
      }
      return true;
    });
  }, [jobCardsForView, searchQuery, statusFilter, dateFilter, mechanicFilter, staff]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: jobCardsForView.length };
    jobCardsForView.forEach((jc) => {
      c[jc.status] = (c[jc.status] ?? 0) + 1;
    });
    return c;
  }, [jobCardsForView]);

  const visibleStatuses = useMemo(
    () =>
      TAB_STATUSES.filter(
        (status) => status === "ALL" || (counts[status] ?? 0) > 0
      ),
    [counts]
  );

  const moreStatuses = useMemo(
    () =>
      TAB_STATUSES.filter(
        (status) => status !== "ALL" && (counts[status] ?? 0) === 0
      ),
    [counts]
  );

  const isMoreTabActive = moreStatuses.includes(activeTab as JobCardStatus);

  const viewToggle = (
    <div
      className="flex shrink-0 items-center rounded-lg border border-border overflow-hidden"
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => setViewMode("list")}
        aria-pressed={viewMode === "list"}
        title="List view"
        className={`flex h-8 w-8 items-center justify-center transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
      >
        <List className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setViewMode("kanban")}
        aria-pressed={viewMode === "kanban"}
        title="Grid view"
        className={`flex h-8 w-8 items-center justify-center transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const kanbanData = useMemo(() => {
    const map: Record<string, JobCard[]> = {};
    KANBAN_COLUMNS.forEach((s) => { map[s] = []; });
    jobCardsForView.forEach((jc) => {
      if (jc.status !== "CANCELLED" && map[jc.status]) map[jc.status].push(jc);
    });
    KANBAN_COLUMNS.forEach((s) => {
      map[s] = sortJobCardsByNumberThenCreated(map[s] ?? []);
    });
    return map;
  }, [jobCardsForView]);

  useEffect(() => {
    if (kanbanCollapseSeeded.current) return;

    const firstWithJobs = KANBAN_COLUMNS.find((status) => (kanbanData[status]?.length ?? 0) > 0);
    if (!firstWithJobs) return;

    setCollapsedKanbanSections(
      new Set(KANBAN_COLUMNS.filter((status) => status !== firstWithJobs))
    );
    kanbanCollapseSeeded.current = true;
  }, [kanbanData]);

  const filteredJobCardsForListTab = useMemo(() => {
    const base = jobCardsForView.filter((jc) => {
      if (dateFilter) {
        const jcDateStr = jc.createdAt ? jc.createdAt.slice(0, 10) : "";
        if (jcDateStr !== dateFilter) {
          const expectedStr = jc.expectedDelivery ? jc.expectedDelivery.slice(0, 10) : "";
          if (expectedStr !== dateFilter) return false;
        }
      }
      if (mechanicFilter !== "ALL") {
        const mechName = jc.mechanicName || "";
        const mechId = jc.mechanicId || "";
        if (mechName !== mechanicFilter && mechId !== mechanicFilter) {
          const mechObj = staff.find((s) => s.id === mechanicFilter);
          if (!mechObj || mechName !== mechObj.name) return false;
        }
      }
      return true;
    });

    if (activeTab === "ALL") return base;
    return base.filter((jc) => jc.status === activeTab);
  }, [jobCardsForView, activeTab]);

  const columns = useMemo(
    () => [
      {
        key: "jobNumber",
        label: "Job number",
        sortable: true,
        sortValue: (item: JobCard) => jobNumberSortKey(item.jobNumber),
        className: "align-top whitespace-nowrap w-[1%]",
        render: (item: JobCard) => (
          <span className="font-mono text-xs font-semibold text-primary">{item.jobNumber}</span>
        ),
      },
      ...(showBranchColumn
        ? [
            {
              key: "branchId",
              label: "Branch",
              className: "align-top whitespace-nowrap max-w-[9rem]",
              render: (item: JobCard) => (
                <span
                  className="text-sm text-muted-foreground truncate block"
                  title={renderBranchLabel(item.branchId)}
                >
                  {renderBranchLabel(item.branchId)}
                </span>
              ),
            },
          ]
        : []),
      {
        key: "customerName",
        label: "Customer",
        className: "align-top min-w-[10rem] max-w-[14rem]",
        render: (item: JobCard) => (
          <div className="space-y-0.5">
            <div className="font-medium leading-snug">{item.customerName}</div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">{item.customerPhone}</div>
          </div>
        ),
      },
      {
        key: "vehicleRegNumber",
        label: "Vehicle",
        className: "align-top min-w-[9rem] max-w-[16rem]",
        render: (item: JobCard) => (
          <div className="space-y-0.5">
            <div className="font-mono text-xs font-medium leading-snug">{item.vehicleRegNumber}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">{item.vehicleMakeModel}</div>
          </div>
        ),
      },
      {
        key: "mechanicName",
        label: "Mechanic",
        className: "align-top whitespace-nowrap text-muted-foreground max-w-[8rem]",
        render: (item: JobCard) => (
          <span className="line-clamp-2">{item.mechanicName ?? "—"}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        className: "align-top whitespace-nowrap w-[1%]",
        render: (item: JobCard) => (
          <JobCardStatusBadge status={item.status} className="whitespace-nowrap" />
        ),
      },
      {
        key: "expectedDelivery",
        label: "Delivery",
        sortable: true,
        sortValue: (item: JobCard) => jobCardDeliveryAt(item),
        className: "align-top whitespace-nowrap text-muted-foreground",
        render: (item: JobCard) =>
          item.status === "DELIVERED" ? (
            <span title="Delivered">{formatDate(item.actualDelivery ?? item.updatedAt)}</span>
          ) : (
            <span title="Expected">{formatDate(item.expectedDelivery)}</span>
          ),
      },
      {
        key: "createdAt",
        label: "Created",
        sortable: true,
        sortValue: (item: JobCard) => item.createdAt,
        className: "align-top whitespace-nowrap text-muted-foreground",
        render: (item: JobCard) => formatDateTime(item.createdAt),
      },
    ],
    [showBranchColumn, renderBranchLabel]
  );

  const searchMatchJobCard = useCallback((jc: JobCard, qLower: string) => jobCardMatchesSearch(jc, qLower), []);

  if (!storesReady) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <PageHeader
        title="Job Cards"
        inlineActionsOnMobile
        actions={
          <div className="flex items-center gap-2 shrink-0">
            {viewToggle}
            <Link href="/job-cards/new">
              <Button size="sm" className="h-8 px-3">
                <Plus className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">New Job Card</span>
                <span className="sm:hidden">New</span>
              </Button>
            </Link>
          </div>
        }
      />

      {activeFilter === DASHBOARD_FILTER.OVERDUE && (
        <FilterBanner
          message="⚠ Showing overdue job cards — delivery date has passed"
          onDismiss={() => setActiveFilter(null)}
        />
      )}
      {activeFilter === DASHBOARD_FILTER.TODAYS_BOOKINGS && (
        <FilterBanner
          message="Showing job cards created today (calendar date)."
          onDismiss={() => setActiveFilter(null)}
        />
      )}
      {activeFilter === DASHBOARD_FILTER.READY_FOR_DELIVERY && (
        <FilterBanner
          message="Showing jobs in Ready status — ready for handover."
          onDismiss={() => setActiveFilter(null)}
        />
      )}

      {viewMode === "list" ? (
        <Card className="border-border/80 shadow-sm overflow-hidden">
          <CardContent className="pt-4 min-w-0 sm:pt-5">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
              <div className="mb-3 -mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
                <TabsList className="inline-flex h-auto w-max min-w-full flex-nowrap justify-start gap-1 bg-muted/50 p-1">
                    {visibleStatuses.map((status) => (
                      <TabsTrigger
                        key={status}
                        value={status}
                        className="h-8 shrink-0 px-2.5 text-xs data-[state=active]:shadow-sm sm:h-9 sm:px-3 sm:text-sm"
                      >
                        {TAB_LABELS[status]} ({counts[status] ?? 0})
                      </TabsTrigger>
                    ))}
                    {moreStatuses.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors sm:h-9 sm:px-3 sm:text-sm ${
                              isMoreTabActive
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                            }`}
                          >
                            More
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {moreStatuses.map((status) => (
                            <DropdownMenuItem
                              key={status}
                              onClick={() => setActiveTab(status)}
                            >
                              {TAB_LABELS[status]} (0)
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TabsList>
              </div>

              <div className="min-w-0 space-y-4" aria-live="polite">
                <DataTable<JobCard>
                  key={activeTab}
                  data={filteredJobCardsForListTab}
                  columns={columns}
                  defaultSortKey="jobNumber"
                  defaultSortDir="desc"
                  searchPlaceholder="Search jobs, customers, vehicles..."
                  searchMatch={searchMatchJobCard}
                  serverPagination={{
                    page: currentPage,
                    pageSize: 50,
                    total,
                    totalPages,
                    onPageChange: handlePageChange,
                    isLoading,
                  }}
                  mobileCardClassName="p-2.5"
                  onRowClick={(item) => router.push(`/job-cards/${item.id}`)}
                  renderMobileCard={(jc) => (
                    <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {jc.jobNumber}
                      </span>
                      <JobCardStatusBadge
                        status={jc.status}
                        className="shrink-0 justify-self-end row-span-1"
                      />
                      {showBranchColumn && (
                        <span className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">
                          {renderBranchLabel(jc.branchId)}
                        </span>
                      )}
                      <p className="col-span-2 text-sm font-medium leading-tight">
                        {jc.customerName}
                      </p>
                      <p className="col-span-2 text-xs text-muted-foreground">
                        {jc.customerPhone}
                      </p>
                      <p className="col-span-2 text-sm font-medium leading-tight mt-0.5">
                        {jc.vehicleRegNumber}
                      </p>
                      <p className="col-span-2 text-xs text-muted-foreground line-clamp-1">
                        {jc.vehicleMakeModel}
                      </p>
                      <div className="col-span-2 mt-1.5 pt-1.5 border-t border-border/80 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <span className="truncate min-w-0">
                          {jc.mechanicName ?? "Unassigned"}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {jc.status === "DELIVERED"
                            ? formatDate(jc.actualDelivery ?? jc.updatedAt)
                            : formatDate(jc.expectedDelivery)}
                        </span>
                      </div>
                    </div>
                  )}
                />
              </div>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Simple Filters above the grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-card border border-border/80 p-4 rounded-xl shadow-sm">
            {/* Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jobs, customers, vehicles..."
                className="w-full h-10 px-3 py-2 text-sm bg-background border border-border/85 rounded-lg placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            
            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full h-10 bg-background border-border/85 text-sm">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {KANBAN_COLUMNS.map((st) => (
                    <SelectItem key={st} value={st}>
                      {TAB_LABELS[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm bg-background border border-border/85 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
              />
            </div>

            {/* Mechanic */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mechanic</label>
              <Select value={mechanicFilter} onValueChange={setMechanicFilter}>
                <SelectTrigger className="w-full h-10 bg-background border-border/85 text-sm">
                  <SelectValue placeholder="All Mechanics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Mechanics</SelectItem>
                  {mechanics.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unified Grid */}
          {filteredJobCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-16 border border-dashed border-border/85 rounded-xl bg-card text-muted-foreground">
              <span className="text-sm font-medium">No job cards match your filters</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredJobCards.map((jc) => (
                <div
                  key={jc.id}
                  className="group flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 w-full"
                >
                  {/* Top Section */}
                  <div className="p-4 bg-background space-y-3.5 pb-3">
                    {/* Plate & Status & Dropdown row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5 min-w-0">
                        {/* Indian License Plate */}
                        <div className="inline-flex items-stretch border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-background h-8">
                          <div className="bg-[#0b5cda] flex flex-col items-center justify-center px-2 py-0.5 text-white shrink-0 select-none">
                            <span className="w-1.5 h-1.5 rounded-full border border-white mb-0.5" />
                            <span className="text-[7px] font-bold leading-none tracking-wider">IND</span>
                          </div>
                          <div className="flex items-center justify-center px-3 py-0.5 font-mono text-[11px] font-black text-foreground tracking-wider uppercase">
                            {jc.vehicleRegNumber}
                          </div>
                        </div>
                        {/* Vehicle Make/Model */}
                        <p className="text-[#0b5cda] dark:text-[#3b82f6] font-bold text-sm leading-tight truncate">
                          {jc.vehicleMakeModel}
                        </p>
                        <p className="text-[11px] font-mono font-semibold text-muted-foreground leading-none">
                          {jc.jobNumber}
                        </p>
                      </div>

                      {/* Top-Right Badge & Three dots dropdown */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Status Badge */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE_STYLES[jc.status]}`}>
                          {TAB_LABELS[jc.status]}
                        </span>
                        
                        {/* Dropdown menu trigger (top right) */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:bg-muted"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/job-cards/${jc.id}`);
                              }}
                              className="gap-2 text-xs"
                            >
                              {canEditJobCards ? (
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                              {canEditJobCards ? "Edit Job Card" : "View Job Card"}
                            </DropdownMenuItem>
                            {(() => {
                              const invoice = invoices.find((inv) => inv.jobCardId === jc.id);
                              const paid = invoice
                                ? (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0) + (invoice.walletAmountUsed || 0)
                                : (jc.paidAmount ?? 0);
                              const due = invoice
                                ? invoice.grandTotal - paid
                                : jc.estimatedAmount - paid;
                              if (due <= 0.01) return null;
                              if (!userCanCreate(useAuthStore.getState().user, "BILLING")) return null;
                              
                              return (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenRecordPayment(jc);
                                  }}
                                  className="gap-2 text-xs"
                                >
                                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                                  Record Payment
                                </DropdownMenuItem>
                              );
                            })()}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/job-cards/${jc.id}`);
                              }}
                              className="gap-2 text-xs"
                            >
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              Change Status
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="gap-2 text-xs">
                                <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                Customer Photos
                              </DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const token = (jc as any).secureToken;
                                      if (token) {
                                        window.open(`/customer/job-card/${token}/photos`, "_blank");
                                      } else {
                                        toast.error("Photos link not ready yet. Please refresh the page.");
                                      }
                                    }}
                                    className="gap-2 text-xs"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                    View Photos
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const token = (jc as any).secureToken;
                                      if (token) {
                                        const link = `${window.location.origin}/customer/job-card/${token}/photos`;
                                        navigator.clipboard.writeText(link).then(() => {
                                          toast.success("Customer link copied to clipboard!");
                                        }).catch(() => {
                                          toast.error("Failed to copy link.");
                                        });
                                      } else {
                                        toast.error("Photos link not ready yet. Please refresh the page.");
                                      }
                                    }}
                                    className="gap-2 text-xs"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                    Copy Customer Link
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const token = (jc as any).secureToken;
                                      if (token) {
                                        const link = `${window.location.origin}/customer/job-card/${token}/photos`;
                                        const bizName = useSettingsStore.getState().businessName || "MY DETAIL OS";
                                        const message = buildJobCardPhotosWhatsAppMessage({
                                          customerName: jc.customerName,
                                          jobCardNumber: jc.jobNumber,
                                          customerPhotosLink: link,
                                          workshopName: bizName,
                                        });
                                        openWhatsAppComposer(jc.customerPhone, message);
                                      } else {
                                        toast.error("Photos link not ready yet. Please refresh the page.");
                                      }
                                    }}
                                    className="gap-2 text-xs"
                                  >
                                    <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
                                    Share on WhatsApp
                                  </DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuItem
                              disabled={!invoices.some((inv) => inv.jobCardId === jc.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadInvoiceForJobCard(jc);
                              }}
                              className="gap-2 text-xs"
                            >
                              <Download className="w-3.5 h-3.5 text-muted-foreground" />
                              Download Invoice
                            </DropdownMenuItem>
                            {jc.status !== "CANCELLED" && userCanDelete(user, "JOB_CARDS") && (
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive gap-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmJobCard(jc);
                                  setDeleteConfirmHasInvoice(invoices.some((inv) => inv.jobCardId === jc.id));
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete Job Card
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Meta tags (Invoice, Photos, Payment status) */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {invoices.some((inv) => inv.jobCardId === jc.id) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <FileText className="w-3 h-3 shrink-0" />
                          Invoiced
                        </span>
                      )}
                      {(((jc as any).beforePhotos?.length || 0) > 0 || ((jc as any).afterPhotos?.length || 0) > 0 || (jc.inspectionPhotos?.length || 0) > 0) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/50 dark:bg-blue-950/40 dark:text-blue-400">
                          <ImageIcon className="w-3 h-3 shrink-0" />
                          Photos
                        </span>
                      )}
                      {(() => {
                        const invoice = invoices.find((inv) => inv.jobCardId === jc.id);
                        const paid = invoice
                          ? (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0) + (invoice.walletAmountUsed || 0)
                          : (jc.paidAmount ?? 0);
                        const payable = payableForJobCard(jc);
                        const due = invoice
                          ? invoice.grandTotal - paid
                          : payable - paid;
                        
                        let statusLabel = "Unpaid";
                        let badgeColor = "bg-rose-50 text-rose-700 border-rose-200/50 dark:bg-rose-950/40 dark:text-rose-400";
                        if (paid > 0 && due > 0) {
                          statusLabel = "Partially Paid";
                          badgeColor = "bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-950/40 dark:text-amber-400";
                        } else if (paid > 0 && due <= 0) {
                          statusLabel = "Paid";
                          badgeColor = "bg-green-50 text-green-700 border-green-200/50 dark:bg-green-950/40 dark:text-green-400";
                        }
                        
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
                            <CreditCard className="w-3 h-3 shrink-0" />
                            {statusLabel}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Customer Section */}
                  <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between gap-2 bg-background">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate leading-snug">{jc.customerName}</p>
                        <p className="text-[11px] font-mono text-muted-foreground mt-0.5 leading-none">{jc.customerPhone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Mechanic & Expected Delivery Row */}
                  <div className="px-4 py-3 border-t border-border/40 grid grid-cols-2 gap-4 bg-background text-xs">
                    <div className="space-y-1">
                      <p className="text-muted-foreground font-medium">Assigned Mechanic</p>
                      <div className="flex items-center gap-1.5 text-foreground font-semibold">
                        <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{jc.mechanicName ?? "Unassigned"}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground font-medium">Expected Delivery</p>
                      <div className="flex items-center gap-1.5 text-foreground font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{formatDate(jc.expectedDelivery)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto">
                    {/* Total Cost & Compact Created On Section */}
                    <div className="px-4 py-3 border-t border-border/40 space-y-1.5 bg-background">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-semibold">
                          Created {formatDateTime(jc.createdAt || jc.expectedDelivery)}
                        </span>
                        <span className="text-base font-black text-foreground tabular-nums">
                          {formatCurrency(payableForJobCard(jc))}
                        </span>
                      </div>
                      {(() => {
                        const invoice = invoices.find((inv) => inv.jobCardId === jc.id);
                        const paid = invoice
                          ? (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0) + (invoice.walletAmountUsed || 0)
                          : (jc.paidAmount ?? 0);
                        const payable = payableForJobCard(jc);
                        const due = invoice
                          ? invoice.grandTotal - paid
                          : payable - paid;
                        
                        if (paid <= 0) return null;
                        return (
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium pt-0.5">
                            <span>Paid: <span className="text-foreground font-semibold">{formatCurrency(paid)}</span></span>
                            <span>Due: <span className="text-foreground font-semibold">{formatCurrency(Math.max(0, due))}</span></span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Bottom Actions Grid */}
                    <div className="px-4 py-3 bg-muted/10 border-t border-border/40 flex text-xs font-semibold">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 h-9 text-[#0b5cda] border-[#0b5cda]/30 hover:border-[#0b5cda] hover:bg-blue-50/20 font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/job-cards/${jc.id}`);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5 text-[#0b5cda]" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <RecordPaymentDialog
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        invoiceId={recordPaymentInvoiceId}
      />

      <Dialog open={!!deleteConfirmJobCard} onOpenChange={(o) => { if (!o) setDeleteConfirmJobCard(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Job Card?</DialogTitle>
            <DialogDescription className="pt-1">
              {deleteConfirmHasInvoice
                ? "This job card has an invoice. Deleting it may impact billing records. This action cannot be undone."
                : "Are you sure you want to delete this job card? This action cannot be undone."}
              {deleteConfirmJobCard && (
                <span className="block mt-2 font-mono font-semibold text-foreground">{deleteConfirmJobCard.jobNumber} &mdash; {deleteConfirmJobCard.customerName}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={deletingJobCard} onClick={() => setDeleteConfirmJobCard(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deletingJobCard}
              onClick={async () => {
                if (!deleteConfirmJobCard) return;
                setDeletingJobCard(true);
                try {
                  await deleteJobCard(deleteConfirmJobCard.id);
                  toast.success("Job card deleted.");
                  setDeleteConfirmJobCard(null);
                } catch {
                  toast.error("Could not delete job card.");
                } finally {
                  setDeletingJobCard(false);
                }
              }}
            >
              {deletingJobCard ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
