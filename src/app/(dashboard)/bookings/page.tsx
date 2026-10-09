"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { MobileFilterSheet, MobileFilterTrigger } from "@/components/shared/mobile-filter-sheet";
import { DataTable } from "@/components/shared/data-table";
import { JobCardStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJobCardStore } from "@/store/job-card-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useCustomerStore } from "@/store/customer-store";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { filterByBranchId, useBranchScope } from "@/lib/branch-scope";
import { useAppointmentStore } from "@/store/appointment-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { normalizeRegistrationNumber } from "@/lib/vehicle-registration";
import { findCatalogServiceForAppointment } from "@/lib/job-from-appointment";
import { isAppointmentSlotElapsed } from "@/lib/appointment-status";
import { getAppointmentDisplayId, resolveAppointmentKind } from "@/lib/appointment-ids";
import {
  appointmentsScheduledToday,
  upcomingReservations,
  isActiveReservation,
} from "@/lib/appointment-reminders";
import { convertAppointmentToJobCard } from "@/lib/convert-appointment-to-job";
import { invoicePaidTotal } from "@/lib/party/ledger-math";
import { useReservationReminders } from "@/hooks/use-reservation-reminders";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { sortByNewest } from "@/lib/sort-by-date";
import { appointmentIsEditable } from "@/lib/appointment-edit-policy";
import { EditReservationDialog } from "@/components/reservations/edit-reservation-dialog";
import { userCanEdit } from "@/lib/rbac";
import type { Appointment, Invoice, JobCard, JobCardStatus } from "@/types";
import {
  Plus,
  ClipboardList,
  Eye,
  IndianRupee,
  Wallet,
  Clock,
  LayoutList,
  Search,
  Loader2,
  CalendarRange,
  Pencil,
  Phone,
  Car,
  CheckCircle2,
  Calendar,
  Wrench,
  User,
} from "lucide-react";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { PageSkeleton, RefreshingBar } from "@/components/shared/skeleton-loader";

function compactRegForSearch(s: string): string {
  return normalizeRegistrationNumber(s).replace(/-/g, "").toLowerCase();
}

