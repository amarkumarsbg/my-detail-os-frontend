"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  FileText,
  User,
  Car,
  Camera,
  Upload,
  X,
  ImageIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageCircle,
  ArrowLeftRight,
  Clock,
  Lock,
  AlertTriangle,
  Sparkles,
  IndianRupee,
  LayoutGrid,
  ListChecks,
  Phone,
  Mail,
  CalendarDays,
  Package,
  Plus,
  Pencil,
  Truck,
} from "lucide-react";
import { TimerControlsBufferCard } from "@/components/job-cards/timer-controls-buffer-card";
import { ServiceTimerDeliverySummary } from "@/components/job-cards/service-timer-delivery-summary";
import { EditJobCardDetailsDialog } from "@/components/job-cards/edit-job-card-details-dialog";
import { RecordPaymentDialog } from "@/components/billing/record-payment-dialog";
import {
  JobCardWorkflowChrome,
  JOB_CARD_STATUS_LABELS,
} from "@/components/job-cards/job-card-workflow-chrome";
import { JobCardHeaderCard } from "@/components/job-cards/job-card-header-card";
import { JobCardWhatsAppNotifyDialog } from "@/components/job-cards/job-card-whatsapp-notify-dialog";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { JobCardNotesPanel } from "@/components/job-cards/job-card-notes-panel";
import { JobCardServiceChecklist } from "@/components/job-cards/job-card-service-checklist";
import {
  DeliverVehicleDialog,
  type DeliverVehicleResult,
} from "@/components/job-cards/deliver-vehicle-dialog";
import { useJobTimer } from "@/hooks/use-job-timer";
import {
  jobCardIsEditable,
  jobCardPartsEditable,
  canEditJobCardPricing,
} from "@/lib/job-card-edit-policy";
import { computeServiceTimerSnapshot, getServiceTimerSummaryForJob, initialServiceTimerPatch } from "@/lib/job-timer";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useJobCardStore } from "@/store/job-card-store";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import { useCustomerStore } from "@/store/customer-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useInventoryStore } from "@/store/inventory-store";
import { useStaffStore } from "@/store/staff-store";
import {
  ADD_MECHANIC_SELECT_VALUE,
  QuickAddMechanicDialog,
} from "@/components/staff/quick-add-mechanic-dialog";
import { canCreateStaffAccounts } from "@/lib/rbac";
import { useHighEndServiceStore, highEndPriceForSegment } from "@/store/high-end-service-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useServiceCategoryStore } from "@/store/service-category-store";
import { useMembershipStore } from "@/store/membership-store";
import { useReminderStore } from "@/store/reminder-store";
import { useAuthStore } from "@/store/auth-store";
import { useSettingsStore } from "@/store/settings-store";
import { JobCardPartsPicker,
  buildJobCardPartItems,
  jobCardPartsSubtotal,
  selectedLinesFromJobParts,
  type SelectedPartLine,
} from "@/components/job-cards/job-card-parts-picker";
import {
  MultiPhotoCameraCapture,
  canUseLiveCameraPreview,
  requestCameraStream,
} from "@/components/job-cards/multi-photo-camera-capture";
import { apiGet, ApiError } from "@/lib/api-client";
import { ensureDomainResources, invalidateDomainResources } from "@/lib/domain-data-loader";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import {
  refreshJobCardFromServer,
  uploadJobInspectionPhoto,
} from "@/lib/job-card-inspection-photo-upload";
import {
  hasAfterInspectionPhoto,
  hasBeforeInspectionPhoto,
  isAfterInspectionPhoto,
  isBeforeInspectionPhoto,
  mergeInspectionPhotosById,
  normalizeInspectionPhotoKind,
  toPersistedInspectionPhotoType,
} from "@/lib/job-card-inspection-photos";
import { createOrGetInvoiceForJob } from "@/lib/invoice-from-job-card";
import {
  notifyBeforePhotosReadyWhatsApp,
  notifyHighEndAdvanceRecordedWhatsApp,
  notifyInvoiceCreatedWhatsApp,
  notifyJobDeliveredWhatsApp,
  notifyJobReadyWhatsApp,
} from "@/lib/whatsapp-automation-triggers";
import {
  buildHighEndReminderMonthIntervals,
  defaultManualFirstFollowUpMonths,
  expectedDeliveryFromHighEndCompletion,
  formatHighEndCompletionMinutes,
  HIGH_END_COMPLETION_PRESETS,
  highEndCompletionSelectValue,
} from "@/lib/high-end-follow-up";
import { computeGstFromSubtotal } from "@/lib/gst-tax";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { userCanCreate, userCanEdit } from "@/lib/rbac";
import { useBranchScope } from "@/lib/branch-scope";
import { useStaffRewardStore } from "@/store/staff-reward-store";
import {
  buildDropRequestInput,
  getLinkedDropRequest,
  getLinkedPickupRequest,
  jobNeedsDropOffForm,
  orphanPickupRequestIdForJob,
} from "@/lib/pickup-drop-flow";
import { isMembershipPricedLine } from "@/lib/service-line-price";
import type {
  JobCard,
  JobCardStatus,
  ServiceItem,
  InspectionPhoto,
  MechanicSwitchLog,
  TimerAdjustment,
  PaymentMethod,
} from "@/types";

const WORKFLOW_STATUSES: JobCardStatus[] = [
  "RECEIVED",
  "INSPECTION",
  "AWAITING_SERVICE",
  "QUALITY_CHECK",
  "READY",
  "DELIVERED",
];

