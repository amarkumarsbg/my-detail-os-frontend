"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import { uploadJobInspectionPhoto, refreshJobCardFromServer, markJobCardCheckedIn, INSPECTION_PHOTO_MAX_BYTES } from "@/lib/job-card-inspection-photo-upload";
import {
  hasBeforeInspectionPhoto,
  mergeInspectionPhotosById,
  toPersistedInspectionPhotoType,
} from "@/lib/job-card-inspection-photos";
import {
  MultiPhotoCameraCapture,
  canUseLiveCameraPreview,
  requestCameraStream,
} from "@/components/job-cards/multi-photo-camera-capture";
import { notifyMembershipWelcomeWhatsApp, notifyReservationConfirmedWhatsApp } from "@/lib/whatsapp-automation-triggers";
import { referredByFromOptionalInput } from "@/lib/referral-eligibility";
import { NewCustomerReferralCodeField } from "@/components/customers/new-customer-referral-code-field";
import { getNextBookingId } from "@/lib/appointment-ids";
import {
  getBookingConfirmationBusiness,
} from "@/lib/booking-confirmation-message";
import {
  appendAdvanceAckToJobMessage,
  buildJobCardCustomerWhatsAppMessage,
} from "@/lib/whatsapp-customer-messages";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Car,
  Search,
  Sparkles,
  Crown,
  Ticket,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  TrendingUp,
  Info,
  Plus,
  Check,
  CheckCircle2,
  XCircle,
  Camera,
  Upload,
  X,
  Calendar,
  Banknote,
  Percent,
  Wrench,
  ListChecks,
  Pencil,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import { CustomerCreditCheckDialog } from "@/components/job-cards/customer-credit-check-dialog";
import { type SelectedPartLine, buildJobCardPartItems, jobCardPartsSubtotal, selectedLinesFromJobParts } from "@/components/job-cards/job-card-parts-picker";
import { PartsSelectionStep } from "@/features/booking-wizard/components/steps/parts-selection-step";
import { NotesStep, JobDetailsStep } from "@/features/booking-wizard/components/steps/notes-step";
import { AddAddonDialog } from "@/components/services/add-addon-dialog";
import { AddServicePackageDialog } from "@/components/services/add-service-package-dialog";
import { ServiceSearchInput } from "@/components/services/searchable-service-select";
import { ServiceCustomPriceControl } from "@/components/services/service-custom-price-control";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { useStaffStore } from "@/store/staff-store";
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";
import { useHighEndServiceStore, highEndPriceForSegment } from "@/store/high-end-service-store";
import { useSettingsStore } from "@/store/settings-store"
import { averageServiceRewardPercent } from "@/lib/reward-category-rates";
import { useMembershipStore, computeMembershipEndDate, membershipTierDurationLabel } from "@/store/membership-store";
import { filterMembershipPackagesForVehicleSegment } from "@/lib/membership-package-eligibility";
import { useInvoiceStore } from "@/store/invoice-store";
import { useInventoryStore } from "@/store/inventory-store";
import { useOfferStore } from "@/store/offer-store";
import { useAppointmentStore } from "@/store/appointment-store";
import { customerHasPendingInvoiceDues } from "@/lib/party/ledger-math";
import { useBranchScope } from "@/lib/branch-scope";
import {
  computeOfferCouponDiscount,
  findOfferByCode,
  splitOfferCouponDiscount,
} from "@/lib/offer-coupon";
import { formatCurrency, cn } from "@/lib/utils";
import {
  INDIAN_VEHICLE_REG_HINT,
  findVehicleByNormalizedReg,
  isValidIndianVehicleRegistration,
  normalizeRegistrationNumber,
  sanitizeVehicleRegistrationInput,
} from "@/lib/vehicle-registration";
import { AddVehicleDialog } from "@/components/vehicles/add-vehicle-dialog";
import { AddVehicleInlineForm } from "@/components/vehicles/add-vehicle-inline-form";
import type { AddVehicleFormData } from "@/components/vehicles/add-vehicle-form-types";
import {
  isDatetimeLocalInPast,
  localDatetimeLocalInputMin,
  localTodayDateInputMin,
  localTimeInputMinNow,
} from "@/lib/booking-calendar-validation";
import { pushActivityLog } from "@/lib/activity-log-helper";
import {
  defaultManualFirstFollowUpMonths,
  expectedDeliveryFromHighEndCompletion,
  HIGH_END_COMPLETION_PRESETS,
  highEndCompletionSelectValue,
  maxHighEndCompletionMinutes,
} from "@/lib/high-end-follow-up";
import { formatServiceDurationLabel } from "@/lib/service-duration";
import type {
  Customer,
  Vehicle,
  VehicleSegment,
  FuelType,
  ServiceCatalogItem,
  InspectionPhoto,
  MembershipTier,
  MembershipServiceUsage,
  JobCard,
  JobCardPartItem,
  Appointment,
  CustomerMembership,
} from "@/types";


import { normalizePhoneDigits } from "@/lib/phone";
import {
  computeCustomerLookupMatches,
  queryLooksLikeVehicleReg,
} from "@/lib/customer-vehicle-lookup";
import { catalogPriceForSegment, withCatalogPrice, withCustomPrice } from "@/lib/service-line-price";
import type { CreateBookingVariant, JobWizardStepId } from "@/features/booking-wizard/types";
import {
  QUICK_INTERNAL_NOTES,
  TRENDING_IDS,
  ADDON_IDS_PREFERRED,
  SERVICE_TYPE_PRIMARY,
  OTHER_PRICING_SEGMENTS,
  MOBILE_DATE_TIME_INPUT_ICON_END,
  JOB_WIZARD_LABEL,
} from "@/features/booking-wizard/constants";
import {
  computeGstFromSubtotal,
  DEFAULT_GST_RATE,
} from "@/lib/gst-tax";
import { wizardTrackerMilestone, wizardTrackerLabels } from "@/features/booking-wizard/lib/wizard-steps";
import {
  datetimeLocalValue,
  splitDatetimeLocal,
  joinDatetimeLocal,
  hasExpectedDeliveryDateSet,
} from "@/features/booking-wizard/lib/datetime-local";
import {
  highEndComparisonTag,
  formatExpectedDeliveryDate,
  segmentBannerLabel,
  formatHighEndIntervalMonths,
  membershipTierLabel,
} from "@/features/booking-wizard/lib/pricing-format";
import { mechanicAvailabilityLabel } from "@/features/booking-wizard/lib/mechanic-availability";
import {
} from "@/features/booking-wizard/lib/queue-pickup-from-booking";

export type { CreateBookingVariant } from "@/features/booking-wizard/types";