/** Parse `<input type="date">` value (yyyy-mm-dd) at local noon then clamp — avoids UTC drift from `new Date("yyyy-mm-dd")`. */
function parseHtmlDateLocal(value: string): Date | null {
  const v = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function startOfDayLocal(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  return x.getTime();
}

function endOfDayLocal(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return x.getTime();
}

function bookingMatchesSearch(jc: JobCard, queryRaw: string, branchName?: string): boolean {
  const q = queryRaw.trim().toLowerCase();
  if (!q) return true;
  const qDigits = queryRaw.replace(/\D/g, "");
  const phoneDigits = jc.customerPhone.replace(/\D/g, "");
  const regCompact = compactRegForSearch(jc.vehicleRegNumber);
  const qCompact = compactRegForSearch(queryRaw);
  const bn = branchName?.trim().toLowerCase() ?? "";
  return (
    jc.jobNumber.toLowerCase().includes(q) ||
    jc.customerName.toLowerCase().includes(q) ||
    (qDigits.length > 0 && phoneDigits.includes(qDigits)) ||
    (qCompact.length > 0 && regCompact.includes(qCompact)) ||
    jc.vehicleRegNumber.toLowerCase().includes(q) ||
    (bn.length > 0 && bn.includes(q)) ||
    (jc.services ?? []).some((s) => s.name.toLowerCase().includes(q))
  );
}

const STATUS_OPTIONS: { value: JobCardStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "RECEIVED", label: "Received" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "AWAITING_SERVICE", label: "In service" },
  { value: "QUALITY_CHECK", label: "Quality check" },
  { value: "READY", label: "Ready" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function BookingsPage() {
  const storesReady = useDashboardStoresReady();
  const router = useRouter();
  const { jobCards } = useJobCardStore();
  const invoices = useInvoiceStore((s) => s.invoices);
  const currentBranch = useAuthStore((s) => s.currentBranch);
  const authUser = useAuthStore((s) => s.user);
  const canEditBookings = userCanEdit(authUser, "BOOKINGS");
  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId, showBranchPicker } = useBranchScope();
  const appointments = useAppointmentStore((s) => s.appointments);
  const updateAppointment = useAppointmentStore((s) => s.updateAppointment);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const customers = useCustomerStore((s) => s.customers);
  const customerById = useMemo(
    () => Object.fromEntries(customers.map((c) => [c.id, c])),
    [customers]
  );
  const activeBranches = useMemo(() => branches.filter((b) => b.isActive), [branches]);

  const [searchQuery, setSearchQuery] = useState("");
  const [creatingFromAppointmentId, setCreatingFromAppointmentId] = useState<string | null>(
    null
  );
  const [editingReservation, setEditingReservation] = useState<Appointment | null>(null);
  const [editReservationOpen, setEditReservationOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<JobCardStatus | "ALL">("ALL");
  const [branchFilterId, setBranchFilterId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  useReservationReminders();

  const bookingReservations = useMemo(
    () =>
      appointments
        .filter((a) => resolveAppointmentKind(a) === "BOOKING")
        .sort((a, b) => {
          // Newest scheduled slots first so today's / upcoming bookings aren't buried.
          const da = `${b.date}T${b.time || "00:00"}`.localeCompare(`${a.date}T${a.time || "00:00"}`);
          if (da !== 0) return da;
          return b.bookingId.localeCompare(a.bookingId);
        }),
    [appointments]
  );

  const todaysBookingCount = useMemo(
    () => appointmentsScheduledToday(bookingReservations).length,
    [bookingReservations]
  );

  const upcomingBookingCount = useMemo(
    () => upcomingReservations(bookingReservations).length,
    [bookingReservations]
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (statusFilter !== "ALL") n += 1;
    if (showBranchPicker && branchFilterId !== "all") n += 1;
    if (dateFrom.trim() || dateTo.trim()) n += 1;
    return n;
  }, [statusFilter, showBranchPicker, branchFilterId, dateFrom, dateTo]);

  const headerScoped = useMemo(
    () => filterByBranchId(jobCards, (jc) => jc.branchId, selectedBranchId),
    [jobCards, selectedBranchId]
  );

  const filteredBookings = useMemo(() => {
    let list = headerScoped;
    if (showBranchPicker && branchFilterId !== "all") {
      list = list.filter((jc) => jc.branchId === branchFilterId);
    }
    if (statusFilter !== "ALL") {
      list = list.filter((jc) => jc.status === statusFilter);
    }
    if (dateFrom.trim()) {
      const parsed = parseHtmlDateLocal(dateFrom);
      if (parsed) {
        const t = startOfDayLocal(parsed);
        list = list.filter((jc) => new Date(jc.createdAt).getTime() >= t);
      }
    }
    if (dateTo.trim()) {
      const parsed = parseHtmlDateLocal(dateTo);
      if (parsed) {
        const t = endOfDayLocal(parsed);
        list = list.filter((jc) => new Date(jc.createdAt).getTime() <= t);
      }
    }
    return sortByNewest(list, "createdAt");
  }, [headerScoped, showBranchPicker, branchFilterId, statusFilter, dateFrom, dateTo]);

  const branchNameById = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  const searchFilteredBookings = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return filteredBookings;
    return filteredBookings.filter((jc) =>
      bookingMatchesSearch(jc, q, branchNameById[jc.branchId])
    );
  }, [filteredBookings, searchQuery, branchNameById]);

  const invoiceByJobId = useMemo(() => {
    const map: Record<string, Invoice> = {};
    for (const inv of invoices) {
      if (!inv.jobCardId) continue;
      map[inv.jobCardId] = inv;
    }
    return map;
  }, [invoices]);

  const confirmedAppointmentsNeedingJob = useMemo(() => {
    return bookingReservations
      .filter(
        (a) =>
          isActiveReservation(a) &&
          (a.status === "CONFIRMED" || a.status === "SCHEDULED") &&
          !isAppointmentSlotElapsed(a.date, a.time)
      );
  }, [bookingReservations]);

  const createJobFromAppointment = async (apt: Appointment) => {
    if (apt.jobCardId) return;
    setCreatingFromAppointmentId(apt.id);
    try {
      const job = await convertAppointmentToJobCard({
        apt,
        vehicles,
        catalog,
        branches,
        currentBranch,
        createdBy: authUser?.id ?? "usr-004",
      });
      if (!findCatalogServiceForAppointment(catalog, apt.serviceType)) {
        toast.info("Custom service line", {
          description: `No catalog match for "${apt.serviceType}" — check prices on the job card.`,
        });
      }
      toast.success("Job card created", {
        description: `${getAppointmentDisplayId(apt)} → ${job.jobNumber}`,
      });
      router.push(`/job-cards/${job.id}?checkIn=1`);
    } catch {
      toast.error("Could not create job card", {
        description: "Check that the API server is running and try again.",
      });
    } finally {
      setCreatingFromAppointmentId(null);
    }
  };

  const kpis = useMemo(() => {
    let totalRevenue = 0;
    let amountReceived = 0;
    let pendingAmount = 0;
    let invoiced = 0;
    let unbilled = 0;

    for (const jc of searchFilteredBookings) {
      const inv = invoiceByJobId[jc.id];
      if (inv) {
        invoiced++;
        totalRevenue += inv.grandTotal;
        const paid = invoicePaidTotal(inv);
        amountReceived += paid;
        pendingAmount += Math.max(0, inv.grandTotal - paid);
      } else {
        totalRevenue += jc.estimatedAmount;
        unbilled++;
      }
    }

    return {
      totalRevenue,
      amountReceived,
      pendingAmount,
      totalBookings: filteredBookings.length,
      invoiced,
      unbilled,
    };
  }, [searchFilteredBookings, invoiceByJobId]);

  const columns = useMemo(
    () => [
      {
        key: "jobNumber",
        label: "ID",
        render: (jc: JobCard) => (
          <span className="font-mono text-xs font-semibold text-primary">{jc.jobNumber}</span>
        ),
      },
      {
        key: "customerName",
        label: "Customer",
        render: (jc: JobCard) => <span className="font-medium">{jc.customerName}</span>,
      },
      {
        key: "customerPhone",
        label: "Contact",
        render: (jc: JobCard) => (
          <span className="text-muted-foreground whitespace-nowrap">{jc.customerPhone}</span>
        ),
      },
      {
        key: "vehicleRegNumber",
        label: "Reg. number",
        render: (jc: JobCard) => (
          <span className="font-mono text-xs">{jc.vehicleRegNumber}</span>
        ),
      },
      {
        key: "service",
        label: "Service",
        render: (jc: JobCard) => (
          <span className="text-muted-foreground">{jc.services[0]?.name ?? "—"}</span>
        ),
      },
      {
        key: "branchId",
        label: "Branch",
        render: (jc: JobCard) => (
          <span className="text-muted-foreground truncate max-w-[10rem] block">
            {branchNameById[jc.branchId] ?? jc.branchId}
          </span>
        ),
      },
      {
        key: "createdAt",
        label: "Date",
        sortable: true,
        render: (jc: JobCard) => (
          <span className="text-muted-foreground whitespace-nowrap">{formatDate(jc.createdAt)}</span>
        ),
      },
      {
        key: "bookedOn",
        label: "Booked on",
        render: (jc: JobCard) => (
          <span className="text-muted-foreground whitespace-nowrap">{formatDate(jc.createdAt)}</span>
        ),
      },
      {
        key: "estimatedAmount",
        label: "Price",
        render: (jc: JobCard) => (
          <span className="tabular-nums font-medium">{formatCurrency(jc.estimatedAmount)}</span>
        ),
      },
      {
        key: "mechanicName",
        label: "Floor mgr",
        render: (jc: JobCard) => (
          <span className="text-muted-foreground">{jc.mechanicName ?? "—"}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (jc: JobCard) => (
          <JobCardStatusBadge status={jc.status} className="whitespace-nowrap shrink-0" />
        ),
      },
      {
        key: "actions",
        label: "Actions",
        className: "text-center w-24",
        render: (jc: JobCard) => (
          <div className="inline-flex items-center justify-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/job-cards/${jc.id}`} aria-label="Open job">
                <ClipboardList className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/job-cards/${jc.id}`} aria-label="View job">
                <Eye className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [branchNameById]
  );

  if (!storesReady && jobCards.length === 0) return <PageSkeleton />;

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-6">
      <RefreshingBar show={!storesReady} />
      <PageHeader
        title="Bookings"
        inlineActionsOnMobile
        actions={
          <Button size="sm" className="shrink-0 whitespace-nowrap" asChild>
            <Link href="/bookings/walk-in">
              <Plus className="w-4 h-4 mr-1.5" />
              Create booking
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Today&apos;s bookings</p>
            <p className="text-2xl font-bold tabular-nums mt-2">{todaysBookingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Upcoming</p>
            <p className="text-2xl font-bold tabular-nums mt-2">{upcomingBookingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Awaiting arrival</p>
            <p className="text-2xl font-bold tabular-nums mt-2">{confirmedAppointmentsNeedingJob.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active jobs</p>
            <p className="text-2xl font-bold tabular-nums mt-2">{searchFilteredBookings.length}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">All bookings</h2>
            <p className="text-sm text-muted-foreground">
              Pre-service reservations — create a job card when the customer arrives.
            </p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {bookingReservations.length} booking{bookingReservations.length !== 1 ? "s" : ""}
          </span>
        </div>

        {bookingReservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/85 py-16 text-muted-foreground">
            <CalendarRange className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">No bookings yet</p>
            <Button size="sm" asChild>
              <Link href="/bookings/walk-in">
                <Plus className="w-4 h-4 mr-1.5" />
                Create booking
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {bookingReservations.map((apt) => {
              const isElapsed = isAppointmentSlotElapsed(apt.date, apt.time);
              const isConverted = !!apt.jobCardId;
              const initials = apt.customerName
                .trim()
                .split(/\s+/)
                .map((w) => w[0]?.toUpperCase() ?? "")
                .slice(0, 2)
                .join("");
              const customerAvatar = apt.customerId ? customerById[apt.customerId]?.avatar : null;
              const accentColor = isConverted
                ? "bg-emerald-500"
                : isElapsed
                ? "bg-rose-400"
                : "bg-primary";
              const avatarBg = isConverted
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                : isElapsed
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                : "bg-primary/10 text-primary";

              return (
                <div
                  key={apt.id}
                  className="group relative flex flex-col rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200"
                >
                  {/* Left accent */}
                  <div className={`absolute inset-y-0 left-0 w-[3px] ${accentColor}`} />

                  <div className="flex-1 px-5 pt-4 pb-3 space-y-3.5">
                    {/* Row 1: booking ID + status pill */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                        {getAppointmentDisplayId(apt)}
                      </span>
                      {isConverted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Converted
                        </span>
                      ) : isElapsed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
                          <Clock className="h-3 w-3" />
                          Elapsed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                          <Calendar className="h-3 w-3" />
                          Upcoming
                        </span>
                      )}
                    </div>

                    {/* Row 2: avatar + customer info */}
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold ${customerAvatar ? "" : avatarBg}`}>
                        {customerAvatar ? (
                          <img src={customerAvatar} alt={apt.customerName} className="h-full w-full object-cover" />
                        ) : (
                          initials || <User className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-snug truncate">{apt.customerName}</p>
                        {apt.customerPhone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3 shrink-0" />
                            {apt.customerPhone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 3: chips */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {apt.date}{apt.time ? ` · ${apt.time}` : ""}
                      </span>
                      {apt.serviceType && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground max-w-[160px]">
                          <Wrench className="h-3 w-3 shrink-0" />
                          <span className="truncate">{apt.serviceType}</span>
                        </span>
                      )}
                      {apt.vehicleRegNumber && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/80 border border-border/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                          <Car className="h-3 w-3 shrink-0" />
                          {apt.vehicleRegNumber}
                        </span>
                      )}

                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mx-5 border-t border-border/50 py-3 flex items-center gap-2">
                    {canEditBookings && appointmentIsEditable(apt) && (
                      <button
                        type="button"
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                        onClick={() => {
                          setEditingReservation(apt);
                          setEditReservationOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    )}
                    {isConverted ? (
                      <Link
                        href={`/job-cards/${apt.jobCardId}`}
                        className="flex flex-1 h-8 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View job card
                      </Link>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={creatingFromAppointmentId === apt.id}
                          className="flex flex-1 h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap dark:bg-primary/15 dark:text-primary dark:border dark:border-primary/35 dark:hover:bg-primary/25"
                          onClick={() => void createJobFromAppointment(apt)}
                        >
                          {creatingFromAppointmentId === apt.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          Create job card
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 hidden">
        <Card className="border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 h-full">
          <CardContent className="p-4 sm:p-5 flex flex-col h-full min-h-[9rem]">
            <div className="flex items-center gap-3 min-h-8">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100/90 text-emerald-700 shadow-sm ring-1 ring-emerald-200/50 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-800/50"
                aria-hidden
              >
                <IndianRupee className="size-4" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 leading-none">
                Total revenue
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-4 text-emerald-800 dark:text-emerald-300">
              {formatCurrency(kpis.totalRevenue)}
            </p>
            <p className="text-xs text-muted-foreground mt-auto pt-2 leading-snug">
              {kpis.totalBookings} booking{kpis.totalBookings !== 1 ? "s" : ""} in view · {kpis.invoiced}{" "}
              invoiced
            </p>
          </CardContent>
        </Card>
        <Card className="border-sky-200/60 bg-sky-50/50 dark:bg-sky-950/20 dark:border-sky-900/40 h-full">
          <CardContent className="p-4 sm:p-5 flex flex-col h-full min-h-[9rem]">
            <div className="flex items-center gap-3 min-h-8">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-100/90 text-sky-700 shadow-sm ring-1 ring-sky-200/50 dark:bg-sky-900/40 dark:text-sky-300 dark:ring-sky-800/50"
                aria-hidden
              >
                <Wallet className="size-4" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400 leading-none">
                Amount received
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-4 text-sky-800 dark:text-sky-300">
              {formatCurrency(kpis.amountReceived)}
            </p>
            <p className="text-xs text-muted-foreground mt-auto pt-2 leading-snug">
              Payments collected on invoices
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 h-full">
          <CardContent className="p-4 sm:p-5 flex flex-col h-full min-h-[9rem]">
            <div className="flex items-center gap-3 min-h-8">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100/90 text-amber-700 shadow-sm ring-1 ring-amber-200/50 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-800/50"
                aria-hidden
              >
                <Clock className="size-4" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 leading-none">
                Pending amount
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-4 text-amber-800 dark:text-amber-300">
              {formatCurrency(kpis.pendingAmount)}
            </p>
            <p className="text-xs text-muted-foreground mt-auto pt-2 leading-snug">
              Unpaid on invoices · {kpis.unbilled} without invoice
            </p>
          </CardContent>
        </Card>
        <Card className="border-cyan-200/60 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-900/40 h-full">
          <CardContent className="p-4 sm:p-5 flex flex-col h-full min-h-[9rem]">
            <div className="flex items-center gap-3 min-h-8">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100/90 text-cyan-700 shadow-sm ring-1 ring-cyan-200/50 dark:bg-cyan-900/40 dark:text-cyan-300 dark:ring-cyan-800/50"
                aria-hidden
              >
                <LayoutList className="size-4" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 leading-none">
                Bookings
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-4 text-cyan-800 dark:text-cyan-300">
              {kpis.totalBookings}
            </p>
            <p className="text-xs text-muted-foreground mt-auto pt-2 leading-snug">
              Matching search &amp; filters (status, branch, dates)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 border-border/80 border-dashed shadow-sm bg-muted/20">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarRange className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Arriving today — create job card</CardTitle>
              <p className="text-sm text-muted-foreground max-md:hidden">
                When the customer arrives, start the job card from their booking.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {confirmedAppointmentsNeedingJob.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No confirmed appointments waiting for a job. Confirm a scheduled booking to see it
              here.
            </p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {confirmedAppointmentsNeedingJob.map((apt) => (
                  <div
                    key={apt.id}
                    className="rounded-lg border border-border bg-background p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {getAppointmentDisplayId(apt)}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {apt.date} · {apt.time}
                      </span>
                    </div>
                    <p className="mt-2 font-medium leading-snug">{apt.customerName}</p>
                    <a
                      href={`tel:${apt.customerPhone.replace(/\s/g, "")}`}
                      className="text-xs text-primary"
                    >
                      {apt.customerPhone}
                    </a>
                    <p className="mt-2 font-mono text-xs">{apt.vehicleRegNumber}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {apt.vehicleMakeModel}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {apt.serviceType}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {canEditBookings && appointmentIsEditable(apt) ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setEditingReservation(apt);
                            setEditReservationOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        className="w-full"
                        disabled={creatingFromAppointmentId === apt.id}
                        onClick={() => void createJobFromAppointment(apt)}
                      >
                        {creatingFromAppointmentId === apt.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Create job card
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block rounded-lg border border-border bg-background overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="p-3 font-medium">Booking</th>
                      <th className="p-3 font-medium whitespace-nowrap">Date &amp; time</th>
                      <th className="p-3 font-medium">Customer</th>
                      <th className="p-3 font-medium">Vehicle</th>
                      <th className="p-3 font-medium hidden md:table-cell">Service</th>
                      <th className="p-3 font-medium text-right w-[1%]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmedAppointmentsNeedingJob.map((apt) => (
                      <tr key={apt.id} className="border-b border-border/80 last:border-0">
                        <td className="p-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">
                          {getAppointmentDisplayId(apt)}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {apt.date} · {apt.time}
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{apt.customerName}</div>
                          <div className="text-xs text-muted-foreground">{apt.customerPhone}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-xs">{apt.vehicleRegNumber}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {apt.vehicleMakeModel}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell max-w-[12rem] truncate">
                          {apt.serviceType}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            {canEditBookings && appointmentIsEditable(apt) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="whitespace-nowrap"
                                onClick={() => {
                                  setEditingReservation(apt);
                                  setEditReservationOpen(true);
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                Edit
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              className="whitespace-nowrap"
                              disabled={creatingFromAppointmentId === apt.id}
                              onClick={() => void createJobFromAppointment(apt)}
                            >
                              {creatingFromAppointmentId === apt.id ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Plus className="w-3.5 h-3.5 mr-1.5" />
                              )}
                              Create job card
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 border-border/80 shadow-sm">
        <CardContent className="min-w-0 pt-6 space-y-4">
          <div className="w-full min-w-0 max-w-full overflow-x-clip rounded-xl border border-border bg-background p-3 shadow-sm sm:p-4">
            <div className="flex w-full min-w-0 max-w-full flex-col gap-3 xl:flex-nowrap xl:flex-row xl:items-center">
              <div className="relative w-full min-w-0 max-w-full xl:min-w-[220px] xl:flex-[1.25]">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone or reg. no"
                  className="h-10 min-w-0 max-w-full bg-background pl-9"
                  aria-label="Search bookings"
                />
              </div>
              <MobileFilterTrigger
                onClick={() => setFilterSheetOpen(true)}
                activeCount={activeFilterCount}
              />
              <div className="hidden w-full min-w-0 max-w-full flex-col gap-3 md:flex xl:flex-nowrap xl:flex-row xl:items-center">
                <div className="w-full min-w-0 max-w-full xl:w-[168px] xl:shrink-0">
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as JobCardStatus | "ALL")}
                  >
                    <SelectTrigger className="h-10 w-full min-w-0 bg-background xl:w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {showBranchPicker && (
                  <div className="w-full min-w-0 max-w-full xl:w-[168px] xl:shrink-0">
                    <Select value={branchFilterId} onValueChange={setBranchFilterId}>
                      <SelectTrigger className="h-10 w-full min-w-0 bg-background xl:w-full">
                        <SelectValue placeholder="All Branches" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {activeBranches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex w-full min-w-0 max-w-full flex-col gap-2 md:flex-row md:items-stretch md:gap-2 xl:flex-[1.1] xl:justify-end xl:gap-2">
                  <div className="w-full min-w-0 md:min-w-0 md:flex-1 md:max-w-[11rem] xl:max-w-[11rem]">
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="date-input-icon-end h-10 min-w-0 w-full max-w-full bg-background pr-9 [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                  <span className="shrink-0 self-center px-0.5 text-center text-sm text-muted-foreground md:self-center">
                    to
                  </span>
                  <div className="w-full min-w-0 md:min-w-0 md:flex-1 md:max-w-[11rem] xl:max-w-[11rem]">
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="date-input-icon-end h-10 min-w-0 w-full max-w-full bg-background pr-9 [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <DataTable<JobCard>
              data={searchFilteredBookings}
              columns={columns}
              defaultSortKey="createdAt"
              defaultSortDir="desc"
              hideSearch
              searchPlaceholder="Search by name, phone, registration, or job ID…"
              searchMatch={(jc, qLower) =>
                bookingMatchesSearch(jc, qLower, branchNameById[jc.branchId])
              }
              pageSize={10}
              onRowClick={(jc) => router.push(`/job-cards/${jc.id}`)}
              renderMobileCard={(jc) => (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{jc.jobNumber}</span>
                    <JobCardStatusBadge
                      status={jc.status}
                      className="shrink-0 whitespace-nowrap text-[10px]"
                    />
                  </div>
                  <p className="font-medium mt-1.5 leading-tight">{jc.customerName}</p>
                  <p className="text-xs text-muted-foreground">{jc.customerPhone}</p>
                  <p className="text-xs font-mono mt-1">{jc.vehicleRegNumber}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{jc.services[0]?.name ?? "—"}</p>
                  <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Branch</dt>
                    <dd className="text-foreground truncate">{branchNameById[jc.branchId] ?? jc.branchId}</dd>
                    <dt className="text-muted-foreground">Booked</dt>
                    <dd className="text-foreground">{formatDate(jc.createdAt)}</dd>
                    <dt className="text-muted-foreground">Price</dt>
                    <dd className="text-foreground tabular-nums font-medium">
                      {formatCurrency(jc.estimatedAmount)}
                    </dd>
                    <dt className="text-muted-foreground">Floor mgr</dt>
                    <dd className="text-foreground truncate">{jc.mechanicName ?? "—"}</dd>
                  </dl>
                  <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-border/80">
                    <Button variant="outline" size="sm" className="h-8" asChild>
                      <Link href={`/job-cards/${jc.id}`}>
                        <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                        Open
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                      <Link href={`/job-cards/${jc.id}`} aria-label="View booking">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <MobileFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        title="Booking filters"
        activeCount={activeFilterCount}
        onReset={() => {
          setStatusFilter("ALL");
          setBranchFilterId("all");
          setDateFrom("");
          setDateTo("");
        }}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">Status</p>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as JobCardStatus | "ALL")}
          >
            <SelectTrigger className="h-10 w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showBranchPicker ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Branch</p>
            <Select value={branchFilterId} onValueChange={setBranchFilterId}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {activeBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="text-sm font-medium">Date range</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="date-input-icon-end h-10 bg-background"
              aria-label="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="date-input-icon-end h-10 bg-background"
              aria-label="To date"
            />
          </div>
        </div>
      </MobileFilterSheet>
      <EditReservationDialog
        appointment={editingReservation}
        open={editReservationOpen}
        onOpenChange={(open) => {
          setEditReservationOpen(open);
          if (!open) setEditingReservation(null);
        }}
      />
    </div>
  );
}