/** Record staff rewards after a successful DELIVERED update; never throws into delivery UI. */
function recordJobDeliveryRewardsSafe(job: JobCard): void {
  try {
    if (!job.mechanicId?.trim()) return;
    useStaffRewardStore.getState().recordJobDeliveryRewards({
      id: job.id,
      jobNumber: job.jobNumber,
      mechanicId: job.mechanicId,
      mechanicName: job.mechanicName,
      branchId: job.branchId,
      estimatedAmount: job.estimatedAmount ?? 0,
      incentivePercent: job.incentivePercent ?? 0,
      incentiveAmount: job.incentiveAmount ?? 0,
      actualDelivery: job.actualDelivery,
      promisedDelivery: job.expectedDelivery,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("recordJobDeliveryRewards failed", err);
    }
  }
}

function formatSegmentLabel(segment: string): string {
  return segment
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeJobCardStatus(raw: string | undefined): JobCardStatus {
  if (!raw) return "RECEIVED";
  const upper = String(raw).toUpperCase();
  if (upper === "CANCELLED") return "CANCELLED";
  const hit = WORKFLOW_STATUSES.find((w) => w === upper);
  return hit ?? "RECEIVED";
}

function formatHighEndIntervalMonths(m: number): string {
  return m >= 12 ? `${m / 12}yr` : `${m}mo`;
}

type TaskChecklistRow =
  | { kind: "catalog"; service: ServiceItem }
  | {
      kind: "highEnd";
      hesId: string;
      name: string;
      price: number;
      durationMinutes?: number;
      completed: boolean;
    };

export default function JobCardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { jobCards, updateJobCard } = useJobCardStore();
  const [singleFetchDone, setSingleFetchDone] = useState(false);

  useEffect(() => {
    setSingleFetchDone(false);
  }, [id]);
  const pickupDropRequests = usePickupDropStore((s) => s.requests);
  const pickupDropHydrated = usePickupDropStore((s) => s.hydrated);
  const { selectedBranchId } = useBranchScope();
  const customers = useCustomerStore((s) => s.customers);
  const staff = useStaffStore((s) => s.staff);

  const jobCard = useMemo(
    () => jobCards.find((jc) => jc.id === id),
    [jobCards, id]
  );

  useEffect(() => {
    let cancelled = false;
    if (!id || jobCard || singleFetchDone) return;
    void (async () => {
      try {
        const data = await apiGet<{ item: JobCard }>(`/api/job-cards/${encodeURIComponent(id)}`);
        if (cancelled || !data.item) return;
        useJobCardStore.setState((state) => {
          if (state.jobCards.some((j) => j.id === data.item.id)) return state;
          return { jobCards: [data.item, ...state.jobCards] };
        });
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) {
          if (process.env.NODE_ENV !== "production") {
            console.error(e);
          }
        }
      } finally {
        if (!cancelled) setSingleFetchDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, jobCard, singleFetchDone]);

  useEffect(() => {
    if (!jobCard || !pickupDropHydrated) return;
    const orphanId = orphanPickupRequestIdForJob(jobCard, pickupDropRequests);
    if (!orphanId) return;
    usePickupDropStore.getState().linkJobCard(orphanId, jobCard.id, jobCard.jobNumber, {
      vehicleRegNumber: jobCard.vehicleRegNumber,
      vehicleMakeModel: jobCard.vehicleMakeModel,
      customerName: jobCard.customerName,
      customerPhone: jobCard.customerPhone,
    });
  }, [jobCard, pickupDropHydrated, pickupDropRequests]);

  const customerRecord = useMemo(
    () => (jobCard ? customers.find((c) => c.id === jobCard.customerId) : undefined),
    [customers, jobCard]
  );

  const dropOffPrefill = useMemo(() => {
    if (!jobCard || !jobNeedsDropOffForm(jobCard, pickupDropRequests)) return null;
    const drop = getLinkedDropRequest(jobCard.id, pickupDropRequests);
    const pickup = getLinkedPickupRequest(jobCard.id, pickupDropRequests);
    return {
      branchId: jobCard.branchId,
      branchScoped: Boolean(selectedBranchId),
      address:
        drop?.address?.trim() ||
        pickup?.address?.trim() ||
        customerRecord?.address?.trim() ||
        "",
      driverId: drop?.driverId,
      driverName: drop?.driverName,
      scheduledTime: drop?.scheduledTime || jobCard.expectedDelivery,
    };
  }, [jobCard, pickupDropRequests, selectedBranchId, customerRecord]);

  const invoices = useInvoiceStore((s) => s.invoices);
  const businessName = useSettingsStore((s) => s.businessName);
  const gstRegistrationStatus = useSettingsStore((s) => s.gstRegistrationStatus);
  const invoiceForJob = useMemo(
    () => (jobCard ? invoices.find((inv) => inv.jobCardId === jobCard.id) : undefined),
    [invoices, jobCard]
  );
  const jobCardSubtotalExGst = useMemo(() => {
    if (!jobCard) return 0;
    const servicesSubtotal = jobCard.services.reduce((sum, line) => sum + (line.price ?? 0), 0);
    const partsSubtotal = (jobCard.parts ?? []).reduce((sum, part) => sum + (part.lineTotal ?? 0), 0);
    const highEndSubtotal = (jobCard.highEndServiceIds ?? []).reduce((sum, hesId) => {
      const cfg = useHighEndServiceStore.getState().services.find((item) => item.id === hesId);
      return sum + (cfg ? highEndPriceForSegment(cfg, jobCard.vehicleSegment) : 0);
    }, 0);
    return Math.round(
      (servicesSubtotal + partsSubtotal + highEndSubtotal + (jobCard.membershipActivationAmount ?? 0)) *
        100
    ) / 100;
  }, [jobCard]);
  const jobCardPayableAmount = useMemo(() => {
    if (!jobCard) return 0;
    if (invoiceForJob) return invoiceForJob.grandTotal;
    return computeGstFromSubtotal(jobCardSubtotalExGst, gstRegistrationStatus).grandTotal;
  }, [jobCard, invoiceForJob, gstRegistrationStatus, jobCardSubtotalExGst]);

  const mechanics = useMemo(
    () => staff.filter((s) => s.role === "MECHANIC"),
    [staff]
  );
  const authUser = useAuthStore((s) => s.user);
  const canAddMechanic = canCreateStaffAccounts(authUser?.role);
  const [addMechanicOpen, setAddMechanicOpen] = useState(false);
  const canAdjustBuffer = useMemo(() => {
    const r = authUser?.role;
    if (!r) return false;
    return (
      r === "SUPERVISOR" ||
      r === "ADMIN" ||
      r === "BRANCH_MANAGER" ||
      r === "MANAGER" ||
      r === "SUPER_ADMIN"
    );
  }, [authUser?.role]);

  const canPauseResume = useMemo(() => {
    const r = authUser?.role;
    if (!r) return false;
    return (
      canAdjustBuffer ||
      r === "MECHANIC" ||
      r === "RECEPTIONIST"
    );
  }, [authUser?.role, canAdjustBuffer]);

  const { services: highEndServiceConfigs } = useHighEndServiceStore();
  const { generateHighEndReminders, applyCategoryRemindersOnDeliver } = useReminderStore();
  /** Fallback % for suggested advance copy on job card when creation left hint empty. */
  const effectiveAdvanceHintPercent = jobCard?.highEndAdvanceHintPercent ?? 30;
  const serviceCatalog = useServiceCatalogStore((s) => s.catalog);
  const serviceCategories = useServiceCategoryStore((s) => s.categories);
  const membershipPackages = useMembershipStore((s) => s.packages);
  const cancelMembership = useMembershipStore((s) => s.cancelMembership);
  const getActiveMembership = useMembershipStore((s) => s.getActiveMembership);
  const getUsedIncludedServiceCount = useMembershipStore((s) => s.getUsedIncludedServiceCount);
  const getRemainingIncludedServiceCount = useMembershipStore((s) => s.getRemainingIncludedServiceCount);
  const redeemMembershipServiceUsage = useMembershipStore((s) => s.redeemMembershipServiceUsage);
  const rollbackMembershipServiceUsage = useMembershipStore((s) => s.rollbackMembershipServiceUsage);

  /** Advance UI: premium programs and/or any catalog line marked high-end (not only the PPF wizard step). */
  const jobQualifiesForHighEndAdvance = useMemo(() => {
    if (!jobCard) return false;
    if (jobCard.highEndServiceIds && jobCard.highEndServiceIds.length > 0) return true;
    for (const line of jobCard.services) {
      const cat = serviceCatalog.find((c) => c.id === line.serviceCatalogId);
      if (cat?.isHighEnd) return true;
    }
    return false;
  }, [jobCard, serviceCatalog]);

  const jobTicker = useJobTimer({
    serviceTimerStartedAt: jobCard?.serviceTimerStartedAt,
    serviceAllocatedMinutes: jobCard?.serviceAllocatedMinutes,
    bufferTotalMinutes: jobCard?.bufferTotalMinutes,
    bufferRemainingMinutes: jobCard?.bufferRemainingMinutes,
    timerIsPaused: jobCard?.timerIsPaused,
    timerPausedAt: jobCard?.timerPausedAt,
    totalPausedMs: jobCard?.totalPausedMs,
  });

  const serviceTimerDeliverySummary = useMemo(
    () => (jobCard ? getServiceTimerSummaryForJob(jobCard) : null),
    [jobCard]
  );

  const [currentStatus, setCurrentStatus] = useState<JobCardStatus>(
    () => jobCard?.status ?? "RECEIVED"
  );
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>(
    () => jobCard?.services ?? []
  );
  const [notes, setNotes] = useState<string>(jobCard?.notes ?? "");
  const [newNote, setNewNote] = useState("");
  const [currentMechanicId, setCurrentMechanicId] = useState<string | undefined>(jobCard?.mechanicId);
  const [currentMechanicName, setCurrentMechanicName] = useState<string | undefined>(jobCard?.mechanicName);
  const [switchLog, setSwitchLog] = useState<MechanicSwitchLog[]>(jobCard?.mechanicSwitchLog ?? []);
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [showQuickAssignDialog, setShowQuickAssignDialog] = useState(false);
  const [beforePhotoRequiredOpen, setBeforePhotoRequiredOpen] = useState(false);
  const checkInPromptHandledRef = useRef(false);
  const beforePhotoModalInputRef = useRef<HTMLInputElement>(null);
  const [afterPhotoRequiredOpen, setAfterPhotoRequiredOpen] = useState(false);
  const afterPhotoModalInputRef = useRef<HTMLInputElement>(null);
  // Tracks whether before-photos WhatsApp was already sent in this session to prevent duplicates
  // (fires at INSPECTION if photos exist, or at AWAITING_SERVICE as fallback — but never both).
  const beforePhotosWhatsAppSentRef = useRef(false);
  const [multiCamOpen, setMultiCamOpen] = useState(false);
  const [multiCamType, setMultiCamType] = useState<"BEFORE" | "AFTER">("BEFORE");
  const [multiCamStreamPromise, setMultiCamStreamPromise] = useState<Promise<MediaStream> | null>(
    null
  );
  const [whatsAppNotifyOpen, setWhatsAppNotifyOpen] = useState(false);
  const [deliverVehicleOpen, setDeliverVehicleOpen] = useState(false);

  // Open deliver-vehicle dialog from ?deliverVehicle=1 query param (set by
  // billing invoice page after recording payment), but only when the job card
  // is not already delivered. Clear the param from the URL immediately so
  // navigating back to this page later doesn't re-open the dialog.
  useEffect(() => {
    if (searchParams.get("deliverVehicle") !== "1") return;
    router.replace(`/job-cards/${id}`, { scroll: false });
    if (currentStatus !== "DELIVERED" && currentStatus !== "CANCELLED") {
      setDeliverVehicleOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open before photo check-in from ?checkIn=1 (set when creating a job
  // card from the bookings page). Clear param immediately.
  useEffect(() => {
    checkInPromptHandledRef.current = false;
  }, [id]);

  useEffect(() => {
    if (searchParams.get("checkIn") !== "1") return;
    if (checkInPromptHandledRef.current) return;

    const isMobileViewport =
      typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

    if (!isMobileViewport) {
      checkInPromptHandledRef.current = true;
      router.replace(`/job-cards/${id}`, { scroll: false });
      if (currentStatus === "RECEIVED" || currentStatus === "INSPECTION") {
        setBeforePhotoRequiredOpen(true);
      }
      return;
    }

    // Mobile fix: wait until at least one data pass is done, then resolve
    // latest photos before deciding whether check-in is still required.
    if (!jobCard && !singleFetchDone) return;
    checkInPromptHandledRef.current = true;
    router.replace(`/job-cards/${id}`, { scroll: false });

    void (async () => {
      let resolved = useJobCardStore.getState().jobCards.find((j) => j.id === id) ?? jobCard;

      const hasBeforeLocal =
        hasBeforeInspectionPhoto(resolved?.inspectionPhotos) ||
        Boolean(resolved?.checkInCompletedAt);

      if (!hasBeforeLocal) {
        try {
          const refreshed = await refreshJobCardFromServer(id);
          if (refreshed) resolved = refreshed;
        } catch {
          // Non-blocking: fallback to currently available store state.
        }
      }

      const hasBeforeResolved =
        hasBeforeInspectionPhoto(resolved?.inspectionPhotos) ||
        Boolean(resolved?.checkInCompletedAt);
      const resolvedStatus = normalizeJobCardStatus(resolved?.status);

      if (!hasBeforeResolved && (resolvedStatus === "RECEIVED" || resolvedStatus === "INSPECTION")) {
        setBeforePhotoRequiredOpen(true);
      }
    })();
  }, [searchParams, router, id, currentStatus, jobCard, singleFetchDone]);
  const [deliverVehicleSubmitting, setDeliverVehicleSubmitting] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [serviceChecklistRequiredOpen, setServiceChecklistRequiredOpen] = useState(false);
  const [qualityCheckRequiredOpen, setQualityCheckRequiredOpen] = useState(false);
  const [quickAssignMechanicId, setQuickAssignMechanicId] = useState("");
  const [switchToMechanicId, setSwitchToMechanicId] = useState("");
  const [switchReason, setSwitchReason] = useState("");
  const [switchCustomReason, setSwitchCustomReason] = useState("");
  const [qualityCheckDone, setQualityCheckDone] = useState(
    () => jobCard?.qualityCheckCompleted ?? false
  );
  const [detailTab, setDetailTab] = useState("overview");
  const [highEndFollowUpById, setHighEndFollowUpById] = useState<Record<string, number>>({});
  const [highEndCompletionById, setHighEndCompletionById] = useState<Record<string, number>>({});
  const [highEndChecklistDoneById, setHighEndChecklistDoneById] = useState<Record<string, boolean>>(
    () => jobCard?.highEndServiceCompletedById ?? {}
  );
  const [partsDialogOpen, setPartsDialogOpen] = useState(false);
  const [partsDraftLines, setPartsDraftLines] = useState<SelectedPartLine[]>([]);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);

  const inventoryParts = useInventoryStore((s) => s.parts);

  const canEditJobCards = userCanEdit(authUser, "JOB_CARDS");
  const canEditJobDetails = Boolean(
    jobCard && jobCardIsEditable({ status: currentStatus }) && canEditJobCards
  );
  const canEditParts = Boolean(
    jobCard &&
      jobCardPartsEditable({
        status: currentStatus,
        inventoryConsumedAt: jobCard.inventoryConsumedAt,
      }) &&
      canEditJobCards
  );
  const canEditPricing = Boolean(
    jobCard && canEditJobCardPricing(authUser, { status: currentStatus }, Boolean(invoiceForJob))
  );

  const persistHighEndCompletion = useCallback(
    (next: Record<string, number>) => {
      if (!jobCard) return;
      setHighEndCompletionById(next);
      const payload: Record<string, number> = {};
      for (const sid of jobCard.highEndServiceIds ?? []) {
        const m = next[sid];
        if (m != null && m > 0 && Number.isFinite(m)) payload[sid] = Math.round(m);
      }
      const expectedDelivery = expectedDeliveryFromHighEndCompletion(
        jobCard.createdAt,
        jobCard.highEndServiceIds ?? [],
        payload
      ).toISOString();
      updateJobCard(jobCard.id, {
        highEndCompletionMinutesByServiceId: Object.keys(payload).length > 0 ? payload : undefined,
        expectedDelivery,
        updatedAt: new Date().toISOString(),
      });
    },
    [jobCard, updateJobCard]
  );

  const [highEndAdvAmount, setHighEndAdvAmount] = useState("");
  const [highEndAdvMethod, setHighEndAdvMethod] = useState<PaymentMethod>("CASH");
  const [highEndAdvRef, setHighEndAdvRef] = useState("");

  const prevJobIdRef = useRef<string | null>(null);

  const SWITCH_REASONS = [
    "Mechanic on leave",
    "Lunch break",
    "New mechanic assigned",
    "Mechanic overloaded",
    "Skill mismatch",
    "Shift change",
    "Other",
  ];

  const handleSwitchMechanic = () => {
    if (!switchToMechanicId || !switchReason) {
      toast.error("Please select a mechanic and reason");
      return;
    }
    const newMechanic = mechanics.find((m) => m.id === switchToMechanicId);
    if (!newMechanic) return;

    const reason = switchReason === "Other" ? switchCustomReason || "Other" : switchReason;

    const logEntry: MechanicSwitchLog = {
      fromMechanicId: currentMechanicId ?? "—",
      fromMechanicName: currentMechanicName ?? "Unassigned",
      toMechanicId: newMechanic.id,
      toMechanicName: newMechanic.name,
      reason,
      switchedAt: new Date().toISOString(),
      switchedBy: "USR-001",
    };

    const updatedLog = [...switchLog, logEntry];
    setSwitchLog(updatedLog);
    setCurrentMechanicId(newMechanic.id);
    setCurrentMechanicName(newMechanic.name);

    updateJobCard(id, {
      mechanicId: newMechanic.id,
      mechanicName: newMechanic.name,
      mechanicSwitchLog: updatedLog,
      updatedAt: new Date().toISOString(),
    });

    if (jobCard) {
      pushActivityLog({
        action: "MECHANIC_SWITCHED",
        entityType: "JOB_CARD",
        entityId: jobCard.id,
        entityLabel: jobCard.jobNumber,
        details: `${jobCard.jobNumber}: ${currentMechanicName ?? "Unassigned"} → ${newMechanic.name}`,
      });
    }

    setShowSwitchDialog(false);
    setSwitchToMechanicId("");
    setSwitchReason("");
    setSwitchCustomReason("");

    toast.success("Mechanic switched", {
      description: `${currentMechanicName ?? "Unassigned"} → ${newMechanic.name}`,
    });
  };

  const handleQuickAssignConfirm = () => {
    if (!quickAssignMechanicId) {
      toast.error("Select a mechanic");
      return;
    }
    const m = mechanics.find((x) => x.id === quickAssignMechanicId);
    if (!m || !jobCard) return;

    setCurrentMechanicId(m.id);
    setCurrentMechanicName(m.name);
    updateJobCard(jobCard.id, {
      mechanicId: m.id,
      mechanicName: m.name,
      updatedAt: new Date().toISOString(),
    });

    pushActivityLog({
      action: "ASSIGNED",
      entityType: "JOB_CARD",
      entityId: jobCard.id,
      entityLabel: jobCard.jobNumber,
      details: `${jobCard.jobNumber} assigned to ${m.name}`,
    });

    setShowQuickAssignDialog(false);
    setQuickAssignMechanicId("");
    toast.success("Mechanic assigned", { description: m.name });
  };

  const formatDuration = (ms: number) => {
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 1) return "< 1 min";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  /* eslint-disable react-hooks/purity -- timeline uses wall clock for in-progress mechanic segments */
  const mechanicTimeline = useMemo(() => {
    const timeline: {
      name: string;
      from: string;
      to: string | null;
      duration: number;
      isActive: boolean;
      reason?: string;
    }[] = [];

    const createdAt = jobCard?.createdAt ?? new Date().toISOString();

    if (switchLog.length === 0 && currentMechanicName) {
      const from = createdAt;
      const now = Date.now();
      timeline.push({
        name: currentMechanicName,
        from,
        to: null,
        duration: now - new Date(from).getTime(),
        isActive: true,
      });
    } else if (switchLog.length > 0) {
      const firstSwitch = switchLog[0];
      const firstFrom = createdAt;
      const firstTo = firstSwitch.switchedAt;
      timeline.push({
        name: firstSwitch.fromMechanicName,
        from: firstFrom,
        to: firstTo,
        duration: new Date(firstTo).getTime() - new Date(firstFrom).getTime(),
        isActive: false,
        reason: firstSwitch.reason,
      });

      for (let i = 0; i < switchLog.length; i++) {
        const entry = switchLog[i];
        const from = entry.switchedAt;
        const to = i + 1 < switchLog.length ? switchLog[i + 1].switchedAt : null;
        const isActive = to === null;
        const duration = to
          ? new Date(to).getTime() - new Date(from).getTime()
          : Date.now() - new Date(from).getTime();

        timeline.push({
          name: entry.toMechanicName,
          from,
          to,
          duration,
          isActive,
          reason: !isActive && i + 1 < switchLog.length ? switchLog[i + 1].reason : undefined,
        });
      }
    }

    const delivered =
      jobCard != null && normalizeJobCardStatus(jobCard.status) === "DELIVERED";
    const deliveredAt = jobCard?.actualDelivery ?? jobCard?.updatedAt;
    if (delivered && deliveredAt && timeline.length > 0) {
      return timeline.map((entry) => {
        if (entry.to === null && entry.isActive) {
          const endMs = new Date(deliveredAt).getTime();
          const fromMs = new Date(entry.from).getTime();
          return {
            ...entry,
            to: deliveredAt,
            isActive: false,
            duration: Math.max(0, endMs - fromMs),
          };
        }
        return entry;
      });
    }

    return timeline;
  }, [jobCard, switchLog, currentMechanicName]);
  /* eslint-enable react-hooks/purity */

  const totalWorkDuration = useMemo(
    () => mechanicTimeline.reduce((sum, t) => sum + t.duration, 0),
    [mechanicTimeline]
  );

  const displayPhotos = useMemo(() => {
    const photos = jobCard?.inspectionPhotos ?? [];
    const photoTime = (p: InspectionPhoto) => {
      const ms = Date.parse(p.uploadedAt);
      return Number.isFinite(ms) ? ms : 0;
    };
    const beforeSorted = photos
      .filter((p) => isBeforeInspectionPhoto(p))
      .sort((a, b) => photoTime(a) - photoTime(b));
    const afterSorted = photos
      .filter((p) => isAfterInspectionPhoto(p))
      .sort((a, b) => photoTime(a) - photoTime(b));
    const ordered = [...beforeSorted, ...afterSorted];
    return ordered.map((p: InspectionPhoto) => {
      const raw = p.url;
      const url = raw.startsWith("blob:") ? raw : (resolveUploadsPublicUrl(raw) ?? raw);
      const kind = normalizeInspectionPhotoKind(p.type);
      return {
        id: p.id,
        url,
        type: (kind === "after" ? "AFTER" : "BEFORE") as "BEFORE" | "AFTER",
        label: p.caption ?? "Photo",
      };
    });
  }, [jobCard]);

  const canDeleteInspectionPhotos =
    currentStatus !== "DELIVERED" && currentStatus !== "CANCELLED";

  const detailPhotoCount = displayPhotos.length;

  const hasBeforePhoto = useMemo(
    () => hasBeforeInspectionPhoto(jobCard?.inspectionPhotos),
    [jobCard?.inspectionPhotos]
  );
  const hasAfterPhoto = useMemo(
    () => hasAfterInspectionPhoto(jobCard?.inspectionPhotos),
    [jobCard?.inspectionPhotos]
  );

  /** Before photos: only while job is before QC (inspection / in service). */
  const canUploadBefore = ["RECEIVED", "INSPECTION", "AWAITING_SERVICE"].includes(currentStatus);
  /** After photos: only after QC is marked complete, or once past QC. */
  const canUploadAfter =
    (currentStatus === "QUALITY_CHECK" && qualityCheckDone) ||
    currentStatus === "READY" ||
    currentStatus === "DELIVERED";
  const canCompare = hasBeforePhoto && hasAfterPhoto;

  const [photoTab, setPhotoTab] = useState<"BEFORE" | "AFTER" | "COMPARE">(() => {
    const st = normalizeJobCardStatus(jobCard?.status);
    if (st === "READY" || st === "DELIVERED") return "AFTER";
    return "BEFORE";
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openMultiCam = useCallback((type: "BEFORE" | "AFTER") => {
    setMultiCamType(type);
    // Live preview only on HTTPS; on HTTP LAN we use native capture (no getUserMedia throw).
    if (canUseLiveCameraPreview()) {
      const promise = requestCameraStream();
      void promise.catch(() => undefined);
      setMultiCamStreamPromise(promise);
    } else {
      setMultiCamStreamPromise(null);
    }
    setMultiCamOpen(true);
  }, []);

  useEffect(() => {
    if (!jobCard || jobCard.id !== id) return;
    const idChanged = prevJobIdRef.current !== id;
    prevJobIdRef.current = id;

    const normalized = normalizeJobCardStatus(jobCard.status);
    setCurrentStatus(normalized);
    setServiceItems(
      Array.isArray(jobCard.services) ? jobCard.services.map((s) => ({ ...s })) : []
    );
    setCurrentMechanicId(jobCard.mechanicId);
    setCurrentMechanicName(jobCard.mechanicName);
    setSwitchLog(jobCard.mechanicSwitchLog ?? []);
    setQualityCheckDone(jobCard.qualityCheckCompleted ?? false);

    if (idChanged) {
      setNotes(jobCard.notes ?? "");
      setPhotoTab(normalized === "READY" || normalized === "DELIVERED" ? "AFTER" : "BEFORE");
      const adv = jobCard.highEndAdvanceAmountInr;
      setHighEndAdvAmount(adv != null && adv > 0 ? String(adv) : "");
      setHighEndAdvMethod(jobCard.highEndAdvanceMethod ?? "CASH");
      setHighEndAdvRef(jobCard.highEndAdvanceReference ?? "");
    }

    const hesIds = jobCard.highEndServiceIds ?? [];
    const storedFollowUp = jobCard.highEndFirstFollowUpMonthsByServiceId ?? {};
    const followUpNext: Record<string, number> = {};
    for (const hesId of hesIds) {
      const cfg = highEndServiceConfigs.find((c) => c.id === hesId);
      if (!cfg || cfg.reminderIntervals.length === 0) continue;
      const raw = storedFollowUp[hesId];
      followUpNext[hesId] =
        raw != null && raw > 0 ? raw : cfg.reminderIntervals[0]!;
    }
    setHighEndFollowUpById(followUpNext);
    setHighEndCompletionById({ ...(jobCard.highEndCompletionMinutesByServiceId ?? {}) });
    setHighEndChecklistDoneById({ ...(jobCard.highEndServiceCompletedById ?? {}) });
  }, [id, jobCard, highEndServiceConfigs]);

  useEffect(() => {
    if (!jobCard) return;
    if (jobCard.serviceTimerStartedAt) return;
    if (normalizeJobCardStatus(jobCard.status) !== "AWAITING_SERVICE") return;
    if (!jobCard.mechanicId) return;
    const nowIso = new Date().toISOString();
    void updateJobCard(jobCard.id, {
      ...initialServiceTimerPatch(jobCard.services, nowIso, {
        highEndServiceIds: jobCard.highEndServiceIds,
        highEndCompletionMinutesByServiceId: jobCard.highEndCompletionMinutesByServiceId,
      }),
      updatedAt: nowIso,
    }).catch(() => undefined);
  }, [jobCard, updateJobCard]);

  useEffect(() => {
    if (photoTab === "AFTER" && !canUploadAfter) queueMicrotask(() => setPhotoTab("BEFORE"));
  }, [photoTab, canUploadAfter]);

  useEffect(() => {
    if (photoTab === "COMPARE" && !canCompare) queueMicrotask(() => setPhotoTab("BEFORE"));
  }, [photoTab, canCompare]);

  const appendInspectionPhotosFromFiles = useCallback(
    async (files: FileList | File[] | null, type: "BEFORE" | "AFTER"): Promise<boolean> => {
      const fileList = !files ? [] : Array.isArray(files) ? files : Array.from(files);
      if (fileList.length === 0) return false;
      if (!jobCard) return false;
      if (type === "BEFORE" && !canUploadBefore) {
        toast.error("Before photos can only be uploaded during inspection / in service");
        return false;
      }
      if (type === "AFTER" && !canUploadAfter) {
        toast.error("Mark quality check complete first, then upload After photos");
        return false;
      }

      const uploadUserId = useAuthStore.getState().user?.id ?? "USR-001";
      const jcNow = useJobCardStore.getState().jobCards.find((j) => j.id === jobCard.id);
      const base = [...(jcNow?.inspectionPhotos ?? [])];
      const added: InspectionPhoto[] = [];
      const kind = type === "BEFORE" ? "before" : "after";

      try {
        for (const file of fileList) {
          const photoId = `ph-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const url = await uploadJobInspectionPhoto(jobCard.id, kind, file, photoId);
          const rawCaption = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
          const baseLabel = rawCaption || "Photo";
          const storedCaption =
            kind === "before"
              ? baseLabel.toLowerCase() === "photo"
                ? "Inspection"
                : `Inspection · ${baseLabel}`
              : baseLabel;
          added.push({
            id: photoId,
            type: toPersistedInspectionPhotoType(kind),
            url,
            caption: storedCaption,
            uploadedAt: new Date().toISOString(),
            uploadedBy: uploadUserId,
          });
        }
        await updateJobCard(jobCard.id, {
          inspectionPhotos: mergeInspectionPhotosById(base, added),
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed";
        toast.error(msg);
        return false;
      }

      toast.success(`${fileList.length} photo${fileList.length > 1 ? "s" : ""} saved`);
      return true;
    },
    [jobCard, updateJobCard, canUploadBefore, canUploadAfter]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (photoTab === "COMPARE") {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    await appendInspectionPhotosFromFiles(e.target.files, photoTab);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const handleRemovePhoto = useCallback(
    async (photoId: string) => {
      if (!jobCard || !canDeleteInspectionPhotos) return;
      const jc = useJobCardStore.getState().jobCards.find((j) => j.id === jobCard.id);
      const next = (jc?.inspectionPhotos ?? []).filter((p) => p.id !== photoId);
      try {
        await updateJobCard(jobCard.id, {
          inspectionPhotos: next,
          updatedAt: new Date().toISOString(),
        });
        setViewingPhoto((cur) => (cur === photoId ? null : cur));
      } catch (e) {
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not remove photo";
        toast.error(msg);
      }
    },
    [jobCard, canDeleteInspectionPhotos, updateJobCard]
  );

  const viewingPhotoData = viewingPhoto ? displayPhotos.find((p) => p.id === viewingPhoto) : null;
  const filteredPhotos = displayPhotos.filter((p) => p.type === photoTab);
  const viewingIndex = viewingPhoto ? filteredPhotos.findIndex((p) => p.id === viewingPhoto) : -1;

  const navigatePhoto = (dir: -1 | 1) => {
    const nextIdx = viewingIndex + dir;
    if (nextIdx >= 0 && nextIdx < filteredPhotos.length) {
      setViewingPhoto(filteredPhotos[nextIdx].id);
    }
  };

  const currentStatusIndex = useMemo(() => {
    if (currentStatus === "CANCELLED") return -1;
    const idx = WORKFLOW_STATUSES.indexOf(currentStatus);
    return idx >= 0 ? idx : 0;
  }, [currentStatus]);

  /** True when a mechanic is on the job (local state or persisted card). */
  const hasMechanicAssigned = Boolean(currentMechanicId ?? jobCard?.mechanicId);

  /** Next workflow step after "Update Status" (null if terminal or cancelled). */
  const nextWorkflowStatus =
    currentStatusIndex >= 0 && currentStatusIndex < WORKFLOW_STATUSES.length - 1
      ? WORKFLOW_STATUSES[currentStatusIndex + 1]
      : null;

  /** Block advancing into In Service (or beyond) until someone is assigned. */
  const inServiceWorkflowIndex = WORKFLOW_STATUSES.indexOf("AWAITING_SERVICE");
  const advanceBlockedByMechanic =
    !hasMechanicAssigned &&
    nextWorkflowStatus !== null &&
    WORKFLOW_STATUSES.indexOf(nextWorkflowStatus) >= inServiceWorkflowIndex;

  const updateStatusDisabled =
    currentStatusIndex >= WORKFLOW_STATUSES.length - 1 || advanceBlockedByMechanic;

  const updateStatusDisabledTitle = advanceBlockedByMechanic
    ? "Assign a mechanic before moving to In Service"
    : undefined;

  const completedCount = serviceItems.filter((s) => s.isCompleted).length;
  const totalCount = serviceItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const membershipUsageByCatalogId = useMemo(() => {
    const m = new Map<
      string,
      { included: number; used: number; remaining: number; isIncluded: boolean }
    >();
    if (!jobCard) return m;
    const sub = getActiveMembership(jobCard.customerId, jobCard.vehicleId);
    const pkg = sub ? membershipPackages.find((p) => p.id === sub.packageId) : undefined;
    if (!sub || !pkg) return m;
    for (const sid of pkg.includedServiceIds) {
      const included = Math.max(1, pkg.includedServiceQuantities?.[sid] ?? 1);
      const used = getUsedIncludedServiceCount(sub, sid);
      const remaining = getRemainingIncludedServiceCount(sub, pkg, sid);
      m.set(sid, { included, used, remaining, isIncluded: true });
    }
    return m;
  }, [jobCard, getActiveMembership, membershipPackages, getRemainingIncludedServiceCount, getUsedIncludedServiceCount]);

  const redeemMembershipForCompletion = (items: ServiceItem[]): { ok: true } | { ok: false } => {
    if (!jobCard || items.length === 0) return { ok: true };
    const sub = getActiveMembership(jobCard.customerId, jobCard.vehicleId);
    const pkg = sub ? membershipPackages.find((p) => p.id === sub.packageId) : undefined;
    if (!sub || !pkg) return { ok: true };

    const demandByCatalogId = new Map<string, { name: string; quantity: number }>();
    for (const item of items) {
      const isMembershipBenefit =
        item.priceSource === "MEMBERSHIP" || (item.priceSource == null && item.price <= 0);
      if (!isMembershipBenefit) continue;
      if (!pkg.includedServiceIds.includes(item.serviceCatalogId)) continue;
      const prev = demandByCatalogId.get(item.serviceCatalogId);
      if (prev) {
        demandByCatalogId.set(item.serviceCatalogId, {
          ...prev,
          quantity: prev.quantity + 1,
        });
      } else {
        demandByCatalogId.set(item.serviceCatalogId, { name: item.name, quantity: 1 });
      }
    }
    if (demandByCatalogId.size === 0) return { ok: true };

    for (const [serviceCatalogId, demand] of demandByCatalogId) {
      const remaining = getRemainingIncludedServiceCount(sub, pkg, serviceCatalogId);
      if (remaining < demand.quantity) {
        toast.error(
          `No remaining membership usage for ${demand.name} (${remaining} left, ${demand.quantity} needed).`
        );
        return { ok: false };
      }
    }

    for (const [serviceCatalogId, demand] of demandByCatalogId) {
      const redeemed = redeemMembershipServiceUsage({
        subscriptionId: sub.id,
        serviceCatalogId,
        serviceName: demand.name,
        jobCardId: jobCard.id,
        quantity: demand.quantity,
      });
      if (!redeemed.ok) {
        toast.error(redeemed.error);
        return { ok: false };
      }
      pushActivityLog({
        action: "UPDATED",
        entityType: "JOB_CARD",
        entityId: jobCard.id,
        entityLabel: jobCard.jobNumber,
        details: `Membership redeemed: ${demand.name} x${demand.quantity} (remaining ${redeemed.remaining})`,
      });
    }
    return { ok: true };
  };

  const rollbackMembershipForUncompletion = (items: ServiceItem[]): { ok: true } | { ok: false } => {
    if (!jobCard || items.length === 0) return { ok: true };
    const sub = getActiveMembership(jobCard.customerId, jobCard.vehicleId);
    const pkg = sub ? membershipPackages.find((p) => p.id === sub.packageId) : undefined;
    if (!sub || !pkg) return { ok: true };

    const demandByCatalogId = new Map<string, { name: string; quantity: number }>();
    for (const item of items) {
      const isMembershipBenefit =
        item.priceSource === "MEMBERSHIP" || (item.priceSource == null && item.price <= 0);
      if (!isMembershipBenefit) continue;
      if (!pkg.includedServiceIds.includes(item.serviceCatalogId)) continue;
      const prev = demandByCatalogId.get(item.serviceCatalogId);
      if (prev) {
        demandByCatalogId.set(item.serviceCatalogId, {
          ...prev,
          quantity: prev.quantity + 1,
        });
      } else {
        demandByCatalogId.set(item.serviceCatalogId, { name: item.name, quantity: 1 });
      }
    }
    if (demandByCatalogId.size === 0) return { ok: true };

    for (const [serviceCatalogId, demand] of demandByCatalogId) {
      const rolledBack = rollbackMembershipServiceUsage({
        subscriptionId: sub.id,
        serviceCatalogId,
        jobCardId: jobCard.id,
        quantity: demand.quantity,
      });
      if (!rolledBack.ok) {
        toast.error(`Could not rollback membership usage for ${demand.name}: ${rolledBack.error}`);
        return { ok: false };
      }
      pushActivityLog({
        action: "UPDATED",
        entityType: "JOB_CARD",
        entityId: jobCard.id,
        entityLabel: jobCard.jobNumber,
        details: `Membership rollback: ${demand.name} x${demand.quantity} (remaining ${rolledBack.remaining})`,
      });
    }
    return { ok: true };
  };

  const toggleServiceComplete = (serviceId: string) => {
    if (!jobCard) return;
    if (!jobCardIsEditable({ status: currentStatus })) {
      toast.error("This job card can no longer be edited");
      return;
    }
    const target = serviceItems.find((s) => s.id === serviceId);
    if (!target) return;
    const markingComplete = !target.isCompleted;
    if (markingComplete) {
      const redemption = redeemMembershipForCompletion([target]);
      if (!redemption.ok) return;
    } else {
      const rollback = rollbackMembershipForUncompletion([target]);
      if (!rollback.ok) return;
    }

    const nowIso = new Date().toISOString();
    const byUser = authUser?.id ?? "USR-001";
    const next = serviceItems.map((s) => {
      if (s.id !== serviceId) return s;
      const done = !s.isCompleted;
      return {
        ...s,
        isCompleted: done,
        completedAt: done ? nowIso : undefined,
        completedBy: done ? byUser : undefined,
      };
    });
    setServiceItems(next);
    updateJobCard(jobCard.id, {
      services: next,
      updatedAt: nowIso,
    });
  };

  const openPartsDialog = () => {
    if (!jobCard) return;
    setPartsDraftLines(selectedLinesFromJobParts(jobCard.parts ?? []));
    setPartsDialogOpen(true);
  };

  const saveJobCardParts = () => {
    if (!jobCard) return;
    const items = buildJobCardPartItems(jobCard.id, partsDraftLines, inventoryParts);
    const oldPartsTotal = jobCardPartsSubtotal(jobCard.parts ?? []);
    const newPartsTotal = jobCardPartsSubtotal(items);
    const estimatedAmount =
      Math.round((jobCard.estimatedAmount - oldPartsTotal + newPartsTotal) * 100) / 100;
    updateJobCard(jobCard.id, {
      parts: items.length > 0 ? items : undefined,
      estimatedAmount,
      updatedAt: new Date().toISOString(),
    });
    setPartsDialogOpen(false);
    toast.success(
      items.length > 0 ? `${items.length} part(s) saved on job card` : "Parts removed from job card"
    );
  };

  const setAllServicesComplete = (completed: boolean) => {
    if (!jobCard || serviceItems.length === 0) return;
    if (!jobCardIsEditable({ status: currentStatus })) {
      toast.error("This job card can no longer be edited");
      return;
    }
    if (completed) {
      const toComplete = serviceItems.filter((s) => !s.isCompleted);
      const redemption = redeemMembershipForCompletion(toComplete);
      if (!redemption.ok) return;
    } else {
      const toUncomplete = serviceItems.filter((s) => s.isCompleted);
      const rollback = rollbackMembershipForUncompletion(toUncomplete);
      if (!rollback.ok) return;
    }
    const next = serviceItems.map((s) => ({ ...s, isCompleted: completed }));
    setServiceItems(next);
    updateJobCard(jobCard.id, {
      services: next,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleQualityCheckChange = (checked: boolean) => {
    setQualityCheckDone(checked);
    if (jobCard) {
      updateJobCard(jobCard.id, {
        qualityCheckCompleted: checked,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const highEndAdvanceReadOnly = !canEditPricing;

  const clearHighEndAdvance = () => {
    if (!jobCard) return;
    const nowIso = new Date().toISOString();
    setHighEndAdvAmount("");
    setHighEndAdvMethod("CASH");
    setHighEndAdvRef("");
    updateJobCard(jobCard.id, {
      highEndAdvanceAmountInr: undefined,
      highEndAdvanceCollectedAt: undefined,
      highEndAdvanceMethod: undefined,
      highEndAdvanceReference: undefined,
      updatedAt: nowIso,
    });
    toast.success("Advance cleared");
  };

  const saveHighEndAdvance = () => {
    if (!jobCard) return;
    const raw = highEndAdvAmount.trim();
    const num = raw === "" ? NaN : Number.parseFloat(raw);
    const nowIso = new Date().toISOString();
    if (!Number.isFinite(num) || num <= 0) {
      clearHighEndAdvance();
      return;
    }
    updateJobCard(jobCard.id, {
      highEndAdvanceAmountInr: num,
      highEndAdvanceCollectedAt: jobCard.highEndAdvanceCollectedAt ?? nowIso,
      highEndAdvanceMethod: highEndAdvMethod,
      highEndAdvanceReference: highEndAdvRef.trim() || undefined,
      updatedAt: nowIso,
    });
    const prevAmt = jobCard.highEndAdvanceAmountInr ?? 0;
    if (num > 0 && prevAmt <= 0) {
      const mergedJob: JobCard = {
        ...jobCard,
        highEndAdvanceAmountInr: num,
        highEndAdvanceCollectedAt: jobCard.highEndAdvanceCollectedAt ?? nowIso,
        highEndAdvanceMethod: highEndAdvMethod,
        highEndAdvanceReference: highEndAdvRef.trim() || undefined,
      };
      // Advance recorded — no automated WhatsApp (only 3 messages: check-in, ready, delivered)
    }
    toast.success("Advance saved");
  };

  const handleTimerPause = () => {
    if (!jobCard || jobCard.timerIsPaused) return;
    const nowIso = new Date().toISOString();
    updateJobCard(jobCard.id, {
      timerIsPaused: true,
      timerPausedAt: nowIso,
      updatedAt: nowIso,
    });
  };

  const handleTimerResume = () => {
    if (!jobCard?.timerIsPaused || !jobCard.timerPausedAt) return;
    const add = Math.max(0, Date.now() - new Date(jobCard.timerPausedAt).getTime());
    const nowIso = new Date().toISOString();
    updateJobCard(jobCard.id, {
      timerIsPaused: false,
      timerPausedAt: undefined,
      totalPausedMs: (jobCard.totalPausedMs ?? 0) + add,
      updatedAt: nowIso,
    });
  };

  const handleBufferDelta = (delta: number) => {
    if (!jobCard || !authUser) return;
    const total = jobCard.bufferTotalMinutes ?? 0;
    const remaining = jobCard.bufferRemainingMinutes ?? 0;
    let newTotal: number;
    let newRem: number;
    if (delta > 0) {
      newTotal = total + delta;
      newRem = remaining + delta;
    } else {
      newTotal = Math.max(0, total + delta);
      newRem = Math.min(remaining, newTotal);
    }
    const entry: TimerAdjustment = {
      adjustedBy: authUser.name,
      adjustedAt: new Date().toISOString(),
      deltaMinutes: delta,
    };
    const nowIso = new Date().toISOString();
    updateJobCard(jobCard.id, {
      bufferTotalMinutes: newTotal,
      bufferRemainingMinutes: newRem,
      bufferAdjustments: [...(jobCard.bufferAdjustments ?? []), entry],
      updatedAt: nowIso,
    });
  };

  const addNote = () => {
    if (!jobCard || !newNote.trim()) return;
    if (!jobCardIsEditable({ status: currentStatus })) {
      toast.error("This job card can no longer be edited");
      return;
    }
    const nextNotes = notes + (notes ? "\n\n" : "") + newNote.trim();
    setNotes(nextNotes);
    setNewNote("");
    void updateJobCard(jobCard.id, {
      notes: nextNotes,
      updatedAt: new Date().toISOString(),
    });
  };

  const applyServiceRemindersOnDeliver = useCallback(
    async (job: JobCard, serviceDateIso: string) => {
      const settings = useSettingsStore.getState();
      const created = await applyCategoryRemindersOnDeliver({
        job,
        serviceDateIso,
        settings: {
          reminderLeadDays: settings.reminderLeadDays,
          reminderCategoryFrequencies: settings.reminderCategoryFrequencies,
        },
        catalog: serviceCatalog,
        categories: serviceCategories,
      });
      if (created > 0) {
        toast.success("Service reminders updated", {
          description:
            created === 1
              ? "1 category reminder scheduled from this delivery"
              : `${created} category reminders scheduled from this delivery`,
        });
      }
    },
    [applyCategoryRemindersOnDeliver, serviceCatalog, serviceCategories]
  );

  const handleUpdateStatus = async () => {
    if (!jobCard || currentStatus === "DELIVERED" || currentStatus === "CANCELLED") return;
    if (advanceBlockedByMechanic) {
      toast.error("Assign a mechanic before moving to In Service", {
        description: "Use Assign mechanic in the workflow bar above.",
      });
      setShowQuickAssignDialog(true);
      return;
    }
    const nextIndex = currentStatusIndex + 1;
    if (nextIndex < WORKFLOW_STATUSES.length) {
      const nextStatus = WORKFLOW_STATUSES[nextIndex];

      if (currentStatus === "RECEIVED" && nextStatus === "INSPECTION") {
        const beforePhotos =
          useJobCardStore.getState().jobCards.find((j) => j.id === jobCard.id)?.inspectionPhotos ??
          jobCard.inspectionPhotos;
        if (!hasBeforeInspectionPhoto(beforePhotos)) {
          setDetailTab("photos");
          setPhotoTab("BEFORE");
          setBeforePhotoRequiredOpen(true);
          return;
        }
      }

      if (currentStatus === "INSPECTION" && nextStatus === "AWAITING_SERVICE") {
        // Before photos are captured during Vehicle Check-In — no additional
        // photo check is needed at this transition.
        if (!hasMechanicAssigned) {
          toast.error("Assign a mechanic before moving to In Service", {
            description: "Use Assign mechanic in the workflow bar above.",
          });
          return;
        }
      }

      if (currentStatus === "AWAITING_SERVICE" && nextStatus === "QUALITY_CHECK") {
        if (totalCount > 0 && completedCount !== totalCount) {
          setDetailTab("tasks");
          setServiceChecklistRequiredOpen(true);
          return;
        }
      }

      if (currentStatus === "QUALITY_CHECK" && nextStatus === "READY") {
        if (!qualityCheckDone) {
          setDetailTab("tasks");
          setQualityCheckRequiredOpen(true);
          return;
        }
        const afterPhotos =
          useJobCardStore.getState().jobCards.find((j) => j.id === jobCard.id)?.inspectionPhotos ??
          jobCard.inspectionPhotos;
        if (!hasAfterInspectionPhoto(afterPhotos)) {
          setDetailTab("photos");
          setPhotoTab("AFTER");
          setAfterPhotoRequiredOpen(true);
          return;
        }
      }

      setCurrentStatus(nextStatus);

      const nowIso = new Date().toISOString();
      const patch: Partial<JobCard> = {
        status: nextStatus,
        updatedAt: nowIso,
        services: serviceItems,
      };

      if (
        nextStatus === "AWAITING_SERVICE" &&
        !jobCard.serviceTimerStartedAt &&
        hasMechanicAssigned
      ) {
        Object.assign(patch, initialServiceTimerPatch(serviceItems, nowIso));
      }

      if (nextStatus === "READY" && !jobCard.inventoryConsumedAt) {
        const jobForStock = {
          ...jobCard,
          status: "READY" as const,
          services: serviceItems,
        };
        const stockResult = useInventoryStore
          .getState()
          .applyDeductionForJobCardReady(jobForStock, "USR-001");
        if (stockResult.ok) {
          patch.inventoryConsumedAt = nowIso;
        } else {
          toast.warning("Stock not reduced", {
            description: stockResult.error ?? "Fix inventory levels and try again from Ready if needed.",
          });
        }
      }

      if (nextStatus === "DELIVERED") {
        patch.actualDelivery = nowIso;
        if (jobCard.serviceTimerStartedAt) {
          const snap = computeServiceTimerSnapshot(jobCard, nowIso);
          if (snap) {
            patch.serviceTimerDeliverySnapshot = snap;
            patch.totalPausedMs = snap.totalPauseMs;
            patch.timerIsPaused = false;
            patch.timerPausedAt = undefined;
          }
        }
      }

      if (nextStatus === "DELIVERED" && jobCard.highEndServiceIds && jobCard.highEndServiceIds.length > 0) {
        const now = nowIso;
        jobCard.highEndServiceIds.forEach((hesId) => {
          const config = highEndServiceConfigs.find((c) => c.id === hesId);
          if (config) {
            const first =
              jobCard.highEndFirstFollowUpMonthsByServiceId?.[hesId] ??
              config.reminderIntervals[0] ??
              0;
            const intervals = buildHighEndReminderMonthIntervals(config.reminderIntervals, first);
            void generateHighEndReminders({
              jobCardId: jobCard.id,
              serviceName: config.name,
              serviceDate: now,
              customerId: jobCard.customerId,
              customerName: jobCard.customerName,
              customerPhone: jobCard.customerPhone,
              vehicleId: jobCard.vehicleId,
              vehicleRegNumber: jobCard.vehicleRegNumber,
              vehicleMakeModel: jobCard.vehicleMakeModel,
              intervalMonths: intervals,
            });
          }
        });
        toast.success("Maintenance reminders created", {
          description: `Auto-generated reminders for ${jobCard.highEndServiceIds.length} high-end service(s)`,
        });
      }

      if (nextStatus === "DELIVERED") {
        await applyServiceRemindersOnDeliver(jobCard, nowIso);
      }

      updateJobCard(jobCard.id, patch);

      const mergedJob: JobCard = { ...jobCard, ...patch };

      // Send before-photos WhatsApp when vehicle is received in for inspection (INSPECTION)
      // or as a guaranteed fallback at AWAITING_SERVICE (where before photos are required).
      // The ref ensures we send at most once per session, avoiding double messages.
      if (nextStatus === "INSPECTION" || nextStatus === "AWAITING_SERVICE") {
        const latestPhotos =
          useJobCardStore.getState().jobCards.find((j) => j.id === jobCard.id)?.inspectionPhotos ??
          mergedJob.inspectionPhotos;
        const lsKey = `checkin-whatsapp-sent:${mergedJob.id}`;
        const alreadySent = typeof localStorage !== "undefined" && localStorage.getItem(lsKey) === "1";
        if (hasBeforeInspectionPhoto(latestPhotos) && !beforePhotosWhatsAppSentRef.current && !alreadySent) {
          beforePhotosWhatsAppSentRef.current = true;
          if (typeof localStorage !== "undefined") localStorage.setItem(lsKey, "1");
          notifyBeforePhotosReadyWhatsApp(mergedJob, businessName);
        }
      }

      if (nextStatus === "READY") {
        notifyJobReadyWhatsApp(mergedJob, businessName);
      }

      if (nextStatus === "DELIVERED") {
        pushActivityLog({
          action: "STATUS_CHANGED",
          entityType: "JOB_CARD",
          entityId: jobCard.id,
          entityLabel: jobCard.jobNumber,
          details: `${jobCard.jobNumber} marked delivered`,
        });
        recordJobDeliveryRewardsSafe(mergedJob);
      }

      toast.success("Status updated", {
        description: `Job card moved to "${JOB_CARD_STATUS_LABELS[nextStatus]}"`,
      });
    }
  };

  const handleCancel = () => {
    if (!jobCard || currentStatus === "DELIVERED" || currentStatus === "CANCELLED") return;
    const nowIso = new Date().toISOString();
    const activationId = jobCard.membershipActivationId?.trim();
    if (activationId) {
      cancelMembership(activationId);
    }
    setCurrentStatus("CANCELLED");
    updateJobCard(jobCard.id, { status: "CANCELLED", updatedAt: nowIso });
    pushActivityLog({
      action: "CANCELLED",
      entityType: "JOB_CARD",
      entityId: jobCard.id,
      entityLabel: jobCard.jobNumber,
      details: `${jobCard.jobNumber} cancelled${activationId ? " and linked membership deactivated" : ""}`,
    });
    toast.error("Job card cancelled", {
      description: `${jobCard.jobNumber} has been cancelled.${activationId ? " Linked membership has been cancelled too." : ""}`,
    });
  };

  const handleGenerateInvoice = async () => {
    if (!jobCard) return;

    if (currentStatus !== "READY" && currentStatus !== "DELIVERED") {
      toast.error("Mark the job ready before generating an invoice");
      return;
    }

    const jobForInvoice: JobCard =
      currentStatus === "READY" && jobCard.status !== "READY"
        ? { ...jobCard, status: "READY" }
        : jobCard;

    const result = createOrGetInvoiceForJob(jobCard.id, jobForInvoice);
    if (!result.ok) {
      if (result.code === "NOT_DELIVERED") {
        toast.error("Mark the job ready before generating an invoice");
      } else if (result.code === "NO_SERVICES") {
        toast.error("Add services on the job card before invoicing");
      } else {
        toast.error("Job card not found");
      }
      return;
    }
    if (result.created) {
      toast.success("Invoice created", { description: result.invoiceNumber });
      const inv = useInvoiceStore.getState().invoices.find((i) => i.id === result.invoiceId);
      // Invoice created — no automated WhatsApp (only 3 messages: check-in, ready, delivered)
    }
    router.push(`/billing/${result.invoiceId}`);
  };

  const handleDeliverVehicle = async (result: DeliverVehicleResult) => {
    if (!jobCard || currentStatus === "DELIVERED" || currentStatus === "CANCELLED") return;
    if (!invoiceForJob) {
      toast.error("Generate the invoice before delivering the vehicle");
      return;
    }

    setDeliverVehicleSubmitting(true);
    const nowIso = new Date().toISOString();

    if (result.dropOff) {
      const pd = usePickupDropStore.getState();
      const pickup = getLinkedPickupRequest(jobCard.id, pd.requests);
      const existingDrop = getLinkedDropRequest(jobCard.id, pd.requests);
      if (existingDrop) {
        pd.updateRequest(existingDrop.id, {
          address: result.dropOff.address,
          scheduledTime: result.dropOff.scheduledTime,
          driverId: result.dropOff.driverId,
          driverName: result.dropOff.driverName,
          status: "DELIVERED",
        });
      } else {
        const createdDrop = pd.addRequest({
          ...buildDropRequestInput(jobCard, pickup),
          address: result.dropOff.address,
          scheduledTime: result.dropOff.scheduledTime,
          driverId: result.dropOff.driverId,
          driverName: result.dropOff.driverName,
          notes: "Completed from Deliver Vehicle",
        });
        pd.updateStatus(createdDrop.id, "DELIVERED");
      }
    }

    const patch: Partial<JobCard> = {
      status: "DELIVERED",
      updatedAt: nowIso,
      actualDelivery: nowIso,
      deliveryNotes: result.deliveryNotes || undefined,
      deliveryChecklist: result.deliveryChecklist,
    };

    if (jobCard.serviceTimerStartedAt) {
      const snap = computeServiceTimerSnapshot(jobCard, nowIso);
      if (snap) {
        patch.serviceTimerDeliverySnapshot = snap;
        patch.totalPausedMs = snap.totalPauseMs;
        patch.timerIsPaused = false;
        patch.timerPausedAt = undefined;
      }
    }

    if (jobCard.highEndServiceIds && jobCard.highEndServiceIds.length > 0) {
      jobCard.highEndServiceIds.forEach((hesId) => {
        const config = highEndServiceConfigs.find((c) => c.id === hesId);
        if (config) {
          const first =
            jobCard.highEndFirstFollowUpMonthsByServiceId?.[hesId] ??
            config.reminderIntervals[0] ??
            0;
          const intervals = buildHighEndReminderMonthIntervals(config.reminderIntervals, first);
          void generateHighEndReminders({
            jobCardId: jobCard.id,
            serviceName: config.name,
            serviceDate: nowIso,
            customerId: jobCard.customerId,
            customerName: jobCard.customerName,
            customerPhone: jobCard.customerPhone,
            vehicleId: jobCard.vehicleId,
            vehicleRegNumber: jobCard.vehicleRegNumber,
            vehicleMakeModel: jobCard.vehicleMakeModel,
            intervalMonths: intervals,
          });
        }
      });
      toast.success("Maintenance reminders created", {
        description: `Auto-generated reminders for ${jobCard.highEndServiceIds.length} high-end service(s)`,
      });
    }

    await applyServiceRemindersOnDeliver(jobCard, nowIso);

    try {
      await updateJobCard(jobCard.id, patch);
    } catch (e) {
      toast.error("Could not mark job as delivered", {
        description: e instanceof Error ? e.message : "Please try again",
      });
      setDeliverVehicleSubmitting(false);
      return;
    }

    const deliveredJob = { ...jobCard, ...patch };
    setCurrentStatus("DELIVERED");
    setDeliverVehicleOpen(false);
    setDeliverVehicleSubmitting(false);

    notifyJobDeliveredWhatsApp(deliveredJob, businessName);

    pushActivityLog({
      action: "STATUS_CHANGED",
      entityType: "JOB_CARD",
      entityId: jobCard.id,
      entityLabel: jobCard.jobNumber,
      details: `${jobCard.jobNumber} marked delivered`,
    });

    recordJobDeliveryRewardsSafe(deliveredJob);

    toast.success("Vehicle delivered", {
      description: `${jobCard.jobNumber} is now delivered.`,
    });
  };

  if (!jobCard && !singleFetchDone) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="Loading Job Card" />
        <p className="text-muted-foreground">Loading latest job card data…</p>
      </div>
    );
  }

  if (!jobCard) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Job Card Not Found"
          actions={
            <Link href="/job-cards">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Job Cards
              </Button>
            </Link>
          }
        />
        <p className="text-muted-foreground">The requested job card could not be found.</p>
      </div>
    );
  }

  const showMobileActionBar =
    currentStatus !== "CANCELLED" &&
    (currentStatus === "DELIVERED" || currentStatusIndex < WORKFLOW_STATUSES.length - 1);

  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-x-hidden space-y-4 sm:space-y-6",
        showMobileActionBar
          ? "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-12"
          : "pb-10 sm:pb-12"
      )}
    >
      <div className="hidden md:block">
        <Breadcrumbs
          items={[
            { label: "Job Cards", href: "/job-cards" },
            { label: jobCard.jobNumber },
          ]}
        />
      </div>

      <JobCardWorkflowChrome
        jobNumber={jobCard.jobNumber}
        currentStatus={currentStatus}
        currentStatusIndex={currentStatusIndex}
        invoiceForJob={invoiceForJob}
        advanceBlockedByMechanic={advanceBlockedByMechanic}
        hasMechanicAssigned={hasMechanicAssigned}
        updateStatusDisabled={updateStatusDisabled}
        updateStatusDisabledTitle={updateStatusDisabledTitle}
        onGenerateInvoice={handleGenerateInvoice}
        onUpdateStatus={handleUpdateStatus}
        onCancel={handleCancel}
        onAssignMechanic={() => setShowQuickAssignDialog(true)}
        onDeliverVehicle={() => setDeliverVehicleOpen(true)}
        onRecordPayment={
          userCanCreate(useAuthStore.getState().user, "BILLING")
            ? () => setRecordPaymentOpen(true)
            : undefined
        }
      />

      {jobCard.serviceTimerStartedAt &&
        currentStatus !== "CANCELLED" &&
        currentStatus !== "DELIVERED" && (
          <TimerControlsBufferCard
            timer={jobTicker}
            timerIsPaused={Boolean(jobCard.timerIsPaused)}
            allocatedMinutes={jobCard.serviceAllocatedMinutes ?? 0}
            canPauseResume={canPauseResume}
            canAdjustBuffer={canAdjustBuffer}
            onPause={handleTimerPause}
            onResume={handleTimerResume}
            onBufferDelta={handleBufferDelta}
            bufferAdjustments={jobCard.bufferAdjustments}
          />
        )}

      {currentStatus === "DELIVERED" && serviceTimerDeliverySummary && (
        <ServiceTimerDeliverySummary snapshot={serviceTimerDeliverySummary} />
      )}

      <JobCardHeaderCard
        jobNumber={jobCard.jobNumber}
        currentStatus={currentStatus}
        createdAt={jobCard.createdAt}
        customerName={jobCard.customerName}
        onNotifyCustomer={() => setWhatsAppNotifyOpen(true)}
        notifyDisabled={!jobCard.customerPhone?.trim()}
        notifyDisabledTitle="Customer phone number is required"
      />

      <Tabs value={detailTab} onValueChange={setDetailTab} className="space-y-0">
        <Card className="border-border/80 shadow-sm overflow-hidden">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-1 px-2 sm:px-4 py-2 border-b border-border/70 bg-muted/25">
            <div className="md:hidden w-full px-1 pb-1">
              <Select value={detailTab} onValueChange={setDetailTab}>
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Overview</SelectItem>
                  <SelectItem value="tasks">Tasks ({totalCount})</SelectItem>
                  <SelectItem value="notes">Notes</SelectItem>
                  <SelectItem value="timeline">Timeline</SelectItem>
                  <SelectItem value="photos">Photos ({detailPhotoCount})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TabsList className="hidden md:flex w-full xl:w-auto justify-start rounded-none border-0 bg-transparent p-0 h-auto gap-0 overflow-x-auto scrollbar-none flex-nowrap">
              <TabsTrigger
                value="overview"
                className={cn(
                  "rounded-none border-b-2 border-transparent bg-transparent shadow-none px-3 py-2.5 gap-2 text-muted-foreground",
                  "data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-800 data-[state=active]:bg-transparent",
                  "dark:data-[state=active]:text-emerald-400"
                )}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className={cn(
                  "rounded-none border-b-2 border-transparent bg-transparent shadow-none px-3 py-2.5 gap-2 text-muted-foreground",
                  "data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-800 data-[state=active]:bg-transparent",
                  "dark:data-[state=active]:text-emerald-400"
                )}
              >
                <ListChecks className="w-4 h-4 shrink-0" />
                Tasks
                <span className="text-xs tabular-nums opacity-70">({totalCount})</span>
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className={cn(
                  "rounded-none border-b-2 border-transparent bg-transparent shadow-none px-3 py-2.5 gap-2 text-muted-foreground",
                  "data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-800 data-[state=active]:bg-transparent",
                  "dark:data-[state=active]:text-emerald-400"
                )}
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                Notes
              </TabsTrigger>
              <TabsTrigger
                value="timeline"
                className={cn(
                  "rounded-none border-b-2 border-transparent bg-transparent shadow-none px-3 py-2.5 gap-2 text-muted-foreground",
                  "data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-800 data-[state=active]:bg-transparent",
                  "dark:data-[state=active]:text-emerald-400"
                )}
              >
                <Clock className="w-4 h-4 shrink-0" />
                Timeline
              </TabsTrigger>
              <TabsTrigger
                value="photos"
                className={cn(
                  "rounded-none border-b-2 border-transparent bg-transparent shadow-none px-3 py-2.5 gap-2 text-muted-foreground",
                  "data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-800 data-[state=active]:bg-transparent",
                  "dark:data-[state=active]:text-emerald-400"
                )}
              >
                <Camera className="w-4 h-4 shrink-0" />
                Photos
                <span className="text-xs tabular-nums opacity-70">({detailPhotoCount})</span>
              </TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap items-center gap-2 shrink-0 px-1 pb-2 xl:pb-0 xl:border-l border-border/60 xl:pl-4">
              {invoiceForJob ? (
                <Button size="sm" type="button" onClick={() => setRecordPaymentOpen(true)}>
                  <IndianRupee className="w-4 h-4 mr-1.5" />
                  Record payment
                </Button>
              ) : currentStatus === "DELIVERED" || currentStatus === "READY" ? (
                <Button size="sm" type="button" onClick={handleGenerateInvoice}>
                  <IndianRupee className="w-4 h-4 mr-1.5" />
                  Generate Invoice
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-dashed text-muted-foreground"
                  disabled
                  title="Invoice is available after the job is marked ready or delivered."
                >
                  <IndianRupee className="w-4 h-4 mr-1.5" />
                  Billing
                </Button>
              )}
              {currentStatus !== "DELIVERED" &&
                currentStatus !== "CANCELLED" &&
                !hasMechanicAssigned && (
                  <Button size="sm" variant="secondary" type="button" onClick={() => setShowQuickAssignDialog(true)}>
                    <User className="w-4 h-4 mr-1.5" />
                    Assign mechanic
                  </Button>
                )}
            </div>
          </div>
        </Card>

        <TabsContent value="overview" className="mt-4 space-y-4 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Customer details
                  </CardTitle>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      type="button"
                      onClick={() => setWhatsAppNotifyOpen(true)}
                      disabled={!jobCard.customerPhone?.trim()}
                      title={
                        jobCard.customerPhone?.trim()
                          ? "Notify customer on WhatsApp"
                          : "Customer phone number is required"
                      }
                    >
                      <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Open customer">
                      <Link href={`/customers/${jobCard.customerId}`}>
                        <User className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-3 space-y-2">
                  <p className="font-semibold leading-tight">{jobCard.customerName}</p>
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium tabular-nums truncate">{jobCard.customerPhone}</span>
                  </div>
                  {customerRecord?.email ? (
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate text-muted-foreground">{customerRecord.email}</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Car className="w-4 h-4 text-muted-foreground" />
                    Vehicle
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild title="Open vehicle">
                    <Link href={`/vehicles/${jobCard.vehicleId}`}>
                      <Car className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Registration</p>
                    <p className="font-semibold font-mono tracking-wide mt-0.5">{jobCard.vehicleRegNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Model</p>
                    <p className="font-medium mt-0.5">{jobCard.vehicleMakeModel}</p>
                  </div>
                  {jobCard.odometerReading != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Odometer</p>
                      <p className="font-medium mt-0.5">{jobCard.odometerReading.toLocaleString()} km</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    Schedule
                  </CardTitle>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {jobCard.quotationId ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Quotation">
                        <Link href={`/billing?quotationId=${jobCard.quotationId}`}>
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                    {jobCard.appointmentBookingRef ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild title={jobCard.appointmentBookingRef}>
                        <Link href="/appointments">
                          <CalendarDays className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">{formatDate(jobCard.createdAt)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Expected delivery</span>
                    <span className="font-medium">{formatDate(jobCard.expectedDelivery)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/60 bg-muted/15 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-base">Job summary</CardTitle>
                  {canEditJobDetails ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditDetailsOpen(true)}
                    >
                      <Pencil className="w-4 h-4 mr-1.5" />
                      Edit details
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="pt-3 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="tabular-nums font-semibold">
                      {formatCurrency(jobCardPayableAmount)}
                    </Badge>
                    <Badge variant="outline">{formatSegmentLabel(jobCard.vehicleSegment)}</Badge>
                    <Badge variant="outline">{currentMechanicName ?? "No mechanic"}</Badge>
                    <Badge variant="outline" className="tabular-nums">
                      {jobCard.incentivePercent}% incentive
                    </Badge>
                  </div>
                  <div className="hidden sm:grid sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Total payable</p>
                      <p className="font-semibold mt-1 tabular-nums">{formatCurrency(jobCardPayableAmount)}</p>
                      {(jobCard.membershipActivationAmount ?? 0) > 0 ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Membership: {formatCurrency(jobCard.membershipActivationAmount ?? 0)}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Incentive</p>
                      <p className="font-semibold mt-1 tabular-nums">
                        {jobCard.incentivePercent}% ({formatCurrency(jobCard.incentiveAmount)})
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Segment</p>
                      <p className="font-semibold mt-1">{formatSegmentLabel(jobCard.vehicleSegment)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Mechanic</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <p className="font-semibold">{currentMechanicName ?? "—"}</p>
                        {currentStatus !== "DELIVERED" && currentStatus !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() =>
                              currentMechanicName ? setShowSwitchDialog(true) : setShowQuickAssignDialog(true)
                            }
                            className="text-primary hover:text-primary/80 transition-colors p-1"
                            title={currentMechanicName ? "Switch mechanic" : "Assign mechanic"}
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {currentStatus !== "DELIVERED" && currentStatus !== "CANCELLED" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs sm:hidden"
                      onClick={() =>
                        currentMechanicName ? setShowSwitchDialog(true) : setShowQuickAssignDialog(true)
                      }
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />
                      {currentMechanicName ? "Switch mechanic" : "Assign mechanic"}
                    </Button>
                  )}
                </CardContent>
              </Card>
              {invoiceForJob ? (
                <Card className="border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      Billing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Invoice{" "}
                        <span className="font-mono font-medium text-foreground">
                          {invoiceForJob.invoiceNumber}
                        </span>
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        Invoice issued — pricing is locked on this job card.
                      </p>
                    </div>
                    <Button size="sm" className="shrink-0" asChild>
                      <Link href={`/billing/${invoiceForJob.id}`}>
                        Open billing &amp; payments
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/60 bg-muted/15 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    Parts &amp; materials
                  </CardTitle>
                  {canEditParts && (
                    <Button type="button" size="sm" variant="outline" onClick={openPartsDialog}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      {(jobCard.parts?.length ?? 0) > 0 ? "Edit parts" : "Add parts"}
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  {(jobCard.parts?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No parts added yet. Optional — add materials from inventory when needed.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {jobCard.parts!.map((part) => (
                        <div
                          key={part.id}
                          className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium leading-tight">{part.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                              SKU {part.sku} · {part.quantity} {part.unit}
                            </p>
                          </div>
                          <p className="font-semibold tabular-nums shrink-0 text-emerald-600">
                            {formatCurrency(part.lineTotal)}
                          </p>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground pt-1 text-right tabular-nums">
                        Parts subtotal: {formatCurrency(jobCardPartsSubtotal(jobCard.parts!))}
                      </p>
                    </div>
                  )}
                  {jobCard.inventoryConsumedAt ? (
                    <p className="text-xs text-muted-foreground mt-3 border-t border-border/60 pt-3">
                      Stock was deducted when this job reached Ready — parts list is read-only.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
              {jobCard.termsAndConditions ? (
                <details className="group rounded-xl border border-border/80 bg-card shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-base font-medium [&::-webkit-details-marker]:hidden">
                    <span>Terms &amp; conditions</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-border/60 px-4 pb-4 pt-3">
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                      {jobCard.termsAndConditions}
                    </p>
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-4 outline-none">
      <JobCardServiceChecklist
        serviceItems={serviceItems}
        progressPercent={progressPercent}
        completedCount={completedCount}
        totalCount={totalCount}
        canEdit={canEditJobDetails}
        membershipUsageByCatalogId={membershipUsageByCatalogId}
        onToggleComplete={toggleServiceComplete}
      />

      {jobQualifiesForHighEndAdvance && jobCard.waiveHighEndAdvance && (
        <Card className="border-dashed">
          <CardContent className="py-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Optional advance not offered on this job</p>
            <p className="mt-1 text-xs leading-relaxed">
              This was turned off when the job card was created (e.g. no advance for this customer). Use normal billing
              when the work is done.
            </p>
          </CardContent>
        </Card>
      )}

      {jobQualifiesForHighEndAdvance && !jobCard.waiveHighEndAdvance && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-amber-600" />
                Optional advance (high-end)
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Record a partial advance if the customer pays toward this job.{" "}
                {jobCard.highEndAdvanceAmountInr != null && jobCard.highEndAdvanceAmountInr > 0 ? (
                  <>
                    Planned amount on file:{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(jobCard.highEndAdvanceAmountInr)}
                    </span>
                    . Add method and reference below when collected.
                  </>
                ) : (
                  <>
                    Suggested:{" "}
                    {formatCurrency(
                      Math.round((jobCard.estimatedAmount * effectiveAdvanceHintPercent) / 100)
                    )}{" "}
                    ({effectiveAdvanceHintPercent}% of estimate
                    {jobCard.highEndAdvanceHintPercent != null ? ", from job creation" : ""}). If you save an amount
                    here, that value is used on the tax invoice; otherwise this % applies to the invoice total when
                    generated.
                  </>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {highEndAdvanceReadOnly ? (
                <div className="space-y-2 text-sm">
                  {jobCard.highEndAdvanceAmountInr != null && jobCard.highEndAdvanceAmountInr > 0 ? (
                    <>
                      <p>
                        <span className="text-muted-foreground">Amount collected:</span>{" "}
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(jobCard.highEndAdvanceAmountInr)}
                        </span>
                      </p>
                      {jobCard.highEndAdvanceMethod && (
                        <p>
                          <span className="text-muted-foreground">Method:</span> {jobCard.highEndAdvanceMethod}
                        </p>
                      )}
                      {jobCard.highEndAdvanceReference && (
                        <p>
                          <span className="text-muted-foreground">Reference:</span> {jobCard.highEndAdvanceReference}
                        </p>
                      )}
                      {jobCard.highEndAdvanceCollectedAt && (
                        <p className="text-xs text-muted-foreground">
                          Recorded {formatDate(jobCard.highEndAdvanceCollectedAt)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">No advance recorded for this job.</p>
                  )}
                  {invoiceForJob && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Editing is disabled because an invoice exists for this job.
                    </p>
                  )}
                  {currentStatus === "DELIVERED" && !invoiceForJob && (
                    <p className="text-xs text-muted-foreground">Job delivered — advance is read-only here.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label htmlFor="he-adv-amt">Amount (₹)</Label>
                      <Input
                        id="he-adv-amt"
                        type="number"
                        min={0}
                        step={1}
                        placeholder="0"
                        value={highEndAdvAmount}
                        onChange={(e) => setHighEndAdvAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Method</Label>
                      <Select
                        value={highEndAdvMethod}
                        onValueChange={(v) => setHighEndAdvMethod(v as PaymentMethod)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="CARD">Card</SelectItem>
                          <SelectItem value="WALLET">Wallet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label htmlFor="he-adv-ref">Reference (optional)</Label>
                      <Input
                        id="he-adv-ref"
                        placeholder="Txn / ref no."
                        value={highEndAdvRef}
                        onChange={(e) => setHighEndAdvRef(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={saveHighEndAdvance}>
                      Save advance
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={clearHighEndAdvance}>
                      Clear
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
      )}

      {jobCard.highEndServiceIds && jobCard.highEndServiceIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              High-end maintenance follow-up
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {currentStatus === "DELIVERED" || currentStatus === "CANCELLED"
                ? "Reminders were generated from these first follow-up intervals when the job was delivered."
                : "Set the first reminder interval for each premium service (when a schedule exists). On delivery, reminders use that milestone and later ones. Planned time to complete is optional and separate from reminders."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobCard.highEndServiceIds.map((hesId) => {
              const cfg = highEndServiceConfigs.find((c) => c.id === hesId);
              if (!cfg) return null;
              const hasReminders = cfg.reminderIntervals.length > 0;
              const canEdit = canEditJobDetails;
              const monthsVal = hasReminders
                ? highEndFollowUpById[hesId] ?? cfg.reminderIntervals[0]!
                : 0;
              const followSelectValue = hasReminders
                ? cfg.reminderIntervals.includes(monthsVal)
                  ? String(monthsVal)
                  : "__custom__"
                : "";
              const complMins = highEndCompletionById[hesId];
              const completionSelectValue =
                complMins != null && complMins > 0
                  ? highEndCompletionSelectValue(complMins)
                  : "__unset__";

              return (
                <div
                  key={hesId}
                  className="flex flex-col lg:flex-row lg:items-end gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{cfg.name}</p>
                    {hasReminders ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Schedule:{" "}
                        {cfg.reminderIntervals.map((m) => formatHighEndIntervalMonths(m)).join(", ")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">No reminder schedule</p>
                    )}
                  </div>
                  {hasReminders ? (
                    <div className="shrink-0 w-full lg:w-44 space-y-1.5">
                      <Label htmlFor={`hes-follow-${hesId}`} className="text-xs text-muted-foreground">
                        Next follow-up
                      </Label>
                      {canEdit ? (
                        <>
                          <Select
                            value={followSelectValue}
                            onValueChange={(v) => {
                              let months: number;
                              if (v === "__custom__") {
                                months = cfg.reminderIntervals.includes(monthsVal)
                                  ? defaultManualFirstFollowUpMonths(cfg.reminderIntervals)
                                  : monthsVal;
                              } else {
                                months = Number.parseInt(v, 10);
                              }
                              const next = { ...highEndFollowUpById, [hesId]: months };
                              setHighEndFollowUpById(next);
                              updateJobCard(jobCard.id, {
                                highEndFirstFollowUpMonthsByServiceId: next,
                                updatedAt: new Date().toISOString(),
                              });
                            }}
                          >
                            <SelectTrigger id={`hes-follow-${hesId}`} className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {cfg.reminderIntervals.map((m) => (
                                <SelectItem key={m} value={String(m)}>
                                  {formatHighEndIntervalMonths(m)} ({m} mo)
                                </SelectItem>
                              ))}
                              <SelectItem value="__custom__">Custom (enter months)</SelectItem>
                            </SelectContent>
                          </Select>
                          {followSelectValue === "__custom__" && (
                            <div className="space-y-1">
                              <Label htmlFor={`hes-follow-custom-${hesId}`} className="text-[10px] text-muted-foreground">
                                Months until first reminder
                              </Label>
                              <Input
                                id={`hes-follow-custom-${hesId}`}
                                type="number"
                                min={1}
                                max={120}
                                className="h-9"
                                value={monthsVal === 0 ? "" : String(monthsVal)}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const n = raw === "" ? 0 : Math.min(120, Math.max(1, Number.parseInt(raw, 10)));
                                  if (n === 0) return;
                                  const next = { ...highEndFollowUpById, [hesId]: n };
                                  setHighEndFollowUpById(next);
                                  updateJobCard(jobCard.id, {
                                    highEndFirstFollowUpMonthsByServiceId: next,
                                    updatedAt: new Date().toISOString(),
                                  });
                                }}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm font-medium py-2 tabular-nums">
                          {formatHighEndIntervalMonths(monthsVal)} ({monthsVal} mo)
                        </p>
                      )}
                    </div>
                  ) : null}
                  <div className="shrink-0 w-full lg:w-44 space-y-1.5">
                    <Label
                      htmlFor={`hes-compl-${hesId}`}
                      className="text-xs text-muted-foreground flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3 shrink-0" />
                      Time to complete (planned)
                    </Label>
                    {canEdit ? (
                      <>
                        <Select
                          value={completionSelectValue}
                          onValueChange={(v) => {
                            if (v === "__unset__") {
                              const rest = { ...highEndCompletionById };
                              delete rest[hesId];
                              persistHighEndCompletion(rest);
                              return;
                            }
                            if (v === "__custom__") {
                              const cur = highEndCompletionById[hesId];
                              const nonPreset =
                                cur != null &&
                                cur > 0 &&
                                !HIGH_END_COMPLETION_PRESETS.some((x) => x.minutes === Math.round(cur));
                              persistHighEndCompletion({
                                ...highEndCompletionById,
                                [hesId]: nonPreset ? Math.round(cur!) : 480,
                              });
                              return;
                            }
                            const minutes = Number.parseInt(v, 10);
                            persistHighEndCompletion({
                              ...highEndCompletionById,
                              [hesId]: minutes,
                            });
                          }}
                        >
                          <SelectTrigger id={`hes-compl-${hesId}`} className="h-9 text-xs bg-background">
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unset__">Not set</SelectItem>
                            {HIGH_END_COMPLETION_PRESETS.map((p) => (
                              <SelectItem key={p.minutes} value={String(p.minutes)}>
                                {p.label}
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom__">Custom hours…</SelectItem>
                          </SelectContent>
                        </Select>
                        {completionSelectValue === "__custom__" && (
                          <div className="space-y-1">
                            <Label htmlFor={`hes-compl-hr-${hesId}`} className="text-[10px] text-muted-foreground">
                              Hours (custom)
                            </Label>
                            <Input
                              id={`hes-compl-hr-${hesId}`}
                              type="number"
                              min={0.5}
                              max={720}
                              step={0.5}
                              inputMode="decimal"
                              className="h-9 text-xs"
                              value={
                                complMins != null && complMins > 0
                                  ? String(Math.round((complMins / 60) * 100) / 100)
                                  : ""
                              }
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === "") {
                                  const rest = { ...highEndCompletionById };
                                  delete rest[hesId];
                                  persistHighEndCompletion(rest);
                                  return;
                                }
                                const h = Number.parseFloat(raw.replace(",", "."));
                                if (!Number.isFinite(h) || h <= 0) return;
                                const capMin = Math.min(43200, Math.round(h * 60));
                                persistHighEndCompletion({
                                  ...highEndCompletionById,
                                  [hesId]: capMin,
                                });
                              }}
                            />
                          </div>
                        )}
                      </>
                    ) : complMins != null && complMins > 0 ? (
                      <p className="text-sm font-medium py-2 tabular-nums">
                        {formatHighEndCompletionMinutes(complMins)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">Not set</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {currentStatus === "QUALITY_CHECK" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quality Check</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Mark QC complete to unlock After photos. You need at least one After photo before moving to Ready.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <Checkbox
                id="qc-complete"
                checked={qualityCheckDone}
                onCheckedChange={(v) => handleQualityCheckChange(v === true)}
              />
              <label htmlFor="qc-complete" className="text-sm leading-tight cursor-pointer select-none">
                <span className="font-medium">Quality check completed</span>
                <p className="text-muted-foreground mt-1 text-xs">
                  Confirm the work meets standards. After photos stay locked until this is checked.
                </p>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

        </TabsContent>

        <TabsContent value="photos" className="mt-4 space-y-4 outline-none pb-4">
      <Card className="overflow-visible">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Inspection Photos
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPhotoTab("BEFORE")}
                  className={`px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1 hover:bg-muted ${
                    photoTab === "BEFORE" ? "bg-primary text-primary-foreground hover:bg-primary!" : ""
                  }`}
                >
                  Before
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoTab("AFTER")}
                  className={`px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
                    photoTab === "AFTER"
                      ? "bg-primary text-primary-foreground"
                      : canUploadAfter
                      ? "hover:bg-muted"
                      : "opacity-70"
                  }`}
                >
                  {!canUploadAfter && <Lock className="w-2.5 h-2.5" />}
                  After
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoTab("COMPARE")}
                  className={`px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
                    photoTab === "COMPARE"
                      ? "bg-primary text-primary-foreground"
                      : canCompare
                      ? "hover:bg-muted"
                      : "opacity-70"
                  }`}
                >
                  {!canCompare && <Lock className="w-2.5 h-2.5" />}
                  Compare
                </button>
              </div>
            </div>
          </div>
          {/* Status hint */}
          <div className="mt-2 space-y-1">
            {["RECEIVED", "INSPECTION", "AWAITING_SERVICE"].includes(currentStatus) && (
              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Camera className="w-3 h-3 shrink-0" />
                <span>
                  <strong className="font-semibold">Before</strong> photos include vehicle check-in (right after creating the job)
                  and any you add here during inspection / in service. You still need at least one Before before moving to In Service.
                  <strong className="font-semibold"> After</strong> unlocks once QC is marked complete.{" "}
                  <strong className="font-semibold">Compare</strong> shows Before vs After side by side (paired row-by-row in time order).
                </span>
              </p>
            )}
            {currentStatus === "AWAITING_SERVICE" && totalCount > 0 && completedCount < totalCount && (
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                Complete the service checklist before moving to Quality Check.
              </p>
            )}
            {currentStatus === "QUALITY_CHECK" && !qualityCheckDone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3 h-3 shrink-0" />
                Complete the Quality Check above to unlock &quot;After&quot; photos.
              </p>
            )}
            {currentStatus === "QUALITY_CHECK" && qualityCheckDone && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                <Check className="w-3 h-3 shrink-0" />
                Quality check done — you can now upload &quot;After&quot; photos. Upload at least one before moving to Ready.
              </p>
            )}
            {(currentStatus === "READY" || currentStatus === "DELIVERED") && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Check className="w-3 h-3 shrink-0" />
                Compare pairs Before (check-in + inspection) with After row by row, oldest first on each side.
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Locked state for After / Compare when status is too early */}
          {photoTab === "AFTER" && !canUploadAfter ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Lock className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">After photos are locked</p>
              <p className="text-xs mt-1 text-center max-w-sm px-2">
                {currentStatus === "QUALITY_CHECK"
                  ? "Mark Quality check completed above first. After photos unlock once QC is done."
                  : "Move past In Service to Quality Check, then complete QC to upload After photos."}
              </p>
            </div>
          ) : photoTab === "COMPARE" && !canCompare ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Lock className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Compare view is locked</p>
              <p className="text-xs mt-1">Upload both before and after photos to compare</p>
            </div>
          ) : photoTab === "COMPARE" ? (
            <CompareView photos={displayPhotos} />
          ) : (
            <>
              {/* Gallery upload input; camera uses in-app multi-capture sheet */}
              <input
                id="job-card-photo-tab-upload"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={handleFileSelect}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="rounded-xl border border-border overflow-hidden bg-card transition-all hover:shadow-lg"
                  >
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.label || "Inspection photo"} className="w-full aspect-4/3 object-cover" loading="lazy" />
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                      <button
                        onClick={() => setViewingPhoto(photo.id)}
                        className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        Preview
                      </button>
                      {canDeleteInspectionPhotos && (
                        <button
                          onClick={() => void handleRemovePhoto(photo.id)}
                          className="text-sm font-semibold text-destructive hover:text-destructive/80 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {((photoTab === "BEFORE" && canUploadBefore) ||
                  (photoTab === "AFTER" && canUploadAfter)) && (
                    <div className="col-span-full sm:col-span-2 lg:col-span-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto w-full">
                        <button
                          type="button"
                          onClick={() => openMultiCam(photoTab === "AFTER" ? "AFTER" : "BEFORE")}
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border min-h-[180px] sm:min-h-[220px] hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary cursor-pointer"
                        >
                          <Camera className="w-7 h-7 mb-2" />
                          <span className="text-sm font-medium">Take photos</span>
                          <span className="text-xs mt-1 text-center px-2">
                            Capture multiple shots in one session
                          </span>
                        </button>
                        <label
                          htmlFor="job-card-photo-tab-upload"
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border min-h-[180px] sm:min-h-[220px] hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary cursor-pointer"
                        >
                          <Upload className="w-7 h-7 mb-2" />
                          <span className="text-sm font-medium">
                            Upload {photoTab === "BEFORE" ? "Before" : "After"}
                          </span>
                          <span className="text-xs mt-1 text-center px-2">Gallery or multiple files</span>
                        </label>
                      </div>
                    </div>
                  )}
              </div>
              {filteredPhotos.length === 0 &&
                !(
                  (photoTab === "BEFORE" && canUploadBefore) ||
                  (photoTab === "AFTER" && canUploadAfter)
                ) && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ImageIcon className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm">No {photoTab.toLowerCase()} photos yet</p>
                    {photoTab === "BEFORE" && !canUploadBefore && (
                      <p className="text-xs mt-2 text-center max-w-sm">
                        Before uploads are only allowed during inspection / in service.
                      </p>
                    )}
                    {photoTab === "AFTER" && !canUploadAfter && (
                      <p className="text-xs mt-2 text-center max-w-sm">
                        Complete Quality Check first to add After photos.
                      </p>
                    )}
                  </div>
                )}
            </>
          )}

          {viewingPhotoData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setViewingPhoto(null)}>
              <button onClick={() => setViewingPhoto(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                <X className="w-5 h-5" />
              </button>

              {viewingIndex > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigatePhoto(-1); }}
                  className="absolute left-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              <div className="max-w-3xl max-h-[80vh] mx-16" onClick={(e) => e.stopPropagation()}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewingPhotoData.url} alt={viewingPhotoData.label || "Full screen photo"} className="w-full h-full object-contain rounded-lg" loading="lazy" />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-white text-sm font-medium">{viewingPhotoData.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-white/60 text-xs">{viewingIndex + 1} / {filteredPhotos.length}</span>
                    {canDeleteInspectionPhotos && (
                      <button
                        onClick={() => void handleRemovePhoto(viewingPhotoData.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/80 text-white text-xs font-medium hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {viewingIndex < filteredPhotos.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigatePhoto(1); }}
                  className="absolute right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4 outline-none">
      <JobCardNotesPanel
        notes={notes}
        newNote={newNote}
        onNewNoteChange={setNewNote}
        onAddNote={addNote}
      />

        </TabsContent>

        <TabsContent value="timeline" className="mt-4 space-y-4 outline-none">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4" />
              Mechanic Assignment
            </CardTitle>
            <div className="flex items-center gap-2">
              {mechanicTimeline.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Total: {formatDuration(totalWorkDuration)}
                </div>
              )}
              {currentStatus !== "DELIVERED" && currentStatus !== "CANCELLED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    currentMechanicName ? setShowSwitchDialog(true) : setShowQuickAssignDialog(true)
                  }
                >
                  {currentMechanicName ? (
                    <>
                      <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
                      Switch mechanic
                    </>
                  ) : (
                    <>
                      <User className="w-3.5 h-3.5 mr-1.5" />
                      Assign mechanic
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Mechanic */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
              {currentMechanicName ? currentMechanicName.split(" ").map((n) => n[0]).join("") : "?"}
            </div>
            <div className="flex-1">
              <p className="font-medium">{currentMechanicName ?? "No mechanic assigned"}</p>
              <p className="text-xs text-muted-foreground">
                {currentMechanicName ? "Currently assigned" : "Assign a mechanic to this job card"}
              </p>
            </div>
            {mechanicTimeline.find((t) => t.isActive) && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Working since</p>
                <p className="text-sm font-medium">
                  {new Date(mechanicTimeline.find((t) => t.isActive)!.from).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                  {formatDuration(mechanicTimeline.find((t) => t.isActive)!.duration)}
                </p>
              </div>
            )}
          </div>

          {/* Timeline */}
          {mechanicTimeline.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Work Timeline</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Mechanic</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">From</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">To</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Duration</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mechanicTimeline.map((entry, idx) => (
                      <tr key={idx} className={`border-b last:border-b-0 ${entry.isActive ? "bg-green-50 dark:bg-green-950/20" : ""}`}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-semibold shrink-0">
                              {entry.name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <span className="font-medium">{entry.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          <div>
                            <p>{new Date(entry.from).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                            <p className="text-xs">{new Date(entry.from).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {entry.to ? (
                            <div>
                              <p>{new Date(entry.to).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                              <p className="text-xs">{new Date(entry.to).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                          ) : (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {normalizeJobCardStatus(jobCard.status) === "DELIVERED"
                                ? "Completed"
                                : "Ongoing"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-medium">
                          {formatDuration(entry.duration)}
                        </td>
                        <td className="px-3 py-2.5">
                          {entry.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                              {normalizeJobCardStatus(jobCard.status) === "DELIVERED" &&
                              idx === mechanicTimeline.length - 1
                                ? "Completed"
                                : entry.reason ?? "Ended"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>
      </Tabs>

      <Dialog
        open={beforePhotoRequiredOpen}
        onOpenChange={(open) => {
          setBeforePhotoRequiredOpen(open);
          if (!open) {
            if (beforePhotoModalInputRef.current) beforePhotoModalInputRef.current.value = "";
          }
        }}
      >
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[90dvh]")}>
          <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-2")}>
            <DialogTitle>Before photos required</DialogTitle>
            <DialogDescription>
              Add at least one &quot;Before&quot; inspection photo before moving this job forward in the workflow.
              {advanceBlockedByMechanic ? (
                <span className="mt-2 block text-amber-600 dark:text-amber-500">
                  Assign a mechanic before you can continue to In Service.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-4 min-h-0 flex-1 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {canUploadBefore ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setBeforePhotoRequiredOpen(false);
                      openMultiCam("BEFORE");
                    }}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border min-h-[120px] px-2 py-4 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer"
                  >
                    <Camera className="w-7 h-7 mb-2" />
                    <span className="text-xs font-medium text-center">Take photos</span>
                  </button>
                  <input
                    id="before-modal-upload"
                    ref={beforePhotoModalInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={async (e) => {
                      await appendInspectionPhotosFromFiles(e.target.files, "BEFORE");
                      if (beforePhotoModalInputRef.current) beforePhotoModalInputRef.current.value = "";
                    }}
                  />
                  <label
                    htmlFor="before-modal-upload"
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border min-h-[120px] px-2 py-4 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer"
                  >
                    <Upload className="w-7 h-7 mb-2" />
                    <span className="text-xs font-medium text-center">Upload photos</span>
                  </label>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border min-h-[120px] px-2 py-4 text-muted-foreground opacity-50 pointer-events-none">
                    <Camera className="w-7 h-7 mb-2" />
                    <span className="text-xs font-medium text-center">Take photos</span>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border min-h-[120px] px-2 py-4 text-muted-foreground opacity-50 pointer-events-none">
                    <Upload className="w-7 h-7 mb-2" />
                    <span className="text-xs font-medium text-center">Upload photos</span>
                  </div>
                </>
              )}
            </div>
            {hasBeforeInspectionPhoto(jobCard?.inspectionPhotos) ? (
              <div className="grid grid-cols-2 gap-2">
                {displayPhotos
                  .filter((p) => p.type === "BEFORE")
                  .map((photo) => (
                    <div key={photo.id} className="rounded-lg border overflow-hidden bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.label || "Before photo"} className="w-full aspect-4/3 object-cover" loading="lazy" />
                      <div className="flex items-center justify-between px-2 py-1.5 border-t text-xs">
                        <span className="truncate font-medium">{photo.label}</span>
                        {canDeleteInspectionPhotos && (
                          <button
                            type="button"
                            className="text-destructive font-medium shrink-0"
                            onClick={() => void handleRemovePhoto(photo.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center">No Before photos yet — use the upload area above.</p>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBeforePhotoRequiredOpen(false)}>
              Not now
            </Button>
            <Button
              type="button"
              disabled={advanceBlockedByMechanic}
              title={updateStatusDisabledTitle}
              onClick={() => {
                const photos =
                  useJobCardStore.getState().jobCards.find((j) => j.id === jobCard?.id)
                    ?.inspectionPhotos ?? jobCard?.inspectionPhotos;
                if (!hasBeforeInspectionPhoto(photos)) {
                  toast.error("Add at least one Before photo first");
                  return;
                }
                if (!hasMechanicAssigned) {
                  toast.error("Assign a mechanic before moving to In Service", {
                    description: "Use Assign mechanic in the workflow bar above.",
                  });
                  setShowQuickAssignDialog(true);
                  return;
                }
                setBeforePhotoRequiredOpen(false);
                void handleUpdateStatus();
              }}
            >
              Continue — update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={afterPhotoRequiredOpen}
        onOpenChange={(open) => {
          setAfterPhotoRequiredOpen(open);
          if (!open) {
            if (afterPhotoModalInputRef.current) afterPhotoModalInputRef.current.value = "";
          }
        }}
      >
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[90dvh]")}>
          <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-2")}>
            <DialogTitle>After photos required</DialogTitle>
            <DialogDescription>
              Add at least one &quot;After&quot; inspection photo to move this job from Quality Check to Ready. QC must already be
              marked complete (which unlocks After uploads).
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-4 min-h-0 flex-1 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {canUploadAfter ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAfterPhotoRequiredOpen(false);
                      openMultiCam("AFTER");
                    }}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border min-h-[120px] px-2 py-4 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer"
                  >
                    <Camera className="w-7 h-7 mb-2" />
                    <span className="text-xs font-medium text-center">Take photos</span>
                  </button>
                  <input
                    id="after-modal-upload"
                    ref={afterPhotoModalInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={async (e) => {
                      await appendInspectionPhotosFromFiles(e.target.files, "AFTER");
                      if (afterPhotoModalInputRef.current) afterPhotoModalInputRef.current.value = "";
                    }}
                  />
                  <label
                    htmlFor="after-modal-upload"
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border min-h-[120px] px-2 py-4 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer"
                  >
                    <Upload className="w-7 h-7 mb-2" />
                    <span className="text-xs font-medium text-center">Upload photos</span>
                  </label>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border min-h-[120px] px-2 py-4 text-muted-foreground opacity-50 pointer-events-none">
                    <Camera className="w-7 h-7 mb-2" />
                    <span className="text-xs font-medium text-center">Take photos</span>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border min-h-[120px] px-2 py-4 text-muted-foreground opacity-50 pointer-events-none">
                    <Upload className="w-7 h-7 mb-2" />
                    <span className="text-xs font-medium text-center">Upload photos</span>
                  </div>
                </>
              )}
            </div>
            {!canUploadAfter && (
              <p className="text-xs text-amber-700 dark:text-amber-500 text-center">
                After uploads are locked until quality check is completed.
              </p>
            )}
            {displayPhotos.filter((p) => p.type === "AFTER").length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {displayPhotos
                  .filter((p) => p.type === "AFTER")
                  .map((photo) => (
                    <div key={photo.id} className="rounded-lg border overflow-hidden bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.label || "After photo"} className="w-full aspect-4/3 object-cover" loading="lazy" />
                      <div className="flex items-center justify-between px-2 py-1.5 border-t text-xs">
                        <span className="truncate font-medium">{photo.label}</span>
                        {canDeleteInspectionPhotos && (
                          <button
                            type="button"
                            className="text-destructive font-medium shrink-0"
                            onClick={() => void handleRemovePhoto(photo.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                No After photos yet — use the upload area above.
              </p>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAfterPhotoRequiredOpen(false)}>
              Not now
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!displayPhotos.some((p) => p.type === "AFTER")) {
                  toast.error("Add at least one After photo first");
                  return;
                }
                setAfterPhotoRequiredOpen(false);
                window.setTimeout(() => handleUpdateStatus(), 0);
              }}
            >
              Continue — update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={partsDialogOpen} onOpenChange={setPartsDialogOpen}>
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[90dvh] sm:max-w-2xl")}>
          <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-2")}>
            <DialogTitle>Parts &amp; materials</DialogTitle>
            <DialogDescription>
              Optional — search inventory and add parts to this job. Prices and stock update automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-4 min-h-0 flex-1 overflow-y-auto">
            <JobCardPartsPicker
              hideIntro
              selectedLines={partsDraftLines}
              onSelectedLinesChange={setPartsDraftLines}
            />
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPartsDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveJobCardParts}>
              Save parts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={serviceChecklistRequiredOpen}
        onOpenChange={setServiceChecklistRequiredOpen}
      >
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[90dvh]")}>
          <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-2")}>
            <DialogTitle>Complete service checklist</DialogTitle>
            <DialogDescription>
              Mark every service line as done before moving from In Service to Quality Check ({completedCount} of {totalCount}{" "}
              completed).
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-4 min-h-0 flex-1 overflow-y-auto space-y-3">
            <Progress value={progressPercent} className="h-2" />
            {serviceItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No services on this job card.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background/80 px-3 py-2">
                  <Checkbox
                    id="checklist-select-all"
                    disabled={!canEditJobDetails}
                    checked={
                      completedCount > 0 && completedCount < totalCount
                        ? "indeterminate"
                        : completedCount === totalCount
                    }
                    onCheckedChange={(v) => setAllServicesComplete(v === true)}
                  />
                  <label
                    htmlFor="checklist-select-all"
                    className="text-sm font-medium cursor-pointer select-none"
                  >
                    Select all
                  </label>
                </div>
                {serviceItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        id={`checklist-gate-${item.id}`}
                        checked={item.isCompleted}
                        disabled={!canEditJobDetails}
                        onCheckedChange={() => toggleServiceComplete(item.id)}
                      />
                      <label htmlFor={`checklist-gate-${item.id}`} className="min-w-0 cursor-pointer select-none">
                        <p
                          className={`font-medium text-sm ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}
                        >
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(item.price)}
                        </p>
                        {isMembershipPricedLine(item) && membershipUsageByCatalogId.get(item.serviceCatalogId)?.isIncluded ? (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Included: {membershipUsageByCatalogId.get(item.serviceCatalogId)!.included} · Used: {membershipUsageByCatalogId.get(item.serviceCatalogId)!.used} · Remaining: {membershipUsageByCatalogId.get(item.serviceCatalogId)!.remaining}
                          </p>
                        ) : null}
                        {item.durationMinutes != null && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Est. {item.durationMinutes} min
                          </p>
                        )}
                      </label>
                    </div>
                    {item.isCompleted ? (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">Done</span>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">Pending</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setServiceChecklistRequiredOpen(false)}>
              Not now
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (totalCount > 0 && completedCount !== totalCount) {
                  toast.error("Complete every checklist item first");
                  return;
                }
                setServiceChecklistRequiredOpen(false);
                window.setTimeout(() => handleUpdateStatus(), 0);
              }}
            >
              Continue — update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qualityCheckRequiredOpen} onOpenChange={setQualityCheckRequiredOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle>Quality check required</DialogTitle>
            <DialogDescription>
              Confirm QC before moving from Quality Check to Ready. After photos stay locked until this is checked.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <Checkbox
              id="qc-complete-gate"
              checked={qualityCheckDone}
              onCheckedChange={(v) => handleQualityCheckChange(v === true)}
            />
            <label htmlFor="qc-complete-gate" className="text-sm leading-tight cursor-pointer select-none">
              <span className="font-medium">Quality check completed</span>
              <p className="text-muted-foreground mt-1 text-xs">
                Confirm the work meets your standards.
              </p>
            </label>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setQualityCheckRequiredOpen(false)}>
              Not now
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!qualityCheckDone) {
                  toast.error("Tick Quality check completed first");
                  return;
                }
                setQualityCheckRequiredOpen(false);
                window.setTimeout(() => handleUpdateStatus(), 0);
              }}
            >
              Continue — update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick assign mechanic (no scroll — same page top) */}
      <Dialog
        open={showQuickAssignDialog}
        onOpenChange={(open) => {
          setShowQuickAssignDialog(open);
          if (!open) setQuickAssignMechanicId("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign mechanic</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Choose who will work on {jobCard.jobNumber}. You can change this later from Switch mechanic.
          </p>
          <div className="space-y-2 pt-1">
            <Label htmlFor="quick-assign-mechanic">Mechanic</Label>
            <Select
              value={quickAssignMechanicId}
              onValueChange={(next) => {
                if (next === ADD_MECHANIC_SELECT_VALUE) {
                  setAddMechanicOpen(true);
                  return;
                }
                setQuickAssignMechanicId(next);
              }}
            >
              <SelectTrigger id="quick-assign-mechanic">
                <SelectValue
                  placeholder={mechanics.length ? "Select mechanic" : "No mechanics in staff list"}
                />
              </SelectTrigger>
              <SelectContent>
                {mechanics.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
                {canAddMechanic && (
                  <>
                    {mechanics.length > 0 && <SelectSeparator />}
                    <SelectItem value={ADD_MECHANIC_SELECT_VALUE} className="text-primary font-medium">
                      + Add mechanic
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            {mechanics.length === 0 && canAddMechanic && (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-1.5"
                onClick={() => setAddMechanicOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add mechanic
              </Button>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowQuickAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickAssignConfirm} disabled={!quickAssignMechanicId}>
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <QuickAddMechanicDialog
        open={addMechanicOpen}
        onOpenChange={setAddMechanicOpen}
        branchId={jobCard.branchId}
        title="Add mechanic"
        description="Creates a mechanic account for this branch and selects them for this job."
        confirmLabel="Add & select"
        onCreated={(m) => {
          setQuickAssignMechanicId(m.id);
          if (showSwitchDialog) {
            setSwitchToMechanicId(m.id);
          }
        }}
      />

      {/* Switch Mechanic Dialog */}
      <Dialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch Mechanic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-muted-foreground">Current Mechanic</p>
              <p className="font-medium mt-0.5">{currentMechanicName ?? "Unassigned"}</p>
            </div>

            <div className="space-y-2">
              <Label>New Mechanic *</Label>
              <Select
                value={switchToMechanicId}
                onValueChange={(next) => {
                  if (next === ADD_MECHANIC_SELECT_VALUE) {
                    setAddMechanicOpen(true);
                    return;
                  }
                  setSwitchToMechanicId(next);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mechanic" />
                </SelectTrigger>
                <SelectContent>
                  {mechanics
                    .filter((m) => m.id !== currentMechanicId)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  {canAddMechanic && (
                    <>
                      <SelectSeparator />
                      <SelectItem value={ADD_MECHANIC_SELECT_VALUE} className="text-primary font-medium">
                        + Add mechanic
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={switchReason} onValueChange={setSwitchReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {SWITCH_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {switchReason === "Other" && (
              <div className="space-y-2">
                <Label>Specify Reason</Label>
                <Input
                  placeholder="Enter reason..."
                  value={switchCustomReason}
                  onChange={(e) => setSwitchCustomReason(e.target.value)}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowSwitchDialog(false)}>Cancel</Button>
              <Button onClick={handleSwitchMechanic}>Confirm Switch</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showMobileActionBar ? (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[90] border-t border-border bg-background/95 px-3 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg flex-col gap-2">
            {currentStatus === "READY" && invoiceForJob ? (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" className="w-full" onClick={() => setDeliverVehicleOpen(true)}>
                  <Truck className="w-4 h-4 mr-2" />
                  Deliver Vehicle
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setRecordPaymentOpen(true)}
                >
                  <IndianRupee className="w-4 h-4 mr-2" />
                  Record Payment
                </Button>
              </div>
            ) : currentStatus === "DELIVERED" || currentStatus === "READY" ? (
              <Button type="button" className="w-full" onClick={handleGenerateInvoice}>
                <FileText className="w-4 h-4 mr-2" />
                {invoiceForJob ? "View invoice" : "Generate Invoice"}
              </Button>
            ) : (
              <div className="flex gap-2">
                {!hasMechanicAssigned ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowQuickAssignDialog(true)}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Assign
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className={cn("min-w-0", hasMechanicAssigned ? "flex-1" : "flex-[1.5]")}
                  onClick={handleUpdateStatus}
                  disabled={updateStatusDisabled}
                  title={updateStatusDisabledTitle}
                >
                  Update Status
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
      <DeliverVehicleDialog
        open={deliverVehicleOpen}
        onOpenChange={setDeliverVehicleOpen}
        jobNumber={jobCard.jobNumber}
        submitting={deliverVehicleSubmitting}
        dropOff={dropOffPrefill}
        onConfirm={handleDeliverVehicle}
      />
      <RecordPaymentDialog
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        invoiceId={invoiceForJob?.id ?? null}
        onSuccess={() => {
          setRecordPaymentOpen(false);
          setDeliverVehicleOpen(true);
        }}
      />
      <EditJobCardDetailsDialog
        jobCard={jobCard}
        open={editDetailsOpen}
        onOpenChange={setEditDetailsOpen}
        onSaved={(next) => {
          setServiceItems(next.services);
          setNotes(next.notes ?? "");
        }}
      />
      <MultiPhotoCameraCapture
        open={multiCamOpen}
        onOpenChange={(open) => {
          setMultiCamOpen(open);
          if (!open) setMultiCamStreamPromise(null);
        }}
        streamPromise={multiCamStreamPromise}
        title={multiCamType === "AFTER" ? "Take After Photos" : "Take Before Photos"}
        onComplete={async (files) => {
          await appendInspectionPhotosFromFiles(files, multiCamType);
        }}
      />
      <JobCardWhatsAppNotifyDialog
        open={whatsAppNotifyOpen}
        onOpenChange={setWhatsAppNotifyOpen}
        jobCard={jobCard}
        businessName={businessName}
        invoiceNumber={invoiceForJob?.invoiceNumber}
      />
    </div>
  );
}

function CompareView({ photos }: { photos: { id: string; url: string; type: "BEFORE" | "AFTER"; label: string }[] }) {
  const beforePhotos = photos.filter((p) => p.type === "BEFORE");
  const afterPhotos = photos.filter((p) => p.type === "AFTER");
  const maxLen = Math.max(beforePhotos.length, afterPhotos.length);

  if (beforePhotos.length === 0 && afterPhotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ImageIcon className="w-10 h-10 mb-2 opacity-40" />
        <p className="text-sm">No photos to compare</p>
        <p className="text-xs mt-1">Upload Before and After photos first</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Before
          </span>
          <p className="text-[11px] text-muted-foreground mt-1.5 px-1 leading-snug">
            Check-in and inspection photos both appear here (oldest first).
          </p>
        </div>
        <div className="text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            After
          </span>
          <p className="text-[11px] text-muted-foreground mt-1.5 px-1 leading-snug">
            Paired with Before by row: 1↔1, 2↔2…
          </p>
        </div>
      </div>
      {Array.from({ length: maxLen }).map((_, i) => (
        <div key={i} className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
            {beforePhotos[i] ? (
              <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={beforePhotos[i].url} alt={beforePhotos[i].label || "Before photo"} className="w-full aspect-4/3 object-cover" loading="lazy" />
                <p className="text-xs font-medium text-center py-2 border-t border-border">{beforePhotos[i].label}</p>
              </div>
            ) : (
              <div className="flex items-center justify-center aspect-4/3 text-muted-foreground">
                <p className="text-xs">No photo</p>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
            {afterPhotos[i] ? (
              <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={afterPhotos[i].url} alt={afterPhotos[i].label || "After photo"} className="w-full aspect-4/3 object-cover" loading="lazy" />
                <p className="text-xs font-medium text-center py-2 border-t border-border">{afterPhotos[i].label}</p>
              </div>
            ) : (
              <div className="flex items-center justify-center aspect-4/3 text-muted-foreground">
                <p className="text-xs">No photo</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