export function CreateBookingPage({ variant }: { variant: CreateBookingVariant }) {
  const isWalkIn = variant === "walk-in";
  const isJobCard = variant === "job-card";
  const bookingListHref = isJobCard ? "/job-cards" : "/bookings";
  const desktopTitle = isJobCard ? "New Job Card" : "New Booking";
  const desktopBackLabel = isJobCard ? "Back to Job Cards" : "Back to Bookings";
  /** Shared stepped flow, summary panel, dialog on smaller viewports */
  const useBookingWizard = isJobCard || isWalkIn;
  const router = useRouter();
  /** Prevents create flow dialog `onOpenChange` from navigating away when we already route to `/job-cards/[id]`. */
  const skipJobCardListRedirectRef = useRef(false);
  /** Nested modals inside the mobile booking shell must not dismiss the shell (Radix bubbles close). */
  const skipBookingShellCloseRef = useRef(false);
  const guardBookingShellFromNestedClose = useCallback(() => {
    skipBookingShellCloseRef.current = true;
  }, []);
  const navigateToCreatedJobCard = useCallback((jobId: string) => {
    skipJobCardListRedirectRef.current = true;
    router.replace(`/job-cards/${jobId}`);
  }, [router]);

  const sendJobCardCreatedWhatsApp = useCallback(async (job: JobCard, message: string) => {
    const phone = job.customerPhone?.trim();
    if (!phone) return;
    const notify = (channel: "api" | "composer") => {
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title:
          channel === "api" ? "Job created — WhatsApp sent" : "Job created — WhatsApp composer",
        message: `${job.jobNumber} → ${phone}`,
        href: `/job-cards/${job.id}`,
        branchId: job.branchId,
      });
    };
    try {
      await sendCustomerWhatsApp(phone, message);
      toast.success("WhatsApp sent to customer", { description: phone });
      notify("api");
    } catch (e) {
      if (isWhatsAppNotConfiguredError(e)) {
        const { usedClipboard } = openWhatsAppComposer(phone, message);
        toast.info("WhatsApp opened", {
          description: usedClipboard
            ? "Full message copied — paste in WhatsApp. Or configure Twilio on the server."
            : "Finish sending in the app, or configure Twilio on the server.",
        });
        notify("composer");
        return;
      }
      toast.error("WhatsApp failed", {
        description: e instanceof ApiError ? e.message : "Could not send",
      });
    }
  }, []);

  const jobCards = useJobCardStore((s) => s.jobCards);
  const { addJobCard, getNextJobNumber, updateJobCard } = useJobCardStore();
  const addAppointment = useAppointmentStore((s) => s.addAppointment);
  const { services: highEndServices } = useHighEndServiceStore();
  const {
    businessName,
    businessAddress,
    businessPhone,
    businessEmail,
    businessWebsite,
    gstRegistrationStatus,
  } = useSettingsStore();
  // Be strict here so unexpected payload values never accidentally enable GST.
  const isGstRegistered = gstRegistrationStatus === "REGISTERED";
  const serviceCatalog = useServiceCatalogStore((s) => s.catalog);

  const rewardCategoryIncentivePercents = useSettingsStore((s) => s.rewardCategoryIncentivePercents);
  const defaultMechanicIncentivePercent = useSettingsStore((s) => s.defaultMechanicIncentivePercent);
  const highEndIncentivePercent = useSettingsStore((s) => s.highEndIncentivePercent);
  const incentiveCapPerJob = useSettingsStore((s) => s.incentiveCapPerJob);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const addVehicle = useVehicleStore((s) => s.addVehicle);
  const updateVehicle = useVehicleStore((s) => s.updateVehicle);
  const {
    addCustomer,
    updateCustomer,
    findByPhone,
    findByEmail,
    findByReferralCode,
    customers,
  } = useCustomerStore();
  const membershipPackagesAll = useMembershipStore((s) => s.packages);
  const membershipSubscriptions = useMembershipStore((s) => s.subscriptions);
  const getActiveMembership = useMembershipStore((s) => s.getActiveMembership);
  const subscriptionEffectiveStatus = useMembershipStore((s) => s.subscriptionEffectiveStatus);
  const getUsedIncludedServiceCount = useMembershipStore((s) => s.getUsedIncludedServiceCount);
  const getRemainingIncludedServiceCount = useMembershipStore((s) => s.getRemainingIncludedServiceCount);
  const assignMembership = useMembershipStore((s) => s.assignMembership);
  const invoices = useInvoiceStore((s) => s.invoices);
  const activeMembershipPackages = useMemo(
    () =>
      [...membershipPackagesAll.filter((p) => p.isActive)].sort((a, b) => a.price - b.price),
    [membershipPackagesAll]
  );
  const user = useAuthStore((s) => s.user);
  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const branchLocked = !showBranchPicker;
  const branches = useBranchStore((s) => s.branches);
  const activeBranches = useMemo(() => branches.filter((b) => b.isActive), [branches]);
  const staff = useStaffStore((s) => s.staff);
  const mechanics = useMemo(() => staff.filter((s) => s.role === "MECHANIC"), [staff]);
  const { getBrandNames, getModels, getModelSegment } = useVehicleCatalogStore();
  const brandNames = useMemo(() => getBrandNames(), [getBrandNames]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null);
  const [customerCreditDialogOpen, setCustomerCreditDialogOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleVinNumber, setVehicleVinNumber] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleSegment, setVehicleSegment] = useState<VehicleSegment | "">("");
  const eligibleActiveMembershipPackages = useMemo(
    () => filterMembershipPackagesForVehicleSegment(activeMembershipPackages, vehicleSegment || null),
    [activeMembershipPackages, vehicleSegment]
  );
  const [vehicleVariant, setVehicleVariant] = useState("");
  const [vehicleFuelType, setVehicleFuelType] = useState<FuelType>("PETROL");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleYear, setVehicleYear] = useState(() => String(new Date().getFullYear()));
  const [vehicleNotes, setVehicleNotes] = useState("");
  const [vehicleOdometer, setVehicleOdometer] = useState("");
  const [vehicleInsuranceProvider, setVehicleInsuranceProvider] = useState("");
  const [vehicleInsurancePolicyNumber, setVehicleInsurancePolicyNumber] = useState("");
  const [vehicleInsuranceDueDate, setVehicleInsuranceDueDate] = useState("");
  const [vehicleIdentifierType, setVehicleIdentifierType] = useState<"REG" | "VIN">("REG");
  const [vehicleIdentifierValue, setVehicleIdentifierValue] = useState("");
  const [showMoreVehicleDetails, setShowMoreVehicleDetails] = useState(true);


  const [bookingWhen, setBookingWhen] = useState(() =>
    isWalkIn ? datetimeLocalValue(new Date()) : ""
  );
  const bookingScheduleDateMin = localTodayDateInputMin();
  const bookingScheduleSplit = splitDatetimeLocal(bookingWhen);
  const bookingScheduleTimeMin =
    bookingScheduleSplit.date === bookingScheduleDateMin
      ? localTimeInputMinNow()
      : undefined;
  const [selectedMainIds, setSelectedMainIds] = useState<string[]>([]);
  /** Document-scoped custom prices keyed by catalog service id. */
  const [customPriceByServiceId, setCustomPriceByServiceId] = useState<Record<string, number>>({});
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [mechanicId, setMechanicId] = useState("");
  const [mechanicSearch, setMechanicSearch] = useState("");
  /** Empty = use catalog average; otherwise custom % of job estimate for incentive on this card. */
  const [mechanicIncentivePercentOverride, setMechanicIncentivePercentOverride] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const offers = useOfferStore((s) => s.offers);
  const [directDiscountType, setDirectDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [directDiscountValue, setDirectDiscountValue] = useState("");
  const [branchId, setBranchId] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [addonSearch, setAddonSearch] = useState("");
  const [highEndSearch, setHighEndSearch] = useState("");
  const [membershipRedeemSearch, setMembershipRedeemSearch] = useState("");
  const [selectedPartLines, setSelectedPartLines] = useState<SelectedPartLine[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [showAddons, setShowAddons] = useState(true);
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [addServicePackageOpen, setAddServicePackageOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referrerInfo, setReferrerInfo] = useState<{ id: string; name: string } | null>(null);
  const [referralError, setReferralError] = useState(false);
  const [lookupPanelCustomers, setLookupPanelCustomers] = useState<Customer[] | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [hasManuallySetExpectedDelivery, setHasManuallySetExpectedDelivery] = useState(false);
  /** Prevents re-running the pickup/drop prefill when customers/vehicles arrays update. */
  const pickupPrefillDoneRef = useRef(false);

  useEffect(() => {
    if (pickupPrefillDoneRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const pId = params.get("pickupId");
    // Wait for stores to hydrate before attempting prefill
    if (!pId || customers.length === 0) return;

    pickupPrefillDoneRef.current = true;

    const leg = usePickupDropStore.getState().requests.find((r) => r.id === pId);
    if (!leg) return;

    const normPhone = normalizePhoneDigits(leg.customerPhone ?? "");
    const matchedCustomer =
      normPhone.length === 10
        ? customers.find((c) => normalizePhoneDigits(c.phone) === normPhone)
        : undefined;

    if (matchedCustomer) {
      // Full prefill from matched customer record + vehicle
      prevMatchRef.current = matchedCustomer.id;
      setExistingCustomerId(matchedCustomer.id);
      setCustomerName(matchedCustomer.name);
      setCustomerPhone(normalizePhoneDigits(matchedCustomer.phone));
      setCustomerEmail(matchedCustomer.email ?? "");
      setCustomerAddress(matchedCustomer.address ?? "");
      const owned = vehicles.filter((v) => v.customerId === matchedCustomer.id);
      const matchedVehicle = leg.vehicleRegNumber
        ? (owned.find(
            (v) =>
              normalizeRegistrationNumber(v.registrationNumber) ===
              normalizeRegistrationNumber(leg.vehicleRegNumber!)
          ) ?? owned[0])
        : owned[0];
      if (matchedVehicle) {
        setSelectedVehicleId(matchedVehicle.id);
        setVehicleNumber(matchedVehicle.registrationNumber);
        setVehicleIdentifierType(matchedVehicle.vinNumber ? "VIN" : "REG");
        const rb =
          brandNames.find((b) => b.toLowerCase() === matchedVehicle.make.toLowerCase()) ??
          matchedVehicle.make;
        setVehicleBrand(rb);
        setVehicleModel(matchedVehicle.model);
        setVehicleSegment(matchedVehicle.segment);
      }
    } else {
      // No customer record yet — prefill the fields we have from the leg
      setCustomerName(leg.customerName);
      if (normPhone.length === 10) setCustomerPhone(normPhone);
      if (leg.vehicleRegNumber) setVehicleNumber(leg.vehicleRegNumber);
    }

    if (leg.odometerReading) setOdometerReading(String(leg.odometerReading));
    if (leg.notes) setInternalNotes(leg.notes);
  }, [customers, vehicles, brandNames]);

  const selectedCustomerRecord = useMemo(() => {
    if (!existingCustomerId) return null;
    return customers.find((c) => c.id === existingCustomerId) ?? null;
  }, [existingCustomerId, customers]);

  const customerVisits = selectedCustomerRecord?.totalVisits ?? 0;
  const customerRewardPoints = selectedCustomerRecord?.rewardPoints ?? 0;
  const [addingNewVehicle, setAddingNewVehicle] = useState(false);
  /** When adding a vehicle for an existing customer with a garage, form opens in a dialog */
  const [addVehiclePopupOpen, setAddVehiclePopupOpen] = useState(false);
  const skipAddVehicleCancelOnCloseRef = useRef(false);
  const [extraBrands, setExtraBrands] = useState<string[]>([]);
  const [extraModelsByBrand, setExtraModelsByBrand] = useState<Record<string, string[]>>({});
  const [pricingService, setPricingService] = useState<ServiceCatalogItem | null>(null);
  const serviceSearchInputRef = useRef<HTMLInputElement>(null);
  const addonsCardRef = useRef<HTMLDivElement>(null);
  const scheduleDateInputRef = useRef<HTMLInputElement>(null);
  const prevMatchRef = useRef<string | null>(null);

  const [reportedIssues, setReportedIssues] = useState("");
  const [odometerReading, setOdometerReading] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState(
    "Vehicle will be kept in secure parking. Not responsible for valuables left in vehicle. Warranty: 30 days on parts replaced."
  );
  const [selectedHighEndIds, setSelectedHighEndIds] = useState<string[]>([]);
  const [highEndFirstFollowUpById, setHighEndFirstFollowUpById] = useState<Record<string, number>>({});
  /** Planned completion time (minutes) per selected high-end program. */
  const [highEndCompletionMinutesById, setHighEndCompletionMinutesById] = useState<
    Record<string, number>
  >({});
  /** Optional advance amount (₹, incl. GST cap) saved on the job card when creating. */
  const [advanceAmountInput, setAdvanceAmountInput] = useState("");
  /** When set, membership is activated for the customer when the booking / job card is submitted. */
  const [wizardMembershipPackageId, setWizardMembershipPackageId] = useState<string | null>(null);
  /** For an existing vehicle-scoped pass: whether this visit uses included services (Yes) or normal booking (No). */
  const [membershipVisitChoice, setMembershipVisitChoice] = useState<null | "yes" | "no">(null);
  /** Included catalog service ids redeemed on this job at ₹0 (subset of package; must match selectedMainIds when Yes). */
  const [membershipRedeemServiceIds, setMembershipRedeemServiceIds] = useState<string[]>([]);
  const [membershipServicesDialogOpen, setMembershipServicesDialogOpen] = useState(false);
  /** Main service ids selected before choosing membership Yes (smart suggestions, etc.). */
  const preMembershipMainIdsRef = useRef<string[]>([]);

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInJob, setCheckInJob] = useState<{
    id: string;
    jobNumber: string;
    customerName: string;
    vehicleRegLabel: string;
    vehicleIdLabel: "VIN" | "Registration";
  } | null>(null);
  const [checkInReportedIssuesBase, setCheckInReportedIssuesBase] = useState("");
  const [checkInNotesBase, setCheckInNotesBase] = useState("");
  const [checkInDamages, setCheckInDamages] = useState("");
  const [checkInNotesExtra, setCheckInNotesExtra] = useState("");
  const [checkInPhotos, setCheckInPhotos] = useState<
    { id: string; file: File; previewUrl: string; label: string }[]
  >([]);
  const [checkInPhotoError, setCheckInPhotoError] = useState(false);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const checkInFileRef = useRef<HTMLInputElement>(null);
  const [checkInMultiCamOpen, setCheckInMultiCamOpen] = useState(false);
  // Guards the check-in dialog against spurious Radix onOpenChange(false) events that
  // can fire when the camera dialog opens or closes on mobile (nested Dialog interaction).
  const checkInCamBlocksDismissRef = useRef(false);
  const [checkInMultiCamStreamPromise, setCheckInMultiCamStreamPromise] =
    useState<Promise<MediaStream> | null>(null);
  const checkInJobIdRef = useRef<string | null>(null);
  /** Stores temporary password for new customers so it can be included in the check-in WhatsApp */
  const newCustomerTempPassRef = useRef<string | undefined>(undefined);
  const inlineVehicleFormRef = useRef<{
    validate: () => Promise<boolean>;
    getValues: () => AddVehicleFormData & { registrationNumber: string; isVin: boolean };
  } | null>(null);
  const isSubmittingJobRef = useRef(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

  const [jobCreateStep, setJobCreateStep] = useState(0);
  const [isDesktopWide, setIsDesktopWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktopWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /** Desktop wizard: fit dashboard main without page scroll; compact density */
  const compactJobCardDesktop = useBookingWizard && isDesktopWide;
  /** Wizard: denser customer step on all breakpoints to reduce scroll */
  const compactCustomerStep = useBookingWizard;

  useEffect(() => {
    if (branchLocked && selectedBranchId) {
      setBranchId(selectedBranchId);
      return;
    }
    if (selectedBranchId) {
      setBranchId(selectedBranchId);
    } else {
      setBranchId("");
    }
  }, [branchLocked, selectedBranchId]);

  useEffect(() => {
    if (!isJobCard) return;
    const code = referralCode.trim();
    if (!code) {
      setReferrerInfo(null);
      setReferralError(false);
      return;
    }
    const referrer = findByReferralCode(code);
    if (referrer) {
      setReferrerInfo({ id: referrer.id, name: referrer.name });
      setReferralError(false);
    } else {
      setReferrerInfo(null);
      setReferralError(true);
    }
  }, [referralCode, isJobCard, findByReferralCode]);

  useEffect(() => {
    // Keep current membership selection stable while creating + check-in modal is open.
    if (isCreatingBooking || checkInOpen) return;
    setWizardMembershipPackageId(null);
  }, [existingCustomerId, isCreatingBooking, checkInOpen]);

  useEffect(() => {
    if (!existingCustomerId) return;
    setReferralCode("");
    setReferrerInfo(null);
    setReferralError(false);
  }, [existingCustomerId]);

  useEffect(() => {
    setHighEndCompletionMinutesById((prev) => {
      const allowed = new Set(selectedHighEndIds);
      const next = { ...prev };
      let changed = false;
      for (const k of Object.keys(next)) {
        if (!allowed.has(k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedHighEndIds]);

  const brandModels = useMemo(
    () => (vehicleBrand ? getModels(vehicleBrand) : []),
    [vehicleBrand, getModels]
  );

  const allBrandsSorted = useMemo(
    () => [...new Set([...brandNames, ...extraBrands])].sort((a, b) => a.localeCompare(b)),
    [brandNames, extraBrands]
  );

  const allModelsSorted = useMemo(() => {
    const catalog = brandModels.map((m) => m.name);
    const extra = vehicleBrand ? extraModelsByBrand[vehicleBrand] ?? [] : [];
    return [...new Set([...catalog, ...extra])].sort((a, b) => a.localeCompare(b));
  }, [brandModels, vehicleBrand, extraModelsByBrand]);

  const emailLooks =
    (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const openCreditDialogIfCustomerHasDues = useCallback(
    (customerId: string) => {
      if (!isJobCard) return;
      if (customerHasPendingInvoiceDues(customerId, invoices)) {
        setCustomerCreditDialogOpen(true);
      }
    },
    [isJobCard, invoices]
  );

  useEffect(() => {
    const digits = normalizePhoneDigits(customerPhone);
    const emailTrim = customerEmail.trim();
    let found = digits.length === 10 ? findByPhone(customerPhone) : undefined;
    if (!found && emailLooks(emailTrim)) found = findByEmail(emailTrim);
    if (!found) {
      prevMatchRef.current = null;
      setExistingCustomerId(null);
      setSelectedVehicleId(null);
      if (isJobCard) setCustomerCreditDialogOpen(false);
      return;
    }
    if (prevMatchRef.current === found.id) {
      setExistingCustomerId(found.id);
      return;
    }
    prevMatchRef.current = found.id;
    setExistingCustomerId(found.id);
    setReferralCode("");
    setReferrerInfo(null);
    setReferralError(false);
    setCustomerName(found.name);
    const p10 = normalizePhoneDigits(found.phone);
    if (p10.length === 10) setCustomerPhone(p10);
    setCustomerEmail(found.email || "");
    setCustomerAddress(found.address || "");
    const owned = vehicles.filter((v) => v.customerId === found.id);
    if (owned.length > 0) {
      const v =
        [...owned].sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber))[0];
      setSelectedVehicleId(v.id);
      setAddingNewVehicle(false);
      setVehicleNumber(v.registrationNumber);
      setVehicleIdentifierType(v.vinNumber ? "VIN" : "REG");
      const rb = brandNames.find((b) => b.toLowerCase() === v.make.toLowerCase()) ?? v.make;
      setVehicleBrand(rb);
      setVehicleModel(v.model);
      setVehicleSegment(v.segment);
      setOdometerReading("");
      setVehicleOdometer("");
    } else {
      setSelectedVehicleId(null);
    }
    openCreditDialogIfCustomerHasDues(found.id);
  }, [
    customerPhone,
    customerEmail,
    findByPhone,
    findByEmail,
    brandNames,
    vehicles,
    isJobCard,
    vehicleNumber,
    openCreditDialogIfCustomerHasDues,
  ]);

  const applySelectedCustomer = (c: Customer) => {
    prevMatchRef.current = c.id;
    setExistingCustomerId(c.id);
    setReferralCode("");
    setReferrerInfo(null);
    setReferralError(false);
    setCustomerName(c.name);
    const p10 = normalizePhoneDigits(c.phone);
    if (p10.length === 10) setCustomerPhone(p10);
    setCustomerEmail(c.email || "");
    setCustomerAddress(c.address || "");
    const owned = vehicles.filter((v) => v.customerId === c.id);
    if (owned.length > 0) {
      const v = [...owned].sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber))[0];
      setSelectedVehicleId(v.id);
      setAddingNewVehicle(false);
      setVehicleNumber(v.registrationNumber);
      setVehicleIdentifierType(v.vinNumber ? "VIN" : "REG");
      const rb = brandNames.find((b) => b.toLowerCase() === v.make.toLowerCase()) ?? v.make;
      setVehicleBrand(rb);
      setVehicleModel(v.model);
      setVehicleSegment(v.segment);
      setOdometerReading("");
      setVehicleOdometer("");
    } else {
      setSelectedVehicleId(null);
      setAddingNewVehicle(true);
    }
    setLookupPanelCustomers(null);
    setLookupQuery("");
    toast.success("Customer selected", { description: c.name });
    openCreditDialogIfCustomerHasDues(c.id);
  };

  const cancelLookup = () => {
    setLookupPanelCustomers(null);
  };

  const computeLookupMatches = useCallback(
    (qRaw: string): Customer[] => computeCustomerLookupMatches(qRaw, customers, vehicles),
    [customers, vehicles]
  );

  useEffect(() => {
    const trimmed = lookupQuery.trim();
    if (!trimmed) {
      setLookupPanelCustomers(null);
      return;
    }
    const id = window.setTimeout(() => {
      const limited = computeLookupMatches(lookupQuery);
      setLookupPanelCustomers(limited.length > 0 ? limited : null);
    }, 280);
    return () => clearTimeout(id);
  }, [lookupQuery, computeLookupMatches]);

  /** Copy search into phone/reg for new customers; clear selection when search no longer matches selected customer. */
  useEffect(() => {
    const q = lookupQuery.trim();
    const digits = q.replace(/\D/g, "");
    const hasLetter = /[a-zA-Z]/i.test(q);
    const ql = q.toLowerCase();

    let canSyncFromLookup = !existingCustomerId;

    if (existingCustomerId && q.length > 0) {
      const cust = customers.find((c) => c.id === existingCustomerId);
      if (cust) {
        const owned = vehicles.filter((v) => v.customerId === existingCustomerId);
        const p10 = normalizePhoneDigits(cust.phone);

        let stillMatches = false;
        if (!hasLetter) {
          if (digits.length === 0) stillMatches = true;
          else if (digits.length < 10) stillMatches = true;
          else stillMatches = digits.slice(-10) === p10;
        } else {
          if (ql.length >= 2 && cust.name.toLowerCase().includes(ql)) stillMatches = true;
          else {
            const regSan = sanitizeVehicleRegistrationInput(q);
            const regCompact = normalizeRegistrationNumber(regSan).replace(/-/g, "");
            if (hasLetter && /\d/.test(q) && regCompact.length >= 6) {
              stillMatches = owned.some((v) =>
                normalizeRegistrationNumber(v.registrationNumber).includes(regCompact)
              );
            } else if (ql.length < 2) stillMatches = true;
          }
        }

        if (!stillMatches) {
          prevMatchRef.current = null;
          setExistingCustomerId(null);
          setCustomerName("");
          setCustomerEmail("");
          setCustomerAddress("");
          setSelectedVehicleId(null);
          setAddingNewVehicle(false);
          setVehicleNumber("");
          setVehicleBrand("");
          setVehicleModel("");
          setVehicleSegment("");
          canSyncFromLookup = true;
        }
      }
    }

    if (!canSyncFromLookup) return;
    if (!q) return;

    const looksLikePlate = queryLooksLikeVehicleReg(q);

    if (looksLikePlate) {
      const regSan = sanitizeVehicleRegistrationInput(q);
      setVehicleNumber((prev) => (prev === regSan ? prev : regSan));
      return;
    }

    if (!hasLetter && digits.length >= 10) {
      const p10 = digits.slice(-10);
      setCustomerPhone((prev) => (prev === p10 ? prev : p10));
    } else if (!hasLetter && digits.length > 0 && digits.length < 10) {
      setCustomerPhone((prev) => (prev === "" ? digits : prev));
    }
  }, [lookupQuery, existingCustomerId, customers, vehicles]);

  const selectVehicleFromGarage = (v: Vehicle) => {
    setSelectedVehicleId(v.id);
    setAddingNewVehicle(false);
    setAddVehiclePopupOpen(false);
    setVehicleNumber(v.registrationNumber);
    setVehicleIdentifierType(v.vinNumber ? "VIN" : "REG");
    const rb = brandNames.find((b) => b.toLowerCase() === v.make.toLowerCase()) ?? v.make;
    setVehicleBrand(rb);
    setVehicleModel(v.model);
    setVehicleSegment(v.segment);
    // Clear visit odometer so staff enter the current reading (last value shown as hint)
    setOdometerReading("");
    setVehicleOdometer("");
  };

  const startAddNewVehicle = () => {
    setAddingNewVehicle(true);
    setSelectedVehicleId(null);
    setVehicleNumber("");
    setVehicleBrand("");
    setVehicleModel("");
    setVehicleSegment("");
    setAddVehiclePopupOpen(true);
  };

  const cancelAddVehicleFromPopup = () => {
    setAddVehiclePopupOpen(false);
    setAddingNewVehicle(false);
    setVehicleNumber("");
    setVehicleBrand("");
    setVehicleModel("");
    setVehicleSegment("");
    setVehicleVariant("");
    setVehicleFuelType("PETROL");
    setVehicleColor("");
    setVehicleYear(String(new Date().getFullYear()));
    setVehicleNotes("");
    setVehicleOdometer("");
    setVehicleInsuranceProvider("");
    setVehicleInsurancePolicyNumber("");
    setVehicleInsuranceDueDate("");
    setVehicleIdentifierType("REG");
    setVehicleIdentifierValue("");
  };


  const applyVehicleFormToWizardState = (
    data: AddVehicleFormData & { registrationNumber: string; isVin: boolean }
  ) => {
    setVehicleIdentifierType(data.identifierType);
    setVehicleIdentifierValue(data.identifierValue);
    setVehicleNumber(data.registrationNumber);
    setVehicleVinNumber(data.isVin ? data.registrationNumber : "");
    setVehicleBrand(data.make);
    setVehicleModel(data.model);
    setVehicleSegment(data.segment);
    setVehicleVariant(data.variant ?? "");
    setVehicleFuelType(data.fuelType);
    setVehicleColor(data.color ?? "");
    setVehicleYear(String(data.year || new Date().getFullYear()));
    setVehicleNotes(data.notes ?? "");
    const odo =
      data.odometer === "" || data.odometer == null ? "" : String(data.odometer);
    setVehicleOdometer(odo);
    if (odo) setOdometerReading(odo);
    setVehicleInsuranceProvider(data.insuranceProvider ?? "");
    setVehicleInsurancePolicyNumber(data.insurancePolicyNumber ?? "");
    setVehicleInsuranceDueDate(data.insuranceDueDate ?? "");
  };

  const handleGarageVehicleCreated = (v: Vehicle) => {
    skipAddVehicleCancelOnCloseRef.current = true;
    selectVehicleFromGarage(v);
    setAddingNewVehicle(false);
  };

  const categories = useMemo(() => {
    const s = new Set<string>();
    serviceCatalog.filter((x) => x.isActive).forEach((x) => s.add(x.category));
    return ["ALL", ...Array.from(s).sort()];
  }, [serviceCatalog]);

  const filteredMainServices = useMemo(() => {
    return serviceCatalog.filter((s) => {
      if (!s.isActive) return false;
      if (s.isAddon) return false;
      if (categoryFilter !== "ALL" && s.category !== categoryFilter) return false;
      if (serviceSearch.trim()) {
        const q = serviceSearch.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [serviceCatalog, categoryFilter, serviceSearch]);

  const addonServices = useMemo(
    () =>
      serviceCatalog.filter(
        (s) =>
          s.isActive &&
          (ADDON_IDS_PREFERRED.includes(s.id) || s.isAddon === true)
      ),
    [serviceCatalog]
  );

  const filteredAddonServices = useMemo(() => {
    const q = addonSearch.trim().toLowerCase();
    if (!q) return addonServices;
    return addonServices.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [addonServices, addonSearch]);

  const filteredHighEndServices = useMemo(() => {
    const q = highEndSearch.trim().toLowerCase();
    if (!q) return highEndServices;
    return highEndServices.filter((h) => h.name.toLowerCase().includes(q));
  }, [highEndServices, highEndSearch]);

  const trendingServices = useMemo(
    () =>
      TRENDING_IDS.map((id) => serviceCatalog.find((s) => s.id === id)).filter(
        Boolean
      ) as ServiceCatalogItem[],
    [serviceCatalog]
  );

  const ownedVehicles = useMemo(() => {
    if (!existingCustomerId) return [];
    return vehicles.filter((v) => v.customerId === existingCustomerId);
  }, [existingCustomerId, vehicles]);

  const vehiclesWithActiveMembership = useMemo(() => {
    if (!existingCustomerId) return [];
    return ownedVehicles.filter((v) => getActiveMembership(existingCustomerId, v.id) != null);
  }, [existingCustomerId, ownedVehicles, getActiveMembership]);

  /**
   * Garage vehicle for membership: explicit garage selection, or the owned vehicle whose plate matches
   * the registration field (so the Membership step works after the inline vehicle step without clicking garage).
   */
  const membershipLookupVehicleId = useMemo(() => {
    if (!existingCustomerId) return null;
    if (selectedVehicleId) return selectedVehicleId;
    const reg = normalizeRegistrationNumber(sanitizeVehicleRegistrationInput(vehicleNumber));
    if (!reg) return null;
    const match = ownedVehicles.find(
      (v) => normalizeRegistrationNumber(v.registrationNumber) === reg
    );
    return match?.id ?? null;
  }, [existingCustomerId, selectedVehicleId, vehicleNumber, ownedVehicles]);

  const dbMembershipForSelectedVehicle = useMemo(() => {
    if (!existingCustomerId) return undefined;
    if (membershipLookupVehicleId) {
      return getActiveMembership(existingCustomerId, membershipLookupVehicleId);
    }
    return membershipSubscriptions.find(
      (s) =>
        s.customerId === existingCustomerId &&
        !s.vehicleId &&
        subscriptionEffectiveStatus(s) === "ACTIVE"
    );
  }, [
    existingCustomerId,
    membershipLookupVehicleId,
    getActiveMembership,
    membershipSubscriptions,
    subscriptionEffectiveStatus,
  ]);

  const activeMembershipForSelectedVehicle = useMemo(() => {
    if (dbMembershipForSelectedVehicle) return dbMembershipForSelectedVehicle;
    if (wizardMembershipPackageId) {
      const pkg = membershipPackagesAll.find((p) => p.id === wizardMembershipPackageId);
      if (pkg) {
        const endDateIso = computeMembershipEndDate(new Date().toISOString(), pkg.tier);
        return {
          id: "virtual-new-sub",
          customerId: existingCustomerId || "new-cust",
          packageId: wizardMembershipPackageId,
          startDate: new Date().toISOString(),
          endDate: endDateIso,
          status: "ACTIVE",
          notes: "Activating during this visit",
          vehicleId: selectedVehicleId || undefined,
          usageHistory: [],
        } as CustomerMembership;
      }
    }
    return undefined;
  }, [
    dbMembershipForSelectedVehicle,
    wizardMembershipPackageId,
    membershipPackagesAll,
    existingCustomerId,
    selectedVehicleId,
  ]);

  useEffect(() => {
    // During create/check-in transition, keep the selected package so summary totals remain stable.
    if (isCreatingBooking || checkInOpen) return;
    if (dbMembershipForSelectedVehicle) setWizardMembershipPackageId(null);
  }, [dbMembershipForSelectedVehicle, isCreatingBooking, checkInOpen]);

  useEffect(() => {
    if (!wizardMembershipPackageId) return;
    const stillEligible = eligibleActiveMembershipPackages.some(
      (pkg) => pkg.id === wizardMembershipPackageId
    );
    if (stillEligible) return;
    setWizardMembershipPackageId(null);
    setMembershipVisitChoice(null);
    setMembershipRedeemServiceIds([]);
  }, [wizardMembershipPackageId, eligibleActiveMembershipPackages]);

  useEffect(() => {
    // Avoid resetting the membership choice while the check-in modal is open for the newly created job.
    if (isCreatingBooking || checkInOpen) return;
    setMembershipVisitChoice(null);
    setMembershipRedeemServiceIds([]);
  }, [
    existingCustomerId,
    selectedVehicleId,
    membershipLookupVehicleId,
    activeMembershipForSelectedVehicle?.id,
    isCreatingBooking,
    checkInOpen,
  ]);

  /** Keep redeem ids in the job selection without replacing other picks (e.g. smart suggestions). */
  useEffect(() => {
    if (membershipVisitChoice !== "yes" || membershipRedeemServiceIds.length === 0) return;
    setSelectedMainIds((prev) => {
      const merged = new Set(prev);
      let changed = false;
      for (const id of membershipRedeemServiceIds) {
        if (!merged.has(id)) {
          merged.add(id);
          changed = true;
        }
      }
      return changed ? [...merged] : prev;
    });
  }, [membershipVisitChoice, membershipRedeemServiceIds]);

  const activeMembershipPackageRow = useMemo(
    () =>
      activeMembershipForSelectedVehicle
        ? membershipPackagesAll.find((p) => p.id === activeMembershipForSelectedVehicle.packageId)
        : undefined,
    [activeMembershipForSelectedVehicle, membershipPackagesAll]
  );

  const redeemingMembershipVisit = Boolean(
    activeMembershipForSelectedVehicle && membershipVisitChoice === "yes"
  );

  const summaryMembershipLabel = useMemo(() => {
    if (activeMembershipForSelectedVehicle && activeMembershipPackageRow) {
      let base = `${activeMembershipPackageRow.name} (active)`;
      if (membershipVisitChoice === "yes") {
        base +=
          membershipRedeemServiceIds.length > 0
            ? ` · redeeming ${membershipRedeemServiceIds.length} included service(s)`
            : " · add-ons only (included services not used)";
      } else if (membershipVisitChoice === "no") {
        base += " · not used this visit";
      }
      return base;
    }
    if (wizardMembershipPackageId) {
      const pkg = membershipPackagesAll.find((p) => p.id === wizardMembershipPackageId);
      return pkg ? `${pkg.name} (with this job)` : "—";
    }
    return "None";
  }, [
    activeMembershipForSelectedVehicle,
    activeMembershipPackageRow,
    wizardMembershipPackageId,
    membershipVisitChoice,
    membershipRedeemServiceIds.length,
    membershipPackagesAll,
  ]);

  const selectedVehicleObj = useMemo(() => {
    if (!selectedVehicleId) return null;
    return vehicles.find((v) => v.id === selectedVehicleId) ?? null;
  }, [selectedVehicleId, vehicles]);

  const isVinMode = useMemo(() => {
    if (selectedVehicleObj) {
      return !!selectedVehicleObj.vinNumber;
    }
    return vehicleIdentifierType === "VIN";
  }, [selectedVehicleObj, vehicleIdentifierType]);

  const showVehicleDetailsForm =
    !existingCustomerId || addingNewVehicle || ownedVehicles.length === 0;

  /** Garage + "Add New Vehicle" uses a popup; other cases keep the form inline in the card */
  const showInlineVehicleDetailsForm =
    showVehicleDetailsForm &&
    !(existingCustomerId && ownedVehicles.length > 0 && addingNewVehicle);

  const previousBooked = useMemo(() => {
    if (!existingCustomerId) return [];
    const map = new Map<string, { id: string; name: string; tag: string; count: number }>();
    for (const jc of jobCards) {
      if (jc.customerId !== existingCustomerId) continue;
      for (const si of jc.services) {
        const cat = serviceCatalog.find((c) => c.id === si.serviceCatalogId);
        const tag =
          cat?.category?.split(/[\s/&]/)[0]?.slice(0, 14) ?? si.name.split(" ")[0] ?? "Service";
        const cur = map.get(si.serviceCatalogId);
        if (cur) cur.count += 1;
        else map.set(si.serviceCatalogId, { id: si.serviceCatalogId, name: si.name, tag, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [existingCustomerId, jobCards, serviceCatalog]);

  const serviceBookingCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const jc of jobCards) {
      for (const si of jc.services) {
        m.set(si.serviceCatalogId, (m.get(si.serviceCatalogId) ?? 0) + 1);
      }
    }
    return m;
  }, [jobCards]);

  const activeCatalogTotal = useMemo(
    () => serviceCatalog.filter((s) => s.isActive).length,
    [serviceCatalog]
  );

  const selectedCatalogItems = useMemo(() => {
    const ids = new Set([...selectedMainIds, ...selectedAddonIds]);
    return serviceCatalog.filter((s) => ids.has(s.id));
  }, [serviceCatalog, selectedMainIds, selectedAddonIds]);

  // Incentive is always 0 by default — staff can override per job.
  const catalogAvgIncentivePercent = 0;

  useEffect(() => {
    setMechanicIncentivePercentOverride("");
  }, [mechanicId]);

  const membershipMainServiceZeroIds = useMemo(() => {
    if (membershipVisitChoice !== "yes") return new Set<string>();
    return new Set(membershipRedeemServiceIds);
  }, [membershipVisitChoice, membershipRedeemServiceIds]);

  const catalogSubtotalExclGst = useMemo(() => {
    if (!vehicleSegment) return 0;
    return selectedCatalogItems.reduce((sum, s) => {
      const isMain = selectedMainIds.includes(s.id);
      if (isMain && membershipMainServiceZeroIds.has(s.id)) return sum;
      const catalogPrice = catalogPriceForSegment(s, vehicleSegment);
      const custom = customPriceByServiceId[s.id];
      return sum + (custom != null ? custom : catalogPrice);
    }, 0);
  }, [
    selectedCatalogItems,
    vehicleSegment,
    selectedMainIds,
    membershipMainServiceZeroIds,
    customPriceByServiceId,
  ]);

  const clearCustomPrice = (id: string) => {
    setCustomPriceByServiceId((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const setCustomPrice = (id: string, next: number | null) => {
    if (next == null) {
      clearCustomPrice(id);
      return;
    }
    setCustomPriceByServiceId((prev) => ({ ...prev, [id]: next }));
  };

  const highEndSubtotalExclGst = useMemo(() => {
    return selectedHighEndIds.reduce((sum, hid) => {
      const h = highEndServices.find((x) => x.id === hid);
      return sum + (h ? highEndPriceForSegment(h, vehicleSegment || undefined) : 0);
    }, 0);
  }, [selectedHighEndIds, highEndServices, vehicleSegment]);

  const inventoryParts = useInventoryStore((s) => s.parts);

  const partsSubtotalExclGst = useMemo(() => {
    if (!isJobCard || selectedPartLines.length === 0) return 0;
    const items = buildJobCardPartItems("preview", selectedPartLines, inventoryParts);
    return jobCardPartsSubtotal(items);
  }, [isJobCard, selectedPartLines, inventoryParts]);

  const selectedPartSummaryLines = useMemo(() => {
    if (!isJobCard || selectedPartLines.length === 0) return [];
    return buildJobCardPartItems("preview", selectedPartLines, inventoryParts).map((item) => ({
      id: item.partId,
      label: `${item.name} · ${item.quantity} ${item.unit}`,
      amount: item.lineTotal,
    }));
  }, [isJobCard, selectedPartLines, inventoryParts]);

  const maxCatalogMinutes = useMemo(() => {
    if (selectedCatalogItems.length === 0) return 0;
    return Math.max(...selectedCatalogItems.map((s) => s.durationMinutes ?? 0));
  }, [selectedCatalogItems]);

  const maxHighEndMinutes = useMemo(() => {
    return maxHighEndCompletionMinutes(selectedHighEndIds, highEndCompletionMinutesById);
  }, [selectedHighEndIds, highEndCompletionMinutesById]);

  const totalPlannedCompletionMinutes = useMemo(() => {
    return Math.max(maxCatalogMinutes, maxHighEndMinutes);
  }, [maxCatalogMinutes, maxHighEndMinutes]);

  const suggestedJobCardExpectedDelivery = useMemo(() => {
    if (!isJobCard) return null;
    const d = new Date(Date.now() + totalPlannedCompletionMinutes * 60_000);
    d.setSeconds(0, 0);
    return d;
  }, [isJobCard, totalPlannedCompletionMinutes]);

  useEffect(() => {
    if (!isJobCard) return;
    if (suggestedJobCardExpectedDelivery && !hasManuallySetExpectedDelivery) {
      setBookingWhen(datetimeLocalValue(suggestedJobCardExpectedDelivery));
    }
  }, [isJobCard, suggestedJobCardExpectedDelivery, hasManuallySetExpectedDelivery]);

  useEffect(() => {
    if (selectedHighEndIds.length === 0 && selectedCatalogItems.length === 0) {
      setHasManuallySetExpectedDelivery(false);
      setBookingWhen("");
    }
  }, [selectedHighEndIds.length, selectedCatalogItems.length]);

  const isExpectedDeliveryTooEarly = useMemo(() => {
    if (!isJobCard || !suggestedJobCardExpectedDelivery || !bookingWhen) return false;
    const currentVal = new Date(bookingWhen);
    currentVal.setSeconds(0, 0);
    return currentVal.getTime() < suggestedJobCardExpectedDelivery.getTime();
  }, [isJobCard, suggestedJobCardExpectedDelivery, bookingWhen]);

  const computedExpectedDelivery = useMemo(() => {
    if (isWalkIn) {
      return expectedDeliveryFromHighEndCompletion(
        new Date(bookingWhen),
        selectedHighEndIds,
        highEndCompletionMinutesById
      );
    }
    if (isJobCard) {
      return bookingWhen ? new Date(bookingWhen) : suggestedJobCardExpectedDelivery;
    }
    if (hasExpectedDeliveryDateSet(bookingWhen)) return new Date(bookingWhen);
    return null;
  }, [isWalkIn, isJobCard, bookingWhen, suggestedJobCardExpectedDelivery, selectedHighEndIds, highEndCompletionMinutesById]);

  const jobCardExpectedDeliveryReady =
    !isJobCard ||
    selectedHighEndIds.length === 0 ||
    (hasExpectedDeliveryDateSet(bookingWhen) &&
      !isDatetimeLocalInPast(bookingWhen) &&
      !isExpectedDeliveryTooEarly);

  const highEndSummaryLines = useMemo(
    () =>
      selectedHighEndIds
        .map((hid) => {
          const h = highEndServices.find((x) => x.id === hid);
          if (!h) return null;
          return {
            id: hid,
            name: h.name,
            amount: highEndPriceForSegment(h, vehicleSegment || undefined),
          };
        })
        .filter((x): x is { id: string; name: string; amount: number } => x != null),
    [selectedHighEndIds, highEndServices, vehicleSegment]
  );

  const couponEvalContext = useMemo(() => {
    const serviceAmountsById: Record<string, number> = {};
    if (vehicleSegment) {
      for (const s of selectedCatalogItems) {
        const isMain = selectedMainIds.includes(s.id);
        if (isMain && membershipMainServiceZeroIds.has(s.id)) {
          serviceAmountsById[s.id] = 0;
          continue;
        }
        const catalogPrice = catalogPriceForSegment(s, vehicleSegment);
        const custom = customPriceByServiceId[s.id];
        serviceAmountsById[s.id] = custom != null ? custom : catalogPrice;
      }
    }
    const partAmountsById: Record<string, number> = {};
    for (const line of selectedPartSummaryLines) {
      partAmountsById[line.id] = line.amount;
    }
    return {
      customerId: existingCustomerId,
      servicesSubtotal: catalogSubtotalExclGst,
      partsSubtotal: partsSubtotalExclGst,
      selectedServiceIds: [...selectedMainIds, ...selectedAddonIds],
      selectedPartIds: selectedPartLines.map((l) => l.partId),
      serviceAmountsById,
      partAmountsById,
    };
  }, [
    vehicleSegment,
    selectedCatalogItems,
    selectedMainIds,
    selectedAddonIds,
    membershipMainServiceZeroIds,
    customPriceByServiceId,
    selectedPartSummaryLines,
    existingCustomerId,
    catalogSubtotalExclGst,
    partsSubtotalExclGst,
    selectedPartLines,
  ]);

  const discountAmount = useMemo(() => {
    if (!couponApplied || !appliedCouponCode) return 0;
    const offer = findOfferByCode(offers, appliedCouponCode);
    if (offer) {
      const result = computeOfferCouponDiscount(offer, couponEvalContext);
      return result.ok ? result.amount : 0;
    }
    if (appliedCouponCode === "WELCOME10") {
      return Math.round(catalogSubtotalExclGst * 0.1 * 100) / 100;
    }
    return 0;
  }, [
    couponApplied,
    appliedCouponCode,
    offers,
    couponEvalContext,
    catalogSubtotalExclGst,
  ]);

  const couponDiscountSplit = useMemo(() => {
    if (!couponApplied || !appliedCouponCode || !(discountAmount > 0)) {
      return { services: 0, parts: 0 };
    }
    const offer = findOfferByCode(offers, appliedCouponCode);
    if (!offer) {
      return appliedCouponCode === "WELCOME10"
        ? { services: discountAmount, parts: 0 }
        : { services: 0, parts: 0 };
    }
    return splitOfferCouponDiscount(offer, couponEvalContext, discountAmount);
  }, [
    couponApplied,
    appliedCouponCode,
    discountAmount,
    offers,
    couponEvalContext,
  ]);

  const directDiscountAmount = useMemo(() => {
    const val = directDiscountValue.trim();
    if (val === "") return 0;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return 0;
    if (directDiscountType === "percentage") {
      return Math.round(catalogSubtotalExclGst * (num / 100) * 100) / 100;
    } else {
      return Math.min(num, catalogSubtotalExclGst);
    }
  }, [directDiscountType, directDiscountValue, catalogSubtotalExclGst]);

  const totalDiscount = useMemo(() => {
    return Math.round((discountAmount + directDiscountAmount) * 100) / 100;
  }, [discountAmount, directDiscountAmount]);

  const membershipActivationPreviewAmount = useMemo(() => {
    if (!wizardMembershipPackageId) return 0;
    const pkg = membershipPackagesAll.find((p) => p.id === wizardMembershipPackageId);
    if (!pkg) return 0;
    return Math.round((pkg.price ?? 0) * 100) / 100;
  }, [wizardMembershipPackageId, membershipPackagesAll]);

  /** Catalog after coupon + high-end program amounts + parts (all excl. GST). */
  const afterDiscount = Math.max(
    0,
    catalogSubtotalExclGst +
      highEndSubtotalExclGst +
      partsSubtotalExclGst +
      membershipActivationPreviewAmount -
      discountAmount -
      directDiscountAmount
  );
  const { taxAmount: gstAmount, grandTotal: totalPayable } = computeGstFromSubtotal(
    afterDiscount,
    isGstRegistered ? "REGISTERED" : "NOT_REGISTERED"
  );

  /** Parsed advance for summary & cap (matches submit logic). */
  const summaryAdvanceAmount = useMemo(() => {
    const t = advanceAmountInput.trim();
    if (t === "") return 0;
    const n = Number.parseFloat(t.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return 0;
    const rounded = Math.round(n * 100) / 100;
    return Math.min(rounded, totalPayable);
  }, [advanceAmountInput, totalPayable]);

  const balanceAfterAdvance = useMemo(
    () => Math.max(0, Math.round((totalPayable - summaryAdvanceAmount) * 100) / 100),
    [totalPayable, summaryAdvanceAmount]
  );

  const toggleMain = (id: string) => {
    setSelectedMainIds((prev) => {
      if (prev.includes(id)) {
        clearCustomPrice(id);
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) => {
      if (prev.includes(id)) {
        clearCustomPrice(id);
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const toggleTrending = (id: string) => {
    setSelectedMainIds((prev) => {
      if (prev.includes(id)) {
        clearCustomPrice(id);
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const applyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      toast.error("Enter a coupon code");
      return;
    }
    const offer = findOfferByCode(offers, code);
    if (offer) {
      const result = computeOfferCouponDiscount(offer, couponEvalContext);
      if (!result.ok) {
        setCouponApplied(false);
        setAppliedCouponCode(null);
        toast.error(result.error);
        return;
      }
      setAppliedCouponCode(code);
      setCouponApplied(true);
      toast.success(
        `${offer.code} applied — ${formatCurrency(result.amount)} off (before tax)`
      );
      return;
    }
    if (code === "WELCOME10") {
      setAppliedCouponCode(code);
      setCouponApplied(true);
      toast.success("10% off applied to services (before tax)");
      return;
    }
    setCouponApplied(false);
    setAppliedCouponCode(null);
    toast.error("Invalid coupon code");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingJobRef.current) return;
    if (
      useBookingWizard &&
      wizardSteps.length > 0 &&
      jobCreateStep < wizardSteps.length - 1
    ) {
      toast.error(
        isJobCard
          ? "Complete all wizard steps before creating the job card."
          : "Complete all wizard steps before creating the booking."
      );
      return;
    }
    if (!branchId) {
      toast.error("Please select a branch to create the booking.");
      return;
    }
    if (!customerName.trim() || customerPhone.replace(/\D/g, "").length < 10) {
      toast.error("Customer name and a valid 10-digit phone are required.");
      return;
    }

    if (showInlineVehicleDetailsForm && inlineVehicleFormRef.current) {
      const ok = await inlineVehicleFormRef.current.validate();
      if (!ok) {
        toast.error("Vehicle identifier, brand, model, and type are required.");
        return;
      }
      applyVehicleFormToWizardState(inlineVehicleFormRef.current.getValues());
    }

    const number = showInlineVehicleDetailsForm && inlineVehicleFormRef.current
      ? inlineVehicleFormRef.current.getValues().registrationNumber
      : vehicleNumber;
    const brand = showInlineVehicleDetailsForm && inlineVehicleFormRef.current
      ? inlineVehicleFormRef.current.getValues().make
      : vehicleBrand;
    const model = showInlineVehicleDetailsForm && inlineVehicleFormRef.current
      ? inlineVehicleFormRef.current.getValues().model
      : vehicleModel;
    const segment = showInlineVehicleDetailsForm && inlineVehicleFormRef.current
      ? inlineVehicleFormRef.current.getValues().segment
      : vehicleSegment;
    const vinMode = showInlineVehicleDetailsForm && inlineVehicleFormRef.current
      ? inlineVehicleFormRef.current.getValues().isVin
      : isVinMode;

    if (!number.trim() || !brand.trim() || !model.trim() || !segment) {
      toast.error("Vehicle identifier, brand, model, and type are required.");
      return;
    }
    if (!vinMode && !isValidIndianVehicleRegistration(number)) {
      toast.error("Invalid registration", { description: INDIAN_VEHICLE_REG_HINT });
      return;
    }
    if (vinMode && number.length < 5) {
      toast.error("VIN must be at least 5 characters.");
      return;
    }
    if (
      selectedMainIds.length + selectedAddonIds.length === 0 &&
      selectedHighEndIds.length === 0
    ) {
      toast.error("Select at least one service, add-on, or high-end program.");
      return;
    }
    if (isJobCard && selectedHighEndIds.length > 0) {
      if (!hasExpectedDeliveryDateSet(bookingWhen)) {
        toast.error("Please select an expected delivery date for the high-end service.");
        return;
      }
      if (isDatetimeLocalInPast(bookingWhen)) {
        toast.error("Expected delivery date must be in the future.");
        return;
      }
    }
    if (isWalkIn && isDatetimeLocalInPast(bookingWhen)) {
      toast.error("Booking cannot be in the past", {
        description: "Choose today with a future time, or a later date.",
      });
      return;
    }
    isSubmittingJobRef.current = true;
    setIsCreatingBooking(true);
    try {
    const now = new Date().toISOString();
    const jobNumber = getNextJobNumber();
    const id = `jc-local-${Date.now()}`;
    const mechanic = mechanics.find((m) => m.id === mechanicId);

    let custId = existingCustomerId ?? `cust-local-${Date.now()}`;
    let newCustomerTempPass: string | undefined;
    const inlineVals =
      showInlineVehicleDetailsForm && inlineVehicleFormRef.current
        ? inlineVehicleFormRef.current.getValues()
        : null;
    const regStored = inlineVals
      ? inlineVals.isVin
        ? inlineVals.registrationNumber
        : normalizeRegistrationNumber(inlineVals.registrationNumber)
      : isVinMode
        ? vehicleNumber.trim().toUpperCase()
        : normalizeRegistrationNumber(vehicleNumber);
    const formDigits = normalizePhoneDigits(customerPhone);

    const vehiclesNow = useVehicleStore.getState().vehicles;
    const sameReg = vehiclesNow.filter(
      (v) => normalizeRegistrationNumber(v.registrationNumber) === regStored
    );
    const forThisCustomer = sameReg.filter((v) => v.customerId === custId);
    const forOthers = sameReg.filter((v) => v.customerId !== custId);
    let matchedVehicle: Vehicle | undefined = forThisCustomer[0];

    if (!matchedVehicle && forOthers.length > 0) {
      const otherV = forOthers[0];
      const owner = customers.find((c) => c.id === otherV.customerId);
      const ownerDigits = owner ? normalizePhoneDigits(owner.phone) : "";
      const samePerson = formDigits.length === 10 && (!owner || ownerDigits === formDigits);
      if (!existingCustomerId || !samePerson) {
        toast.error("Registration belongs to another customer", {
          description: "Use that customer record or transfer the vehicle first.",
        });
        return;
      }
      matchedVehicle = otherV;
    }

    if (!existingCustomerId) {
      const newReferralCode = `REF-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      let referredByWalkIn: string | undefined;
      if (!isJobCard) {
        const parsed = referredByFromOptionalInput(referralCode, findByReferralCode);
        if (parsed.error) {
          toast.error(parsed.error);
          return;
        }
        referredByWalkIn = parsed.referredBy;
      }
      const referredByJobCard =
        isJobCard && referrerInfo ? referralCode.trim().toUpperCase() : undefined;
      let createdWalkIn;
      try {
        createdWalkIn = await addCustomer({
          name: customerName.trim(),
          phone: customerPhone,
          email: customerEmail,
          address: customerAddress,
          referralCode: newReferralCode,
          referredBy: isJobCard ? referredByJobCard : referredByWalkIn,
          totalVisits: 1,
          lastVisitDate: now,
          rewardPoints: 0,
          walletBalance: 0,
        });
      } catch {
        toast.error("Could not create customer", {
          description: "Check that the API server is running.",
        });
        return;
      }
      if (!createdWalkIn) {
        toast.error("Phone already registered — search again to load customer.");
        return;
      }
      custId = createdWalkIn.id;
      newCustomerTempPass = (createdWalkIn as any)._temporaryPassword as string | undefined;
      newCustomerTempPassRef.current = newCustomerTempPass;
      // Store in sessionStorage so Ready-for-Pickup message can include it later in the same session
      if (newCustomerTempPass && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(`customer-temp-pass:${custId}`, newCustomerTempPass);
      }

      // Show temporary password to staff if WhatsApp delivery was skipped
      const tempPass = (createdWalkIn as any)._temporaryPassword as string | undefined;
      if (tempPass) {
        toast.info("Share login credentials manually", {
          description: `Phone: ${customerPhone}  |  Password: ${tempPass}`,
          duration: 20000,
        });
      }      if (isJobCard && referrerInfo) {
        toast.success("Referral code saved", {
          description:
            "Wallet rewards for both customers apply on the first qualifying invoice (Referrals rules).",
        });
      }
    } else {
      const existing = customers.find((c) => c.id === existingCustomerId);
      try {
        await updateCustomer(existingCustomerId, {
          totalVisits: (existing?.totalVisits ?? 0) + 1,
          lastVisitDate: now,
        });
      } catch {
        // Non-critical: without-edit users lack CUSTOMERS_EDIT; do not block job create.
      }
    }

    const seg = vehicleSegment as VehicleSegment;
    let resolvedVehicleId: string;
    if (matchedVehicle) {
      resolvedVehicleId = matchedVehicle.id;
    } else {
      resolvedVehicleId = `veh-local-${Date.now()}`;
    }

    let activatedMembershipMeta:
      | {
          membershipId: string;
          packageId: string;
          packageName: string;
          amount: number;
          startDate?: string;
          endDate?: string;
        }
      | null = null;

    if (wizardMembershipPackageId) {
      const selectedPackageIsEligible = eligibleActiveMembershipPackages.some(
        (pkg) => pkg.id === wizardMembershipPackageId
      );
      if (!selectedPackageIsEligible) {
        toast.error("No memberships available for this vehicle type.");
        return;
      }
      const memRes = assignMembership({
        customerId: custId,
        packageId: wizardMembershipPackageId,
        vehicleId: resolvedVehicleId,
        notes: `${isJobCard ? "New job card" : "Booking"} ${jobNumber}`,
      });
      if (!memRes.ok) {
        toast.error("Could not activate membership", { description: memRes.error });
        return;
      }
      const pkg = membershipPackagesAll.find((p) => p.id === wizardMembershipPackageId);
      const subRow = useMembershipStore.getState().subscriptions.find((s) => s.id === memRes.id);
      if (pkg) {
        toast.success("Membership activated", { description: pkg.name });
        activatedMembershipMeta = {
          membershipId: memRes.id,
          packageId: pkg.id,
          packageName: pkg.name,
          amount: Math.round((pkg.price ?? 0) * 100) / 100,
          startDate: subRow?.startDate,
          endDate: subRow?.endDate,
        };
        const names = pkg.includedServiceIds
          .map((sid) => serviceCatalog.find((c) => c.id === sid)?.name)
          .filter((n): n is string => Boolean(n));
        notifyMembershipWelcomeWhatsApp({
          customerPhone,
          customerName: customerName.trim(),
          customerId: custId,
          businessName,
          packageName: pkg.name,
          tier: pkg.tier,
          validUntilIso: subRow?.endDate ?? new Date().toISOString(),
          vehicleReg: regStored,
          includedServiceNames: names,
        });
      } else {
        toast.success("Membership activated", { description: "Membership" });
      }
    }

    if (membershipVisitChoice === "yes" && membershipRedeemServiceIds.length > 0) {
      const activeSub = getActiveMembership(custId, resolvedVehicleId);
      const activePkg = activeSub
        ? membershipPackagesAll.find((p) => p.id === activeSub.packageId)
        : undefined;
      if (!activeSub || !activePkg) {
        toast.error("Active membership not found for this vehicle.");
        return;
      }
      for (const sid of membershipRedeemServiceIds) {
        const remaining = getRemainingIncludedServiceCount(activeSub, activePkg, sid);
        if (remaining <= 0) {
          const serviceName = serviceCatalog.find((c) => c.id === sid)?.name ?? sid;
          toast.error(`${serviceName} has no remaining membership usage.`);
          return;
        }
      }
    }

    const serviceItems = selectedCatalogItems.map((s) => {
      const catalogPrice = catalogPriceForSegment(s, seg);
      const isFreeMain =
        membershipVisitChoice === "yes" &&
        membershipRedeemServiceIds.includes(s.id) &&
        selectedMainIds.includes(s.id);
      if (isFreeMain) {
        const priced = withCatalogPrice(catalogPrice, { membership: true });
        return {
          id: `si-${id}-${s.id}`,
          jobCardId: id,
          serviceCatalogId: s.id,
          name: s.name,
          ...priced,
          isCompleted: false,
          durationMinutes: s.durationMinutes,
        };
      }
      const custom = customPriceByServiceId[s.id];
      const base =
        custom != null
          ? withCustomPrice(catalogPrice, custom).price
          : catalogPrice;
      const serviceCoupon = couponDiscountSplit.services;
      const share =
        catalogSubtotalExclGst > 0
          ? base / catalogSubtotalExclGst
          : 1 / selectedCatalogItems.length;
      const discounted =
        Math.round((base - serviceCoupon * share + Number.EPSILON) * 100) / 100;
      const priced =
        custom != null
          ? {
              ...withCustomPrice(catalogPrice, custom),
              price: Math.max(0, discounted),
            }
          : {
              ...withCatalogPrice(catalogPrice),
              price: Math.max(0, discounted),
            };
      return {
        id: `si-${id}-${s.id}`,
        jobCardId: id,
        serviceCatalogId: s.id,
        name: s.name,
        ...priced,
        isCompleted: false,
        durationMinutes: s.durationMinutes,
      };
    });

    let jobCardPartItems: JobCardPartItem[] = isJobCard
      ? buildJobCardPartItems(id, selectedPartLines, inventoryParts)
      : [];
    const partsCoupon = couponDiscountSplit.parts;
    if (partsCoupon > 0 && jobCardPartItems.length > 0) {
      const partsTotal = jobCardPartsSubtotal(jobCardPartItems);
      if (partsTotal > 0) {
        jobCardPartItems = jobCardPartItems.map((item) => {
          const share = item.lineTotal / partsTotal;
          const nextTotal =
            Math.round((item.lineTotal - partsCoupon * share + Number.EPSILON) * 100) / 100;
          const nextUnit =
            item.quantity > 0
              ? Math.round((Math.max(0, nextTotal) / item.quantity) * 100) / 100
              : item.unitPrice;
          return {
            ...item,
            lineTotal: Math.max(0, nextTotal),
            unitPrice: nextUnit,
            isCustomPrice: true,
            priceSource: "CUSTOM" as const,
          };
        });
      }
    }

    const estimatedAmount =
      serviceItems.reduce((s, x) => s + x.price, 0) +
      highEndSubtotalExclGst +
      (isJobCard ? jobCardPartsSubtotal(jobCardPartItems) : 0) +
      (activatedMembershipMeta?.amount ?? 0);
    const customIncRaw = mechanicIncentivePercentOverride.trim();
    let incentivePercentFinal = catalogAvgIncentivePercent;
    if (customIncRaw !== "") {
      const n = Number.parseFloat(customIncRaw.replace(",", "."));
      if (Number.isFinite(n)) {
        incentivePercentFinal = Math.min(100, Math.max(0, Math.round(n * 100) / 100));
      }
    }

    if (matchedVehicle) {
      try {
        await updateVehicle(matchedVehicle.id, {
          customerId: custId,
          customerName: customerName.trim(),
          registrationNumber: regStored,
          make: vehicleBrand.trim(),
          model: vehicleModel.trim() || "—",
          segment: seg,
          ...(odometerReading.trim()
            ? { odometer: Number.parseInt(odometerReading, 10) || matchedVehicle.odometer }
            : {}),
        });
      } catch {
        // Non-critical for create: without-edit users lack VEHICLES_EDIT.
      }
    } else {
      await addVehicle({
        id: resolvedVehicleId,
        customerId: custId,
        customerName: customerName.trim(),
        registrationNumber: regStored,
        make: vehicleBrand.trim(),
        model: vehicleModel.trim() || "—",
        variant: vehicleVariant.trim() || undefined,
        segment: seg,
        fuelType: vehicleFuelType,
        color: vehicleColor.trim() || "—",
        year: Number(vehicleYear) || new Date().getFullYear(),
        notes: vehicleNotes.trim() || undefined,
        odometer: odometerReading.trim()
          ? Number.parseInt(odometerReading, 10) || undefined
          : undefined,
        insuranceProvider: vehicleInsuranceProvider.trim() || undefined,
        insurancePolicyNumber: vehicleInsurancePolicyNumber.trim() || undefined,
        insuranceDueDate: vehicleInsuranceDueDate || undefined,
        vinNumber: vehicleIdentifierType === "VIN" ? regStored : undefined,
      });
    }

    const bookingNote =
      [
        customerNotes && `Customer: ${customerNotes}`,
        internalNotes && `Internal: ${internalNotes}`,
        couponApplied &&
          appliedCouponCode &&
          `Coupon: ${appliedCouponCode}${discountAmount > 0 ? ` (−${formatCurrency(discountAmount)})` : ""}`,
        directDiscountValue.trim() !== "" &&
          `Direct Discount: ${directDiscountType === "percentage" ? `${directDiscountValue}%` : `₹${directDiscountValue}`}`,
      ]
        .filter(Boolean)
        .join("\n") || undefined;

    const expectedDeliveryIso = isJobCard
      ? (bookingWhen
          ? new Date(bookingWhen)
          : expectedDeliveryFromHighEndCompletion(
              new Date(),
              selectedHighEndIds,
              highEndCompletionMinutesById
            )
        ).toISOString()
      : expectedDeliveryFromHighEndCompletion(
          new Date(bookingWhen),
          selectedHighEndIds,
          highEndCompletionMinutesById
        ).toISOString();

    const advanceAmountPatch = (() => {
      const t = advanceAmountInput.trim();
      if (t === "") return {};
      const n = Number.parseFloat(t.replace(/,/g, ""));
      if (!Number.isFinite(n) || n <= 0) return {};
      const rounded = Math.round(n * 100) / 100;
      const capped = Math.min(rounded, totalPayable);
      return { highEndAdvanceAmountInr: capped } as const;
    })();

    if (isWalkIn) {
      const when = new Date(bookingWhen);
      const aptDate = format(when, "yyyy-MM-dd");
      const aptTime = format(when, "HH:mm");
      const bookingId = getNextBookingId(useAppointmentStore.getState().appointments);
      const aptId = `apt-${Date.now()}`;
      const serviceTypeLabel =
        serviceItems.map((s) => s.name).join(" + ") || "Service";
      const expectedDelDate =
        expectedDeliveryIso && !Number.isNaN(new Date(expectedDeliveryIso).getTime())
          ? format(new Date(expectedDeliveryIso), "yyyy-MM-dd")
          : undefined;

      const newBooking: Appointment = {
        id: aptId,
        bookingId,
        kind: "BOOKING",
        branchId,
        customerId: custId,
        customerName: customerName.trim(),
        customerPhone,
        whatsappPhone: customerPhone,
        vehicleId: resolvedVehicleId,
        vehicleRegNumber: regStored,
        vehicleMakeModel: `${vehicleBrand} ${vehicleModel}`.trim(),
        serviceType: serviceTypeLabel,
        mechanicId: mechanicId || undefined,
        mechanicName: mechanic?.name,
        date: aptDate,
        time: aptTime,
        status: "CONFIRMED",
        whatsappSent: true,
        createdAt: now,
        notes: bookingNote,
        customerFirstName: customerName.trim().split(/\s+/)[0],
        customerAddress: customerAddress.trim() || undefined,
        priceSubtotalExGst: afterDiscount,
        priceGstAmount: gstAmount,
        priceGrandTotal: totalPayable,
        advancePaid: summaryAdvanceAmount > 0 ? summaryAdvanceAmount : undefined,
        advancePolicyNote:
          "An advance payment of 30% is required to confirm and pre-schedule your service slot.",
        expectedDeliveryDate: expectedDelDate,
        deliveryExpectationNote:
          "we will try our 100% to deliver it on Saturday Evening.",
      };

      await addAppointment(newBooking);
      notifyReservationConfirmedWhatsApp(
        newBooking,
        getBookingConfirmationBusiness({
          businessName,
          businessAddress,
          businessPhone,
          businessEmail,
          businessWebsite,
          acceptanceOutlet: "Visit Outlet",
        })
      );

      pushActivityLog({
        action: "CREATED",
        entityType: "APPOINTMENT",
        entityId: aptId,
        entityLabel: bookingId,
        details: `Booking ${bookingId} — ${customerName.trim()} (${formatCurrency(totalPayable)}${isGstRegistered ? " incl. GST" : ""})`,
      });

      toast.success("Booking created", {
        description: `${bookingId} — confirmation message sent. Create a job card when the customer arrives.`,
      });
      skipJobCardListRedirectRef.current = true;
      router.push("/bookings");
      return;
    }

    const termsWithAdvanceNote = `${termsAndConditions.trim()}\n\nOptional: a partial advance may be collected toward this job; record the amount on the job card when agreed.`;

    const newJobCard: JobCard = {
      id,
      jobNumber,
      branchId,
      customerId: custId,
      customerName: customerName.trim(),
      customerPhone,
      vehicleId: resolvedVehicleId,
      vehicleRegNumber: regStored,
      vehicleMakeModel: `${vehicleBrand} ${vehicleModel}`.trim(),
      vehicleSegment: seg,
      mechanicId: mechanicId || undefined,
      mechanicName: mechanic?.name,
      status: "RECEIVED",
      reportedIssues: reportedIssues.trim() || "—",
      odometerReading: odometerReading ? parseInt(odometerReading, 10) : undefined,
      expectedDelivery: expectedDeliveryIso,
      services: serviceItems,
      parts: jobCardPartItems.length > 0 ? jobCardPartItems : undefined,
      estimatedAmount,
      incentivePercent: Math.round(incentivePercentFinal * 100) / 100,
      incentiveAmount: Math.min(
        incentiveCapPerJob,
        Math.round((estimatedAmount * incentivePercentFinal) / 100 * 100) / 100
      ),
      termsAndConditions: termsWithAdvanceNote,
      notes: bookingNote,
      highEndServiceIds: selectedHighEndIds.length > 0 ? selectedHighEndIds : undefined,
      highEndFirstFollowUpMonthsByServiceId:
        selectedHighEndIds.length > 0
          ? Object.fromEntries(
              selectedHighEndIds.map((hesId) => {
                const cfg = highEndServices.find((h) => h.id === hesId);
                const months =
                  highEndFirstFollowUpById[hesId] ?? cfg?.reminderIntervals[0] ?? 0;
                return [hesId, months] as const;
              })
            )
          : undefined,
      highEndCompletionMinutesByServiceId:
        selectedHighEndIds.length > 0
          ? (() => {
              const o: Record<string, number> = {};
              for (const hesId of selectedHighEndIds) {
                const m = highEndCompletionMinutesById[hesId];
                if (m != null && Number.isFinite(m) && m > 0) o[hesId] = Math.round(m);
              }
              return Object.keys(o).length > 0 ? o : undefined;
            })()
          : undefined,
      membershipActivationId: activatedMembershipMeta?.membershipId,
      membershipActivationPackageId: activatedMembershipMeta?.packageId,
      membershipActivationPackageName: activatedMembershipMeta?.packageName,
      membershipActivationAmount: activatedMembershipMeta?.amount,
      membershipActivationStartDate: activatedMembershipMeta?.startDate,
      membershipActivationEndDate: activatedMembershipMeta?.endDate,
      ...advanceAmountPatch,
      createdBy: user?.id ?? "USR-001",
      createdAt: now,
      updatedAt: now,
    };
    await addJobCard(newJobCard);

    pushActivityLog({
      action: "CREATED",
      entityType: "JOB_CARD",
      entityId: id,
      entityLabel: jobNumber,
      details: `Job ${jobNumber} created for ${customerName.trim()} — ${vehicleNumber}`,
    });

    // NOTE: WhatsApp with credentials is sent on check-in completion (after before photos)
    // so the customer gets one complete message with job details + login link.
    // void sendJobCardCreatedWhatsApp(...)  ← moved to handleCheckInSubmit

    setCheckInJob({
      id,
      jobNumber,
      customerName: customerName.trim(),
      vehicleRegLabel: vehicleNumber.trim() || regStored,
      vehicleIdLabel: isVinMode ? "VIN" : "Registration",
    });
    setCheckInReportedIssuesBase(reportedIssues.trim() || "—");
    setCheckInNotesBase(bookingNote?.trim() ?? "");
    setCheckInDamages("");
    setCheckInNotesExtra("");
    setCheckInPhotos([]);
    setCheckInPhotoError(false);
    checkInJobIdRef.current = id;
    setCheckInOpen(true);
    toast.message("Job card created", {
      description: "Complete vehicle check-in with before photos to open the job.",
    });
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not create job card";
      toast.error(msg, {
        description:
          e instanceof ApiError && e.status === 403
            ? "Your account may be missing create access for job cards. Ask an admin to update access, then log out and back in."
            : undefined,
      });
    } finally {
      isSubmittingJobRef.current = false;
      setIsCreatingBooking(false);
    }
  };

  const dismissCheckIn = () => {
    setCheckInPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    const jid = checkInJobIdRef.current;
    checkInJobIdRef.current = null;
    setCheckInOpen(false);
    setCheckInJob(null);
    if (jid) {
      navigateToCreatedJobCard(jid);
    }
  };

  const appendCheckInFiles = (files: FileList | File[] | null) => {
    const list = !files ? [] : Array.isArray(files) ? files : Array.from(files);
    if (!list.length) return;
    for (const file of list) {
      if (!file.type.startsWith("image/")) {
        toast.error("Choose image files only.");
        continue;
      }
      if (file.size > INSPECTION_PHOTO_MAX_BYTES) {
        toast.error("Each photo must be 10 MB or smaller.");
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      const label = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") || "Photo";
      setCheckInPhotos((prev) => [
        ...prev,
        {
          id: `ph-ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          previewUrl,
          label,
        },
      ]);
    }
    setCheckInPhotoError(false);
    if (checkInFileRef.current) checkInFileRef.current.value = "";
  };

  const handleCheckInFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    appendCheckInFiles(e.target.files);
  };

  const removeCheckInPhoto = (photoId: string) => {
    setCheckInPhotos((prev) => {
      const hit = prev.find((p) => p.id === photoId);
      if (hit) URL.revokeObjectURL(hit.previewUrl);
      return prev.filter((p) => p.id !== photoId);
    });
  };

  const handleCheckInSubmit = async () => {
    if (!checkInJob) return;
    if (checkInPhotos.length === 0) {
      setCheckInPhotoError(true);
      return;
    }
    const damages = checkInDamages.trim();
    const extra = checkInNotesExtra.trim();
    let reported = checkInReportedIssuesBase;
    if (damages) {
      reported =
        reported === "—"
          ? `Check-in — observed damages: ${damages}`
          : `${reported}\n\nCheck-in — observed damages: ${damages}`;
    }
    let mergedNotes = checkInNotesBase;
    if (extra) {
      mergedNotes = mergedNotes ? `${mergedNotes}\n\nCheck-in notes: ${extra}` : `Check-in notes: ${extra}`;
    }
    const nowIso = new Date().toISOString();
    const uploadUserId = user?.id ?? "USR-001";
    const jcExisting = useJobCardStore.getState().jobCards.find((j) => j.id === checkInJob.id);
    const existingPhotos = [...(jcExisting?.inspectionPhotos ?? [])];
    const uploaded: InspectionPhoto[] = [];

    setCheckInSubmitting(true);
    try {
      for (const p of checkInPhotos) {
        const url = await uploadJobInspectionPhoto(checkInJob.id, "before", p.file, p.id);
        uploaded.push({
          id: p.id,
          type: toPersistedInspectionPhotoType("before"),
          url,
          caption: p.label.trim() ? `Check-in · ${p.label.trim()}` : "Check-in",
          uploadedAt: nowIso,
          uploadedBy: uploadUserId,
        });
      }
      const nextPhotos = mergeInspectionPhotosById(existingPhotos, uploaded);
      const savedOk = await updateJobCard(checkInJob.id, {
        inspectionPhotos: nextPhotos,
        reportedIssues: reported,
        notes: mergedNotes || undefined,
        updatedAt: nowIso,
      });

      if (!savedOk) {
        throw new Error("Before photos did not save. Please try check-in again.");
      }

      // Register in the session-level in-memory flag IMMEDIATELY — before any
      // async work — so the INSPECTION → In Service validation can bypass the
      // before-photo check without a network round-trip or store lookup.
      // This is the most race-condition-proof signal we can produce.
      markJobCardCheckedIn(checkInJob.id);

      // Also refresh from server (for secureToken + checkInCompletedAt stamp).
      try {
        await refreshJobCardFromServer(checkInJob.id);
      } catch {
        // Non-critical: session flag above is already set.
      }

      // Persist a checkInCompletedAt stamp so the bypass also works after a
      // hard page refresh (where the session Set is cleared).
      await updateJobCard(checkInJob.id, {
        checkInCompletedAt: nowIso,
        updatedAt: nowIso,
      }).catch(() => { /* non-critical */ });

      // Verify photos made it into the store (server-confirmed).
      const saved = useJobCardStore.getState().jobCards.find((j) => j.id === checkInJob.id);
      if (saved && !hasBeforeInspectionPhoto(saved.inspectionPhotos)) {
        throw new Error("Before photos did not save. Please try check-in again.");
      }
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not upload photos";
      toast.error(msg);
      setCheckInSubmitting(false);
      return;
    }

    checkInPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setCheckInPhotos([]);
    setCheckInSubmitting(false);

    pushActivityLog({
      action: "UPDATED",
      entityType: "JOB_CARD",
      entityId: checkInJob.id,
      entityLabel: checkInJob.jobNumber,
      details: `Vehicle check-in — ${uploaded.length} before photo(s)`,
    });
    toast.success("Vehicle checked in", { description: `${checkInJob.jobNumber} is ready for the workshop.` });

    // Send WhatsApp with job details + credentials (for new customers) now that check-in is complete
    const completedJob = useJobCardStore.getState().jobCards.find((j) => j.id === checkInJob.id);
    if (completedJob) {
      const lsKey = `checkin-whatsapp-sent:${completedJob.id}`;
      const alreadySent = typeof localStorage !== "undefined" && localStorage.getItem(lsKey) === "1";
      if (!alreadySent) {
        if (typeof localStorage !== "undefined") localStorage.setItem(lsKey, "1");
        const { notifyBeforePhotosReadyWhatsApp } = await import("@/lib/whatsapp-automation-triggers");
        notifyBeforePhotosReadyWhatsApp(completedJob, businessName, {
          temporaryPassword: newCustomerTempPassRef.current,
        });
        newCustomerTempPassRef.current = undefined;
      }
    }

    const jid = checkInJob.id;
    checkInJobIdRef.current = null;
    setCheckInOpen(false);
    setCheckInJob(null);
    navigateToCreatedJobCard(jid);
  };

  const mainLabels = selectedCatalogItems
    .filter((s) => selectedMainIds.includes(s.id))
    .map((s) => s.name);
  const addonLabels = selectedCatalogItems
    .filter((s) => selectedAddonIds.includes(s.id))
    .map((s) => s.name);

  const wizardSteps = useMemo((): JobWizardStepId[] => {
    const s: JobWizardStepId[] = [
      "customer",
      "vehicle",
      ...(isJobCard ? [] : (["schedule"] as const)),
      "smartSuggestions",
      "membership",
      "serviceSelection",
    ];
    if (isJobCard) s.push("partsSelection");
    if (highEndServices.length > 0) s.push("highEndServices");
    s.push("addons");
    if (isJobCard) {
      s.push("mechanic");
      s.push("notesAndJobDetails", "jobSummary");
    } else {
      s.push("notes", "jobSummary");
    }
    return s;
  }, [isJobCard, highEndServices.length]);

  useEffect(() => {
    if (!useBookingWizard) return;
    setJobCreateStep((prev) => Math.min(prev, Math.max(0, wizardSteps.length - 1)));
  }, [useBookingWizard, wizardSteps.length]);

  const jobWizardStepId = wizardSteps[jobCreateStep] ?? "customer";
  const jobWizardStepCount = wizardSteps.length;
  const wizardProgressPercent = Math.round(((jobCreateStep + 1) / Math.max(jobWizardStepCount, 1)) * 100);

  const wizardSelectionSummary = useMemo(() => {
    const parts: string[] = [];
    const svcCount = selectedMainIds.length;
    if (svcCount > 0) parts.push(`${svcCount} Service${svcCount !== 1 ? "s" : ""}`);
    if (selectedPartLines.length > 0) {
      parts.push(`${selectedPartLines.length} Part${selectedPartLines.length !== 1 ? "s" : ""}`);
    }
    if (selectedAddonIds.length > 0) {
      parts.push(`${selectedAddonIds.length} Add-on${selectedAddonIds.length !== 1 ? "s" : ""}`);
    }
    return parts.join(" • ");
  }, [selectedMainIds.length, selectedPartLines.length, selectedAddonIds.length]);

  const filteredMechanics = useMemo(() => {
    const q = mechanicSearch.trim().toLowerCase();
    if (!q) return mechanics;
    return mechanics.filter((m) => m.name.toLowerCase().includes(q));
  }, [mechanics, mechanicSearch]);

  const goToJobWizardStep = useCallback(
    (stepId: JobWizardStepId) => {
      const idx = wizardSteps.indexOf(stepId);
      if (idx >= 0) setJobCreateStep(idx);
    },
    [wizardSteps]
  );

  const appendQuickInternalNote = useCallback((text: string) => {
    setInternalNotes((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
  }, []);

  const appendQuickCustomerNote = useCallback((text: string) => {
    setCustomerNotes((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
  }, []);

  const selectedMechanicName = useMemo(
    () => mechanics.find((m) => m.id === mechanicId)?.name ?? "Not assigned",
    [mechanics, mechanicId]
  );

  const wizardTrackerIndex = wizardTrackerMilestone(jobWizardStepId, isJobCard);
  const wizardTrackerSteps = wizardTrackerLabels(isJobCard);

  const notesStepNextBlocked =
    isJobCard &&
    ((jobWizardStepId === "highEndServices" && selectedHighEndIds.length > 0) ||
      jobWizardStepId === "notesAndJobDetails") &&
    !jobCardExpectedDeliveryReady;

  const bookingWizardIncomplete =
    useBookingWizard && jobWizardStepCount > 0 && jobCreateStep < jobWizardStepCount - 1;

  const jobWizardStepSkipped = useCallback(
    (stepId: JobWizardStepId) => {
      if (!useBookingWizard) return false;
      if (!redeemingMembershipVisit) return false;
      return stepId === "highEndServices";
    },
    [useBookingWizard, redeemingMembershipVisit]
  );

  /** Membership "Yes" hides high-end step; keep step index from pointing at a hidden step (e.g. after Back). */
  useEffect(() => {
    if (!useBookingWizard || !redeemingMembershipVisit) return;
    setJobCreateStep((prev) => {
      let n = prev;
      while (
        n < wizardSteps.length &&
        wizardSteps[n] != null &&
        jobWizardStepSkipped(wizardSteps[n]!)
      ) {
        n++;
      }
      return Math.min(wizardSteps.length - 1, Math.max(0, n));
    });
  }, [useBookingWizard, redeemingMembershipVisit, wizardSteps, jobWizardStepSkipped]);

  const showJobWizardStep = (id: JobWizardStepId) => {
    if (!useBookingWizard) return true;
    if (jobWizardStepSkipped(id)) return false;
    if (isJobCard) {
      if (id === "notes" || id === "jobDetails") {
        return jobWizardStepId === "notesAndJobDetails";
      }
      return jobWizardStepId === id;
    }
    if (id === "notesAndJobDetails" || id === "jobDetails") return false;
    if (id === "notes") return jobWizardStepId === "notes";
    return jobWizardStepId === id;
  };

  const goNextJobWizard = async () => {
    if (!useBookingWizard) return;
    if (jobCreateStep >= jobWizardStepCount - 1) return;
    if (jobWizardStepId === "customer") {
      if (!customerName.trim() || customerPhone.replace(/\D/g, "").length < 10) {
        toast.error("Enter customer name and a 10-digit phone to continue.");
        return;
      }
    }
    if (jobWizardStepId === "vehicle") {
      let number = vehicleNumber;
      let brand = vehicleBrand;
      let model = vehicleModel;
      let segment = vehicleSegment;
      let vinMode = isVinMode;

      if (showInlineVehicleDetailsForm && inlineVehicleFormRef.current) {
        const ok = await inlineVehicleFormRef.current.validate();
        if (!ok) {
          toast.error("Complete vehicle details to continue.");
          return;
        }
        const vals = inlineVehicleFormRef.current.getValues();
        applyVehicleFormToWizardState(vals);
        number = vals.registrationNumber;
        brand = vals.make;
        model = vals.model;
        segment = vals.segment;
        vinMode = vals.isVin;
      }

      if (!number.trim() || !brand.trim() || !model.trim() || !segment) {
        toast.error("Complete vehicle details to continue.");
        return;
      }
      if (!vinMode && !isValidIndianVehicleRegistration(number)) {
        toast.error("Invalid registration", { description: INDIAN_VEHICLE_REG_HINT });
        return;
      }
      if (vinMode && number.length < 5) {
        toast.error("VIN must be at least 5 characters.");
        return;
      }
    }
    if (jobWizardStepId === "serviceSelection") {
      if (!vehicleSegment) {
        toast.error("Select a vehicle type for pricing.");
        return;
      }
      const hasHighEndStep = highEndServices.length > 0;
      if (
        !redeemingMembershipVisit &&
        !hasHighEndStep &&
        selectedMainIds.length === 0
      ) {
        toast.error("Select at least one service to continue.");
        return;
      }
    }
    if (jobWizardStepId === "membership") {
      if (activeMembershipForSelectedVehicle && activeMembershipPackageRow) {
        if (membershipVisitChoice === null) {
          toast.error("Choose whether to use membership on this visit (Yes or No).");
          return;
        }
        if (membershipVisitChoice === "yes") {
          const remaining = activeMembershipPackageRow.includedServiceIds.filter(
            (sid) =>
              getRemainingIncludedServiceCount(
                activeMembershipForSelectedVehicle,
                activeMembershipPackageRow,
                sid
              ) > 0
          );
          if (remaining.length > 0 && membershipRedeemServiceIds.length === 0) {
            toast.error(
              "Open included services and pick at least one remaining service, or choose No for a normal booking."
            );
            return;
          }
          setSelectedMainIds((prev) => {
            const merged = new Set(prev);
            for (const id of membershipRedeemServiceIds) merged.add(id);
            return [...merged];
          });
          setSelectedHighEndIds([]);
        }
      }
    }
    if (jobWizardStepId === "highEndServices" && isJobCard && selectedHighEndIds.length > 0) {
      if (!hasExpectedDeliveryDateSet(bookingWhen)) {
        toast.error("Please select an expected delivery date for the high-end service to continue.");
        return;
      }
      if (isDatetimeLocalInPast(bookingWhen)) {
        toast.error("Expected delivery date must be in the future.");
        return;
      }
    }
    if (jobWizardStepId === "pickupDrop") {
      // pickup/drop step removed — no validation needed
    }
    setJobCreateStep((i) => {
      let n = i + 1;
      while (
        n < jobWizardStepCount &&
        wizardSteps[n] != null &&
        jobWizardStepSkipped(wizardSteps[n]!)
      ) {
        n++;
      }
      return Math.min(jobWizardStepCount - 1, n);
    });
  };

  const goBackJobWizard = () => {
    setJobCreateStep((s) => {
      let n = s - 1;
      while (n >= 0 && wizardSteps[n] != null && jobWizardStepSkipped(wizardSteps[n]!)) {
        n--;
      }
      return Math.max(0, n);
    });
  };

  const renderWizardReviewSections = () => (
    <Card className="border-primary/20 bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Review &amp; create</CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          Confirm each section below. Tap Edit to jump back without losing your progress.
        </p>
      </CardHeader>
      <CardContent className="space-y-2.5 text-sm">
        <div className="rounded-lg border border-border/80 bg-card p-3">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => goToJobWizardStep("customer")}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </div>
          <p className="font-medium">{customerName.trim() || "Not selected"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {customerPhone.length >= 10 ? customerPhone : "Phone not set"}
          </p>
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-3">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vehicle</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => goToJobWizardStep("vehicle")}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </div>
          <p className="font-medium">
            {vehicleBrand || "—"} {vehicleModel}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            {isVinMode ? "VIN" : "Reg"}:{" "}
            {vehicleNumber || (isVinMode ? "No VIN" : "No registration")}
          </p>
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-3">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Services</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => goToJobWizardStep("serviceSelection")}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </div>
          <p>{mainLabels.length ? mainLabels.join(", ") : "None selected"}</p>
          {addonLabels.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Add-ons: {addonLabels.join(", ")}</p>
          )}
          {highEndSummaryLines.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              High-end: {highEndSummaryLines.map((l) => l.name).join(", ")}
            </p>
          )}
        </div>

        {isJobCard && (
          <div className="rounded-lg border border-border/80 bg-card p-3">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parts</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => goToJobWizardStep("partsSelection")}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Edit
              </Button>
            </div>
            <p>
              {selectedPartSummaryLines.length > 0
                ? selectedPartSummaryLines.map((l) => l.label).join(", ")
                : "None selected"}
            </p>
          </div>
        )}

        {isJobCard && (
          <div className="rounded-lg border border-border/80 bg-card p-3">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mechanic</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => goToJobWizardStep("mechanic")}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Edit
              </Button>
            </div>
            <p>{selectedMechanicName}</p>
          </div>
        )}

        <div className="rounded-lg border border-border/80 bg-card p-3">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                const el = document.getElementById("advance-amount-summary");
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                if (el instanceof HTMLInputElement) el.focus();
              }}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </div>
          <div className="flex justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">{formatCurrency(totalPayable)}</span>
          </div>
          {summaryAdvanceAmount > 0 && (
            <div className="flex justify-between gap-2 text-xs mt-1">
              <span className="text-muted-foreground">Advance</span>
              <span className="tabular-nums">{formatCurrency(summaryAdvanceAmount)}</span>
            </div>
          )}
          <div className="flex justify-between gap-2 text-xs mt-1">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-medium tabular-nums">{formatCurrency(balanceAfterAdvance)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderSummaryCard = (branchBlockId: string) => (
    <Card className="w-full border-border/80 shadow-sm">
      <CardHeader
        className={cn(
          "pb-2",
          compactJobCardDesktop ? "px-3 pt-2.5 pb-1" : "px-4 pt-3 sm:px-6 sm:pt-5"
        )}
      >
        <CardTitle className={cn(compactJobCardDesktop ? "text-xs font-semibold" : "text-base")}>
          {isJobCard ? "Job summary" : "Booking summary"}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pb-2 text-sm space-y-2 px-4 sm:space-y-3 sm:px-6 sm:pb-4",
          compactJobCardDesktop ? "text-[11px] px-3 pb-2 pt-0.5 space-y-1.5" : ""
        )}
      >
        <dl className={cn("space-y-1", compactJobCardDesktop && "space-y-0.5")}>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="font-medium text-right truncate max-w-[55%]">
              {customerName.trim() || "Not selected"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="text-right">{customerPhone.length >= 10 ? customerPhone : "N/A"}</dd>
          </div>
          {existingCustomerId && (
            <>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Total Visits</dt>
                <dd className="text-right tabular-nums">{customerVisits}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Reward Points</dt>
                <dd className="text-right tabular-nums text-violet-600 dark:text-violet-400 font-medium">
                  {customerRewardPoints}
                </dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="text-right truncate max-w-[55%]">
              {vehicleBrand || "Not selected"} {vehicleModel}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{vehicleSegment || "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{isVinMode ? "VIN" : "Registration"}</dt>
            <dd className="font-mono text-xs">{vehicleNumber || "Not selected"}</dd>
          </div>
          <div className="flex justify-between gap-2 align-start">
            <dt className="text-muted-foreground shrink-0">Membership</dt>
            <dd className="text-right text-xs leading-snug max-w-[58%]">{summaryMembershipLabel}</dd>
          </div>
          <div className="flex justify-between gap-2 align-start">
            <dt className="text-muted-foreground shrink-0">Service(s)</dt>
            <dd className="text-right text-xs">
              {mainLabels.length ? mainLabels.join(", ") : "Not selected"}
            </dd>
          </div>
          {addonLabels.length > 0 && (
            <div className="flex justify-between gap-2 align-start">
              <dt className="text-muted-foreground shrink-0">Add-ons</dt>
              <dd className="text-right text-xs">{addonLabels.join(", ")}</dd>
            </div>
          )}
          {selectedPartSummaryLines.length > 0 && (
            <div className="flex justify-between gap-2 align-start">
              <dt className="text-muted-foreground shrink-0">Parts</dt>
              <dd className="text-right text-xs space-y-1 min-w-0">
                {selectedPartSummaryLines.map((line) => (
                  <div key={line.id} className="flex justify-end gap-2 flex-wrap">
                    <span className="truncate max-w-[140px]">{line.label}</span>
                    <span className="tabular-nums shrink-0">{formatCurrency(line.amount)}</span>
                  </div>
                ))}
              </dd>
            </div>
          )}
          {highEndSummaryLines.length > 0 && (
            <div className={cn("flex justify-between gap-2 align-start border-t border-border/60 pt-2 mt-1", compactJobCardDesktop && "pt-1 mt-0.5")}>
              <dt className="text-muted-foreground shrink-0">High-end (est.)</dt>
              <dd className="text-right text-xs space-y-1 min-w-0">
                {highEndSummaryLines.map((line) => (
                  <div key={line.id} className="flex justify-end gap-2 flex-wrap">
                    <span className="truncate max-w-[140px]">{line.name}</span>
                    <span className="tabular-nums shrink-0">{formatCurrency(line.amount)}</span>
                  </div>
                ))}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">
              {isJobCard ? "Expected delivery" : "Date & time"}
            </dt>
            <dd className="text-right text-xs">
              {computedExpectedDelivery
                ? isJobCard
                  ? formatExpectedDeliveryDate(computedExpectedDelivery)
                  : computedExpectedDelivery.toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                : "Not set"}
            </dd>
          </div>
        </dl>
        <Separator className={cn(compactJobCardDesktop ? "my-1" : "my-2")} />
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-violet-500" />
          <span className={cn("font-medium text-sm", compactJobCardDesktop && "text-xs")}>Discount coupon</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="ENTER CODE"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase());
              if (couponApplied) {
                setCouponApplied(false);
                setAppliedCouponCode(null);
              }
            }}
            className={cn("uppercase text-xs", compactJobCardDesktop && "h-8 text-[11px]")}
          />
          <Button type="button" variant="secondary" size="sm" onClick={applyCoupon} className={cn(compactJobCardDesktop && "h-8 px-2.5 text-xs")}>
            {couponApplied ? "Applied" : "Apply"}
          </Button>
        </div>
        <Separator className={cn(compactJobCardDesktop ? "my-1" : "my-2")} />
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className={cn("font-medium text-sm", compactJobCardDesktop && "text-xs")}>Direct Discount</span>
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn(
                "flex-1 text-xs gap-1 h-9 rounded-md transition-all",
                directDiscountType === "percentage"
                  ? "bg-amber-50 hover:bg-amber-100/80 border-amber-300 text-amber-700 hover:text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400 font-semibold"
                  : "text-muted-foreground border-border hover:bg-muted"
              )}
              onClick={() => setDirectDiscountType("percentage")}
            >
              % Percentage
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "flex-1 text-xs gap-1 h-9 rounded-md transition-all",
                directDiscountType === "fixed"
                  ? "bg-amber-50 hover:bg-amber-100/80 border-amber-300 text-amber-700 hover:text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400 font-semibold"
                  : "text-muted-foreground border-border hover:bg-muted"
              )}
              onClick={() => setDirectDiscountType("fixed")}
            >
              ₹ Fixed Amount
            </Button>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
              {directDiscountType === "percentage" ? "%" : "₹"}
            </span>
            <Input
              type="number"
              min={0}
              max={directDiscountType === "percentage" ? 100 : undefined}
              placeholder={directDiscountType === "percentage" ? "e.g. 10" : "e.g. 500"}
              value={directDiscountValue}
              onChange={(e) => setDirectDiscountValue(e.target.value)}
              className={cn("pl-8 text-xs tabular-nums", compactJobCardDesktop && "h-8 text-[11px]")}
            />
          </div>
        </div>
        <Separator className={cn(compactJobCardDesktop ? "my-1" : "my-2")} />
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className={cn("font-medium text-sm", compactJobCardDesktop && "text-xs")}>Advance (₹)</span>
        </div>
        <div className="flex gap-2">
          <Input
            id="advance-amount-summary"
            type="number"
            min={0}
            step={1}
            inputMode="decimal"
            placeholder="Optional amount"
            className={cn("text-xs tabular-nums", compactJobCardDesktop && "h-8 text-[11px]")}
            value={advanceAmountInput}
            onChange={(e) => setAdvanceAmountInput(e.target.value)}
          />
        </div>
        {!compactJobCardDesktop && (
          <p className="text-[10px] text-muted-foreground">
            In rupees{isGstRegistered ? " (incl. GST)" : ""}, capped at gross total below (
            {formatCurrency(totalPayable)}). Deducted in the summary total. Saved on the job card for
            billing. Leave empty if none.
          </p>
        )}
        <Separator className={cn(compactJobCardDesktop ? "my-1" : "my-2")} />
        <div className={cn("space-y-1 text-sm", compactJobCardDesktop && "space-y-0.5 text-[11px]")}>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {isGstRegistered ? "Subtotal (excl. GST)" : "Subtotal"}
            </span>
            <span className="tabular-nums">{formatCurrency(afterDiscount)}</span>
          </div>
          {membershipActivationPreviewAmount > 0 ? (
            <div className="flex justify-between text-violet-700 dark:text-violet-400">
              <span>Membership in subtotal</span>
              <span className="tabular-nums">{formatCurrency(membershipActivationPreviewAmount)}</span>
            </div>
          ) : null}
          {isGstRegistered ? (
            <div className="flex justify-between text-amber-700 dark:text-amber-400">
              <span>GST ({Math.round(DEFAULT_GST_RATE * 100)}%)</span>
              <span className="tabular-nums">+{formatCurrency(gstAmount)}</span>
            </div>
          ) : null}
          {summaryAdvanceAmount > 0 ? (
            <>
              <div className="flex justify-between text-muted-foreground text-xs pt-0.5">
                <span>{isGstRegistered ? "Total (incl. GST)" : "Total"}</span>
                <span className="tabular-nums">{formatCurrency(totalPayable)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Advance</span>
                <span className="tabular-nums">−{formatCurrency(summaryAdvanceAmount)}</span>
              </div>
            </>
          ) : null}
          <div
            className={cn(
              "flex justify-between font-bold text-primary pt-0.5",
              compactJobCardDesktop ? "text-xs" : "text-base pt-1",
              summaryAdvanceAmount > 0 && "border-t border-border/60 mt-1 pt-1.5"
            )}
          >
            <span>{summaryAdvanceAmount > 0 ? "Balance due" : "Total payable"}</span>
            <span className="tabular-nums">{formatCurrency(balanceAfterAdvance)}</span>
          </div>
        </div>
        <Separator className={cn(compactJobCardDesktop ? "my-1" : "my-2")} />
        <div id={branchBlockId} className={cn("space-y-2 scroll-mt-24", compactJobCardDesktop && "space-y-1")}>
          <Label className={cn("flex items-center gap-2", compactJobCardDesktop && "text-[11px]")}>
            <Building2 className="w-4 h-4" />
            Select branch *
          </Label>
          <Select
            value={branchId}
            onValueChange={setBranchId}
            required
            disabled={branchLocked}
          >
            <SelectTrigger className={cn(compactJobCardDesktop && "h-8 text-[11px]")}>
              <SelectValue placeholder="Please select a branch" />
            </SelectTrigger>
            <SelectContent>
              {activeBranches.map((b) => (
                <SelectItem key={b.id} value={b.id} className={cn(compactJobCardDesktop && "text-[11px]")}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {branchLocked ? (
            <p className="text-xs text-muted-foreground">
              Branch is set to{" "}
              <span className="font-medium text-foreground">{viewingLabel}</span> from the header
              selector.
            </p>
          ) : !branchId ? (
            <p className="text-xs text-destructive">
              Please select a branch to create the {isJobCard ? "job card" : "booking"}.
            </p>
          ) : null}
        </div>
      </CardContent>

    </Card>
  );

  const bookingForm = (
      <form
        onSubmit={handleSubmit}
        className={cn(
          useBookingWizard
            ? cn(
                "flex min-h-0 flex-1 flex-col overflow-x-hidden",
                isDesktopWide
                  ? "h-full overflow-hidden lg:flex-row lg:items-stretch lg:justify-between lg:gap-6"
                  : "h-auto overflow-visible"
              )
            : "lg:flex lg:flex-row lg:items-start lg:gap-8",
          useBookingWizard &&
            !isDesktopWide &&
            "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-0"
        )}
      >
        <div
          className={cn(
            "min-w-0 flex-1 lg:min-w-0",
            !useBookingWizard && "space-y-6",
            useBookingWizard &&
              "flex flex-col overflow-x-hidden px-3 py-2 sm:px-6 sm:pt-3 sm:pb-0",
            useBookingWizard &&
              isDesktopWide &&
              "min-h-0 flex-1 gap-2 overflow-hidden py-2 sm:px-4 sm:pt-2 sm:pb-0 max-lg:overflow-y-auto max-lg:overflow-x-hidden lg:min-w-0",
            useBookingWizard && !isDesktopWide && "min-h-0 flex-1 overflow-x-hidden"
          )}
        >
          {isDesktopWide && (
            <div className="shrink-0 mb-2.5">
              <Button variant="ghost" size="sm" className="w-fit -ml-2 h-8 mb-1" asChild>
                <Link href={bookingListHref}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {desktopBackLabel}
                </Link>
              </Button>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl leading-tight">{desktopTitle}</h1>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground sm:text-xs">
                {isJobCard
                  ? "Review the summary, select branch, then create the job card."
                  : "Review the summary, select branch, then create the booking."}
              </p>
            </div>
          )}

          <div
            className={cn(
              useBookingWizard ? "space-y-4" : "space-y-6",
              useBookingWizard &&
                isDesktopWide &&
                "lg:flex lg:min-h-0 lg:flex-1 lg:basis-0 lg:flex-col lg:space-y-0 lg:gap-2.5 lg:overflow-y-auto lg:overflow-x-auto lg:overscroll-y-contain lg:pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5",
              useBookingWizard && "max-lg:shrink-0 max-lg:overflow-visible"
            )}
          >
          {showJobWizardStep("customer") && (
          <Card
            className={cn(compactCustomerStep && "border-border/80 shadow-sm")}
          >
            <CardHeader
              className={cn(
                compactCustomerStep && "space-y-0 py-2 pb-1.5 pt-2.5 sm:py-2 sm:pb-1.5 sm:pt-3"
              )}
            >
              <CardTitle className={cn(compactCustomerStep ? "text-base" : "text-lg")}>
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent
              className={cn(
                compactCustomerStep
                  ? "space-y-2.5 pt-0 pb-3 sm:space-y-2.5 sm:pb-4 sm:pt-0"
                  : "space-y-6"
              )}
            >
              <div>
                <Label className={cn("text-muted-foreground", compactCustomerStep && "text-xs")}>
                  Search Existing Customer
                </Label>
                <div
                  className={cn(
                    "mt-2 w-full max-w-md",
                    compactCustomerStep && "mt-1 max-w-full"
                  )}
                >
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      className={cn("pl-9", compactCustomerStep && "h-9")}
                      placeholder="Enter Mobile or Vehicle number"
                      value={lookupQuery}
                      onChange={(e) => setLookupQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      autoComplete="off"
                    />
                  </div>
                  {!compactCustomerStep && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Matches update as you type (phone, name, or registration).
                    </p>
                  )}
                </div>
                {lookupPanelCustomers && lookupPanelCustomers.length > 0 && (
                  <div
                    className={cn(
                      "space-y-2 rounded-lg border bg-muted/30 p-3 mt-3",
                      compactCustomerStep && "space-y-1.5 p-2.5 mt-2"
                    )}
                  >
                    <p className="text-xs font-medium text-muted-foreground">Matching customers</p>
                    <ul className={cn("space-y-2", compactCustomerStep && "space-y-1.5")}>
                      {lookupPanelCustomers.map((c) => (
                        <li
                          key={c.id}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-md border bg-background px-3",
                            compactCustomerStep ? "py-1.5" : "py-2"
                          )}
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{c.name}</p>
                            <p className="text-sm text-muted-foreground tabular-nums">{c.phone}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="shrink-0"
                            onClick={() => applySelectedCustomer(c)}
                          >
                            Select
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="text-sm text-primary hover:underline pt-1" onClick={cancelLookup}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p
                  className={cn(
                    "font-medium",
                    compactCustomerStep ? "mb-1.5 text-sm" : "mb-3 text-sm"
                  )}
                >
                  Customer Details
                </p>
                <div
                  className={cn(
                    "grid grid-cols-1 sm:grid-cols-2",
                    compactCustomerStep ? "gap-2 sm:gap-3" : "gap-4"
                  )}
                >
                  <div className={cn(compactCustomerStep ? "space-y-1" : "space-y-2")}>
                    <Label className={cn(compactCustomerStep && "text-xs")}>Full Name</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer name"
                      readOnly={!!existingCustomerId}
                      className={cn(existingCustomerId ? "bg-muted/80" : "", compactCustomerStep && "h-9")}
                      required
                    />
                    {existingCustomerId && (
                      <p className="text-xs text-muted-foreground">Existing customer — name locked</p>
                    )}
                  </div>
                  <div className={cn(compactCustomerStep ? "space-y-1" : "space-y-2")}>
                    <Label className={cn(compactCustomerStep && "text-xs")}>Phone Number</Label>
                    <Input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(normalizePhoneDigits(e.target.value))}
                      placeholder="Phone number"
                      maxLength={10}
                      readOnly={!!existingCustomerId}
                      className={cn(existingCustomerId ? "bg-muted/80" : "", compactCustomerStep && "h-9")}
                      required
                    />
                  </div>
                  <div className={cn("sm:col-span-2", compactCustomerStep ? "space-y-1" : "space-y-2")}>
                    <Label className={cn(compactCustomerStep && "text-xs")}>Email (Optional)</Label>
                    <Input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Email address"
                      readOnly={!!existingCustomerId}
                      className={cn(existingCustomerId ? "bg-muted/80" : "", compactCustomerStep && "h-9")}
                    />
                    {existingCustomerId && (
                      <p className="text-xs text-muted-foreground">Existing customer — email locked</p>
                    )}
                  </div>
                  {!existingCustomerId && isWalkIn && (
                    <div className="sm:col-span-2">
                      <NewCustomerReferralCodeField
                        id="walk-in-referral"
                        value={referralCode}
                        onChange={setReferralCode}
                        compact={compactCustomerStep}
                      />
                    </div>
                  )}
                  {!existingCustomerId && isJobCard && (
                    <>
                      <Separator className={cn("sm:col-span-2", compactCustomerStep && "my-0.5")} />
                      <div className={cn("sm:col-span-2", compactCustomerStep ? "space-y-1" : "space-y-2")}>
                        <Label
                          htmlFor="jobcard-referral"
                          className={cn("flex items-center gap-1.5", compactCustomerStep && "text-xs")}
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          Have a referral code?
                        </Label>
                        <div className="flex items-center gap-2 max-w-sm">
                          <Input
                            id="jobcard-referral"
                            placeholder="e.g. REF-A001"
                            value={referralCode}
                            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                            className={cn("uppercase", compactCustomerStep && "h-9")}
                          />
                        </div>
                        {referrerInfo && (
                          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Referred by <span className="font-medium">{referrerInfo.name}</span> — wallet
                            rewards follow Referrals rules on first invoice
                          </p>
                        )}
                        {referralError && referralCode.trim() && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                            <XCircle className="w-3.5 h-3.5" />
                            Invalid referral code
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {showJobWizardStep("vehicle") && (
          <>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 p-4 pb-2 sm:px-6 sm:pt-4 sm:pb-2">
              <CardTitle className="text-base font-semibold tracking-tight">Vehicle Details</CardTitle>
              {existingCustomerId && ownedVehicles.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={startAddNewVehicle}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add New Vehicle
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-4">
              {ownedVehicles.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ownedVehicles.map((v) => {
                    const sel = selectedVehicleId === v.id && !addingNewVehicle;
                    const rb =
                      brandNames.find((b) => b.toLowerCase() === v.make.toLowerCase()) ?? v.make;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => selectVehicleFromGarage(v)}
                        className={cn(
                          "rounded-lg border-2 p-3 text-left transition-all",
                          sel ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Car className="w-7 h-7 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="font-semibold truncate text-sm">
                                {rb} {v.model}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                {v.vinNumber ? "VIN" : "Reg"}: {v.registrationNumber}
                              </p>
                            </div>
                          </div>
                          {sel && (
                            <Badge className="shrink-0 bg-primary text-primary-foreground hover:bg-primary">Selected</Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="mt-1.5 text-[10px]">
                          {v.segment.replace("_", " ")}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedVehicleId && !addingNewVehicle && ownedVehicles.length > 0 && (
                <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 space-y-1.5">
                  <Label htmlFor="garage-odometer-reading" className="text-sm font-medium">
                    Odometer for this visit (km)
                  </Label>
                  <Input
                    id="garage-odometer-reading"
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 45200"
                    value={odometerReading}
                    onChange={(e) => {
                      const v = e.target.value;
                      setOdometerReading(v);
                      setVehicleOdometer(v);
                    }}
                    className="h-9 max-w-xs"
                  />
                </div>
              )}

              {showInlineVehicleDetailsForm && (
                <AddVehicleInlineForm
                  lockedCustomerId={existingCustomerId ?? ""}
                  idPrefix="booking-inline-veh"
                  formRef={inlineVehicleFormRef}
                  onChange={applyVehicleFormToWizardState}
                />
              )}

              {ownedVehicles.length > 0 && (
                <div className="flex gap-2 rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-2 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/25 dark:text-sky-100">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {addingNewVehicle && addVehiclePopupOpen
                      ? "Complete the popup to register the new vehicle, or cancel it to pick a saved vehicle."
                      : "Select a saved vehicle above, or use Add New Vehicle to enter details in a popup."}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <AddVehicleDialog
            open={addVehiclePopupOpen}
            title="Add New Vehicle"
            lockedCustomerId={existingCustomerId ?? undefined}
            onCreated={handleGarageVehicleCreated}
            onOpenChange={(open) => {
              if (open) {
                setAddVehiclePopupOpen(true);
                return;
              }
              guardBookingShellFromNestedClose();
              if (skipAddVehicleCancelOnCloseRef.current) {
                skipAddVehicleCancelOnCloseRef.current = false;
                setAddVehiclePopupOpen(false);
                return;
              }
              cancelAddVehicleFromPopup();
            }}
          />

          </>
          )}

          {showJobWizardStep("schedule") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-w-0 max-w-md space-y-2">

                <Label htmlFor="schedule-booking-when" className="hidden md:inline-flex">
                  Booking Date & Time
                </Label>
                <div className="min-w-0 grid grid-cols-2 gap-3 md:hidden">
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="schedule-booking-date" className="text-xs text-muted-foreground truncate">
                      Date
                    </Label>
                    <Input
                      id="schedule-booking-date"
                      type={splitDatetimeLocal(bookingWhen).date ? "date" : "text"}
                      placeholder="dd-mm-yyyy"
                      onFocus={(e) => (e.target.type = "date")}
                      onBlur={(e) => {
                        if (!e.target.value) e.target.type = "text";
                      }}
                      min={bookingScheduleDateMin}
                      value={splitDatetimeLocal(bookingWhen).date}
                      onChange={(e) => {
                        const { time } = splitDatetimeLocal(bookingWhen);
                        let next = joinDatetimeLocal(e.target.value, time);
                        if (
                          e.target.value === bookingScheduleDateMin &&
                          next &&
                          isDatetimeLocalInPast(next)
                        ) {
                          next = joinDatetimeLocal(e.target.value, localTimeInputMinNow());
                        }
                        setBookingWhen(next);
                      }}
                      required
                      className={cn("h-10 w-full min-w-0 max-w-full", MOBILE_DATE_TIME_INPUT_ICON_END)}
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="schedule-booking-time" className="text-xs text-muted-foreground truncate">
                      Time
                    </Label>
                    <Input
                      id="schedule-booking-time"
                      type={splitDatetimeLocal(bookingWhen).time ? "time" : "text"}
                      placeholder="--:--"
                      onFocus={(e) => (e.target.type = "time")}
                      onBlur={(e) => {
                        if (!e.target.value) e.target.type = "text";
                      }}
                      min={bookingScheduleTimeMin}
                      value={splitDatetimeLocal(bookingWhen).time}
                      onChange={(e) => {
                        let { date } = splitDatetimeLocal(bookingWhen);
                        if (!date) date = datetimeLocalValue(new Date()).slice(0, 10);
                        if (date < bookingScheduleDateMin) {
                          date = bookingScheduleDateMin;
                        }
                        let next = joinDatetimeLocal(date, e.target.value);
                        if (date === bookingScheduleDateMin && next && isDatetimeLocalInPast(next)) {
                          next = joinDatetimeLocal(date, localTimeInputMinNow());
                        }
                        setBookingWhen(next);
                      }}
                      required
                      className={cn("h-10 w-full min-w-0 max-w-full", MOBILE_DATE_TIME_INPUT_ICON_END)}
                    />
                  </div>
                </div>
                <div className="relative hidden md:block">
                  <Input
                    id="schedule-booking-when"
                    ref={scheduleDateInputRef}
                    type="datetime-local"
                    min={localDatetimeLocalInputMin()}
                    value={bookingWhen}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        setBookingWhen(v);
                        return;
                      }
                      if (!isDatetimeLocalInPast(v)) {
                        setBookingWhen(v);
                      } else {
                        setBookingWhen(localDatetimeLocalInputMin());
                      }
                    }}
                    required
                    className="h-10 pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:bottom-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Open date and time picker"
                    onClick={() => scheduleDateInputRef.current?.showPicker?.()}
                  >
                    <Calendar className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {showJobWizardStep("smartSuggestions") && (
          <Card className="border-amber-200/80 dark:border-amber-900/40 shadow-sm">
            <CardHeader className="flex flex-row items-center gap-2 border-b border-amber-100/80 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/20">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-lg text-amber-950 dark:text-amber-100">Smart Suggestions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {previousBooked.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Previously Booked
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {previousBooked.map((p) => {
                      const on = selectedMainIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleTrending(p.id)}
                          className={cn(
                            "rounded-xl border-2 px-3 py-2 text-left transition-all max-w-[220px]",
                            on
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:border-primary/30"
                          )}
                        >
                          <p className="text-sm font-semibold line-clamp-2">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {p.tag} · {p.count}×
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Trending at This Branch
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {trendingServices.map((s) => {
                    const on = selectedMainIds.includes(s.id);
                    const pr = vehicleSegment ? catalogPriceForSegment(s, vehicleSegment) : s.defaultPrice;
                    const bookings = serviceBookingCounts.get(s.id) ?? 0;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleTrending(s.id)}
                        className={cn(
                          "rounded-xl border-2 p-3 text-left transition-all w-full",
                          on
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-card hover:border-primary/30"
                        )}
                      >
                        <p className="text-sm font-semibold line-clamp-2">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{s.category.split(/[\s/]/)[0]}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          {formatServiceDurationLabel(s)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{bookings || 1} bookings</p>
                        <p className="text-xs font-medium text-primary mt-2">{formatCurrency(pr)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {showJobWizardStep("membership") && (
          <>
          <Card className="min-w-0 border-violet-200/60 dark:border-violet-900/40">
            <div className="flex items-center gap-2 rounded-t-xl bg-primary px-4 py-3 text-primary-foreground">
              <Ticket className="w-4 h-4 shrink-0 opacity-90" />
              <p className="text-sm font-bold tracking-wide">MEMBERSHIP STATUS</p>
            </div>
            <CardContent className="min-w-0 py-6 space-y-4">
              {existingCustomerId && ownedVehicles.length > 1 && vehiclesWithActiveMembership.length > 0 ? (
                <div className="rounded-lg border border-violet-200/70 bg-violet-50/40 px-3 py-2 text-xs dark:border-violet-900/45 dark:bg-violet-950/25">
                  <p className="font-medium text-foreground mb-1">Vehicles with an active pass</p>
                  <ul className="list-inside list-disc text-muted-foreground space-y-0.5">
                    {vehiclesWithActiveMembership.map((v) => (
                      <li key={v.id}>
                        <span className="font-mono">{v.registrationNumber}</span>
                        <span className="text-muted-foreground/90">
                          {" "}
                          — {v.make} {v.model}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {activeMembershipForSelectedVehicle && activeMembershipPackageRow ? (
                <>
                  <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 px-4 py-3 dark:border-violet-900/50 dark:bg-violet-950/30">
                    <div className="flex items-start gap-2">
                      <Crown className="w-5 h-5 shrink-0 text-violet-600 dark:text-violet-400 mt-0.5" />
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-foreground">
                          {activeMembershipPackageRow.name}
                          {activeMembershipForSelectedVehicle.id === "virtual-new-sub" && " (Activating on this visit)"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {membershipTierLabel(activeMembershipPackageRow.tier)} · valid until{" "}
                          {new Date(activeMembershipForSelectedVehicle.endDate).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {membershipLookupVehicleId || selectedVehicleId ? (
                          <p className="text-[11px] text-muted-foreground pt-0.5">
                            Pass applies to this vehicle (
                            {ownedVehicles.find(
                              (v) => v.id === (membershipLookupVehicleId ?? selectedVehicleId)
                            )?.registrationNumber ?? vehicleNumber}
                            ).
                          </p>
                        ) : !activeMembershipForSelectedVehicle.vehicleId ? (
                          <p className="text-[11px] text-muted-foreground pt-0.5">
                            Customer-wide pass — included services bill at ₹0 when you choose Yes.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Use membership on this visit?</p>
                    <p className="text-xs text-muted-foreground">
                      Yes — included services bill at ₹0; you can add paid add-ons next. No — continue with normal
                      service selection and pricing.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={membershipVisitChoice === "yes" ? "default" : "outline"}
                        className={membershipVisitChoice === "yes" ? "bg-violet-600 hover:bg-violet-700" : ""}
                        onClick={() => {
                          preMembershipMainIdsRef.current = selectedMainIds;
                          setMembershipVisitChoice("yes");
                          setSelectedHighEndIds([]);
                          setMembershipRedeemServiceIds([]);
                          setMembershipServicesDialogOpen(true);
                        }}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={membershipVisitChoice === "no" ? "default" : "outline"}
                        onClick={() => {
                          setMembershipVisitChoice("no");
                          setMembershipRedeemServiceIds([]);
                        }}
                      >
                        No
                      </Button>
                    </div>
                  </div>

                  {membershipVisitChoice === "yes" ? (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 border-violet-200/80"
                        onClick={() => setMembershipServicesDialogOpen(true)}
                      >
                        <ListChecks className="h-4 w-4" />
                        Included services ({membershipRedeemServiceIds.length} selected)
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        Services with 0 remaining usage cannot be selected this period.
                      </p>
                    </div>
                  ) : null}

                  {activeMembershipForSelectedVehicle.usageHistory && activeMembershipForSelectedVehicle.usageHistory.length > 0 ? (
                    <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground mb-2">Membership usage history</p>
                      <ul className="max-h-36 space-y-1.5 overflow-y-auto text-[11px] text-muted-foreground">
                        {[...activeMembershipForSelectedVehicle.usageHistory]
                          .sort(
                            (a: MembershipServiceUsage, b: MembershipServiceUsage) =>
                              new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()
                          )
                          .map((u: MembershipServiceUsage, idx: number) => (
                            <li key={`${u.usedAt}-${u.serviceCatalogId}-${idx}`} className="flex justify-between gap-2">
                              <span className="min-w-0 truncate">
                                {u.serviceName ??
                                  serviceCatalog.find((c) => c.id === u.serviceCatalogId)?.name ??
                                  u.serviceCatalogId}
                                {(u.quantity ?? 1) > 1 ? ` ×${u.quantity ?? 1}` : ""}
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {new Date(u.usedAt).toLocaleString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* If virtual membership (buying right now), also show the packages list underneath so they can change/clear it! */}
                  {activeMembershipForSelectedVehicle.id === "virtual-new-sub" && (
                    <div className="space-y-4 pt-4 border-t border-dashed">
                      <p className="text-sm font-semibold text-foreground">Select a different plan or tap to clear</p>
                      <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {eligibleActiveMembershipPackages.map((pkg) => {
                          const selected = wizardMembershipPackageId === pkg.id;
                          const durationLabel = membershipTierDurationLabel(pkg.tier);
                          return (
                            <button
                              key={pkg.id}
                              type="button"
                              onClick={() => {
                                setWizardMembershipPackageId(selected ? null : pkg.id);
                                // Clear choice if plan is cleared
                                if (selected) {
                                  setMembershipVisitChoice(null);
                                  setMembershipRedeemServiceIds([]);
                                }
                              }}
                              className={cn(
                                "flex min-h-[148px] min-w-0 flex-col rounded-2xl border-2 bg-card p-4 text-left shadow-sm transition-all",
                                selected
                                  ? "border-violet-600 bg-violet-50/5 dark:border-violet-500 dark:bg-violet-950/10"
                                  : "border-border hover:border-violet-600/30"
                              )}
                            >
                              <div className="flex flex-1 flex-col justify-between">
                                <div>
                                  <p className="font-bold text-foreground text-sm leading-snug line-clamp-1">{pkg.name}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {membershipTierLabel(pkg.tier)} · {durationLabel}
                                  </p>
                                  <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 mt-2">
                                    {formatCurrency(pkg.price)}
                                  </p>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-3 line-clamp-2">
                                  {pkg.includedServiceIds.length} service(s) included.
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : existingCustomerId &&
                !membershipLookupVehicleId &&
                ownedVehicles.length > 0 &&
                !activeMembershipForSelectedVehicle ? (
                <p className="text-sm text-muted-foreground">
                  Pick this customer&apos;s vehicle from the garage in the previous step, or enter a registration
                  that matches a saved vehicle, to see an existing pass. You can still activate a new plan below.
                </p>
              ) : activeMembershipPackages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center">
                  No active packages in the catalog.{" "}
                  <Link href="/membership" className="text-primary font-medium hover:underline">
                    Add packages in Membership
                  </Link>
                </p>
              ) : eligibleActiveMembershipPackages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center">
                  No memberships available for this vehicle type.
                </p>
              ) : (
                <>
                  <div className="rounded-lg border border-violet-200/70 bg-violet-50/50 px-3 py-2.5 text-xs text-muted-foreground dark:border-violet-900/45 dark:bg-violet-950/25">
                    <span className="font-medium text-foreground">No active pass for this vehicle.</span> When a pass
                    exists, you&apos;ll see <strong className="text-foreground">Yes / No</strong> here, included
                    services in a popup, and history. Otherwise activate a new plan below (linked to this job&apos;s
                    vehicle).
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Optional: activate a plan when the job is created, or handle it later in{" "}
                    <Link href="/membership" className="text-primary font-medium hover:underline">
                      Membership
                    </Link>
                    . Tap a selected plan again to clear.
                  </p>
                  <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {eligibleActiveMembershipPackages.map((pkg) => {
                      const selected = wizardMembershipPackageId === pkg.id;
                      const durationLabel = membershipTierDurationLabel(pkg.tier);
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setWizardMembershipPackageId(selected ? null : pkg.id)}
                          className={cn(
                            "flex min-h-[148px] min-w-0 flex-col rounded-2xl border-2 bg-card p-4 text-left shadow-sm transition-all",
                            selected
                              ? "border-primary bg-primary/5 ring-2 ring-primary/25 shadow-md"
                              : "border-border hover:border-primary/40 hover:shadow-md"
                          )}
                        >
                          <p className="text-sm font-semibold leading-snug line-clamp-3">{pkg.name}</p>
                          <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
                            <span className="font-medium text-foreground/80">
                              {membershipTierLabel(pkg.tier)}
                            </span>
                            <span className="text-muted-foreground/80"> · {durationLabel}</span>
                          </p>
                          <div className="mt-auto flex items-end justify-between gap-2 border-t border-border/60 pt-3">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Plan price
                            </span>
                            <span className="text-base font-bold tabular-nums text-primary">
                              {formatCurrency(pkg.price)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={membershipServicesDialogOpen}
            onOpenChange={(open) => {
              if (!open) guardBookingShellFromNestedClose();
              if (open) setMembershipRedeemSearch("");
              setMembershipServicesDialogOpen(open);
            }}
          >
            <DialogContent className="max-h-[min(90vh,520px)] flex flex-col sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Included services</DialogTitle>
                <DialogDescription>
                  Select which included services to redeem on this visit. Used services are disabled. Bill amount for
                  these lines will be ₹0; add-ons are charged separately.
                </DialogDescription>
              </DialogHeader>
              {activeMembershipForSelectedVehicle && activeMembershipPackageRow ? (
                <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-2">
                  <ServiceSearchInput
                    value={membershipRedeemSearch}
                    onChange={setMembershipRedeemSearch}
                  />
                  {activeMembershipPackageRow.includedServiceIds
                    .filter((sid) => {
                      const q = membershipRedeemSearch.trim().toLowerCase();
                      if (!q) return true;
                      const cat = serviceCatalog.find((c) => c.id === sid);
                      const name = (cat?.name ?? sid).toLowerCase();
                      const category = (cat?.category ?? "").toLowerCase();
                      return name.includes(q) || category.includes(q);
                    })
                    .map((sid) => {
                    const cat = serviceCatalog.find((c) => c.id === sid);
                    const included = Math.max(
                      1,
                      activeMembershipPackageRow.includedServiceQuantities?.[sid] ?? 1
                    );
                    const used = getUsedIncludedServiceCount(activeMembershipForSelectedVehicle, sid);
                    const remaining = getRemainingIncludedServiceCount(
                      activeMembershipForSelectedVehicle,
                      activeMembershipPackageRow,
                      sid
                    );
                    const exhausted = remaining <= 0;
                    const checked = membershipRedeemServiceIds.includes(sid);
                    const selectedNow = checked ? 1 : 0;
                    const remainingAfterThisVisit = Math.max(0, remaining - selectedNow);
                    return (
                      <label
                        key={sid}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
                          exhausted
                            ? "border-border/50 bg-muted/40 opacity-60 cursor-not-allowed"
                            : "border-border bg-card"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={exhausted}
                          onCheckedChange={(v) => {
                            if (exhausted) return;
                            const on = v === true;
                            setMembershipRedeemServiceIds((prev) =>
                              on
                                ? (prev.includes(sid) ? prev : [...prev, sid])
                                : prev.filter((x) => x !== sid)
                            );
                            setSelectedMainIds((prev) => {
                              if (on) return prev.includes(sid) ? prev : [...prev, sid];
                              if (preMembershipMainIdsRef.current.includes(sid)) return prev;
                              return prev.filter((x) => x !== sid);
                            });
                          }}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="font-medium block">{cat?.name ?? sid}</span>
                          <span className="text-[11px] text-muted-foreground">{cat?.category}</span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            Included: {included} · Used (completed visits): {used} · Selected now: {selectedNow} · Remaining after this visit: {remainingAfterThisVisit}
                          </span>
                          {exhausted ? (
                            <span className="block text-[11px] text-amber-700 dark:text-amber-300">
                              No remaining uses
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setMembershipServicesDialogOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
          )}

          {showJobWizardStep("serviceSelection") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Service Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border-2 border-sky-200 bg-sky-50/60 p-4 dark:border-sky-800 dark:bg-sky-950/25">
                <div className="flex items-start gap-2">
                  <Car className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">Vehicle Type (for pricing)</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Select the vehicle type to see applicable prices
                    </p>
                  </div>
                </div>
                {vehicleBrand.trim() && vehicleSegment && (
                  <p className="mt-3 text-xs text-muted-foreground rounded-md border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                    <span className="font-medium text-emerald-900 dark:text-emerald-100">From vehicle: </span>
                    {vehicleBrand} {vehicleModel || ""} —{" "}
                    <span className="capitalize">{segmentBannerLabel(vehicleSegment)}</span>
                    {OTHER_PRICING_SEGMENTS.some((o) => o.segment === vehicleSegment) ? (
                      <span className="text-muted-foreground"> (use buttons below to match)</span>
                    ) : null}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SERVICE_TYPE_PRIMARY.map(({ segment, label, hint, icon }) => {
                    const selected = vehicleSegment === segment;
                    return (
                      <button
                        key={segment}
                        type="button"
                        onClick={() => setVehicleSegment(segment)}
                        className={cn(
                          "rounded-xl border-2 bg-card p-3 text-left transition-all",
                          selected
                            ? "border-sky-600 bg-white shadow-md ring-1 ring-sky-600/20 dark:bg-card"
                            : "border-border hover:border-sky-300/80 hover:bg-sky-50/50 dark:hover:bg-sky-950/40"
                        )}
                      >
                        <span className="text-2xl leading-none" aria-hidden>
                          {icon}
                        </span>
                        <p className="mt-2 text-sm font-semibold">{label}</p>
                        <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p>
                      </button>
                    );
                  })}
                </div>
                <details className="mt-4 group">
                  <summary className="cursor-pointer list-none text-sm font-medium text-primary flex items-center gap-1 [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    More vehicle types (Luxury, MUV, Compact SUV)
                  </summary>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 border-t border-sky-200/80 pt-3 dark:border-sky-800">
                    {OTHER_PRICING_SEGMENTS.map(({ segment, label, hint }) => (
                      <button
                        key={segment}
                        type="button"
                        onClick={() => setVehicleSegment(segment)}
                        className={cn(
                          "rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-colors",
                          vehicleSegment === segment
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/60"
                        )}
                      >
                        <span className="font-medium">{label}</span>
                        <span className="block text-[10px] text-muted-foreground">{hint}</span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={selectedMainIds.length > 0 ? "default" : "secondary"}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold tabular-nums",
                    selectedMainIds.length > 0 &&
                      "bg-sky-600 text-white hover:bg-sky-600 dark:bg-sky-600"
                  )}
                >
                  {selectedMainIds.length}{" "}
                  {selectedMainIds.length === 1 ? "service" : "services"} selected
                </Badge>
              </div>

              <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Select Service(s)</p>
                  <p className="text-sm text-muted-foreground">
                    You can select multiple services for a single booking
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-border bg-background"
                  onClick={() => setAddServicePackageOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Service
                </Button>
                <AddServicePackageDialog
                  open={addServicePackageOpen}
                  onOpenChange={setAddServicePackageOpen}
                  onCreated={(item) => {
                    setSelectedMainIds((prev) =>
                      prev.includes(item.id) ? prev : [...prev, item.id]
                    );
                    setCategoryFilter("ALL");
                    setServiceSearch("");
                  }}
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative sm:flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={serviceSearchInputRef}
                    id="create-booking-service-search"
                    className="pl-9 h-10"
                    placeholder="Search services..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="sm:w-[200px] h-10">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c === "ALL" ? "All Categories" : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!branchId ? (
                <>
                  <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm dark:border-sky-800 dark:bg-sky-950/20">
                    <Car className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
                    <p className="text-muted-foreground">
                      Showing <strong className="text-foreground">services</strong> for{" "}
                      <strong className="text-foreground">
                        {vehicleSegment ? segmentBannerLabel(vehicleSegment) : "—"}
                      </strong>
                    </p>
                  </div>
                  <div className="rounded-xl border-2 border-dashed border-sky-400/70 bg-sky-50/40 px-4 py-10 text-center dark:border-sky-600 dark:bg-sky-950/20">
                    <p className="text-base font-semibold text-sky-800 dark:text-sky-100">
                      Please FIRST SELECT A BRANCH to see available services
                    </p>
                    <button
                      type="button"
                      className="mt-3 text-sm font-medium text-sky-700 underline underline-offset-4 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
                      onClick={() => {
                        for (const id of [
                          "booking-branch-select-block-mobile",
                          "booking-branch-select-block",
                        ] as const) {
                          const el = document.getElementById(id);
                          if (el && el.offsetParent !== null) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            return;
                          }
                        }
                      }}
                    >
                      Select branch from the summary panel or global header
                    </button>
                  </div>
                </>
              ) : !vehicleSegment ? (
                <p className="text-sm text-amber-600 py-4 text-center rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
                  Select a vehicle type above to see priced services.
                </p>
              ) : (
                <>
                  <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm dark:border-sky-800 dark:bg-sky-950/20">
                    <Car className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
                    <p>
                      Showing <strong>services</strong> for{" "}
                      <strong className="capitalize">{segmentBannerLabel(vehicleSegment)}</strong> (
                      {filteredMainServices.length} of {activeCatalogTotal})
                    </p>
                  </div>
                  {filteredMainServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No services match filters.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {filteredMainServices.map((s) => {
                        const catalogPrice = catalogPriceForSegment(s, vehicleSegment);
                        const custom = customPriceByServiceId[s.id];
                        const on = selectedMainIds.includes(s.id);
                        const isMembershipZero =
                          on && membershipMainServiceZeroIds.has(s.id);
                        const pr = isMembershipZero
                          ? 0
                          : custom != null
                            ? custom
                            : catalogPrice;
                        return (
                          <div
                            key={s.id}
                            className={cn(
                              "rounded-xl border-2 p-3 text-left transition-all flex flex-col min-h-0",
                              on
                                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/15"
                                : "border-border bg-card hover:border-primary/25"
                            )}
                          >
                            <button
                              type="button"
                              className="text-left w-full"
                              onClick={() => toggleMain(s.id)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-sm leading-tight flex-1">{s.name}</p>
                                {on && (
                                  <Badge className="shrink-0 bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                                    <Check className="h-3 w-3 mr-0.5" />
                                    Selected
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <p className="text-base font-bold text-emerald-600 tabular-nums">
                                  {formatCurrency(pr)}
                                </p>
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                                  <Clock className="w-3 h-3" />
                                  {formatServiceDurationLabel(s)}
                                </div>
                              </div>
                            </button>
                            {on && !isMembershipZero && (
                              <div
                                className="mt-2 border-t border-border/60 pt-2"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <ServiceCustomPriceControl
                                  dense
                                  catalogPrice={catalogPrice}
                                  customPrice={custom ?? null}
                                  onChange={(next) => setCustomPrice(s.id, next)}
                                />
                              </div>
                            )}
                            {on && isMembershipZero && (
                              <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                                Membership benefit — billed at ₹0
                              </p>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant={on ? "default" : "outline"}
                              className="mt-2.5 h-8 w-full text-xs"
                              onClick={() => toggleMain(s.id)}
                            >
                              {on ? "Selected" : "Select"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          )}

          {isJobCard && showJobWizardStep("partsSelection") && (
          <PartsSelectionStep
            useBookingWizard={useBookingWizard}
            selectedPartLines={selectedPartLines}
            onSelectedLinesChange={setSelectedPartLines}
          />
          )}

          {highEndServices.length > 0 && showJobWizardStep("highEndServices") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  High-End Services
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">Optional.</span> Tag premium programs for maintenance
                  reminders. Configured amounts (excl. GST) add to the job estimate on the right; you can skip this step
                  and continue with main services and/or add-ons only.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ServiceSearchInput
                  value={highEndSearch}
                  onChange={setHighEndSearch}
                  placeholder="Search high-end services..."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredHighEndServices.length === 0 ? (
                    <p className="col-span-full text-sm text-muted-foreground py-6 text-center">
                      No high-end services match.
                    </p>
                  ) : (
                  filteredHighEndServices.map((hes) => {
                    const isSelected = selectedHighEndIds.includes(hes.id);
                    const comparisonTag = highEndComparisonTag(hes.name);
                    return (
                      <div
                        key={hes.id}
                        className={cn(
                          "rounded-lg border text-left transition-all",
                          isSelected
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-500"
                            : "border-border hover:border-amber-300 hover:bg-muted/50"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedHighEndIds((prev) =>
                              isSelected ? prev.filter((id) => id !== hes.id) : [...prev, hes.id]
                            )
                          }
                          className="flex items-start gap-2.5 p-3 w-full text-left"
                        >
                          <Sparkles
                            className={cn(
                              "w-4 h-4 mt-0.5 shrink-0",
                              isSelected ? "text-amber-500" : "text-muted-foreground"
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p
                                className={cn(
                                  "text-sm font-medium",
                                  isSelected ? "text-amber-700 dark:text-amber-400" : ""
                                )}
                              >
                                {hes.name}
                              </p>
                              {comparisonTag && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] font-medium border-amber-300/80 text-amber-800 dark:text-amber-300"
                                >
                                  {comparisonTag}
                                </Badge>
                              )}
                              {isSelected && (
                                <Badge className="text-[9px] bg-amber-500 text-white px-1.5 py-0">
                                  <Check className="h-2.5 w-2.5 mr-0.5" />
                                  Selected
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Schedule:{" "}
                              {hes.reminderIntervals.map((m) => formatHighEndIntervalMonths(m)).join(", ")}
                            </p>
                            <p className="text-[10px] font-medium text-amber-800 dark:text-amber-300 mt-0.5 tabular-nums">
                              +{formatCurrency(highEndPriceForSegment(hes, vehicleSegment || undefined))} est. (excl. GST)
                            </p>
                          </div>
                        </button>
                        {isSelected && (
                          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-amber-200/60 dark:border-amber-900/40">
                            {hes.reminderIntervals.length > 0 && (
                              <div className="space-y-1.5">
                                <Label htmlFor={`hes-next-${hes.id}`} className="text-xs text-muted-foreground">
                                  Next follow-up
                                </Label>
                                {(() => {
                                  const monthsVal =
                                    highEndFirstFollowUpById[hes.id] ?? hes.reminderIntervals[0];
                                  const followSelectValue = hes.reminderIntervals.includes(monthsVal)
                                    ? String(monthsVal)
                                    : "__custom__";
                                  return (
                                    <>
                                      <Select
                                        value={followSelectValue}
                                        onValueChange={(v) => {
                                          if (v === "__custom__") {
                                            const next =
                                              hes.reminderIntervals.includes(monthsVal)
                                                ? defaultManualFirstFollowUpMonths(hes.reminderIntervals)
                                                : monthsVal;
                                            setHighEndFirstFollowUpById((prev) => ({
                                              ...prev,
                                              [hes.id]: next,
                                            }));
                                          } else {
                                            const months = Number.parseInt(v, 10);
                                            setHighEndFirstFollowUpById((prev) => ({
                                              ...prev,
                                              [hes.id]: months,
                                            }));
                                          }
                                        }}
                                      >
                                        <SelectTrigger
                                          id={`hes-next-${hes.id}`}
                                          className="h-9 text-xs bg-background"
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {hes.reminderIntervals.map((m) => (
                                            <SelectItem key={m} value={String(m)}>
                                              {formatHighEndIntervalMonths(m)} ({m} mo)
                                            </SelectItem>
                                          ))}
                                          <SelectItem value="__custom__">Custom (enter months)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {followSelectValue === "__custom__" && (
                                        <div className="space-y-1">
                                          <Label
                                            htmlFor={`hes-next-custom-${hes.id}`}
                                            className="text-[10px] text-muted-foreground"
                                          >
                                            Months until first reminder
                                          </Label>
                                          <Input
                                            id={`hes-next-custom-${hes.id}`}
                                            type="number"
                                            min={1}
                                            max={120}
                                            className="h-9 text-xs"
                                            value={monthsVal === 0 ? "" : String(monthsVal)}
                                            onChange={(e) => {
                                              const raw = e.target.value;
                                              if (raw === "") return;
                                              const n = Math.min(
                                                120,
                                                Math.max(1, Number.parseInt(raw, 10) || 0)
                                              );
                                              if (n < 1) return;
                                              setHighEndFirstFollowUpById((prev) => ({
                                                ...prev,
                                                [hes.id]: n,
                                              }));
                                            }}
                                          />
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <Label
                                htmlFor={`hes-compl-${hes.id}`}
                                className="text-xs text-muted-foreground flex items-center gap-1"
                              >
                                <Clock className="w-3 h-3 shrink-0" />
                                Time to complete (planned)
                              </Label>
                              {(() => {
                                const mins = highEndCompletionMinutesById[hes.id];
                                const completionSelectValue =
                                  mins === 0
                                    ? "__custom__"
                                    : mins != null && mins > 0
                                      ? highEndCompletionSelectValue(mins)
                                      : "__unset__";
                                return (
                                  <>
                                    <Select
                                      value={completionSelectValue}
                                      onValueChange={(v) => {
                                        if (v === "__unset__") {
                                          setHighEndCompletionMinutesById((p) => {
                                            const next = { ...p };
                                            delete next[hes.id];
                                            return next;
                                          });
                                          return;
                                        }
                                        if (v === "__custom__") {
                                          const cur = highEndCompletionMinutesById[hes.id];
                                          const nonPreset =
                                            cur != null &&
                                            cur > 0 &&
                                            !HIGH_END_COMPLETION_PRESETS.some(
                                              (x) => x.minutes === Math.round(cur)
                                            );
                                          setHighEndCompletionMinutesById((p) => ({
                                            ...p,
                                            [hes.id]: nonPreset ? Math.round(cur!) : 0,
                                          }));
                                          return;
                                        }
                                        const minutes = Number.parseInt(v, 10);
                                        setHighEndCompletionMinutesById((p) => ({
                                          ...p,
                                          [hes.id]: minutes,
                                        }));
                                      }}
                                    >
                                      <SelectTrigger
                                        id={`hes-compl-${hes.id}`}
                                        className="h-9 text-xs bg-background"
                                      >
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
                                        <Label
                                          htmlFor={`hes-compl-hr-${hes.id}`}
                                          className="text-[10px] text-muted-foreground"
                                        >
                                          Hours (custom)
                                        </Label>
                                        <Input
                                          id={`hes-compl-hr-${hes.id}`}
                                          type="number"
                                          min={0.5}
                                          max={720}
                                          step={0.5}
                                          inputMode="decimal"
                                          className="h-9 text-xs"
                                          value={
                                            mins != null && mins > 0
                                              ? String(Math.round((mins / 60) * 100) / 100)
                                              : ""
                                          }
                                          onChange={(e) => {
                                            const raw = e.target.value;
                                            if (raw === "") {
                                              setHighEndCompletionMinutesById((p) => {
                                                const next = { ...p };
                                                next[hes.id] = 0;
                                                return next;
                                              });
                                              return;
                                            }
                                            const h = Number.parseFloat(raw.replace(",", "."));
                                            if (!Number.isFinite(h) || h <= 0) return;
                                            const capMin = Math.min(43200, Math.round(h * 60));
                                            setHighEndCompletionMinutesById((p) => ({
                                              ...p,
                                              [hes.id]: capMin,
                                            }));
                                          }}
                                        />
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                              <p className="text-[10px] text-muted-foreground leading-snug">
                                Plan turnaround time.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                  )}
                </div>
                {selectedHighEndIds.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {selectedHighEndIds.length} high-end service{selectedHighEndIds.length !== 1 ? "s" : ""}{" "}
                    selected — reminders are created when the job is delivered.
                  </p>
                )}
                {isJobCard && selectedHighEndIds.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3 max-w-md">
                    <Label className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      Expected delivery <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When should the vehicle be ready for the customer? This is mandatory for high-end services.
                    </p>
                    {suggestedJobCardExpectedDelivery && (
                      <p className="text-xs text-muted-foreground/90">
                        Suggested:{" "}
                        <span className="font-semibold text-foreground">
                          {formatExpectedDeliveryDate(suggestedJobCardExpectedDelivery)}
                        </span>
                      </p>
                    )}
                    <div className="relative">
                      <Input
                        id="expected-delivery-when-highend"
                        type="datetime-local"
                        min={localDatetimeLocalInputMin()}
                        value={bookingWhen}
                        onChange={(e) => {
                          setHasManuallySetExpectedDelivery(true);
                          const v = e.target.value;
                          if (!v) {
                            setBookingWhen("");
                            return;
                          }
                          if (!isDatetimeLocalInPast(v)) {
                            setBookingWhen(v);
                          } else {
                            setBookingWhen(localDatetimeLocalInputMin());
                          }
                        }}
                        required
                        className="h-10 pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:bottom-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                      />
                      <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    {isExpectedDeliveryTooEarly && suggestedJobCardExpectedDelivery && (
                      <p className="text-xs text-destructive font-semibold mt-1">
                        Expected delivery cannot be earlier than the planned completion time (
                        {formatExpectedDeliveryDate(suggestedJobCardExpectedDelivery)}).
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {showJobWizardStep("addons") && (
          <Card ref={addonsCardRef}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">Select Add-ons (Optional)</CardTitle>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-primary"
                  onClick={() => setShowAddons(!showAddons)}
                >
                  {showAddons ? "Hide" : "Show"}
                  {showAddons ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border bg-background"
                onClick={() => {
                  setShowAddons(true);
                  setAddonDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Add-on
              </Button>
              <AddAddonDialog
                open={addonDialogOpen}
                onOpenChange={setAddonDialogOpen}
                onCreated={(item) => {
                  setSelectedAddonIds((prev) =>
                    prev.includes(item.id) ? prev : [...prev, item.id]
                  );
                  window.setTimeout(() => {
                    addonsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 50);
                }}
              />
            </CardHeader>
            {showAddons && (
              <CardContent className="space-y-2">
                <ServiceSearchInput
                  value={addonSearch}
                  onChange={setAddonSearch}
                  placeholder="Search add-ons..."
                />
                {filteredAddonServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No add-ons match.</p>
                ) : (
                filteredAddonServices.map((s) => {
                  const catalogPrice = vehicleSegment
                    ? catalogPriceForSegment(s, vehicleSegment)
                    : s.defaultPrice;
                  const custom = customPriceByServiceId[s.id];
                  const pr = custom != null ? custom : catalogPrice;
                  const on = selectedAddonIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox checked={on} onCheckedChange={() => toggleAddon(s.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Duration: {formatServiceDurationLabel(s)} · + {formatCurrency(pr)}
                          </p>
                        </div>
                      </label>
                      {on && (
                        <ServiceCustomPriceControl
                          dense
                          catalogPrice={catalogPrice}
                          customPrice={custom ?? null}
                          onChange={(next) => setCustomPrice(s.id, next)}
                        />
                      )}
                    </div>
                  );
                })
                )}
              </CardContent>
            )}
          </Card>
          )}

          {showJobWizardStep("mechanic") && (
          <Card className="min-w-0 border-border/90">
            <CardHeader className="space-y-0 py-3 pb-2">
              <CardTitle className="text-base">Assign mechanic</CardTitle>
              <p className="text-xs text-muted-foreground font-normal pt-1">
                Optional · tap to assign · incentive defaults to {catalogAvgIncentivePercent.toFixed(1)}%
              </p>
            </CardHeader>
            <CardContent className="space-y-3 min-w-0 pt-0">
              {isJobCard && (
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
                  <Label htmlFor="odometerReading" className="text-xs font-medium shrink-0">
                    Odometer (optional)
                  </Label>
                  <Input
                    id="odometerReading"
                    type="number"
                    placeholder="e.g. 25000"
                    value={odometerReading}
                    onChange={(e) => setOdometerReading(e.target.value)}
                    className="h-8 max-w-full sm:max-w-[10rem] text-sm"
                  />
                </div>
              )}
              {mechanics.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-4 text-center">
                  No mechanics found. Add staff with role Mechanic in Settings.
                </p>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-9 h-9"
                      placeholder="Search mechanic…"
                      value={mechanicSearch}
                      onChange={(e) => setMechanicSearch(e.target.value)}
                    />
                  </div>
                  {filteredMechanics.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No mechanics match your search.</p>
                  ) : (
                <div className="max-h-[min(52dvh,420px)] space-y-2 overflow-y-auto overscroll-y-contain rounded-lg border border-border/40 bg-muted/10 py-2 pl-1 pr-2 [-webkit-overflow-scrolling:touch] md:max-h-[min(58dvh,560px)] lg:max-h-[min(62dvh,640px)]">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 min-w-0">
                    {filteredMechanics.map((m) => {
                      const selected = mechanicId === m.id;
                      const availability = mechanicAvailabilityLabel(m.id, m.isActive, jobCards);
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "rounded-xl border-2 bg-card p-3 transition-all min-w-0",
                            selected
                              ? "border-primary ring-1 ring-primary/20"
                              : "border-border hover:border-primary/35"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setMechanicId(m.id)}
                            className="flex w-full items-center gap-2.5 text-left"
                          >
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Wrench className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold leading-snug truncate">{m.name}</p>
                              <Badge className={cn("mt-0.5 text-[9px] font-normal px-1.5 py-0", availability.className)}>
                                {availability.label}
                              </Badge>
                            </div>
                            {selected ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                            ) : null}
                          </button>
                          {selected ? (
                            <div className="mt-2.5 flex items-center gap-2 border-t border-border/70 pt-2.5">
                              <Label
                                htmlFor={`mechanic-incentive-${m.id}`}
                                className="sr-only"
                              >
                                Custom incentive percent
                              </Label>
                              <Percent className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                              <Input
                                id={`mechanic-incentive-${m.id}`}
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                inputMode="decimal"
                                placeholder={`Incentive % (default ${catalogAvgIncentivePercent.toFixed(1)})`}
                                className="h-8 flex-1 text-xs"
                                value={mechanicIncentivePercentOverride}
                                onChange={(e) => setMechanicIncentivePercentOverride(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {mechanicId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={() => setMechanicId("")}
                    >
                      Clear selection
                    </Button>
                  ) : null}
                </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          )}

          {showJobWizardStep("notes") && (
          <NotesStep
            internalNotes={internalNotes}
            customerNotes={customerNotes}
            onInternalNotesChange={setInternalNotes}
            onCustomerNotesChange={setCustomerNotes}
            onAppendQuickInternalNote={appendQuickInternalNote}
            onAppendQuickCustomerNote={appendQuickCustomerNote}
          />
          )}

          {isJobCard && showJobWizardStep("jobDetails") && (
            <JobDetailsStep
              reportedIssues={reportedIssues}
              termsAndConditions={termsAndConditions}
              onReportedIssuesChange={setReportedIssues}
              onTermsAndConditionsChange={setTermsAndConditions}
            />
          )}

          {useBookingWizard && showJobWizardStep("jobSummary") && renderWizardReviewSections()}
        </div>

        {useBookingWizard && (
          <div
            className={cn(
              "hidden shrink-0 flex-nowrap items-center justify-between gap-3 border-t border-border md:flex w-full",
              compactJobCardDesktop ? "pt-2 pb-0.5" : "pt-2.5 pb-0.5"
            )}
          >
            {/* Left: Back button + Summary */}
            <div className="flex items-center gap-3 shrink-0 min-w-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={jobCreateStep === 0}
                onClick={goBackJobWizard}
              >
                Back
              </Button>
              {wizardSelectionSummary && (
                <p className="text-xs text-muted-foreground truncate hidden lg:block">{wizardSelectionSummary}</p>
              )}
            </div>

            {/* Middle: Instructional text (centered and flex-1) */}
            {jobCreateStep === jobWizardStepCount - 1 && (
              <span className="text-xs text-muted-foreground text-center truncate hidden lg:block flex-1 px-4">
                Review the summary, select branch, then create the {isJobCard ? "job card" : "booking"}.
              </span>
            )}

            {/* Right: Action buttons (Cancel / Create / Next) */}
            <div className="flex items-center gap-2 shrink-0">
              {wizardSelectionSummary && (
                <p className="text-xs text-muted-foreground truncate lg:hidden">{wizardSelectionSummary}</p>
              )}
              {jobCreateStep < jobWizardStepCount - 1 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={goNextJobWizard}
                  disabled={notesStepNextBlocked}
                  title={notesStepNextBlocked ? "Select an expected delivery date to continue" : undefined}
                >
                  Next
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={isJobCard ? "/job-cards" : "/bookings"}>Cancel</Link>
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={bookingWizardIncomplete || isCreatingBooking}
                    title={
                      bookingWizardIncomplete ? "Complete all wizard steps first" : undefined
                    }
                  >
                    {isCreatingBooking ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        {isJobCard ? "Creating job card..." : "Creating booking..."}
                      </>
                    ) : (
                      isJobCard ? "Create job card" : "Create booking"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {useBookingWizard && jobWizardStepId === "jobSummary" && (
          <div className="mt-4 w-full shrink-0 pb-2 lg:hidden">
            {renderSummaryCard("booking-branch-select-block-mobile")}
          </div>
        )}

        </div>

        <aside
          className={cn(
            "mt-4 w-full shrink-0 sm:mt-6 lg:mt-0 lg:min-h-0 lg:w-[min(100%,460px)] lg:shrink-0 lg:ml-auto lg:pr-1",
            useBookingWizard &&
              cn(
                "hidden lg:flex lg:flex-col lg:overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5",
                compactJobCardDesktop
                  ? "lg:h-full lg:self-stretch"
                  : "lg:sticky lg:top-4 lg:z-20 lg:self-start"
              )
          )}
        >
          {renderSummaryCard("booking-branch-select-block")}
        </aside>

        {/* Mobile sticky actions */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-background px-3 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex max-w-lg flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {summaryAdvanceAmount > 0 ? "Balance due" : "Total"}
                  </p>
                  <p className="text-base font-bold text-primary tabular-nums leading-tight sm:text-lg">
                    {formatCurrency(balanceAfterAdvance)}
                  </p>
                  {wizardSelectionSummary && (
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 truncate">
                      {wizardSelectionSummary}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {jobCreateStep > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={goBackJobWizard}
                    >
                      Back
                    </Button>
                  )}
                  {jobCreateStep < jobWizardStepCount - 1 ? (
                    <Button
                      type="button"
                      className="min-w-[5rem] font-semibold shadow-sm"
                      onClick={goNextJobWizard}
                      disabled={notesStepNextBlocked}
                      title={notesStepNextBlocked ? "Select an expected delivery date to continue" : undefined}
                    >
                      Next
                    </Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" size="sm" className="h-9" asChild>
                        <Link href={isJobCard ? "/job-cards" : "/bookings"}>Cancel</Link>
                      </Button>
                      <Button
                        type="submit"
                        className="min-w-[5rem] font-semibold shadow-sm"
                        disabled={bookingWizardIncomplete || isCreatingBooking}
                        title={
                          bookingWizardIncomplete ? "Complete all wizard steps first" : undefined
                        }
                      >
                        {isCreatingBooking ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            {isJobCard ? "Creating..." : "Creating..."}
                          </>
                        ) : (
                          isJobCard ? "Create Job Card" : "Create Booking"
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {jobCreateStep >= jobWizardStepCount - 1 && !branchLocked && !branchId && (
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Select branch in the summary above, then tap Create.
                </p>
              )}
            </div>
        </div>
      </form>
  );


  return (
    <>
      {isDesktopWide ? (
        <div className="flex h-[calc(100dvh-7rem)] max-h-[calc(100dvh-7rem)] flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">{bookingForm}</div>
        </div>
      ) : (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              if (skipJobCardListRedirectRef.current) {
                skipJobCardListRedirectRef.current = false;
                return;
              }
              if (skipBookingShellCloseRef.current) {
                skipBookingShellCloseRef.current = false;
                return;
              }
              router.push(bookingListHref);
            }
          }}
        >
          <DialogContent
            mobileVariant="fullscreen"
            showMobileHandle={false}
            className="flex h-[min(92vh,880px)] w-[min(100vw-1rem,1200px)] max-w-[min(100vw-1rem,1200px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
          >
            <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 pb-2.5 pt-3 text-left sm:space-y-1.5 sm:px-6 sm:pb-3 sm:pt-4">
              <DialogTitle className="pr-10 text-base leading-tight sm:pr-8 sm:text-xl">
                {desktopTitle}
              </DialogTitle>
              <div className="space-y-1.5 sm:hidden">
                <p className="text-xs font-medium text-foreground">
                  Step {jobCreateStep + 1} of {jobWizardStepCount} — {JOB_WIZARD_LABEL[jobWizardStepId]}
                </p>
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${wizardProgressPercent}%` }}
                      role="progressbar"
                      aria-valuenow={wizardProgressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground shrink-0">
                    {wizardProgressPercent}%
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[9px] text-muted-foreground leading-snug">
                  {wizardTrackerSteps.map((label, idx) => (
                    <span key={label} className="flex items-center gap-0.5">
                      {idx > 0 && <span aria-hidden>→</span>}
                      <span
                        className={cn(
                          idx === wizardTrackerIndex && "font-semibold text-primary",
                          idx < wizardTrackerIndex && "text-foreground/80"
                        )}
                      >
                        {label}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              <DialogDescription className="max-md:sr-only md:block md:text-sm text-muted-foreground">
                Tap Next to move through each section — one screen at a time on mobile.
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch]">
              {bookingForm}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={pricingService !== null}
        onOpenChange={(open) => {
          if (!open) {
            guardBookingShellFromNestedClose();
            setPricingService(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8">{pricingService?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Pricing for other vehicle types (base{isGstRegistered ? ", excl. GST" : ""})
          </p>
          <div className="rounded-md border divide-y">
            {pricingService &&
              (Object.entries(pricingService.segmentPricing) as [VehicleSegment, number][]).map(([seg, price]) => (
                <div key={seg} className="flex justify-between px-3 py-2 text-sm">
                  <span className="capitalize">{seg.replace(/_/g, " ").toLowerCase()}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(price)}</span>
                </div>
              ))}
          </div>
          {isGstRegistered ? (
            <p className="text-xs text-muted-foreground mt-2">
              + 18.00% GST applies on the booked segment price.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      {useBookingWizard && (
        <Dialog
          open={checkInOpen}
          onOpenChange={(open) => {
            if (!open) {
              // Suppress spurious close events while the camera dialog is open or
              // has just closed — on mobile, Radix can fire this for the underlying
              // dialog when the overlaid camera dialog interacts with the overlay.
              if (checkInCamBlocksDismissRef.current) return;
              guardBookingShellFromNestedClose();
              dismissCheckIn();
            }
          }}
        >
          <DialogContent
            className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0"
            showClose={false}
          >
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <DialogTitle className="text-xl">Vehicle Check-In</DialogTitle>
                  <DialogDescription className="mt-2 text-left">
                    Capture before photos to document the vehicle condition. You need at least one photo to
                    finish check-in and open the job card.
                  </DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 -mr-1"
                  aria-label="Close"
                  disabled={checkInSubmitting}
                  onClick={() => dismissCheckIn()}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {checkInJob && (
                <div className="mt-4 grid gap-1.5 text-sm rounded-lg bg-muted/50 p-3 border border-border/80">
                  <p>
                    <span className="text-muted-foreground">Job </span>
                    <span className="font-mono font-semibold">{checkInJob.jobNumber}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Customer </span>
                    <span className="font-medium">{checkInJob.customerName}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      {checkInJob.vehicleIdLabel === "VIN" ? "VIN" : "Reg. number"}{" "}
                    </span>
                    <span className="font-mono font-semibold tracking-wide">{checkInJob.vehicleRegLabel}</span>
                  </p>
                </div>
              )}
            </DialogHeader>

            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-3">
                <Label className="text-base">
                  Before photos <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Add at least one photo of the vehicle. You can upload multiple images.
                </p>
                <input
                  ref={checkInFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => handleCheckInFiles(e)}
                />
                {checkInPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {checkInPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.previewUrl} alt={photo.label} className="h-full w-full object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute right-1 top-1 h-6 w-6 opacity-90"
                          aria-label={`Remove ${photo.label}`}
                          onClick={() => removeCheckInPhoto(photo.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      // Block check-in dialog from closing while camera is open.
                      // Set synchronously (before state update) so the guard is in
                      // place before Radix processes the new dialog mount.
                      checkInCamBlocksDismissRef.current = true;
                      if (canUseLiveCameraPreview()) {
                        const promise = requestCameraStream();
                        void promise.catch(() => undefined);
                        setCheckInMultiCamStreamPromise(promise);
                      } else {
                        setCheckInMultiCamStreamPromise(null);
                      }
                      setCheckInMultiCamOpen(true);
                    }}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photos
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => checkInFileRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photos
                  </Button>
                </div>
                {checkInPhotoError && (
                  <p className="text-sm text-destructive rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                    Required: Please upload at least one before photo of the vehicle
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="check-in-damages">Initial damages (optional)</Label>
                <Textarea
                  id="check-in-damages"
                  placeholder="Note any minor damages observed…"
                  value={checkInDamages}
                  onChange={(e) => setCheckInDamages(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="check-in-notes">Check-in notes (optional)</Label>
                <Textarea
                  id="check-in-notes"
                  placeholder="Additional notes from check-in process…"
                  value={checkInNotesExtra}
                  onChange={(e) => setCheckInNotesExtra(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
              <Button type="button" variant="outline" disabled={checkInSubmitting} onClick={() => dismissCheckIn()}>
                Cancel
              </Button>
              <Button type="button" disabled={checkInSubmitting} onClick={() => void handleCheckInSubmit()}>
                Check In Vehicle
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <MultiPhotoCameraCapture
        open={checkInMultiCamOpen}
        onOpenChange={(open) => {
          setCheckInMultiCamOpen(open);
          if (!open) {
            setCheckInMultiCamStreamPromise(null);
            // Keep the block for one animation frame after the camera dialog closes.
            // This absorbs any lingering Radix pointer/focus events that could
            // otherwise trigger the check-in dialog's onOpenChange(false) on mobile.
            requestAnimationFrame(() => {
              checkInCamBlocksDismissRef.current = false;
            });
          }
        }}
        streamPromise={checkInMultiCamStreamPromise}
        title="Take Before Photos"
        onComplete={(files) => {
          appendCheckInFiles(files);
        }}
      />

      <CustomerCreditCheckDialog
        open={customerCreditDialogOpen && isJobCard}
        onOpenChange={(open) => {
          if (!open) guardBookingShellFromNestedClose();
          setCustomerCreditDialogOpen(open);
        }}
        onPrepareClose={guardBookingShellFromNestedClose}
        customerId={existingCustomerId}
        customerName={customerName}
      />
    </>
  );
}
